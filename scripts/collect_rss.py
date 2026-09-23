#!/usr/bin/env python3
"""Collect RSS/Atom feeds listed in config/feeds.csv → <run_dir>/rss.json

Deterministic: fixed as_of window, fixed per-feed cap, feeds processed in CSV order,
output sorted by (publishedAt desc, url). Full text for tier-1 sources is fetched
through r.jina.ai and stored so later stages never need the network again.
"""
from __future__ import annotations

import concurrent.futures as cf
import csv
import re
import socket
import sys
import time
import urllib.request
from datetime import timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import feedparser  # noqa: E402
from html.parser import HTMLParser  # noqa: E402

from lib import (CONFIG_DIR, USER_AGENT, SeenStore, as_of, dedupe_key, iso_kst, load_config, log,  # noqa: E402
                 result_envelope, run_dir, save_json, strip_html, struct_to_dt)

socket.setdefaulttimeout(20)


def fetch_bytes(url: str, timeout: int = 20, accept: str = "*/*") -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": accept})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()


class _TextExtractor(HTMLParser):
    """Minimal readable-text extractor: prefers <article>/<main>, skips script/style/nav/footer."""
    SKIP = {"script", "style", "noscript", "nav", "footer", "header", "aside", "svg", "form", "button"}
    BLOCK = {"p", "li", "h1", "h2", "h3", "h4", "pre", "blockquote", "tr", "div", "section"}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.skip_depth = 0
        self.in_main = 0
        self.main_parts: list[str] = []
        self.all_parts: list[str] = []

    def handle_starttag(self, tag, attrs):
        if tag in self.SKIP:
            self.skip_depth += 1
        elif tag in ("article", "main"):
            self.in_main += 1
        if tag in self.BLOCK:
            (self.main_parts if self.in_main else self.all_parts).append("\n")

    def handle_endtag(self, tag):
        if tag in self.SKIP and self.skip_depth:
            self.skip_depth -= 1
        elif tag in ("article", "main") and self.in_main:
            self.in_main -= 1

    def handle_data(self, data):
        if self.skip_depth:
            return
        (self.main_parts if self.in_main else self.all_parts).append(data)

    def text(self) -> str:
        parts = self.main_parts if len("".join(self.main_parts).strip()) > 400 else self.all_parts
        t = re.sub(r"[ \t]+", " ", "".join(parts))
        return re.sub(r"\n\s*\n+", "\n", t).strip()


def fetch_direct(url: str, max_chars: int) -> str:
    try:
        raw = fetch_bytes(url, timeout=20, accept="text/html,application/xhtml+xml")
    except Exception as e:  # noqa: BLE001
        log(f"  direct ✗ {url}: {e}")
        return ""
    ex = _TextExtractor()
    try:
        ex.feed(raw.decode("utf-8", errors="replace"))
    except Exception:  # noqa: BLE001
        return ""
    return ex.text()[:max_chars]


_JINA_FAILS = 0  # consecutive rate-limit failures; after 3 the reader is skipped for the rest of the run


def fetch_fulltext(url: str, max_chars: int) -> tuple[str, str]:
    """(text, source). r.jina.ai first (handles JS-rendered sites); it rate-limits bursts with
    403/429 — after 3 consecutive limits we stop calling it (circuit breaker) and go direct."""
    global _JINA_FAILS
    if _JINA_FAILS < 3:
        try:
            raw = fetch_bytes(f"https://r.jina.ai/{url}", timeout=30, accept="text/plain")
            text = strip_html(raw.decode("utf-8", errors="replace"))
            text = re.sub(r"^Title:.*?Markdown Content:\s*", "", text, count=1, flags=re.S)
            _JINA_FAILS = 0
            if len(text) > 300:
                return text[:max_chars], "jina"
        except Exception as e:  # noqa: BLE001
            if getattr(e, "code", None) in (403, 429):
                _JINA_FAILS += 1
                if _JINA_FAILS == 3:
                    log("  r.jina.ai rate-limited 3× — using direct fetch for the rest of this run")
    text = fetch_direct(url, max_chars)
    if len(text) > 300:
        return text, "direct"
    return "", ""


