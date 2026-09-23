#!/usr/bin/env python3
"""Shared helpers for the GEEK/DAILY collection pipeline.

Design rules (see docs/PIPELINE.md):
- Everything is keyed off a fixed ``as_of`` instant (06:00 KST of the run date by default)
  so that every stage shares the same time windows.
- Files are written atomically (tmp + rename) so a timeout never leaves a half-written JSON.
- URLs keep their original form for publishing; a separate conservative ``dedupe_key``
  is used only for duplicate detection.
"""
from __future__ import annotations

import hashlib
import html
import json
import os
import re
import sys
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

KST = timezone(timedelta(hours=9))
REPO = Path(__file__).resolve().parent.parent
CONFIG_DIR = REPO / "config"
DATA_DIR = REPO / "public" / "data"
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/128.0 Safari/537.36 daily-magazine/2.0"
)

# --------------------------------------------------------------------------- time

_AS_OF_CACHE: datetime | None = None


def as_of() -> datetime:
    """Fixed reference instant shared by every stage of one run.

    Resolution order: ``DM_AS_OF`` env (ISO 8601) → ``<run_dir>/as_of.txt`` written by the first
    stage of the run → now (then persisted to as_of.txt). collect_all.sh sets DM_AS_OF at start,
    so collectors, build_candidates, assemble and validate all see identical time windows even
    if the run takes 30 minutes or is resumed later.
    """
    global _AS_OF_CACHE
    if _AS_OF_CACHE:
        return _AS_OF_CACHE
    marker = _run_dir_path() / "as_of.txt"
    env = os.environ.get("DM_AS_OF")
    if env:
        _AS_OF_CACHE = datetime.fromisoformat(env).astimezone(timezone.utc)
        if not marker.exists():  # first stage of a run pins the instant for later stages
            try:
                marker.parent.mkdir(parents=True, exist_ok=True)
                marker.write_text(_AS_OF_CACHE.isoformat())
            except OSError:
                pass
        return _AS_OF_CACHE
    if marker.exists():
        _AS_OF_CACHE = datetime.fromisoformat(marker.read_text().strip()).astimezone(timezone.utc)
        return _AS_OF_CACHE
    now = datetime.now(timezone.utc).replace(second=0, microsecond=0)
    marker.parent.mkdir(parents=True, exist_ok=True)
    marker.write_text(now.isoformat())
    _AS_OF_CACHE = now
    return now


def run_date() -> str:
    """Issue date = KST date of as_of (the 06:00 run and a 23:00 manual run both map to that day)."""
    return as_of().astimezone(KST).strftime("%Y-%m-%d")


def _run_dir_path() -> Path:
    env = os.environ.get("DM_RUN_DIR")
    if env:
        return Path(env)
    return Path(f"/tmp/daily-magazine/{datetime.now(KST).strftime('%Y-%m-%d')}")


def run_dir() -> Path:
    base = _run_dir_path()
    base.mkdir(parents=True, exist_ok=True)
    return base


def iso_kst(dt: datetime) -> str:
    return dt.astimezone(KST).isoformat(timespec="seconds")


def parse_iso(s: str) -> datetime | None:
    if not s:
        return None
    try:
        dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def struct_to_dt(val) -> datetime | None:
    if not val:
        return None
    try:
        return datetime(*val[:6], tzinfo=timezone.utc)
    except Exception:
        return None

# --------------------------------------------------------------------------- io

def load_json(path: Path, default=None):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return default


