#!/usr/bin/env python3
"""Collect recent posts from EVERY account the configured X user follows → <run_dir>/x.json

How it works (no LLM involved):
 1. Open x.com with the persistent profile (see x_login.py) and verify the signed-in account.
 2. https://x.com/<user>/following — scroll and intercept the ``Following`` GraphQL responses to
    get the complete, current following list (user ids + handles) → x_following.json
 3. https://x.com/home → "Following" tab (reverse-chronological feed of exactly those accounts).
    Scroll while intercepting ``HomeLatestTimeline`` responses until posts older than the
    window appear. Promoted posts are dropped; posts are attributed to the original author,
    with ``retweetedBy`` when a followed account reposted them.
 4. Fallback ``--mode accounts``: visit each followed profile and intercept ``UserTweets``.
    Slower, used automatically when the timeline yields too little.

Exit codes: 0 ok, 1 nothing collected, 2 not logged in / wrong account (run scripts/x_login.py).
"""
from __future__ import annotations

import argparse
import re
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib import as_of, iso_kst, load_config, log, parse_iso, result_envelope, run_dir, save_json  # noqa: E402
from x_browser import (ResponseSink, dom_tweets, dump, extract_tweets, extract_users, launch,  # noqa: E402
                       logged_in_handle)


def scroll(page, px: int = 2500, pause_ms: int = 1500):
    page.mouse.move(640, 700)  # wheel events go to the element under the pointer
    page.mouse.wheel(0, px)
    page.wait_for_timeout(pause_ms)


def scroll_for_more(page, sink, timeout_ms: int = 12000) -> bool:
    """Jump to the bottom and wait until the infinite list fetches its next page."""
    before = len(sink.payloads)
    page.mouse.move(640, 700)
    deadline = timeout_ms
    while deadline > 0:
        page.evaluate("window.scrollTo(0, document.documentElement.scrollHeight)")
        page.mouse.wheel(0, 1200)
        page.wait_for_timeout(1000)
        deadline -= 1000
        if len(sink.payloads) > before:
            page.wait_for_timeout(600)  # let the response render so the next bottom is further down
            return True
        if deadline % 4000 == 0:  # nudge: scroll up a little and back, X sometimes needs it
            page.mouse.wheel(0, -1500)
            page.wait_for_timeout(400)
    return False


def profile_following_count(page, user: str) -> int | None:
    """'N Following' / 'N 팔로잉' link on the profile header (locale independent: parse the number)."""
    page.goto(f"https://x.com/{user}", wait_until="domcontentloaded")
    try:
        link = page.locator(f'a[href="/{user}/following" i]').first
        link.wait_for(timeout=15000)
        txt = link.inner_text().replace(",", "")
    except Exception:  # noqa: BLE001
        return None
    m = re.search(r"([\d.]+)\s*([KkMm천만]?)", txt)
    if not m:
        return None
    n = float(m.group(1))
    mult = {"k": 1e3, "K": 1e3, "m": 1e6, "M": 1e6, "천": 1e3, "만": 1e4}.get(m.group(2), 1)
    return int(round(n * mult))


def collect_following(page, user: str, max_scrolls: int, raw_dir: Path) -> dict:
    profile_count = profile_following_count(page, user)
    sink = ResponseSink(page, r"/graphql/[^/]+/Following\b|/graphql/[^/]+/UserByScreenName\b")
    page.goto(f"https://x.com/{user}/following", wait_until="domcontentloaded")
    page.wait_for_timeout(4000)
    expected = profile_count
    users: dict[str, dict] = {}
    idle = 0
    for i in range(max_scrolls):
        for u in extract_users(sink.payloads):
            if u["handle"].lower() == user.lower() and u.get("followingCount") is not None and expected is None:
                expected = u["followingCount"]
            elif u["handle"].lower() != user.lower():
                users[u["id"]] = u
        before = len(users)
        scroll(page, 3000, 1200)
        # detect end: no growth for several scrolls
        for u in extract_users(sink.payloads):
            if u["handle"].lower() != user.lower():
                users[u["id"]] = u
        if len(users) == before:
            idle += 1
            if idle >= 5 or (expected and len(users) >= expected):
                break
        else:
            idle = 0
        if i % 10 == 0:
            log(f"  following: {len(users)}/{expected or '?'} (scroll {i})")
    # DOM fallback (only adds handles, no ids)
    if not users:
        hrefs = page.evaluate("""() => Array.from(document.querySelectorAll('[data-testid="UserCell"] a[href^="/"]'))
                                 .map(a => a.getAttribute('href')).filter(h => /^\\/[A-Za-z0-9_]+$/.test(h))""")
        for h in sorted(set(hrefs)):
            handle = h.strip("/")
            if handle.lower() != user.lower():
                users[handle] = {"id": "", "handle": handle, "name": handle, "protected": False}
    dump(raw_dir / "following_responses.json", sink.payloads)
    lst = sorted(users.values(), key=lambda u: u["handle"].lower())
    if not lst:
        status = "failed"
    elif expected is None:
        status = "unverified"  # no friends_count seen → cannot prove completeness
    elif len(lst) >= expected:
        status = "complete"
    elif len(lst) >= expected * 0.97:
        status = "near_complete"  # X's count includes suspended/deactivated accounts
    else:
        status = "partial"
    # UserByScreenName bodies are sometimes evicted before we read them; the count comes from the
    # profile header anyway, so only Following-page errors matter
    errs = [e for e in sink.errors if not e.startswith("UserByScreenName") and "/UserByScreenName" not in e]
    return {"user": user, "expected": expected, "count": len(lst), "status": status, "accounts": lst,
            "errors": errs}


