#!/usr/bin/env python3
"""Collect articles from sites WITHOUT an RSS feed (Anthropic news/research/engineering,
claude.com blog) via their sitemap.xml → <run_dir>/sites.json

sitemap <lastmod> is only a pre-filter (it bumps on republish); the publish date is read from the
article page itself (first "Mon D, YYYY" in the main text, JSON-LD datePublished, or
article:published_time), falling back to lastmod. Items share the rss.json item shape.
"""
from __future__ import annotations

import re
import socket
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from collect_rss import _TextExtractor, fetch_bytes  # noqa: E402
from lib import (as_of, dedupe_key, iso_kst, load_config, log, result_envelope, run_dir,  # noqa: E402
                 save_json, strip_html)

socket.setdefaulttimeout(20)
MONTHS = {m: i for i, m in enumerate(
    ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"], 1)}
DATE_RE = re.compile(r"\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.? (\d{1,2}), (20\d{2})\b")
LOCALE_RE = re.compile(r"^https?://[^/]+/(ja|de|fr|es|ko|pt|pt-br|it|zh|zh-tw|id|nl|pl|tr)/", re.I)


def parse_lastmod(s: str) -> datetime | None:
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00")).astimezone(timezone.utc)
    except ValueError:
        return None


def sitemap_entries(url: str) -> list[tuple[str, datetime | None]]:
    raw = fetch_bytes(url, timeout=30, accept="application/xml,text/xml,*/*").decode("utf-8", errors="replace")
    if "<sitemapindex" in raw:  # nested index → follow children
        out = []
        for child in re.findall(r"<loc>(.*?)</loc>", raw):
            try:
                out.extend(sitemap_entries(child.strip()))
            except Exception as e:  # noqa: BLE001
                log(f"  child sitemap ✗ {child}: {e}")
        return out
    out = []
    for block in re.findall(r"<url>(.*?)</url>", raw, flags=re.S):
        loc = re.search(r"<loc>(.*?)</loc>", block)
        mod = re.search(r"<lastmod>(.*?)</lastmod>", block)
        if loc:
            out.append((loc.group(1).strip(), parse_lastmod(mod.group(1).strip()) if mod else None))
    return out


def page_date(text: str, html: str) -> datetime | None:
    m = re.search(r'"datePublished"\s*:\s*"([^"]+)"', html) or \
        re.search(r'property="article:published_time"\s+content="([^"]+)"', html)
    if m:
        dt = parse_lastmod(m.group(1))
        if dt:
            return dt
    m = DATE_RE.search(text[:4000])
    if m:
        mon = MONTHS.get(m.group(1)[:3].lower())
        try:
            return datetime(int(m.group(3)), mon, int(m.group(2)), tzinfo=timezone.utc)
        except (TypeError, ValueError):
            return None
    return None


def meta(html: str, key: str) -> str:
    m = re.search(rf'<meta[^>]+(?:property|name)="{re.escape(key)}"[^>]+content="([^"]*)"', html) or \
        re.search(rf'<meta[^>]+content="([^"]*)"[^>]+(?:property|name)="{re.escape(key)}"', html)
    return strip_html(m.group(1)) if m else ""


def main() -> int:
    cfg = load_config()
    sites = cfg.get("sites", [])
    rcfg = cfg.get("rss", {})
    window = int(rcfg.get("collect_window_hours", 72))
    max_chars = int(rcfg.get("fulltext_chars", 3000))
    cutoff = as_of() - timedelta(hours=window)
    items, errors = [], []
    for site in sites:
        name, per_site = site["name"], int(site.get("max_pages", 15))
        inc = re.compile(site["include"])
        try:
            entries = sitemap_entries(site["sitemap"])
        except Exception as e:  # noqa: BLE001
            errors.append(f"{name}: sitemap {str(e)[:100]}")
            log(f"✗ {name}: sitemap {e}")
            continue
        cand = [(u, d) for u, d in entries if inc.search(u) and not LOCALE_RE.search(u) and d and d >= cutoff]
        cand.sort(key=lambda x: (x[1], x[0]), reverse=True)
        n = 0
        for url, lastmod in cand[:per_site]:
            try:
                html = fetch_bytes(url, timeout=25, accept="text/html").decode("utf-8", errors="replace")
            except Exception as e:  # noqa: BLE001
                errors.append(f"{name}: {url} {str(e)[:80]}")
                continue
            ex = _TextExtractor()
            try:
                ex.feed(html)
            except Exception:  # noqa: BLE001
                pass
            text = ex.text()
            pub = page_date(text, html)
            if pub and lastmod and pub.date() == lastmod.date():
                pub = lastmod  # same day → keep the precise time
            pub = pub or lastmod
            if not pub or pub < cutoff or pub > as_of() + timedelta(hours=1):
                continue
            title = meta(html, "og:title") or strip_html(re.sub(r"\s*[\\|]\s*(Anthropic|Claude by Anthropic)\s*$", "",
                                                                   (re.search(r"<title>(.*?)</title>", html, re.S) or [None, ""])[1]))
            title = re.sub(r"\s*(\\|\|)\s*(Anthropic|Claude by Anthropic)\s*$", "", title).strip()
            if not title:
                continue
            desc = meta(html, "description") or meta(html, "og:description")
            items.append({
                "title": title, "url": url, "dedupe_key": dedupe_key(url), "source": name,
                "publisher": site.get("publisher", name), "category": site.get("category", "ai_ml"),
                "tier": int(site.get("tier", 1)), "publishedAt": iso_kst(pub),
                "description": desc[:800], "content": text[:max_chars] if len(text) > 300 else desc,
                "content_source": "direct" if len(text) > 300 else "description",
                "sitemapLastmod": lastmod.isoformat() if lastmod else None,
            })
            n += 1
            time.sleep(0.5)
        log(f"✓ {name}: {n} (from {len(cand)} sitemap entries in window)")
    items.sort(key=lambda x: (x["publishedAt"], x["url"]), reverse=True)
    save_json(run_dir() / "sites.json", result_envelope("sites", items, errors, window_hours=window,
                                                        sites=[s["name"] for s in sites]))
    log(f"sites: {len(items)} articles → {run_dir() / 'sites.json'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