def parse_feed(row: dict, cfg: dict, cutoff, seen: SeenStore | None = None):
    url = row["RSS URL"].strip()
    source = row["Title"].strip()
    items, err = [], None
    try:
        raw = fetch_bytes(url, timeout=20)
        d = feedparser.parse(raw)
        if not d.entries:  # encoding mis-detection on raw bytes → let feedparser fetch itself
            d = feedparser.parse(url, agent=USER_AGENT)
        if not d.entries:
            raise RuntimeError(f"no entries ({d.get('bozo_exception') or 'empty'})")
        for entry in d.entries[: cfg["per_feed"]]:
            pub = struct_to_dt(getattr(entry, "published_parsed", None)) or \
                  struct_to_dt(getattr(entry, "updated_parsed", None))
            title = strip_html(entry.get("title", ""))
            link = (entry.get("link") or "").strip()
            if not pub or not title or not link:
                continue
            key = dedupe_key(link)
            first_seen = seen.mark(key) if seen else None
            late = False
            if pub < cutoff:
                # backdated item that only just appeared in the feed → still news today
                if not (seen and seen.is_new(key, cfg["late_arrival_hours"]) and pub >= as_of() - timedelta(days=cfg["late_arrival_max_age_days"])):
                    continue
                late = True
            desc = strip_html(entry.get("summary", "") or entry.get("description", ""))
            content = ""
            if entry.get("content"):
                content = strip_html(entry["content"][0].get("value", ""))
            items.append({
                "title": title,
                "url": link,
                "dedupe_key": dedupe_key(link),
                "source": source,
                "publisher": (row.get("Publisher") or source).strip(),
                "category": row["Category"].strip(),
                "tier": int(row.get("Tier") or 2),
                "publishedAt": iso_kst(pub),
                "description": desc[:800],
                "content": content[:cfg["fulltext_chars"]],
                **({"lateArrival": True, "firstSeenAt": first_seen.isoformat()} if late else {}),
            })
    except Exception as e:  # noqa: BLE001
        err = f"{source}: {str(e)[:160]}"
    return source, items, err


def main() -> int:
    cfg = load_config().get("rss", {})
    cfg.setdefault("collect_window_hours", 72)
    cfg.setdefault("per_feed", 20)
    cfg.setdefault("fulltext_tiers", [1])
    cfg.setdefault("fulltext_max", 40)
    cfg.setdefault("fulltext_chars", 3000)
    cfg.setdefault("late_arrival_hours", 48)
    cfg.setdefault("late_arrival_max_age_days", 7)
    cutoff = as_of() - timedelta(hours=cfg["collect_window_hours"])
    seen = SeenStore("rss")

    with open(CONFIG_DIR / "feeds.csv", encoding="utf-8") as f:
        rows = [r for r in csv.DictReader(f) if r.get("RSS URL")]

    all_items, errors = [], []
    with cf.ThreadPoolExecutor(max_workers=8) as ex:
        for source, items, err in ex.map(lambda r: parse_feed(r, cfg, cutoff, seen), rows):
            log(f"{'✓' if not err else '✗'} {source}: {len(items)}" + (f" — {err}" if err else ""))
            all_items.extend(items)
            if err:
                errors.append(err)

    seen.save()
    late = [it for it in all_items if it.get("lateArrival")]
    if late:
        log(f"late arrivals (backdated, first seen now): {len(late)} — " + "; ".join(f"{i['source']}: {i['title'][:40]}" for i in late[:5]))
    # de-dup identical links inside the raw set (same story syndicated to two feeds of one publisher)
    seen, uniq = set(), []
    for it in sorted(all_items, key=lambda x: (x["tier"], x["publishedAt"])):
        if it["dedupe_key"] in seen:
            continue
        seen.add(it["dedupe_key"])
        uniq.append(it)

    # save what we have BEFORE the slow enrichment so a timeout never loses the feed data
    uniq.sort(key=lambda x: (x["publishedAt"], x["url"]), reverse=True)
    for it in uniq:
        it.setdefault("content_source", "feed" if it["content"] else "description")
    save_json(run_dir() / "rss.json", result_envelope("rss", uniq, errors, feeds_total=len(rows),
                                                      feeds_failed=len(errors), window_hours=cfg["collect_window_hours"],
                                                      enrichment="pending"))
    # full text for primary sources (newest first), capped
    targets = [it for it in sorted(uniq, key=lambda x: x["publishedAt"], reverse=True)
               if it["tier"] in cfg["fulltext_tiers"] and len(it["content"]) < 1200][: cfg["fulltext_max"]]
    log(f"fetching full text for {len(targets)} tier-1 articles via r.jina.ai (sequential)")
    enrich_deadline = time.time() + int(cfg.get("fulltext_budget_sec", 240))
    for i, it in enumerate(targets, 1):
        if time.time() > enrich_deadline:
            log(f"  full-text budget exhausted after {i - 1} articles")
            errors.append(f"fulltext: budget exhausted after {i - 1}/{len(targets)}")
            break
        text, how = fetch_fulltext(it["url"], cfg["fulltext_chars"])
        if text:
            it["content"] = text
            it["content_source"] = how
        log(f"  [{i}/{len(targets)}] {'✓ ' + how if text else '✗'} {it['source']}: {it['title'][:50]}")
        time.sleep(1.2)
    for it in uniq:
        it.setdefault("content_source", "feed" if it["content"] else "description")
        if not it["content"]:
            it["content"] = it["description"]

    uniq.sort(key=lambda x: (x["publishedAt"], x["url"]), reverse=True)
    out = result_envelope("rss", uniq, errors, feeds_total=len(rows), feeds_failed=len([e for e in errors if not e.startswith("fulltext")]),
                          window_hours=cfg["collect_window_hours"], enrichment="done")
    save_json(run_dir() / "rss.json", out)
    log(f"rss: {len(uniq)} items from {len(rows) - len(errors)}/{len(rows)} feeds → {run_dir() / 'rss.json'}")
    return 0 if uniq else 1


if __name__ == "__main__":
    sys.exit(main())
