#!/usr/bin/env python3
"""Login for the X collector — interactive or automatic (macOS Keychain).

Two modes:

* interactive (default): opens a visible Chromium window using the dedicated
  persistent profile (~/.daily-magazine/x-profile). Log in by hand, then press
  Enter here. Nothing about the credentials is stored by this script; only the
  browser profile persists.

* ``--auto``: reads the account credentials from the macOS Keychain and drives
  the X login flow unattended, so re-authentication after the session expires
  needs no human unless X demands an interactive challenge. Credential values are
  never printed, logged, or written to any repo file — they are read from the
  Keychain at the moment of use and passed straight into the browser form.

Keychain items (generic passwords) the ``--auto`` mode reads, all under service
``daily-magazine-x`` (override with ``DM_X_KEYCHAIN_SERVICE``):

    account "password"     the account password            (required)
    account "identifier"   email / phone / @handle to log in with (optional;
                           falls back to config → x.user)
    account "totp"         base32 TOTP secret, to answer 2FA automatically
                           (optional; needs the ``pyotp`` package)

Provision them once, on the Mac that runs the collector, e.g.:

    security add-generic-password -U -s daily-magazine-x -a password   -w
    security add-generic-password -U -s daily-magazine-x -a identifier -w 'you@example.com'
    security add-generic-password -U -s daily-magazine-x -a totp       -w 'BASE32SECRET'   # optional

(The -w with no value prompts for the secret without echoing it.)
"""
from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib import load_config, log  # noqa: E402
from x_browser import launch, logged_in_handle, profile_dir  # noqa: E402

KEYCHAIN_SERVICE = os.environ.get("DM_X_KEYCHAIN_SERVICE", "daily-magazine-x")


def keychain_secret(account: str) -> str | None:
    """Read one generic-password value from the macOS Keychain, or None.

    The value is returned to the caller in-process only; it is never logged.
    """
    try:
        res = subprocess.run(
            ["security", "find-generic-password", "-s", KEYCHAIN_SERVICE, "-a", account, "-w"],
            capture_output=True,
            text=True,
            timeout=15,
        )
    except Exception:  # noqa: BLE001
        return None
    if res.returncode != 0:
        return None
    val = res.stdout.rstrip("\n")
    return val or None


def _fill_first(page, selectors: list[str], value: str, timeout: int = 8000) -> bool:
    for sel in selectors:
        try:
            loc = page.locator(sel).first
            loc.wait_for(state="visible", timeout=timeout)
            loc.fill(value)
            return True
        except Exception:  # noqa: BLE001
            continue
    return False


def _click_next(page) -> None:
    for sel in (
        'button:has-text("Next")',
        'button:has-text("다음")',
        '[data-testid="LoginForm_Login_Button"]',
        'button:has-text("Log in")',
        'button:has-text("로그인")',
    ):
        try:
            btn = page.locator(sel).first
            if btn.is_visible(timeout=1500):
                btn.click()
                return
        except Exception:  # noqa: BLE001
            continue
    try:
        page.keyboard.press("Enter")
    except Exception:  # noqa: BLE001
        pass


def _totp_now(secret: str) -> str | None:
    try:
        import pyotp  # noqa: PLC0415
    except Exception:  # noqa: BLE001
        log("⚠️ TOTP 비밀이 있으나 pyotp가 없습니다. `python3 -m pip install pyotp` 후 다시 시도하세요.")
        return None
    try:
        return pyotp.TOTP(secret.replace(" ", "")).now()
    except Exception as e:  # noqa: BLE001
        log(f"⚠️ TOTP 코드 생성 실패: {str(e)[:60]}")
        return None


