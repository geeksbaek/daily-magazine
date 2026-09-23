#!/usr/bin/env python3
"""Fetch full text for SELECTED candidate articles that only have a feed summary.

usage: python3 scripts/enrich.py <candidate-id> [...]
The collector's full-text pass is time-boxed and some sites (openai.com) block direct fetches,
so the articles that actually made the issue can end up with a 100-char summary. This fills
`content` (direct HTML → r.jina.ai fallback) in candidates.json so a real body can be written.
"""
from __future__ import annotations

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from collect_sites import fetch_page  # noqa: E402
from lib import load_config, load_json, log, run_dir, save_json  # noqa: E402


def main() -> int:
    ids = set(sys.argv[1:])
    path = run_dir() / "candidates.json"
    cands = load_json(path)
    max_chars = int(load_config().get("rss", {}).get("fulltext_chars", 6000))
    done = 0
    for a in cands["articles"]:
        if a["id"] not in ids or a.get("contentSource") in ("jina", "direct", "feed"):
            continue
        try:
            _, text = fetch_page(a["url"])
        except Exception as e:  # noqa: BLE001
            log(f"✗ {a['id']} {a['url']}: {e}")
            continue
        if len(text) > 400:
            a["content"], a["contentSource"] = text[:max_chars], "direct"
            done += 1
            log(f"✓ {a['id']} {len(text)} chars — {a['title'][:60]}")
        else:
            log(f"✗ {a['id']} too short ({len(text)}) — {a['title'][:60]}")
        time.sleep(1.5)
    save_json(path, cands)
    log(f"enriched {done}/{len(ids)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
