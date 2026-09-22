#!/usr/bin/env python3
"""Publish <run_dir>/magazine.json: re-validate, copy into public/data/<date>/, upsert index.json,
commit + push, verify the remote, then wait for GitHub Pages to serve the new issue.

Must run on the host (git credentials live in the macOS keychain), e.g. via Desktop Commander.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib import DATA_DIR, REPO, load_config, load_json, log, run_dir, save_json  # noqa: E402


def sh(*cmd, check=True) -> str:
    r = subprocess.run(cmd, cwd=REPO, capture_output=True, text=True)
    if check and r.returncode != 0:
        raise RuntimeError(f"{' '.join(cmd)} failed: {r.stderr.strip() or r.stdout.strip()}")
    return r.stdout.strip()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--magazine", default=None)
    ap.add_argument("--dry-run", action="store_true", help="validate + write files only, no git")
    ap.add_argument("--no-push", action="store_true", help="commit locally but do not push")
    ap.add_argument("--no-wait", action="store_true")
    args = ap.parse_args()
    rd = run_dir()
    src = Path(args.magazine or rd / "magazine.json")
    cands = rd / "candidates.json"

    # 1. validate exactly the bytes we are about to publish
    r = subprocess.run([sys.executable, str(REPO / "scripts" / "validate.py"), str(src), "--candidates", str(cands)],
                       capture_output=True, text=True)
    print(r.stdout, end="")
    if r.returncode != 0:
        log("❌ validation failed — not publishing")
        return 1
    digest = hashlib.sha256(src.read_bytes()).hexdigest()
    mag = json.loads(src.read_text(encoding="utf-8"))
    date = mag["date"]

    # 2. copy + index upsert (newest first)
    dest = DATA_DIR / date / "magazine.json"
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(src.read_bytes())
    if hashlib.sha256(dest.read_bytes()).hexdigest() != digest:
        log("❌ copied file hash mismatch")
        return 1
    idx = load_json(DATA_DIR / "index.json", {"issues": []}) or {"issues": []}
    entry = {"date": date, "issueNumber": mag["issueNumber"], "mainHeadline": mag["cover"]["mainHeadline"],
             "headlines": mag["cover"]["headlines"]}
    issues = [i for i in idx["issues"] if i.get("date") != date]
    issues.insert(0, entry)
    issues.sort(key=lambda i: i["date"], reverse=True)
    idx["issues"] = issues
    save_json(DATA_DIR / "index.json", idx)
    log(f"✓ wrote {dest.relative_to(REPO)} and index.json (issue #{mag['issueNumber']})")

    # 3. git
    if args.dry_run:
        log("dry run: files written, git skipped (restore with: git checkout -- public/data)")
        return 0
    if sh("git", "rev-parse", "--abbrev-ref", "HEAD") != "main":
        log("❌ not on main")
        return 1
    paths = [str(dest.relative_to(REPO)), "public/data/index.json"]
    sh("git", "add", "--", *paths)
    if not sh("git", "status", "--porcelain", "--", *paths):
        log("nothing to commit (already published)")
    else:  # commit ONLY these paths, whatever else happens to be staged on the host
        sh("git", "commit", "-m", f"Add magazine issue #{mag['issueNumber']} - {date}", "--only", "--", *paths)
    if args.no_push:
        return 0
    for attempt in range(3):
        try:
            sh("git", "push", "origin", "main")
            break
        except RuntimeError as e:
            log(f"push failed ({attempt + 1}/3): {e}")
            if attempt == 2:
                return 1
            try:
                sh("git", "pull", "--rebase", "origin", "main")
            except RuntimeError as e2:
                log(f"rebase failed: {e2}")
                return 1
    sh("git", "fetch", "origin")
    if sh("git", "rev-parse", "HEAD") != sh("git", "rev-parse", "origin/main"):
        log("❌ PUSH_FAILED: HEAD != origin/main")
        return 1
    log("✓ PUSH_OK")

    # 4. wait for Pages
    if args.no_wait:
        return 0
    site = load_config().get("publish", {}).get("site_url", "").rstrip("/")
    url = f"{site}/data/{date}/magazine.json?t={int(time.time())}"
    deadline = time.time() + 360
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=15) as resp:
                body = resp.read()
            if hashlib.sha256(body).hexdigest() == digest:  # exact bytes we validated, not just the same issue number
                log(f"✓ DEPLOY_OK {site}/")
                return 0
        except Exception:  # noqa: BLE001
            pass
        time.sleep(20)
        url = f"{site}/data/{date}/magazine.json?t={int(time.time())}"
    log("⚠️ DEPLOY_PENDING: push succeeded but Pages has not served the new issue within 6 minutes")
    return 3


if __name__ == "__main__":
    sys.exit(main())
