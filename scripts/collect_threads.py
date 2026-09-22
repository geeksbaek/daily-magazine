#!/usr/bin/env python3
"""Collect recent public Threads posts of configured accounts → <run_dir>/threads.json (best effort)."""
from __future__ import annotations

import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib import as_of, iso_kst, load_config, log, result_envelope, run_dir, save_json  # noqa: E402
from x_browser import ResponseSink, dump, launch, walk  # noqa: E402


def extract_posts(payloads: list[dict]) -> list[dict]:
    found: dict[str, dict] = {}

    def visit(d, _p):
        if not (d.get("code") and d.get("taken_at") and isinstance(d.get("user"), dict)):
            return
        text = ((d.get("caption") or {}).get("text") or "").strip()
        if not text:
            return
        username = d["user"].get("username") or ""
        code = d["code"]
        if code in found:
            return
        found[code] = {
            "id": f"th_{code}",
            "code": code,
            "handle": username,
            "author": d["user"].get("full_name") or username,
            "text": text,
            "createdAt": datetime.fromtimestamp(int(d["taken_at"]), tz=timezone.utc).isoformat(),
            "url": f"https://www.threads.com/@{username}/post/{code}",
            "likes": int(d.get("like_count") or 0),
            "replyTo": ((d.get("text_post_app_info") or {}).get("reply_to_author") or {}).get("username"),
        }

    for p in payloads:
        walk(p["data"], visit)
    return list(found.values())


def clean_dom_text(text: str, handle: str) -> str:
    """Rendered card text is '<handle>\n<23m>\n<body...>\nTranslate\n<counts>' — keep the body."""
    lines = [ln.strip() for ln in text.split("\n") if ln.strip()]
    while lines and (lines[0].lower() == handle.lower() or re.fullmatch(r"\d+\s?[smhdw]|\d+/\d+/\d+|[A-Z][a-z]{2} \d{1,2}", lines[0])):
        lines.pop(0)
    while lines and (lines[-1] in ("Translate", "More") or re.fullmatch(r"[\d.,]+[KkMm]?", lines[-1])):
        lines.pop()
    return "\n".join(lines).strip()


def dom_posts(page, handle: str) -> list[dict]:
    js = """() => Array.from(document.querySelectorAll('a[href*="/post/"]')).map(a => {
        const c = a.closest('[data-pressable-container]') || a.parentElement;
        const t = c ? c.querySelector('time') : null;
        return {href: a.getAttribute('href'), text: c ? c.innerText : '', datetime: t ? t.getAttribute('datetime') : ''};
    })"""
    out, seen = [], set()
    for r in page.evaluate(js):
        m = re.search(r"/@([^/]+)/post/([A-Za-z0-9_-]+)", r.get("href") or "")
        if not m or m.group(2) in seen or not r.get("text"):
            continue
        seen.add(m.group(2))
        out.append({"id": f"th_{m.group(2)}", "code": m.group(2), "handle": m.group(1), "author": m.group(1),
                    "text": clean_dom_text(r["text"], m.group(1))[:1000], "createdAt": r.get("datetime") or None,
                    "url": f"https://www.threads.com/@{m.group(1)}/post/{m.group(2)}", "likes": 0, "replyTo": None,
                    "source": "dom"})
    return out


def main() -> int:
    cfg = load_config().get("threads", {})
    accounts = cfg.get("accounts", [])
    cutoff = as_of() - timedelta(hours=int(cfg.get("window_hours", 48)))
    items, errors = [], []
    raw_dir = run_dir() / "threads_raw"
    if not accounts:
        save_json(run_dir() / "threads.json", result_envelope("threads", [], []))
        return 0
    pw, ctx = launch(headed=False)
    page = ctx.pages[0] if ctx.pages else ctx.new_page()
    try:
        for handle in accounts:
            sink = ResponseSink(page, r"/graphql/query")
            try:
                page.goto(f"https://www.threads.com/@{handle}", wait_until="domcontentloaded")
                page.wait_for_timeout(5000)
                page.mouse.wheel(0, 2000)
                page.wait_for_timeout(2500)
                posts = extract_posts(sink.payloads) or dom_posts(page, handle)
                dump(raw_dir / f"{handle}.json", sink.payloads)
                n = 0
                for p in posts:
                    if p["handle"].lower() != handle.lower() or p.get("replyTo"):
                        continue
                    when = datetime.fromisoformat(p["createdAt"].replace("Z", "+00:00")) if p.get("createdAt") else None
                    if not when or when < cutoff:
                        continue
                    p["publishedAt"] = iso_kst(when)
                    items.append(p)
                    n += 1
                log(f"✓ @{handle}: {n} posts")
            except Exception as e:  # noqa: BLE001
                errors.append(f"@{handle}: {str(e)[:120]}")
                log(f"✗ @{handle}: {e}")
    finally:
        ctx.close()
        pw.stop()
    items.sort(key=lambda p: (p["publishedAt"], p["id"]), reverse=True)
    save_json(run_dir() / "threads.json", result_envelope("threads", items, errors, accounts=accounts))
    log(f"threads: {len(items)} posts → {run_dir() / 'threads.json'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
