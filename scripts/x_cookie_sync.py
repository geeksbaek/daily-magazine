#!/usr/bin/env python3
"""Borrow the live X session from the user's regular Chrome, hands-free.

The X collector signs in with "Sign in with Apple", which Apple gates behind a
per-login trusted-device approval — impossible to automate unattended. Instead of
logging in, this script copies the *already valid* X session from the user's
everyday Google Chrome into the collector's dedicated browser profile, so the
collector authenticates without any human step as long as Chrome stays logged in.

Scope and safety:
* Only cookies for ``x.com`` / ``twitter.com`` are read and transferred. No other
  site's cookies are touched, even though the decryption key could open them.
* Cookie values and the Chrome Safe Storage key live in memory only. They are
  never printed, logged, committed, or written anywhere outside the collector's
  own encrypted browser profile.
* Nothing here types a password or answers 2FA.

macOS only (reads Chrome's AES-128-CBC "v10" cookie encryption keyed by the
"Chrome Safe Storage" Keychain item). Requires the ``cryptography`` package.
"""
from __future__ import annotations

import os
import shutil
import sqlite3
import subprocess
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib import log  # noqa: E402
from x_browser import launch, logged_in_handle, profile_dir  # noqa: E402

CHROME_DIR = Path(os.path.expanduser("~/Library/Application Support/Google/Chrome"))
X_HOSTS = ("x.com", "twitter.com")
KEYCHAIN_SAFE_STORAGE = ("Chrome Safe Storage", "Chrome")


def _safe_storage_key() -> bytes | None:
    """Fetch the Chrome Safe Storage password from the Keychain (never logged)."""
    try:
        res = subprocess.run(
            ["security", "find-generic-password", "-w", "-s", KEYCHAIN_SAFE_STORAGE[0], "-a", KEYCHAIN_SAFE_STORAGE[1]],
            capture_output=True,
            text=True,
            timeout=15,
        )
    except Exception as e:  # noqa: BLE001
        log(f"❌ Keychain 접근 실패: {str(e)[:60]}")
        return None
    if res.returncode != 0:
        log("❌ 'Chrome Safe Storage' 키를 Keychain에서 찾지 못했습니다.")
        return None
    pw = res.stdout.rstrip("\n")
    return pw.encode("utf-8") if pw else None


def _derive_key(safe_storage_pw: bytes) -> bytes:
    from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC  # noqa: PLC0415
    from cryptography.hazmat.primitives import hashes  # noqa: PLC0415

    kdf = PBKDF2HMAC(algorithm=hashes.SHA1(), length=16, salt=b"saltysalt", iterations=1003)
    return kdf.derive(safe_storage_pw)


def _decrypt(encrypted: bytes, key: bytes) -> str | None:
    """Decrypt a Chrome macOS 'v10' cookie value. Returns plaintext or None."""
    if not encrypted or encrypted[:3] != b"v10":
        # Unencrypted (rare) or unknown scheme; return as-is if it looks textual.
        try:
            return encrypted.decode("utf-8") if encrypted else ""
        except Exception:  # noqa: BLE001
            return None
    from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes  # noqa: PLC0415

    try:
        cipher = Cipher(algorithms.AES(key), modes.CBC(b" " * 16))
        dec = cipher.decryptor()
        data = dec.update(encrypted[3:]) + dec.finalize()
        if data:
            pad = data[-1]
            if 1 <= pad <= 16:
                data = data[:-pad]
        # Some Chrome versions prepend a 32-byte SHA256 of the host to the value;
        # others store the value directly. Strip the prefix only when the first
        # 32 bytes look binary (a hash), not when they are the printable value.
        if len(data) > 32 and any(b < 0x20 or b > 0x7E for b in data[:32]):
            data = data[32:]
        try:
            return data.decode("utf-8")
        except Exception:  # noqa: BLE001
            return None
    except Exception:  # noqa: BLE001
        return None