def save_json(path: Path, obj) -> None:
    """Atomic JSON write (same directory tmp file + os.replace)."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix=f".{path.name}.", dir=str(path.parent))
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(obj, f, ensure_ascii=False, indent=2, sort_keys=False)
            f.write("\n")
        os.replace(tmp, path)
    except Exception:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise


def load_config() -> dict:
    return load_json(CONFIG_DIR / "sources.json", {})


def result_envelope(source_type: str, items: list, errors: list, **meta) -> dict:
    return {
        "source_type": source_type,
        "as_of": as_of().isoformat(),
        "collected_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "status": "failed" if (not items and errors) else ("partial" if errors else "complete"),
        "count": len(items),
        **meta,
        "errors": errors,
        "items": items,
    }


def log(msg: str) -> None:
    print(msg, file=sys.stderr, flush=True)

# --------------------------------------------------------------------------- text

_TAG_RE = re.compile(r"<[^>]+>")
_WS_RE = re.compile(r"\s+")


def strip_html(text: str | None) -> str:
    if not text:
        return ""
    t = _TAG_RE.sub(" ", text)
    t = html.unescape(t)
    return _WS_RE.sub(" ", t).strip()


def has_hangul(s: str | None) -> bool:
    return bool(s) and any("가" <= c <= "힣" for c in s)


_STOP = set(
    """a an the and or of to in on for with by from at as is are was were be been this that these those
    it its into over under about after before new how why what when your you we our their his her
    vs via than then also just more most less can could will would should may might""".split()
)


def _stem(w: str) -> str:
    for suf in ("ing", "ies", "ed", "es", "s"):
        if len(w) > len(suf) + 3 and w.endswith(suf):
            return w[: -len(suf)] + ("y" if suf == "ies" else "")
    return w


def title_tokens(title: str) -> set[str]:
    t = re.sub(r"[^0-9a-zA-Z가-힣\s]", " ", (title or "").lower())
    return {_stem(w) for w in t.split() if len(w) >= 3 and w not in _STOP}


def similar_titles(a: set, b: set, jac: float = 0.5) -> bool:
    """Same-story heuristic: Jaccard ≥ jac, or ≥3 shared tokens covering ≥60% of the shorter title."""
    if not a or not b:
        return False
    inter = len(a & b)
    if inter / len(a | b) >= jac:
        return True
    return inter >= 3 and inter / min(len(a), len(b)) >= 0.6


def jaccard(a: set, b: set) -> float:
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)

# --------------------------------------------------------------------------- urls

# only parameters that are unambiguously tracking; content-identifying params (id, p, s, t, v…) stay
_TRACKING_PARAMS = {
    "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "utm_id",
    "fbclid", "gclid", "dclid", "msclkid", "mc_cid", "mc_eid", "ref_src", "igshid", "cmpid", "ncid",
    "sr_share", "smid", "smtyp", "_hsenc", "_hsmi", "mkt_tok",
}


def dedupe_key(url: str) -> str:
    """Conservative canonical form used ONLY for duplicate detection (never published)."""
    if not url:
        return ""
    try:
        parts = urlsplit(url.strip())
    except ValueError:
        return url.strip().lower()
    scheme = "https"
    host = (parts.hostname or "").lower()
    if host.startswith("www."):
        host = host[4:]
    if host in ("x.com", "twitter.com", "mobile.twitter.com"):
        host = "x.com"
    path = re.sub(r"/+$", "", parts.path or "") or "/"
    path = re.sub(r"/index\.html?$", "", path) or "/"
    query = [(k, v) for k, v in parse_qsl(parts.query, keep_blank_values=False)
             if k.lower() not in _TRACKING_PARAMS and not k.lower().startswith("utm_")]
    query.sort()
    # Reddit: the slug after the post id is optional; keep only /r/<sub>/comments/<id>
    m = re.match(r"^/r/([^/]+)/comments/([^/]+)", path)
    if host == "reddit.com" and m:
        path = f"/r/{m.group(1).lower()}/comments/{m.group(2)}"
        query = []
    if host in ("news.ycombinator.com",):
        query = [(k, v) for k, v in query if k == "id"]
    return urlunsplit((scheme, host, path, urlencode(query), ""))


def short_id(prefix: str, key: str, n: int = 10) -> str:
    return f"{prefix}_{hashlib.sha1(key.encode('utf-8')).hexdigest()[:n]}"

# --------------------------------------------------------------------------- history

MAGAZINE_ARTICLE_SECTIONS = ("ai_ml", "dev_tools", "big_tech", "quick_bites")
MAGAZINE_ALL_SECTIONS = MAGAZINE_ARTICLE_SECTIONS + ("twitter_pulse", "threads_pulse", "reddit_pulse")


def iter_magazine_items(mag: dict):
    for a in mag.get("highlights", []) or []:
        yield "highlights", a
    for sec in MAGAZINE_ALL_SECTIONS + ("community_pulse",):
        for a in (mag.get("sections", {}) or {}).get(sec, []) or []:
            yield sec, a


def load_history(n_issues: int, before_date: str) -> dict:
    """URLs/ids/title-token-sets published in the ``n_issues`` issues strictly before ``before_date``."""
    idx = load_json(DATA_DIR / "index.json", {"issues": []}) or {"issues": []}
    issues = sorted((i for i in idx.get("issues", []) if i.get("date") and i["date"] < before_date),
                    key=lambda i: i["date"], reverse=True)[:n_issues]
    urls: set[str] = set()
    ids: set[str] = set()
    titles: list[tuple[str, set[str]]] = []
    dates: list[str] = []
    for issue in issues:
        mag = load_json(DATA_DIR / issue["date"] / "magazine.json")
        if not mag:
            continue
        dates.append(issue["date"])
        for _, item in iter_magazine_items(mag):
            u = item.get("url")
            if u:
                urls.add(dedupe_key(u))
            if item.get("id"):
                ids.add(item["id"])
            t = item.get("originalTitle") or item.get("title") or ""
            toks = title_tokens(t)
            if len(toks) >= 3:
                titles.append((issue["date"], toks))
    return {"dates": dates, "urls": urls, "ids": ids, "titles": titles}

# --------------------------------------------------------------------------- first-seen state

STATE_DIR = Path(os.path.expanduser(os.environ.get("DM_STATE_DIR", "~/.daily-magazine/state")))


class SeenStore:
    """Persistent {dedupe_key: first-seen as_of} per collector.

    Sources that backdate posts (OpenAI adds RSS items with an earlier pubDate hours later) or
    publish pages without any date can't be windowed by publish date alone. A URL that was NOT
    present in any earlier run is new, whatever date it shows. The very first run only records
    (bootstrap) so the existing archive is not mistaken for news.
    """

    def __init__(self, name: str):
        self.path = STATE_DIR / f"seen_{name}.json"
        raw = load_json(self.path, None)
        self.bootstrapped = raw is not None
        raw = raw or {}
        self.meta = raw.get("_meta", {"bootstrapped_at": as_of().isoformat()})
        self.data: dict[str, str] = {k: v for k, v in raw.items() if k != "_meta"}

    def mark(self, key: str) -> datetime:
        """Record key (if new) and return its first-seen instant."""
        if key not in self.data:
            self.data[key] = as_of().isoformat()
        return datetime.fromisoformat(self.data[key])

    def is_new(self, key: str, within_hours: int) -> bool:
        """First seen within the window, and not merely part of the bootstrap snapshot."""
        if not self.bootstrapped or key not in self.data:
            return False
        seen = self.data[key]
        if seen == self.meta.get("bootstrapped_at"):
            return False
        return datetime.fromisoformat(seen) >= as_of() - timedelta(hours=within_hours)

    def save(self) -> None:
        cutoff = (as_of() - timedelta(days=120)).isoformat()  # prune: keeps the file small
        keep = {k: v for k, v in self.data.items() if v >= cutoff or v == self.meta.get("bootstrapped_at")}
        save_json(self.path, {"_meta": self.meta, **dict(sorted(keep.items()))})
