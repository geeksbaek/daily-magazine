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
from lib import (SeenStore, as_of, dedupe_key, iso_kst, load_config, log, result_envelope, run_dir,  # noqa: E402
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


def fetch_page(url: str) -> tuple[str, str]:
    """(html, text). Direct first; sites behind bot protection (openai.com → 403) via r.jina.ai."""
    try:
        html = fetch_bytes(url, timeout=25, accept="text/html").decode("utf-8", errors="replace")
        ex = _TextExtractor()
        try:
            ex.feed(html)
        except Exception:  # noqa: BLE001
            pass
        return html, ex.text()
    except Exception as e:  # noqa: BLE001
        if getattr(e, "code", None) not in (401, 403, 429, 503):
            raise
    raw = ""
    for delay in (0, 8, 20):  # r.jina.ai rate-limits bursts with 403/429
        time.sleep(delay)
        try:
            raw = fetch_bytes(f"https://r.jina.ai/{url}", timeout=40, accept="text/plain").decode("utf-8", errors="replace")
            break
        except Exception as e:  # noqa: BLE001
            if getattr(e, "code", None) not in (403, 429) or delay == 20:
                raise
    title = re.search(r"^Title:\s*(.+)$", raw, re.M)
    pub = re.search(r"^Published Time:\s*(\S+)", raw, re.M)
    body = re.sub(r"^.*?Markdown Content:\s*", "", raw, count=1, flags=re.S)
    body = re.sub(r"!?\[([^\]]*)\]\([^)]*\)", r"\1", body)  # markdown links → text
    fake_html = ""
    if title:
        fake_html += f'<meta property="og:title" content="{title.group(1).strip()}">'
    if pub:
        fake_html += f'<meta property="article:published_time" content="{pub.group(1)}">'
    return fake_html, body


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
    late_h = int(rcfg.get("late_arrival_hours", 48))
    late_days = int(rcfg.get("late_arrival_max_age_days", 7))
    for site in sites:
        name, per_site = site["name"], int(site.get("max_pages", 15))
        inc = re.compile(site["include"])
        seen = SeenStore("site_" + re.sub(r"[^a-z0-9]+", "_", name.lower()))
        try:
            entries = sitemap_entries(site["sitemap"])
        except Exception as e:  # noqa: BLE001
            errors.append(f"{name}: sitemap {str(e)[:100]}")
            log(f"✗ {name}: sitemap {e}")
            continue
        matching = sorted({u.rstrip("/") + ("/" if u.endswith("/") else ""): d for u, d in entries
                           if inc.search(u) and not LOCALE_RE.search(u)}.items())
        for u, _ in matching:
            seen.mark(dedupe_key(u))
        if site.get("discovery") == "new_urls":
            # lastmod is useless here (bumped on every deploy) → only URLs never seen before
            cand = [(u, d) for u, d in matching if seen.is_new(dedupe_key(u), late_h)]
            if not seen.bootstrapped:
                log(f"  {name}: first run — recorded {len(matching)} existing URLs as baseline")
        else:
            cand = [(u, d) for u, d in matching if d and d >= cutoff]
        cand.sort(key=lambda x: (x[1] or cutoff, x[0]), reverse=True)
        cand = cand[:per_site]
        # sitemaps lag behind new posts → also take the newest links from the listing page;
        # these have no lastmod, so the page's own date decides (filtered below)
        known = {u for u, _ in cand}
        listed = 0
        if site.get("listing"):
            try:
                lhtml = fetch_bytes(site["listing"], timeout=25, accept="text/html").decode("utf-8", errors="replace")
                origin = re.match(r"^https?://[^/]+", site["listing"]).group(0)
                for href in re.findall(r'href="([^"#?]+)"', lhtml):
                    url = href if href.startswith("http") else origin + href
                    url = url.rstrip("/")
                    if inc.search(url) and not LOCALE_RE.search(url) and url not in known:
                        known.add(url)
                        cand.append((url, None))
                        listed += 1
                        if listed >= int(site.get("listing_max", 12)):
                            break
            except Exception as e:  # noqa: BLE001
                errors.append(f"{name}: listing {str(e)[:100]}")
        n = 0
        for url, lastmod in cand:
            try:
                html, text = fetch_page(url)
            except Exception as e:  # noqa: BLE001
                errors.append(f"{name}: {url} {str(e)[:80]}")
                continue
            key = dedupe_key(url)
            is_new = seen.is_new(key, late_h)
            first_seen = seen.mark(key)
            pub = page_date(text, html)
            date_source = "page"
            if not pub:
                if not is_new:
                    # lastmod bumps on every republish, so it cannot stand in for a publish date
                    log(f"  skip (no publish date on page): {url}")
                    continue
                pub, date_source = first_seen, "first_seen"  # undated page that appeared since the last run
            elif lastmod and pub.date() == lastmod.date() and lastmod <= as_of():
                pub = lastmod  # same day and not after the run → keep the precise time
            late = False
            if pub < cutoff:
                if not (is_new and pub >= as_of() - timedelta(days=late_days)):
                    continue
                late = True
            if pub > as_of() + timedelta(hours=1):
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
                "dateSource": date_source,
                **({"lateArrival": True, "firstSeenAt": first_seen.isoformat()} if late else {}),
            })
            n += 1
            time.sleep(0.5)
        seen.save()
        log(f"✓ {name}: {n} (checked {len(cand) - listed} sitemap + {listed} listing links)")
    items.sort(key=lambda x: (x["publishedAt"], x["url"]), reverse=True)
    save_json(run_dir() / "sites.json", result_envelope("sites", items, errors, window_hours=window,
                                                        sites=[s["name"] for s in sites]))
    log(f"sites: {len(items)} articles → {run_dir() / 'sites.json'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
