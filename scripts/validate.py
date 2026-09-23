#!/usr/bin/env python3
"""Validate a magazine.json. Exit 0 only when there are no errors.

Full mode (default): needs candidates.json → provenance (every url/handle/date equals the
candidate's), exclusivity (no url/id/cluster twice across highlights + all sections),
cross-issue dedupe, section caps, Korean text, age window.
--ci mode: no candidates available (GitHub Actions) → structural + exclusivity + history checks.
"""
from __future__ import annotations

import argparse
import re
import sys
from datetime import timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib import (MARK_RE, dedupe_key, has_hangul, iter_magazine_items, load_config,  # noqa: E402
                 load_history, load_json, parse_iso, run_dir, unmark)

ARTICLE_SECTIONS = ("ai_ml", "dev_tools", "big_tech", "quick_bites")
SOCIAL_SECTIONS = ("twitter_pulse", "threads_pulse", "reddit_pulse")
HTML_RE = re.compile(r"<[a-zA-Z/][^>]*>")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("magazine", nargs="?")
    ap.add_argument("--candidates")
    ap.add_argument("--ci", action="store_true", help="no candidates; structural checks only")
    args = ap.parse_args()
    cfg = load_config()
    limits = cfg.get("sections", {})
    pub = cfg.get("publish", {})

    mag_path = Path(args.magazine) if args.magazine else run_dir() / "magazine.json"
    mag = load_json(mag_path)
    errors, warnings = [], []
    if not mag:
        print(f"❌ cannot read {mag_path}")
        return 1
    cands = None
    if not args.ci:
        cand_path = Path(args.candidates) if args.candidates else mag_path.parent / "candidates.json"
        cands = load_json(cand_path)
        if not cands:
            print(f"❌ cannot read candidates {cand_path} (use --ci for structural checks only)")
            return 1

    # ---------------------------------------------------------------- structure
    date = mag.get("date", "")
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", date):
        errors.append(f"date invalid: {date!r}")
    if not isinstance(mag.get("issueNumber"), int):
        errors.append("issueNumber must be int")
    cover = mag.get("cover") or {}
    for k in ("mainHeadline", "mainExcerpt"):
        if not has_hangul(cover.get(k)):
            errors.append(f"cover.{k} missing or not Korean")
    if not (isinstance(cover.get("headlines"), list) and len(cover["headlines"]) == 3 and all(has_hangul(h) for h in cover["headlines"])):
        errors.append("cover.headlines must be 3 Korean strings")
    sections = mag.get("sections") or {}
    if "community_pulse" in sections:
        errors.append("sections.community_pulse must not exist")
    for sec in ARTICLE_SECTIONS + SOCIAL_SECTIONS:
        if not isinstance(sections.get(sec), list):
            errors.append(f"sections.{sec} must be a list")
    if not isinstance(mag.get("highlights"), list):
        errors.append("highlights must be a list")
    if errors:
        report(errors, warnings)
        return 1

    # ---------------------------------------------------------------- items
    seen_urls: dict[str, str] = {}
    seen_ids: dict[str, str] = {}
    seen_clusters: dict[str, str] = {}
    per_publisher: dict[str, int] = {}
    per_author: dict[str, int] = {}
    per_sub: dict[str, int] = {}
    as_of_dt = parse_iso(cands["as_of"]) if cands else (parse_iso(mag.get("asOf", "")) or parse_iso(f"{date}T06:00:00+09:00"))
    max_age = timedelta(hours=int(cfg.get("candidates", {}).get("publish_window_hours", 48)))
    c_articles = {a["id"]: a for a in cands["articles"]} if cands else {}
    c_tweets = {t["id"]: t for t in cands["tweets"]} if cands else {}
    c_reddit = {p["id"]: p for p in cands["reddit"]} if cands else {}
    c_threads = {p["id"]: p for p in cands["threads"]} if cands else {}

    def korean(item, key, where, required=True):
        v = item.get(key)
        if not v:
            if required:
                errors.append(f"{where}.{key} missing")
            return
        if not isinstance(v, str):
            errors.append(f"{where}.{key} must be string")
            return
        if not has_hangul(v):
            errors.append(f"{where}.{key} not Korean: {v[:60]!r}")
        if HTML_RE.search(v):
            errors.append(f"{where}.{key} contains HTML")

    def unique(item, where):
        u = item.get("url", "")
        k = dedupe_key(u)
        if not u:
            errors.append(f"{where}.url missing")
        elif k in seen_urls:
            errors.append(f"{where}: DUPLICATE url also in {seen_urls[k]}: {u}")
        else:
            seen_urls[k] = where
        i = item.get("id", "")
        if not i:
            errors.append(f"{where}.id missing")
        elif i in seen_ids:
            errors.append(f"{where}: DUPLICATE id also in {seen_ids[i]}: {i}")
        else:
            seen_ids[i] = where

    def age_ok(item, where):
        dt = parse_iso(item.get("publishedAt", ""))
        if not dt:
            errors.append(f"{where}.publishedAt invalid: {item.get('publishedAt')!r}")
            return
        seen_dt = parse_iso(item.get("firstSeenAt", "")) if item.get("firstSeenAt") else None
        if seen_dt and seen_dt > dt and (as_of_dt - dt) <= timedelta(days=7):
            dt = seen_dt  # backdated post that only appeared recently (collector-verified)
        if as_of_dt and (as_of_dt - dt) > max_age:
            errors.append(f"{where}: older than {max_age.total_seconds()/3600:.0f}h ({item['publishedAt']})")
        if as_of_dt and dt > as_of_dt + timedelta(hours=2):
            errors.append(f"{where}: publishedAt in the future ({item['publishedAt']})")

    for where, a in ((f"highlights[{i}]", a) for i, a in enumerate(mag["highlights"])):
        check_article(a, where, c_articles, cands, errors, korean, unique, age_ok, seen_clusters, per_publisher, pub)
    for sec in ARTICLE_SECTIONS:
        for i, a in enumerate(sections[sec]):
            where = f"{sec}[{i}]"
            check_article(a, where, c_articles, cands, errors, korean, unique, age_ok, seen_clusters, per_publisher, pub)
    for i, t in enumerate(sections["twitter_pulse"]):
        where = f"twitter_pulse[{i}]"
        unique(t, where)
        korean(t, "content", where)
        korean(t, "context", where)
        if not re.search(r"^https://x\.com/[A-Za-z0-9_]+/status/\d{5,}$", t.get("url", "")):
            errors.append(f"{where}.url malformed: {t.get('url')}")
        if t.get("handle") and t["handle"] not in t.get("url", ""):
            errors.append(f"{where}: handle @{t['handle']} not in url")
        if not isinstance(t.get("metrics"), dict):
            errors.append(f"{where}.metrics missing")
        for j, part in enumerate(t.get("thread") or []):
            if not has_hangul(part):
                errors.append(f"{where}.thread[{j}] not Korean")
        if t.get("quoted") and not has_hangul((t["quoted"] or {}).get("content")):
            errors.append(f"{where}.quoted.content not Korean")
        age_ok(t, where)
        h = (t.get("handle") or "").lower()
        per_author[h] = per_author.get(h, 0) + 1
        if cands:
            c = c_tweets.get(t.get("id"))
            if not c:
                errors.append(f"{where}: id {t.get('id')!r} not in candidates")
            else:
                for k in ("url", "handle", "author", "publishedAt"):
                    if t.get(k) != c.get(k):
                        errors.append(f"{where}.{k} differs from candidate: {t.get(k)!r} != {c.get(k)!r}")
                if c.get("retweetedBy") != t.get("retweetedBy"):
                    errors.append(f"{where}.retweetedBy differs from candidate")
    for i, p in enumerate(sections["reddit_pulse"]):
        where = f"reddit_pulse[{i}]"
        unique(p, where)
        korean(p, "title", where)
        korean(p, "summary", where)
        if "/comments/" not in p.get("url", ""):
            errors.append(f"{where}.url is not a post url: {p.get('url')}")
        if not p.get("originalTitle"):
            errors.append(f"{where}.originalTitle missing")
        age_ok(p, where)
        s = p.get("subreddit", "")
        per_sub[s] = per_sub.get(s, 0) + 1
        if cands:
            c = c_reddit.get(p.get("id"))
            if not c:
                errors.append(f"{where}: id {p.get('id')!r} not in candidates")
            elif p.get("url") != c["url"] or p.get("originalTitle") != c["title"] or p.get("subreddit") != c["subreddit"]:
                errors.append(f"{where}: url/originalTitle/subreddit differ from candidate")
    for i, p in enumerate(sections["threads_pulse"]):
        where = f"threads_pulse[{i}]"
        unique(p, where)
        korean(p, "content", where)
        korean(p, "context", where)
        age_ok(p, where)
        if cands:
            c = c_threads.get(p.get("id"))
            if not c:
                errors.append(f"{where}: id {p.get('id')!r} not in candidates")
            elif p.get("url") != c["url"] or p.get("handle") != c["handle"]:
                errors.append(f"{where}: url/handle differ from candidate")

    # ---------------------------------------------------------------- counts & caps
    counts = {"highlights": len(mag["highlights"]), **{s: len(sections[s]) for s in ARTICLE_SECTIONS + SOCIAL_SECTIONS}}
    supply = {}
    if cands:
        supply = {c: sum(1 for a in cands["articles"] if a["category"] == c) for c in ARTICLE_SECTIONS}
        supply["highlights"] = len(cands["articles"])
        supply["twitter_pulse"] = len(cands["tweets"])
        supply["reddit_pulse"] = len(cands["reddit"])
        supply["threads_pulse"] = len(cands["threads"])
    for sec, n in counts.items():
        lim = limits.get(sec, {})
        if "max" in lim and n > lim["max"]:
            errors.append(f"{sec}: {n} items > max {lim['max']}")
        if "min" in lim and n < lim["min"]:  # shortfall is a warning: exclusivity/caps may make the minimum unreachable
            warnings.append(f"{sec}: {n} items < min {lim['min']} (candidates available: {supply.get(sec, '?')})")
    total_articles = counts["highlights"] + sum(counts[s] for s in ARTICLE_SECTIONS)
    if total_articles < int(pub.get("min_total_articles", 12)):
        errors.append(f"only {total_articles} articles in the issue (< {pub.get('min_total_articles', 12)}) — not enough to publish")
    if cands and len(cands["articles"]) < int(pub.get("min_candidate_articles", 20)):
        errors.append(f"only {len(cands['articles'])} candidate articles (< {pub.get('min_candidate_articles', 20)}) — collection too thin to publish")
    # a tweet and the article it links to are the same event
    selected_articles = {a.get("id") for _, a in iter_magazine_items(mag) if str(a.get("id", "")).startswith(("rss_", "web_", "hn_"))}
    for i, t in enumerate(sections["twitter_pulse"]):
        for aid in t.get("linkedArticleIds") or []:
            if aid in selected_articles:
                errors.append(f"twitter_pulse[{i}]: links to article {aid} which is also in the issue (same event twice)")
    for p, n in per_publisher.items():
        if n > int(pub.get("per_publisher_max", 3)):
            errors.append(f"publisher cap: {p} appears {n}× (> {pub.get('per_publisher_max', 3)})")
    for h, n in per_author.items():
        if n > int(pub.get("per_tweet_author_max", 2)):
            errors.append(f"tweet author cap: @{h} appears {n}×")
    for s, n in per_sub.items():
        if n > int(pub.get("per_subreddit_max", 2)):
            errors.append(f"subreddit cap: r/{s} appears {n}×")

    # ---------------------------------------------------------------- highlight marks
    check_marks(mag, errors)

    # ---------------------------------------------------------------- history
    hist = load_history(int(cfg.get("candidates", {}).get("history_issues", 14)), date)
    for where, item in iter_magazine_items(mag):
        k = dedupe_key(item.get("url", ""))
        if k and k in hist["urls"]:
            errors.append(f"{where}: url already published in a previous issue: {item['url']}")
    report(errors, warnings, counts)
    return 1 if errors else 0


