#!/usr/bin/env python3
"""Merge raw collector outputs into <run_dir>/candidates.json (+ candidates_brief.md).

This is the ONLY input the LLM curation step sees. Everything here is deterministic:
 - publish window (48h from as_of) applied to every item
 - conservative URL dedupe (dedupe_key) + per-publisher/author/subreddit caps
 - cross-issue dedupe against the last N published issues (URL + story similarity)
 - same-story clustering: linked-URL match first, then title token similarity
 - stable ids: platform ids where they exist, sha1(url) otherwise
"""
from __future__ import annotations

import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib import (as_of, dedupe_key, jaccard, similar_titles, load_config, load_history, load_json, log, parse_iso,  # noqa: E402
                 run_date, run_dir, save_json, short_id, title_tokens)

CATEGORIES = ("ai_ml", "dev_tools", "big_tech", "quick_bites")


def hours_ago(iso: str) -> float:
    dt = parse_iso(iso)
    return (as_of() - dt).total_seconds() / 3600 if dt else 1e9


def load_raw(rd: Path, name: str) -> dict | None:
    """Raw collector output, but only if it belongs to THIS run (same as_of)."""
    raw = load_json(rd / f"{name}.json")
    if raw and parse_iso(raw.get("as_of", "")) != as_of():
        log(f"⚠️ {name}.json is from another run (as_of {raw.get('as_of')}) — ignored")
        return {"status": "stale", "count": 0, "errors": [f"{name}.json as_of {raw.get('as_of')} ≠ {as_of().isoformat()}"], "items": []}
    return raw


def source_status(raw: dict | None, name: str) -> dict:
    if not raw:
        return {"status": "missing", "count": 0, "errors": [f"{name}.json not found"]}
    return {"status": raw.get("status"), "count": raw.get("count", 0), "errors": raw.get("errors", []),
            **({k: raw[k] for k in ("following_count", "following_status", "mode", "dropped") if k in raw})}


def cluster_articles(arts: list[dict], threshold: float) -> None:
    """Union-find over (a) identical linked URL (b) title similarity. Chaining is limited by
    requiring every merge to be against the cluster representative, not any member."""
    parent = {a["id"]: a["id"] for a in arts}

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(a, b):
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[rb] = ra

    by_key: dict[str, str] = {}
    for a in arts:
        for k in a["_link_keys"]:
            if k in by_key:
                union(by_key[k], a["id"])
            else:
                by_key[k] = a["id"]
    toks = {a["id"]: title_tokens(a["title"]) for a in arts}
    ordered = sorted(arts, key=lambda a: (a["tier"], a["publishedAt"]))  # primary sources become reps
    for i, a in enumerate(ordered):
        for b in ordered[:i]:
            rb = find(b["id"])
            if find(a["id"]) == rb:
                continue
            rep_tokens = toks[rb]
            if len(toks[a["id"]]) >= 3 and len(rep_tokens) >= 3 and similar_titles(toks[a["id"]], rep_tokens, threshold):
                union(rb, a["id"])
                break
    groups: dict[str, list[str]] = {}
    for a in arts:
        groups.setdefault(find(a["id"]), []).append(a["id"])
    for rep, members in groups.items():
        members.sort()
        for a in arts:
            if a["id"] in members:
                a["clusterId"] = rep
                a["clusterSize"] = len(members)
                a["clusterMembers"] = members