def collect_timeline(page, cutoff: datetime, max_scrolls: int, max_tweets: int, raw_dir: Path) -> tuple[list, dict]:
    # ONLY the chronological "Following" feed (HomeLatestTimeline). The algorithmic "For you"
    # feed (HomeTimeline) is mostly accounts the user does not follow, so it is never captured.
    sink = ResponseSink(page, r"/graphql/[^/]+/HomeLatestTimeline\b")
    page.goto("https://x.com/home", wait_until="domcontentloaded")
    page.wait_for_timeout(4000)
    # select the Following tab — UI language varies ("Following", "팔로잉", …); it is the 2nd tab
    try:
        tabs = page.locator('[data-testid="primaryColumn"] [role="tablist"] [role="tab"]')
        tabs.first.wait_for(timeout=15000)
        named = page.get_by_role("tab", name=re.compile(r"^(Following|팔로잉|フォロー中)$"))
        tab = named.first if named.count() else tabs.nth(1)
        if tab.get_attribute("aria-selected") != "true":
            tab.click()
        page.wait_for_timeout(3500)
    except Exception as e:  # noqa: BLE001
        log(f"  ⚠️ could not select the Following tab: {e}")
    if not sink.payloads:  # tab was already selected before the listener saw the first page → reload once
        page.reload(wait_until="domcontentloaded")
        page.wait_for_timeout(4000)
    older_batches = 0
    seen: dict[str, dict] = {}
    idle = 0
    processed = 0
    oldest_overall = None
    i = 0
    for i in range(max_scrolls):
        new_payloads = len(sink.payloads) - processed
        new_tweets = extract_tweets(sink.payloads, start=processed)
        processed = len(sink.payloads)
        fresh = [t for t in new_tweets if t["id"] not in seen]
        for t in new_tweets:
            seen[t["id"]] = t
        idle = 0 if fresh else idle + 1
        # cutoff is judged per batch on the *new* tweets only (an old quoted/pinned tweet cannot end the run)
        if fresh:
            batch_oldest = min((parse_iso(t.get("retweetedAt") or t["createdAt"] or "") for t in fresh
                                if (t.get("retweetedAt") or t["createdAt"])), default=None)
            if batch_oldest:
                oldest_overall = min(oldest_overall, batch_oldest) if oldest_overall else batch_oldest
                older_batches = older_batches + 1 if batch_oldest < cutoff else 0
        if older_batches >= 2 or len(seen) >= max_tweets or idle >= 4:
            break
        if not scroll_for_more(page, sink):
            idle += 1
        if i % 5 == 0:
            log(f"  timeline: {len(seen)} tweets, oldest={oldest_overall.isoformat() if oldest_overall else '?'} "
                f"(scroll {i}, {new_payloads} new responses)")
    dom_used = False
    if not seen and sink.count:  # responses arrived but nothing parsed → schema changed, fall back to DOM
        dom_used = True
        for t in dom_tweets(page):
            seen[t["id"]] = t
    dump(raw_dir / "timeline_responses.json", sink.payloads)
    meta = {"responses": sink.count, "scrolls": i + 1, "reached_cutoff": older_batches >= 2, "idle_stop": idle >= 4,
            "oldest": oldest_overall.isoformat() if oldest_overall else None, "dom_fallback": dom_used,
            "response_errors": sink.errors[:20]}
    return list(seen.values()), meta


