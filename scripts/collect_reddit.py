#!/usr/bin/env python3
"""Collect top posts of the day from configured subreddits via Reddit RSS → <run_dir>/reddit.json

Reddit's JSON API blocks unauthenticated clients, so we use the public RSS endpoint
(/r/<sub>/top/.rss?t=day). It has no score; ``rank`` (1 = top of the day) is kept instead.
"""
from __future__ import annotations

import socket
import sys
import time
import urllib.request
from datetime import timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import feedparser  # noqa: E402

from lib import (as_of, dedupe_key, iso_kst, load_config, log, result_envelope,  # noqa: E402
                 run_dir, save_json, strip_html, struct_to_dt)

socket.setdefaulttimeout(20)


REDDIT_UA = "daily-magazine/2.0 (personal RSS reader; +https://github.com/geeksbaek/daily-magazine)"


def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": REDDIT_UA, "Accept": "application/rss+xml,*/*"})
    with urllib.request.urlopen(req, timeout=20) as resp:
        return resp.read()


def main() -> int:
    cfg = load_config().get("reddit", {})
    subs = cfg.get("subreddits", [])
    per_sub = int(cfg.get("per_sub", 8))
    cutoff = as_of() - timedelta(hours=int(cfg.get("window_hours", 48)))
    bad_kw = [k.lower() for k in cfg.get("exclude_title_keywords", [])]

    items, errors = [], []
    for sub in subs:
        url = f"https://www.reddit.com/r/{sub}/top/.rss?t=day&limit=50"
        raw = None
        backoff = (0, 15, 40)  # reddit answers 429 to bursts; wait it out (bounded: 8 subs must fit the budget)
        for attempt, delay in enumerate(backoff):
            if delay:
                time.sleep(delay)
            try:
                raw = fetch(url)
                break
            except Exception as e:  # noqa: BLE001
                if attempt == len(backoff) - 1:
                    errors.append(f"r/{sub}: {str(e)[:120]}")
        if raw is None:
            log(f"✗ r/{sub}")
            continue
        d = feedparser.parse(raw)
        rank, kept = 0, 0
        for entry in d.entries:
            rank += 1
            link = (entry.get("link") or "").strip()
            if "/comments/" not in link:
                continue
            pub = struct_to_dt(getattr(entry, "published_parsed", None)) or \
                  struct_to_dt(getattr(entry, "updated_parsed", None))
            if not pub or pub < cutoff:
                continue
            title = strip_html(entry.get("title", ""))
            if not title or any(k in title.lower() for k in bad_kw):
                continue
            body = strip_html(entry.get("summary", ""))
            # RSS summary embeds "submitted by /u/x [link] [comments]"; keep text before that
            body = body.split("submitted by")[0].strip()
            author = ""
            if entry.get("author"):
                author = entry["author"].replace("/u/", "").strip()
            items.append({
                "id": f"rd_{link.split('/comments/')[1].split('/')[0]}",
                "title": title,
                "url": link,
                "dedupe_key": dedupe_key(link),
                "subreddit": sub,
                "author": author,
                "rank": rank,
                "publishedAt": iso_kst(pub),
                "body": body[:1200],
            })
            kept += 1
            if kept >= per_sub:
                break
        log(f"✓ r/{sub}: {kept}")
        # checkpoint after every subreddit: a timeout kill keeps everything collected so far
        save_json(run_dir() / "reddit.json", result_envelope("reddit", sorted(items, key=lambda x: (x["subreddit"], x["rank"])),
                                                             errors + [f"in progress: {sub} done"], subreddits=subs))
        time.sleep(3.0)  # be polite; reddit rate-limits bursts

    items.sort(key=lambda x: (x["subreddit"], x["rank"]))
    out = result_envelope("reddit", items, errors, subreddits=subs)
    save_json(run_dir() / "reddit.json", out)
    log(f"reddit: {len(items)} posts → {run_dir() / 'reddit.json'}")
    return 0 if items else 1


if __name__ == "__main__":
    sys.exit(main())