def main() -> int:
    cfg = load_config()
    ccfg = cfg.get("candidates", {})
    window = int(ccfg.get("publish_window_hours", 48))
    cutoff = as_of() - timedelta(hours=window)
    rd = run_dir()
    date = run_date()
    history = load_history(int(ccfg.get("history_issues", 14)), date)
    log(f"history: {len(history['dates'])} issues, {len(history['urls'])} urls, {len(history['titles'])} titles")

    rss = load_raw(rd, "rss")
    sites = load_raw(rd, "sites")
    hn = load_raw(rd, "hn")
    reddit = load_raw(rd, "reddit")
    x = load_raw(rd, "x")
    threads = load_raw(rd, "threads")

    # ------------------------------------------------------------------ articles
    raw_articles = []
    for it in (rss or {}).get("items", []):
        raw_articles.append({**it, "id": short_id("rss", it["dedupe_key"]), "_link_keys": [it["dedupe_key"]]})
    for it in (sites or {}).get("items", []):
        raw_articles.append({**it, "id": short_id("web", it["dedupe_key"]), "_link_keys": [it["dedupe_key"]]})
    for it in (hn or {}).get("items", []):
        raw_articles.append({**it, "_link_keys": [it["dedupe_key"]]})

    dropped = {"old": 0, "history_url": 0, "dup_url": 0, "publisher_cap": 0}
    articles, seen_keys, per_pub = [], set(), {}
    raw_articles.sort(key=lambda a: (a["tier"], a["publishedAt"], a["url"]))  # deterministic before caps
    # same URL from several collectors: keep the copy with a real publish date (RSS) over a
    # first-seen-dated sitemap copy, then newest first
    for a in sorted(raw_articles, key=lambda a: (a.get("dateSource") == "first_seen", -parse_iso(a["publishedAt"]).timestamp(), a["url"])):
        dt = parse_iso(a["publishedAt"])
        eff = max(dt, parse_iso(a["firstSeenAt"])) if (dt and a.get("lateArrival")) else dt
        if not dt or eff < cutoff or dt > as_of() + timedelta(hours=1):
            dropped["old"] += 1
            continue
        if a["dedupe_key"] in history["urls"]:
            dropped["history_url"] += 1
            continue
        if a["dedupe_key"] in seen_keys:
            dropped["dup_url"] += 1
            continue
        seen_keys.add(a["dedupe_key"])
        articles.append(a)
    # id collision guard
    ids = [a["id"] for a in articles]
    assert len(ids) == len(set(ids)), "article id collision"

    cluster_articles(articles, float(ccfg.get("title_similarity_threshold", 0.5)))

    # story-history: similar title already published recently
    sim_thr = float(ccfg.get("story_history_similarity", 0.6))
    for a in articles:
        toks = title_tokens(a["title"])
        a["seenStory"] = None
        if len(toks) >= 3:
            for d, ht in history["titles"]:
                if jaccard(toks, ht) >= sim_thr:
                    a["seenStory"] = d
                    break

    # per-publisher cap (after clustering; keep newest, prefer cluster reps)
    caps = {int(k): int(v) for k, v in (ccfg.get("per_publisher_cap_by_tier") or {}).items()}
    default_cap = int(ccfg.get("per_publisher_cap", 6))
    kept = []
    # deterministic order: cluster representatives first, then newest
    for a in sorted(articles, key=lambda a: (0 if a["clusterId"] == a["id"] else 1, -parse_iso(a["publishedAt"]).timestamp(), a["url"])):
        n = per_pub.get(a["publisher"], 0)
        if n >= caps.get(a["tier"], default_cap):
            dropped["publisher_cap"] += 1
            continue
        per_pub[a["publisher"]] = n + 1
        kept.append(a)
    articles = kept[: int(ccfg.get("max_articles", 220))]

    out_articles = []
    for a in sorted(articles, key=lambda a: (a["category"], a["tier"], -parse_iso(a["publishedAt"]).timestamp(), a["url"])):
        out_articles.append({
            "id": a["id"], "title": a["title"], "url": a["url"], "source": a["source"], "publisher": a["publisher"],
            "category": a["category"], "tier": a["tier"], "publishedAt": a["publishedAt"],
            "ageHours": round(hours_ago(a["publishedAt"]), 1),
            "fresh": hours_ago(a.get("firstSeenAt") or a["publishedAt"]) <= 24,
            "description": a.get("description", ""), "content": a.get("content", ""),
            "contentSource": a.get("content_source", "description"),
            **({"hnUrl": a["hnUrl"], "points": a["points"], "numComments": a["numComments"]} if "hnUrl" in a else {}),
            **({"lateArrival": True, "firstSeenAt": a["firstSeenAt"]} if a.get("lateArrival") else {}),
            "clusterId": a["clusterId"], "clusterSize": a["clusterSize"], "clusterMembers": a["clusterMembers"],
            "seenStory": a["seenStory"],
        })

    # ------------------------------------------------------------------ tweets
    tweets_raw = (x or {}).get("items", [])
    by_id = {t["id"]: t for t in tweets_raw}
    roots, replies = [], []
    for t in tweets_raw:
        (replies if t.get("isSelfReply") else roots).append(t)
    # attach self-reply threads to their root (chronological)
    thread_map: dict[str, list[dict]] = {}
    for r in replies:
        cid = r.get("conversationId")
        if cid and cid in by_id and not by_id[cid].get("isSelfReply"):
            thread_map.setdefault(cid, []).append(r)
    per_author_cap = int(ccfg.get("per_author_cap", 4))
    per_author: dict[str, int] = {}
    tweets = []
    for t in roots:
        if dedupe_key(t["url"]) in history["urls"] or t["id"] in history["ids"]:
            continue
        m = t.get("metrics", {})
        t["engagement"] = m.get("likes", 0) + 3 * m.get("retweets", 0) + 2 * m.get("replies", 0) + 2 * m.get("quotes", 0)
        tweets.append(t)
    tweets.sort(key=lambda t: (-t["engagement"], t["publishedAt"], t["id"]))
    article_by_key = {}
    for a in articles:
        article_by_key[a["dedupe_key"]] = a["id"]
    out_tweets = []
    for t in tweets:
        n = per_author.get(t["handle"].lower(), 0)
        if n >= per_author_cap:
            continue
        per_author[t["handle"].lower()] = n + 1
        thread = [r["text"] for r in sorted(thread_map.get(t["id"], []), key=lambda r: (r["publishedAt"], r["id"]))]
        out_tweets.append({
            "id": f"tw_{t['id']}", "tweetId": t["id"], "handle": t["handle"], "author": t["author"],
            **({"retweetedBy": t["retweetedBy"]} if t.get("retweetedBy") else {}),
            "text": t["text"], "thread": thread,
            **({"quoted": t["quoted"]} if t.get("quoted") else {}),
            "url": t["url"], "publishedAt": t["publishedAt"], "metrics": t.get("metrics", {}),
            "engagement": t["engagement"], "links": t.get("links", []), "hasMedia": t.get("hasMedia", False),
            "lang": t.get("lang"),
            # articles this tweet links to → validate.py forbids selecting both (same event twice)
            "linkedArticleIds": sorted({article_by_key[dedupe_key(u)] for u in t.get("links", []) if dedupe_key(u) in article_by_key}),
        })
        if len(out_tweets) >= int(ccfg.get("max_tweets", 120)):
            break

    # ------------------------------------------------------------------ reddit
    per_sub_cap = int(ccfg.get("per_subreddit_cap", 5))
    per_sub: dict[str, int] = {}
    out_reddit = []
    for p in sorted((reddit or {}).get("items", []), key=lambda p: (p["subreddit"], p["rank"])):
        if p["dedupe_key"] in history["urls"] or p["id"] in history["ids"]:
            continue
        dt = parse_iso(p["publishedAt"])
        if not dt or dt < cutoff:
            continue
        n = per_sub.get(p["subreddit"], 0)
        if n >= per_sub_cap:
            continue
        per_sub[p["subreddit"]] = n + 1
        out_reddit.append({k: p[k] for k in ("id", "title", "url", "subreddit", "author", "rank", "publishedAt", "body")})

    # ------------------------------------------------------------------ threads
    out_threads = []
    for p in (threads or {}).get("items", []):
        if dedupe_key(p["url"]) in history["urls"] or p["id"] in history["ids"]:
            continue
        out_threads.append({k: p.get(k) for k in ("id", "handle", "author", "text", "url", "publishedAt", "likes")})

    counts = {"articles": len(out_articles), "tweets": len(out_tweets), "reddit": len(out_reddit), "threads": len(out_threads)}
    per_cat = {c: sum(1 for a in out_articles if a["category"] == c) for c in CATEGORIES}
    out = {
        "date": date,
        "as_of": as_of().isoformat(),
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "window_hours": window,
        "history": {"issues": history["dates"], "urls": len(history["urls"])},
        "sources": {"rss": source_status(rss, "rss"), "sites": source_status(sites, "sites"),
                    "hackernews": source_status(hn, "hn"),
                    "reddit": source_status(reddit, "reddit"), "x": source_status(x, "x"),
                    "threads": source_status(threads, "threads")},
        "dropped": dropped,
        "counts": {**counts, "articles_by_category": per_cat,
                   "fresh_articles": sum(1 for a in out_articles if a["fresh"]),
                   "clusters": len({a["clusterId"] for a in out_articles})},
        "articles": out_articles,
        "tweets": out_tweets,
        "reddit": out_reddit,
        "threads": out_threads,
    }
    save_json(rd / "candidates.json", out)
    write_brief(rd / "candidates_brief.md", out)
    log(f"candidates: {counts} by_category={per_cat} dropped={dropped} → {rd / 'candidates.json'}")
    return 0 if (out_articles or out_tweets) else 1


