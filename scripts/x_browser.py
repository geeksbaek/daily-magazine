#!/usr/bin/env python3
"""Playwright helpers shared by collect_x.py / collect_threads.py / x_login.py."""
from __future__ import annotations

import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path

from playwright.sync_api import Page, sync_playwright

from lib import load_config

CHROME_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
)


def profile_dir() -> Path:
    cfg = load_config().get("x", {})
    p = os.environ.get("DM_X_PROFILE") or cfg.get("profile_dir") or "~/.daily-magazine/x-profile"
    path = Path(os.path.expanduser(p))
    path.mkdir(parents=True, exist_ok=True)
    return path


def launch(headed: bool = False):
    """Persistent Chromium context (cookies survive between runs). Returns (playwright, context)."""
    pw = sync_playwright().start()
    ctx = pw.chromium.launch_persistent_context(
        str(profile_dir()),
        headless=not headed,
        user_agent=CHROME_UA,
        viewport={"width": 1280, "height": 1600},
        locale="en-US",
        timezone_id="Asia/Seoul",
        args=["--disable-blink-features=AutomationControlled"],
    )
    ctx.set_default_timeout(20000)
    return pw, ctx


class ResponseSink:
    """Collect JSON bodies of GraphQL responses whose URL matches ``pattern``."""

    def __init__(self, page: Page, pattern: str):
        self.pattern = re.compile(pattern)
        self.payloads: list[dict] = []
        self.count = 0
        self.errors: list[str] = []
        page.on("response", self._on_response)

    def _on_response(self, resp):
        if not self.pattern.search(resp.url):
            return
        name = resp.url.split("/graphql/")[-1].split("?")[0]
        if resp.status >= 400:
            self.errors.append(f"{name}: HTTP {resp.status}")
            return
        try:
            body = resp.json()
        except Exception as e:  # noqa: BLE001 — aborted/streamed responses
            self.errors.append(f"{name}: unreadable body ({str(e)[:60]})")
            return
        if isinstance(body, dict) and body.get("errors") and not body.get("data"):
            self.errors.append(f"{name}: GraphQL errors {str(body['errors'])[:120]}")
        self.count += 1
        self.payloads.append({"url": resp.url, "data": body})


def walk_until(obj, fn, promoted: bool = False):
    """Like walk(), but fn returning True stops descent into that dict (no nested extraction)."""
    if isinstance(obj, dict):
        promoted = promoted or ("promotedMetadata" in obj)
        if fn(obj, promoted):
            return
        for v in obj.values():
            walk_until(v, fn, promoted)
    elif isinstance(obj, list):
        for v in obj:
            walk_until(v, fn, promoted)


def walk(obj, fn, promoted: bool = False):
    """Depth-first walk calling fn(dict, promoted) for every dict."""
    if isinstance(obj, dict):
        promoted = promoted or ("promotedMetadata" in obj)
        fn(obj, promoted)
        for v in obj.values():
            walk(v, fn, promoted)
    elif isinstance(obj, list):
        for v in obj:
            walk(v, fn, promoted)


def twitter_time(s: str) -> datetime | None:
    # "Mon Sep 22 01:02:03 +0000 2026"
    try:
        return datetime.strptime(s, "%a %b %d %H:%M:%S %z %Y").astimezone(timezone.utc)
    except Exception:  # noqa: BLE001
        return None


def user_fields(u: dict) -> dict:
    """X moved name/screen_name from ``legacy`` to ``core`` in 2025 — support both."""
    legacy = u.get("legacy") or {}
    core = u.get("core") or {}
    priv = u.get("privacy") or {}
    return {
        "id": u.get("rest_id") or legacy.get("id_str") or "",
        "handle": core.get("screen_name") or legacy.get("screen_name") or "",
        "name": core.get("name") or legacy.get("name") or "",
        "protected": bool(priv.get("protected", legacy.get("protected", False))),
        "followingCount": legacy.get("friends_count"),
        "followersCount": legacy.get("followers_count"),
    }


def unwrap_tweet(t: dict) -> dict | None:
    if not isinstance(t, dict):
        return None
    if t.get("__typename") == "TweetWithVisibilityResults":
        return t.get("tweet")
    if t.get("__typename") == "Tweet" or ("rest_id" in t and "legacy" in t and "full_text" in (t.get("legacy") or {})):
        return t
    return None