def _cookie_db() -> Path | None:
    profile = os.environ.get("DM_CHROME_PROFILE")
    candidates: list[Path] = []
    profiles = [profile] if profile else ["Default", *(f"Profile {i}" for i in range(1, 6))]
    for prof in profiles:
        for leaf in ("Network/Cookies", "Cookies"):
            p = CHROME_DIR / prof / leaf
            if p.exists():
                candidates.append(p)
    # Prefer a DB that actually holds an x.com auth cookie.
    for p in candidates:
        if _has_x_auth(p):
            return p
    return candidates[0] if candidates else None


def _has_x_auth(db: Path) -> bool:
    tmp = Path(tempfile.mkdtemp()) / "c.db"
    try:
        shutil.copy2(db, tmp)
        con = sqlite3.connect(str(tmp))
        n = con.execute(
            "SELECT COUNT(*) FROM cookies WHERE name='auth_token' AND (host_key LIKE '%x.com' OR host_key LIKE '%twitter.com')"
        ).fetchone()[0]
        con.close()
        return n > 0
    except Exception:  # noqa: BLE001
        return False
    finally:
        shutil.rmtree(tmp.parent, ignore_errors=True)


def _read_x_cookies(db: Path, key: bytes) -> list[dict]:
    tmp = Path(tempfile.mkdtemp()) / "c.db"
    out: list[dict] = []
    try:
        shutil.copy2(db, tmp)
        con = sqlite3.connect(str(tmp))
        con.row_factory = sqlite3.Row
        rows = con.execute(
            "SELECT host_key, name, encrypted_value, path, is_secure, is_httponly, expires_utc, samesite "
            "FROM cookies WHERE host_key LIKE '%x.com' OR host_key LIKE '%twitter.com'"
        ).fetchall()
        con.close()
        for r in rows:
            val = _decrypt(r["encrypted_value"], key)
            if val is None or val == "":
                continue
            ss = {0: "None", 1: "Lax", 2: "Strict"}.get(r["samesite"], "Lax")
            # Chrome epoch (1601) microseconds -> Unix seconds; 0 = session cookie.
            exp = r["expires_utc"]
            expires = (exp / 1_000_000 - 11644473600) if exp else -1
            out.append(
                {
                    "name": r["name"],
                    "value": val,
                    "domain": r["host_key"],
                    "path": r["path"] or "/",
                    "secure": bool(r["is_secure"]),
                    "httpOnly": bool(r["is_httponly"]),
                    "sameSite": ss,
                    "expires": expires,
                }
            )
    except Exception as e:  # noqa: BLE001
        log(f"❌ 쿠키 DB 읽기 실패: {str(e)[:80]}")
    finally:
        shutil.rmtree(tmp.parent, ignore_errors=True)
    return out


def main() -> int:
    try:
        import cryptography  # noqa: F401, PLC0415
    except Exception:  # noqa: BLE001
        log("❌ cryptography 패키지가 없습니다. `python3 -m pip install cryptography` 후 다시 시도하세요.")
        return 2

    db = _cookie_db()
    if not db:
        log(f"❌ Chrome 쿠키 DB를 찾지 못했습니다 ({CHROME_DIR}). Chrome에 X 로그인이 되어 있는지 확인하세요.")
        return 2

    pw = _safe_storage_key()
    if not pw:
        return 2
    key = _derive_key(pw)

    cookies = _read_x_cookies(db, key)
    if not any(c["name"] == "auth_token" for c in cookies):
        log("❌ Chrome에서 x.com 로그인 쿠키(auth_token)를 찾지 못했습니다. Chrome에 X 로그인이 유지되어 있는지 확인하세요.")
        return 2
    log(f"🍪 x.com 쿠키 {len(cookies)}개 확보. 수집기 프로필에 주입합니다.")

    pw_pl, ctx = launch(headed=False)
    try:
        ctx.add_cookies(cookies)
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        page.goto("https://x.com/home", wait_until="domcontentloaded")
        page.wait_for_timeout(4000)
        handle = logged_in_handle(page)
    finally:
        ctx.close()
        pw_pl.stop()

    if not handle:
        log("❌ 쿠키를 넣었으나 로그인 상태가 확인되지 않았습니다. Chrome 세션이 만료됐을 수 있습니다.")
        return 1
    log(f"✅ @{handle} 세션을 Chrome에서 빌려 수집기 프로필({profile_dir()})에 적용했습니다.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