def collect_accounts(page, handles: list[str], cutoff: datetime, raw_dir: Path, max_scrolls_per_account: int = 6) -> tuple[list, dict]:
    seen: dict[str, dict] = {}
    failed, empty, dom_used = [], [], []
    for n, h in enumerate(handles, 1):
        sink = ResponseSink(page, r"/graphql/[^/]+/UserTweets\b")
        try:
            page.goto(f"https://x.com/{h}", wait_until="domcontentloaded")
            page.wait_for_timeout(3500)
            got = []
            for _ in range(max_scrolls_per_account):  # scroll until the account's tweets pass the cutoff
                got = extract_tweets(sink.payloads)
                times = [parse_iso(t.get("retweetedAt") or t["createdAt"] or "") for t in got if t["handle"].lower() == h.lower() or t.get("retweetedBy")]
                if times and min(t for t in times if t) < cutoff:
                    break
                scroll(page, 2500, 1500)
            if not got:
                got = dom_tweets(page)
                if got:
                    dom_used.append(h)
            if not got:
                empty.append(h)
            if sink.errors:
                failed.append(f"{h}: {'; '.join(sink.errors[:2])}")
            for t in got:
                seen[t["id"]] = t
        except Exception as e:  # noqa: BLE001
            failed.append(f"{h}: {str(e)[:80]}")
        if n % 10 == 0:
            log(f"  accounts: {n}/{len(handles)} → {len(seen)} tweets")
        time.sleep(0.8)
    return list(seen.values()), {"visited": len(handles), "failed": failed, "empty": empty, "dom_fallback": dom_used}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--mode", choices=["timeline", "accounts"], default="timeline")
    ap.add_argument("--accounts", help="comma-separated handles (accounts mode only)")
    ap.add_argument("--headed", action="store_true")
    ap.add_argument("--skip-following", action="store_true")
    ap.add_argument("--allow-account-mismatch", action="store_true")
    args = ap.parse_args()

    cfg = load_config().get("x", {})
    user = cfg.get("user", "")
    window = int(cfg.get("window_hours", 48))
    cutoff = as_of() - timedelta(hours=window)
    max_tweets = int(cfg.get("max_tweets", 1500))
    max_scrolls = int(cfg.get("max_scrolls", 250))
    out_dir = run_dir()
    raw_dir = out_dir / "x_raw"
    errors: list[str] = []

    me: str | None = None
    following = {"user": user, "expected": None, "count": 0, "status": "skipped", "accounts": []}
    followed_ids: set[str] = set()
    followed_handles: set[str] = set()
    tweets: list[dict] = []
    meta: dict = {}
    pw, ctx = launch(headed=args.headed)
    page = ctx.pages[0] if ctx.pages else ctx.new_page()
    try:
        page.goto("https://x.com/home", wait_until="domcontentloaded")
        page.wait_for_timeout(4000)
        me = logged_in_handle(page)
        if not me:
            log("❌ X 로그인 상태가 아닙니다. `python3 scripts/x_login.py` 를 먼저 실행하세요.")
            save_json(out_dir / "x.json", result_envelope("x", [], ["not logged in"], user=user, mode=args.mode))
            return 2
        if user and me.lower() != user.lower() and not args.allow_account_mismatch:
            log(f"❌ 로그인 계정 @{me} ≠ 설정 계정 @{user}")
            save_json(out_dir / "x.json", result_envelope("x", [], [f"logged in as @{me}, expected @{user}"], user=user, mode=args.mode))
            return 2
        log(f"✓ logged in as @{me}")

        if not args.skip_following:
            following = collect_following(page, user, max_scrolls=400, raw_dir=raw_dir)
            log(f"✓ following: {following['count']} accounts ({following['status']}, expected {following['expected']})")
            save_json(out_dir / "x_following.json", {**following, "as_of": as_of().isoformat()})
            if following["status"] not in ("complete", "near_complete"):
                errors.append(f"following list {following['status']}: {following['count']}/{following['expected']}")
            errors.extend(f"following: {e}" for e in following.get("errors", [])[:5])
        # The home "Following" tab already contains only followed accounts, so the explicit filter is
        # applied only when we KNOW the list is complete — otherwise a partial list would drop real posts.
        if following["status"] in ("complete", "near_complete"):
            followed_ids = {a["id"] for a in following["accounts"] if a.get("id")}
            followed_handles = {a["handle"].lower() for a in following["accounts"]}

        if args.mode == "timeline":
            tweets, meta = collect_timeline(page, cutoff, max_scrolls, max_tweets, raw_dir)
            log(f"✓ timeline: {len(tweets)} raw tweets ({meta})")
            if not meta.get("reached_cutoff"):
                errors.append(f"timeline did not reach {window}h cutoff (oldest={meta.get('oldest')}, scrolls={meta.get('scrolls')})")
            if meta.get("dom_fallback"):
                errors.append("timeline: GraphQL yielded no tweets — DOM fallback used (metrics/reply flags unavailable)")
            errors.extend(f"timeline: {e}" for e in meta.get("response_errors", [])[:5])
            if len(tweets) < 5 and following["accounts"]:
                log("  timeline too small → falling back to per-account mode")
                args.mode = "accounts"
        if args.mode == "accounts":
            all_handles = [h.strip() for h in args.accounts.split(",")] if args.accounts else \
                          [a["handle"] for a in following["accounts"]]
            max_accounts = int(cfg.get("max_accounts", 150))
            handles = all_handles[:max_accounts]
            if len(all_handles) > max_accounts:
                errors.append(f"accounts mode: only {max_accounts}/{len(all_handles)} profiles visited (x.max_accounts)")
            tweets, meta = collect_accounts(page, handles, cutoff, raw_dir)
            log(f"✓ accounts: {len(tweets)} raw tweets from {len(handles)} profiles")
            errors.extend(meta.get("failed", []))
            if meta.get("dom_fallback"):
                errors.append(f"accounts: DOM fallback for {len(meta['dom_fallback'])} profiles")
    except Exception as e:  # noqa: BLE001
        errors.append(f"fatal: {str(e)[:200]}")
        log(f"❌ {e}")
        tweets = []
    finally:
        try:
            ctx.close()
            pw.stop()
        except Exception:  # noqa: BLE001
            pass

    dump(raw_dir / "tweets_all.json", tweets)

    # ---- policy filters (deterministic)
    include_rt = bool(cfg.get("include_retweets", True))
    include_replies = bool(cfg.get("include_replies_to_others", False))
    kept, dropped = [], {"old": 0, "not_followed": 0, "protected": 0, "reply": 0, "retweet": 0, "no_time": 0}
    for t in tweets:
        when = parse_iso(t.get("retweetedAt") or t.get("createdAt") or "")
        if not when:
            dropped["no_time"] += 1
            continue
        if when < cutoff or when > as_of() + timedelta(hours=1):
            dropped["old"] += 1
            continue
        actor_id = t.get("retweetedBy") and next((a["id"] for a in following["accounts"] if a["handle"].lower() == t["retweetedBy"].lower()), "") or t.get("authorId")
        actor_handle = (t.get("retweetedBy") or t["handle"]).lower()
        if followed_handles and actor_handle not in followed_handles and actor_id not in followed_ids and actor_handle != (me or "").lower():
            dropped["not_followed"] += 1
            continue
        if t.get("protected"):
            dropped["protected"] += 1
            continue
        if t.get("retweetedBy") and not include_rt:
            dropped["retweet"] += 1
            continue
        is_reply_to_other = bool(t.get("inReplyToHandle")) and t["inReplyToHandle"].lower() != t["handle"].lower()
        if is_reply_to_other and not include_replies:
            dropped["reply"] += 1
            continue
        t["publishedAt"] = iso_kst(parse_iso(t["createdAt"])) if t.get("createdAt") else iso_kst(when)
        t["isSelfReply"] = bool(t.get("inReplyToHandle")) and t["inReplyToHandle"].lower() == t["handle"].lower()
        kept.append(t)

    kept.sort(key=lambda t: (t["publishedAt"], t["id"]), reverse=True)
    out = result_envelope("x", kept, errors, user=user, logged_in_as=me, mode=args.mode,
                          window_hours=window, following_count=following.get("count"),
                          following_status=following.get("status"), dropped=dropped, collector_meta=meta)
    save_json(out_dir / "x.json", out)
    log(f"x: {len(kept)} tweets kept (dropped {dropped}) → {out_dir / 'x.json'}")
    return 0 if kept else 1


if __name__ == "__main__":
    sys.exit(main())