def tweet_fields(t: dict) -> dict | None:
    t = unwrap_tweet(t)
    if not t:
        return None
    legacy = t.get("legacy") or {}
    author = user_fields(((t.get("core") or {}).get("user_results") or {}).get("result") or {})
    if not author["handle"] or not t.get("rest_id"):
        return None
    text = legacy.get("full_text") or ""
    note = ((t.get("note_tweet") or {}).get("note_tweet_results") or {}).get("result") or {}
    if note.get("text"):
        text = note["text"]
    # expand t.co links
    for u in (legacy.get("entities") or {}).get("urls") or []:
        if u.get("url") and u.get("expanded_url"):
            text = text.replace(u["url"], u["expanded_url"])
    for m in (legacy.get("entities") or {}).get("media") or []:
        if m.get("url"):
            text = text.replace(m["url"], "").strip()
    created = twitter_time(legacy.get("created_at", ""))
    views = (t.get("views") or {}).get("count")
    out = {
        "id": t["rest_id"],
        "handle": author["handle"],
        "author": author["name"],
        "authorId": author["id"],
        "protected": author["protected"],
        "text": text.strip(),
        "createdAt": created.isoformat() if created else None,
        "url": f"https://x.com/{author['handle']}/status/{t['rest_id']}",
        "conversationId": legacy.get("conversation_id_str"),
        "inReplyToHandle": legacy.get("in_reply_to_screen_name"),
        "inReplyToUserId": legacy.get("in_reply_to_user_id_str"),
        "isQuote": bool(legacy.get("is_quote_status")),
        "lang": legacy.get("lang"),
        "metrics": {
            "likes": int(legacy.get("favorite_count") or 0),
            "retweets": int(legacy.get("retweet_count") or 0),
            "replies": int(legacy.get("reply_count") or 0),
            "quotes": int(legacy.get("quote_count") or 0),
            "views": int(views) if str(views or "").isdigit() else 0,
        },
        "links": [u.get("expanded_url") for u in (legacy.get("entities") or {}).get("urls") or [] if u.get("expanded_url")],
        "hasMedia": bool((legacy.get("entities") or {}).get("media")),
    }
    rt = legacy.get("retweeted_status_result")
    if rt and rt.get("result"):
        inner = tweet_fields(rt["result"])
        if inner:
            inner["retweetedBy"] = author["handle"]
            inner["retweetedByName"] = author["name"]
            inner["retweetedAt"] = out["createdAt"]
            return inner
    q = (t.get("quoted_status_result") or {}).get("result")
    if q:
        qf = tweet_fields(q)
        if qf:
            out["quoted"] = {"handle": qf["handle"], "author": qf["author"], "text": qf["text"], "url": qf["url"]}
    return out


def looks_like_tweet(d: dict) -> bool:
    if d.get("__typename") in ("Tweet", "TweetWithVisibilityResults"):
        return True
    return "rest_id" in d and isinstance(d.get("legacy"), dict) and "full_text" in d["legacy"]


def extract_tweets(payloads: list[dict], start: int = 0) -> list[dict]:
    """Top-level tweets only: quoted/retweeted inner tweets are folded into their parent by
    tweet_fields(), never emitted as separate items. ``start`` skips already-processed payloads."""
    found: dict[str, dict] = {}

    def visit(d, promoted):
        if not looks_like_tweet(d):
            return False
        if promoted:
            return True
        tf = tweet_fields(d)
        if tf and tf["id"] not in found:
            found[tf["id"]] = tf
        return True

    for p in payloads[start:]:
        walk_until(p["data"], visit)
    return list(found.values())


def extract_users(payloads: list[dict]) -> list[dict]:
    found: dict[str, dict] = {}

    def visit(d, _promoted):
        if d.get("__typename") == "User" and d.get("rest_id"):
            uf = user_fields(d)
            if uf["handle"]:
                found[uf["id"]] = uf

    for p in payloads:
        walk(p["data"], visit)
    return list(found.values())


def dom_tweets(page: Page) -> list[dict]:
    """Fallback: parse rendered tweet articles (less data, but schema-independent)."""
    js = """
    () => Array.from(document.querySelectorAll('article[data-testid="tweet"]')).map(a => {
      const t = a.querySelector('[data-testid="tweetText"]');
      const time = a.querySelector('time');
      const link = Array.from(a.querySelectorAll('a[href*="/status/"]')).find(x => x.querySelector('time')) || a.querySelector('a[href*="/status/"]');
      const href = link ? link.getAttribute('href') : '';
      const social = a.querySelector('[data-testid="socialContext"]');
      const nameEl = a.querySelector('[data-testid="User-Name"]');
      return {text: t ? t.innerText : '', datetime: time ? time.getAttribute('datetime') : '',
              href, socialContext: social ? social.innerText : '', name: nameEl ? nameEl.innerText.split('\\n')[0] : ''};
    })"""
    out = []
    for r in page.evaluate(js):
        m = re.match(r"^/([^/]+)/status/(\d+)", r.get("href") or "")
        if not m or not r.get("text"):
            continue
        handle, tid = m.group(1), m.group(2)
        item = {
            "id": tid, "handle": handle, "author": r.get("name") or handle, "authorId": "", "protected": False,
            "text": r["text"], "createdAt": r.get("datetime") or None,
            "url": f"https://x.com/{handle}/status/{tid}", "conversationId": None, "inReplyToHandle": None,
            "inReplyToUserId": None, "isQuote": False, "lang": None,
            "metrics": {"likes": 0, "retweets": 0, "replies": 0, "quotes": 0, "views": 0}, "links": [], "hasMedia": False,
            "source": "dom",
        }
        sc = r.get("socialContext") or ""
        m2 = re.match(r"^(.+?) reposted", sc)
        if m2:
            item["retweetedByName"] = m2.group(1)
        out.append(item)
    return out


def logged_in_handle(page: Page) -> str | None:
    """Return the @handle of the signed-in account, or None when logged out."""
    if "/i/flow/login" in page.url or page.url.rstrip("/").endswith("/login"):
        return None
    try:
        el = page.locator('[data-testid="SideNav_AccountSwitcher_Button"]').first
        el.wait_for(timeout=15000)
        m = re.search(r"@(\w+)", el.inner_text())
        return m.group(1) if m else ""
    except Exception:  # noqa: BLE001
        return None


def dump(path: Path, obj) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False)
    os.replace(tmp, path)