def check_article(a, where, c_articles, cands, errors, korean, unique, age_ok, seen_clusters, per_publisher, pub):
    unique(a, where)
    korean(a, "title", where)
    korean(a, "excerpt", where)
    korean(a, "body", where, required=False)
    if not isinstance(a.get("readTime"), (int, float)):
        errors.append(f"{where}.readTime must be a number")
    if a.get("category") not in ARTICLE_SECTIONS:
        errors.append(f"{where}.category invalid: {a.get('category')!r}")
    age_ok(a, where)
    publisher = a.get("publisher") or a.get("source") or ""
    per_publisher[publisher] = per_publisher.get(publisher, 0) + 1
    body, excerpt = unmark(a.get("body")).strip(), unmark(a.get("excerpt")).strip()
    if body:
        bcfg = pub.get("body", {})
        min_chars, min_ratio, max_overlap = int(bcfg.get("min_chars", 600)), float(bcfg.get("min_ratio", 4.0)), float(bcfg.get("max_overlap", 0.45))
        if len(body) < min_chars:
            errors.append(f"{where}.body too short: {len(body)} chars (< {min_chars}) — body must let readers skip the original")
        if len(body) < len(excerpt) * min_ratio:
            errors.append(f"{where}.body only {len(body)/max(1,len(excerpt)):.1f}× the excerpt (need ≥ {min_ratio}×)")
        if body.count("\n\n") < 2:
            errors.append(f"{where}.body needs ≥ 3 paragraphs separated by blank lines")
        et, bt = _tokens(excerpt), _tokens(body)
        overlap = len(et & bt) / max(1, len(et))
        if et and overlap > max_overlap:
            errors.append(f"{where}.body repeats the excerpt ({overlap:.0%} of excerpt tokens reappear; max {max_overlap:.0%})")
        if excerpt[:30] and excerpt[:30] in body:
            errors.append(f"{where}.body contains the excerpt's opening verbatim")
    if cands:
        c = c_articles.get(a.get("id"))
        if not c:
            errors.append(f"{where}: id {a.get('id')!r} not in candidates")
            return
        if not body and where.split("[")[0] != "quick_bites" and c.get("contentSource") in ("jina", "direct", "feed"):
            errors.append(f"{where}: body required — full text is available (contentSource={c['contentSource']})")
        for k in ("url", "source", "publishedAt", "firstSeenAt"):
            if a.get(k) != c.get(k):
                errors.append(f"{where}.{k} differs from candidate: {a.get(k)!r} != {c.get(k)!r}")
        if a.get("title", "").strip() == c["title"].strip():
            errors.append(f"{where}.title not translated")
        cid = c["clusterId"]
        if cid in seen_clusters:
            errors.append(f"{where}: SAME STORY as {seen_clusters[cid]} (cluster {cid})")
        else:
            seen_clusters[cid] = where


