#!/usr/bin/env python3
"""Turn the LLM's draft.json (selection + Korean text only) into magazine.json.

The LLM never writes URLs, dates, handles or metrics: every such field is copied from the
matching candidate by id. Unknown ids, unknown fields and duplicates are rejected here,
and validate.py runs on the result afterwards.

draft.json schema:
{
  "cover": {"mainHeadline": str, "mainExcerpt": str, "headlines": [str, str, str]},
  "highlights": [{"id", "title", "excerpt", "body"}],
  "sections": {
    "ai_ml" | "dev_tools" | "big_tech": [{"id", "title", "excerpt", "body"}],
    "quick_bites": [{"id", "title", "excerpt"}],
    "twitter_pulse": [{"id", "content", "context", "thread"?: [str], "quotedContent"?: str}],
    "reddit_pulse": [{"id", "title", "summary"}],
    "threads_pulse": [{"id", "content", "context"}]
  }
}
"""
from __future__ import annotations

import argparse
import hashlib
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib import DATA_DIR, load_json, log, run_dir, save_json  # noqa: E402

ARTICLE_SECTIONS = ("ai_ml", "dev_tools", "big_tech", "quick_bites")
ALLOWED_ARTICLE_FIELDS = {"id", "title", "excerpt", "body"}
ALLOWED_TWEET_FIELDS = {"id", "content", "context", "thread", "quotedContent"}
ALLOWED_REDDIT_FIELDS = {"id", "title", "summary"}
ALLOWED_THREADS_FIELDS = {"id", "content", "context"}


def issue_number(date: str) -> int:
    idx = load_json(DATA_DIR / "index.json", {"issues": []}) or {"issues": []}
    same = next((i for i in idx["issues"] if i.get("date") == date), None)
    if same:
        return int(same["issueNumber"])
    return max([int(i.get("issueNumber", 0)) for i in idx["issues"]] + [0]) + 1


def read_time(text: str) -> int:
    words = len((text or "").split())
    return max(2, min(12, math.ceil(words / 180)))


