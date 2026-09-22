#!/usr/bin/env python3
"""Collect well-received Hacker News stories via the official Algolia search API → <run_dir>/hn.json"""
from __future__ import annotations

import json
import socket
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib import (USER_AGENT, as_of, dedupe_key, iso_kst, load_config, log, result_envelope,  # noqa: E402
                 run_dir, save_json, strip_html)

socket.setdefaulttimeout(20)


def main() -> int:
    cfg = load_config().get("hackernews", {})
    min_points = int(cfg.get("min_points", 100))
    window = int(cfg.get("window_hours", 48))
    max_items = int(cfg.get("max_items", 60))
    since = int((as_of() - timedelta(hours=window)).timestamp())
    until = int(as_of().timestamp())
    q = urllib.parse.urlencode({
        "tags": "story",
        "numericFilters": f"created_at_i>{since},created_at_i<={until},points>={min_points}",
        "hitsPerPage": 100,
    })
    url = f"https://hn.algolia.com/api/v1/search?{q}"
    items, errors = [], []
    try:
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(req, timeout=20) as resp:
            data = json.load(resp)
        for h in data.get("hits", []):
            hn_url = f"https://news.ycombinator.com/item?id={h['objectID']}"
            link = h.get("url") or hn_url
            pub = datetime.fromtimestamp(h["created_at_i"], tz=timezone.utc)
            items.append({
                "id": f"hn_{h['objectID']}",
                "title": strip_html(h.get("title", "")),
                "url": link,
                "dedupe_key": dedupe_key(link),
                "hnUrl": hn_url,
                "source": "Hacker News",
                "publisher": "Hacker News",
                "category": "quick_bites",
                "tier": 3,
                "points": int(h.get("points") or 0),
                "numComments": int(h.get("num_comments") or 0),
                "author": h.get("author", ""),
                "publishedAt": iso_kst(pub),
                "description": strip_html(h.get("story_text") or "")[:800],
            })
    except Exception as e:  # noqa: BLE001
        errors.append(f"algolia: {str(e)[:160]}")
    items.sort(key=lambda x: (-x["points"], x["id"]))
    items = items[:max_items]
    out = result_envelope("hackernews", items, errors, min_points=min_points, window_hours=window)
    save_json(run_dir() / "hn.json", out)
    log(f"hn: {len(items)} stories ≥{min_points} points → {run_dir() / 'hn.json'}")
    return 0 if items else 1


if __name__ == "__main__":
    sys.exit(main())