# (field, min, max) marks per reader-facing text; anything not listed must carry none
_ARTICLE_MARKS = {"excerpt": (0, 1), "body": (1, 3)}
_SOCIAL_MARKS = {"content": (0, 1), "context": (0, 1), "summary": (0, 1)}


def _marks(text, where, lo, hi, errors):
    if not isinstance(text, str) or "==" not in text and lo == 0:
        return
    spans = MARK_RE.findall(text)
    if "==" in MARK_RE.sub("", text):
        errors.append(f"{where}: stray or unbalanced '==' highlight marker")
    if not lo <= len(spans) <= hi:
        errors.append(f"{where}: {len(spans)} highlight(s), need {lo}–{hi}")
    for sp in spans:
        if sp != sp.strip() or not 4 <= len(sp) <= 140:
            errors.append(f"{where}: highlight {sp[:30]!r}… must be 4–140 chars without edge spaces")
    plain = unmark(text)
    if plain and sum(map(len, spans)) > 0.4 * len(plain):
        errors.append(f"{where}: highlights cover more than 40% of the text")


def check_marks(mag, errors):
    """`==phrase==` highlights: balanced, few per field, never in titles/headlines/quotes."""
    cover = mag.get("cover") or {}
    _marks(cover.get("mainHeadline"), "cover.mainHeadline", 0, 0, errors)
    _marks(cover.get("mainExcerpt"), "cover.mainExcerpt", 0, 1, errors)
    for i, h in enumerate(cover.get("headlines") or []):
        _marks(h, f"cover.headlines[{i}]", 0, 0, errors)
    seen: dict[str, int] = {}
    for sec, item in iter_magazine_items(mag):
        seen[sec] = seen.get(sec, -1) + 1
        where = f"{sec}[{seen[sec]}]"
        if "body" in item or "excerpt" in item:
            for k in ("title", "originalTitle"):
                _marks(item.get(k), f"{where}.{k}", 0, 0, errors)
            for k, (lo, hi) in _ARTICLE_MARKS.items():
                if item.get(k):
                    _marks(item[k], f"{where}.{k}", lo, hi, errors)
        else:
            for k in ("title", "originalTitle", "author"):
                _marks(item.get(k), f"{where}.{k}", 0, 0, errors)
            for k, (lo, hi) in _SOCIAL_MARKS.items():
                _marks(item.get(k), f"{where}.{k}", lo, hi, errors)
            for j, t in enumerate(item.get("thread") or []):
                _marks(t, f"{where}.thread[{j}]", 0, 1, errors)
            _marks((item.get("quoted") or {}).get("content"), f"{where}.quoted", 0, 0, errors)


def _tokens(s: str) -> set[str]:
    return set(re.findall(r"[가-힣A-Za-z0-9]{2,}", s or ""))


def report(errors, warnings, counts=None):
    for w in warnings:
        print(f"⚠️  {w}")
    if errors:
        print(f"❌ {len(errors)} error(s):")
        for e in errors:
            print(f"  - {e}")
    else:
        print("✅ validation passed" + (f" {counts}" if counts else ""))


if __name__ == "__main__":
    sys.exit(main())