def gradient(id_: str) -> int:
    return int(hashlib.sha1(id_.encode()).hexdigest(), 16) % 8


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--draft", default=None)
    ap.add_argument("--candidates", default=None)
    ap.add_argument("--out", default=None)
    args = ap.parse_args()
    rd = run_dir()
    draft_path = Path(args.draft or rd / "draft.json")
    cand_path = Path(args.candidates or rd / "candidates.json")
    out_path = Path(args.out or rd / "magazine.json")

    draft = load_json(draft_path)
    cands = load_json(cand_path)
    if not draft or not cands:
        log(f"❌ missing {draft_path if not draft else cand_path}")
        return 1
    errors: list[str] = []
    arts = {a["id"]: a for a in cands["articles"]}
    tweets = {t["id"]: t for t in cands["tweets"]}
    reddit = {p["id"]: p for p in cands["reddit"]}
    threads = {p["id"]: p for p in cands["threads"]}

    def check_fields(item: dict, allowed: set, where: str):
        extra = set(item) - allowed
        if extra:
            errors.append(f"{where}: unexpected fields {sorted(extra)} (only {sorted(allowed)} allowed)")

    def article(item: dict, section: str, where: str) -> dict | None:
        check_fields(item, ALLOWED_ARTICLE_FIELDS, where)
        c = arts.get(item.get("id"))
        if not c:
            errors.append(f"{where}: unknown article id {item.get('id')!r}")
            return None
        out = {
            "id": c["id"],
            "title": (item.get("title") or "").strip(),
            "originalTitle": c["title"],
            "excerpt": (item.get("excerpt") or "").strip(),
            "url": c["url"],
            "source": c["source"],
            "publisher": c["publisher"],
            "tier": c["tier"],
            "category": section if section != "highlights" else c["category"],
            "publishedAt": c["publishedAt"],
            "readTime": read_time(c.get("content") or c.get("description") or ""),
            "imageGradient": gradient(c["id"]),
        }
        if item.get("body"):
            if section == "quick_bites":
                errors.append(f"{where}: quick_bites items have no body (title + excerpt only)")
            if c.get("contentSource") not in ("jina", "direct", "feed"):
                errors.append(f"{where}: body not allowed — candidate has no full text (contentSource={c.get('contentSource')})")
            out["body"] = item["body"].strip()
        if c.get("hnUrl"):
            out["hnUrl"] = c["hnUrl"]
            out["points"] = c.get("points", 0)
            out["numComments"] = c.get("numComments", 0)
        return out

    mag = {
        "date": cands["date"],
        "issueNumber": issue_number(cands["date"]),
        "asOf": cands["as_of"],
        "cover": {
            "mainHeadline": (draft.get("cover", {}).get("mainHeadline") or "").strip(),
            "mainExcerpt": (draft.get("cover", {}).get("mainExcerpt") or "").strip(),
            "headlines": [h.strip() for h in draft.get("cover", {}).get("headlines", [])],
        },
        "highlights": [],
        "sections": {"ai_ml": [], "dev_tools": [], "big_tech": [], "twitter_pulse": [], "threads_pulse": [],
                     "reddit_pulse": [], "quick_bites": []},
    }
    for i, item in enumerate(draft.get("highlights", [])):
        a = article(item, "highlights", f"highlights[{i}]")
        if a:
            mag["highlights"].append(a)
    dsec = draft.get("sections", {})
    unknown = set(dsec) - set(mag["sections"])
    if unknown:
        errors.append(f"unknown sections {sorted(unknown)}")
    for sec in ARTICLE_SECTIONS:
        for i, item in enumerate(dsec.get(sec, [])):
            a = article(item, sec, f"{sec}[{i}]")
            if a:
                mag["sections"][sec].append(a)
    for i, item in enumerate(dsec.get("twitter_pulse", [])):
        where = f"twitter_pulse[{i}]"
        check_fields(item, ALLOWED_TWEET_FIELDS, where)
        c = tweets.get(item.get("id"))
        if not c:
            errors.append(f"{where}: unknown tweet id {item.get('id')!r}")
            continue
        t = {
            "id": c["id"], "author": c["author"], "handle": c["handle"],
            "content": (item.get("content") or "").strip(),
            "context": (item.get("context") or "").strip(),
            "url": c["url"], "publishedAt": c["publishedAt"],
            "metrics": {k: int(c["metrics"].get(k, 0)) for k in ("likes", "retweets", "replies", "views")},
        }
        if c.get("retweetedBy"):
            t["retweetedBy"] = c["retweetedBy"]
        if c.get("thread"):
            if len(item.get("thread") or []) != len(c["thread"]):
                errors.append(f"{where}: candidate has a {len(c['thread'])}-part thread; draft.thread must translate every part")
            t["thread"] = [s.strip() for s in item.get("thread") or []]
        elif item.get("thread"):
            errors.append(f"{where}: draft has thread but candidate has none")
        if c.get("quoted"):
            if not item.get("quotedContent"):
                errors.append(f"{where}: candidate quotes another tweet; draft.quotedContent (Korean) is required")
            t["quoted"] = {"author": c["quoted"]["author"], "handle": c["quoted"]["handle"], "url": c["quoted"]["url"],
                           "content": (item.get("quotedContent") or "").strip()}
        if c.get("linkedArticleIds"):
            t["linkedArticleIds"] = c["linkedArticleIds"]
        mag["sections"]["twitter_pulse"].append(t)
    for i, item in enumerate(dsec.get("reddit_pulse", [])):
        where = f"reddit_pulse[{i}]"
        check_fields(item, ALLOWED_REDDIT_FIELDS, where)
        c = reddit.get(item.get("id"))
        if not c:
            errors.append(f"{where}: unknown reddit id {item.get('id')!r}")
            continue
        mag["sections"]["reddit_pulse"].append({
            "id": c["id"], "title": (item.get("title") or "").strip(), "originalTitle": c["title"],
            "summary": (item.get("summary") or "").strip(), "url": c["url"], "subreddit": c["subreddit"],
            "score": 0, "rank": c["rank"], "publishedAt": c["publishedAt"],
        })
    for i, item in enumerate(dsec.get("threads_pulse", [])):
        where = f"threads_pulse[{i}]"
        check_fields(item, ALLOWED_THREADS_FIELDS, where)
        c = threads.get(item.get("id"))
        if not c:
            errors.append(f"{where}: unknown threads id {item.get('id')!r}")
            continue
        mag["sections"]["threads_pulse"].append({
            "id": c["id"], "author": c["author"], "handle": c["handle"],
            "content": (item.get("content") or "").strip(), "context": (item.get("context") or "").strip(),
            "url": c["url"], "publishedAt": c["publishedAt"], "platform": "threads",
        })

    if errors:
        log("❌ assemble errors:")
        for e in errors:
            log(f"  - {e}")
        return 1
    save_json(out_path, mag)
    log(f"✓ assembled issue #{mag['issueNumber']} ({mag['date']}) → {out_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