def auto_login(headed: bool) -> int:
    """Drive the X login flow from Keychain credentials. Returns a process exit code."""
    cfg = load_config().get("x", {})
    want = cfg.get("user", "")
    password = keychain_secret("password")
    if not password:
        log(
            f"❌ Keychain에 비밀번호가 없습니다. 먼저 저장하세요:\n"
            f"   security add-generic-password -U -s {KEYCHAIN_SERVICE} -a password -w"
        )
        return 2
    identifier = keychain_secret("identifier") or want
    if not identifier:
        log("❌ 로그인 식별자(이메일/전화/핸들)를 알 수 없습니다. Keychain account 'identifier'를 저장하거나 config x.user를 설정하세요.")
        return 2
    totp_secret = keychain_secret("totp")

    pw, ctx = launch(headed=headed)
    page = ctx.pages[0] if ctx.pages else ctx.new_page()
    try:
        page.goto("https://x.com/home", wait_until="domcontentloaded")
        page.wait_for_timeout(2500)
        handle = logged_in_handle(page)
        if handle:
            log(f"✅ 이미 로그인됨: @{handle}")
            return _finish(handle, want)

        page.goto("https://x.com/i/flow/login", wait_until="domcontentloaded")
        page.wait_for_timeout(2500)

        if not _fill_first(page, ['input[autocomplete="username"]', 'input[name="text"]'], identifier):
            log("❌ 로그인 식별자 입력란을 찾지 못했습니다.")
            return 2
        _click_next(page)
        page.wait_for_timeout(2500)

        # X sometimes interjects: "verify it's you — enter phone or username".
        try:
            inter = page.locator('[data-testid="ocfEnterTextTextInput"]').first
            if inter.is_visible(timeout=2500):
                inter.fill(want or identifier)
                _click_next(page)
                page.wait_for_timeout(2500)
        except Exception:  # noqa: BLE001
            pass

        if not _fill_first(page, ['input[name="password"]', 'input[autocomplete="current-password"]'], password):
            log("❌ 비밀번호 입력란을 찾지 못했습니다.")
            return 2
        _click_next(page)
        page.wait_for_timeout(4000)

        # Possible 2FA challenge.
        handle = logged_in_handle(page)
        if not handle:
            try:
                challenge = page.locator('[data-testid="ocfEnterTextTextInput"], input[name="text"]').first
                if challenge.is_visible(timeout=4000):
                    code = _totp_now(totp_secret) if totp_secret else None
                    if code:
                        challenge.fill(code)
                        _click_next(page)
                        page.wait_for_timeout(4000)
                    elif headed:
                        log("🔐 2단계 인증이 필요합니다. 열린 창에서 코드를 입력한 뒤 Enter 를 누르세요.")
                        try:
                            input()
                        except EOFError:
                            page.wait_for_timeout(120000)
                    else:
                        log("❌ 2단계 인증이 필요하나 TOTP 비밀이 없고 창도 보이지 않습니다. `--headed`로 다시 시도하거나 Keychain에 totp를 저장하세요.")
                        return 2
            except Exception:  # noqa: BLE001
                pass

        page.goto("https://x.com/home", wait_until="domcontentloaded")
        page.wait_for_timeout(4000)
        handle = logged_in_handle(page)
        return _finish(handle, want)
    finally:
        ctx.close()
        pw.stop()


def _finish(handle: str | None, want: str) -> int:
    if not handle:
        log("❌ 로그인 상태가 확인되지 않았습니다.")
        return 1
    if want and handle.lower() != want.lower():
        log(f"⚠️ 로그인된 계정(@{handle})이 설정된 계정(@{want})과 다릅니다.")
        return 1
    log(f"✅ @{handle} 로그인 확인. 프로필: {profile_dir()}")
    return 0


def interactive_login() -> int:
    want = load_config().get("x", {}).get("user", "")
    pw, ctx = launch(headed=True)
    page = ctx.pages[0] if ctx.pages else ctx.new_page()
    page.goto("https://x.com/login", wait_until="domcontentloaded")
    log(f"Profile: {profile_dir()}")
    log(f"브라우저 창에서 @{want} 계정으로 로그인한 뒤, 여기서 Enter 를 누르세요.")
    try:
        input()
    except EOFError:
        page.wait_for_timeout(120000)
    page.goto("https://x.com/home", wait_until="domcontentloaded")
    page.wait_for_timeout(4000)
    handle = logged_in_handle(page)
    ctx.close()
    pw.stop()
    return _finish(handle, want)


def main() -> int:
    ap = argparse.ArgumentParser(description="Login for the X collector.")
    ap.add_argument("--auto", action="store_true", help="unattended login using macOS Keychain credentials")
    ap.add_argument("--headed", action="store_true", help="show the browser window (useful with --auto for 2FA)")
    args = ap.parse_args()
    if args.auto:
        return auto_login(headed=args.headed)
    return interactive_login()


if __name__ == "__main__":
    sys.exit(main())