def write_brief(path: Path, c: dict) -> None:
    lines = [f"# Candidates {c['date']} (as_of {c['as_of']}, window {c['window_hours']}h)", ""]
    lines.append("Sources: " + ", ".join(f"{k}={v['status']}({v['count']})" for k, v in c["sources"].items()))
    lines.append(f"History checked: {len(c['history']['issues'])} issues. Dropped: {c['dropped']}")
    lines.append("")
    for cat in CATEGORIES:
        arts = [a for a in c["articles"] if a["category"] == cat]
        lines.append(f"## {cat} ({len(arts)})")
        for a in arts:
            flags = []
            if a["clusterSize"] > 1:
                flags.append(f"cluster={a['clusterId']}×{a['clusterSize']}")
            if a["seenStory"]:
                flags.append(f"seenStory={a['seenStory']}")
            if a.get("lateArrival"):
                flags.append("late: 게시일은 이전이나 방금 처음 공개됨")
            elif not a["fresh"]:
                flags.append(f"{a['ageHours']:.0f}h")
            extra = f" · HN {a['points']}pt/{a['numComments']}c" if "points" in a else ""
            lines.append(f"- `{a['id']}` [T{a['tier']} {a['source']}]{extra} {a['title']}"
                         + (f"  ({', '.join(flags)})" if flags else ""))
        lines.append("")
    lines.append(f"## tweets ({len(c['tweets'])})")
    for t in c["tweets"]:
        rt = f" (RT by @{t['retweetedBy']})" if t.get("retweetedBy") else ""
        th = f" [+{len(t['thread'])} thread]" if t.get("thread") else ""
        q = " [quote]" if t.get("quoted") else ""
        lines.append(f"- `{t['id']}` @{t['handle']}{rt} ♥{t['metrics'].get('likes', 0)} {t['text'][:140].replace(chr(10), ' ')}{th}{q}")
    lines.append("")
    lines.append(f"## reddit ({len(c['reddit'])})")
    for p in c["reddit"]:
        lines.append(f"- `{p['id']}` r/{p['subreddit']} #{p['rank']} {p['title']}")
    lines.append("")
    lines.append(f"## threads ({len(c['threads'])})")
    for p in c["threads"]:
        lines.append(f"- `{p['id']}` @{p['handle']} {p['text'][:140].replace(chr(10), ' ')}")
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


if __name__ == "__main__":
    sys.exit(main())
