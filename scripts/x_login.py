#!/usr/bin/env python3
"""One-time interactive login for the X collector.

Opens a visible Chromium window using the dedicated persistent profile
(~/.daily-magazine/x-profile). Log in as the account whose "Following" list should be
collected (config/sources.json → x.user), then close the window or press Enter here.
Nothing about the credentials is stored by this script; only the browser profile persists.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib import load_config, log  # noqa: E402
from x_browser import launch, logged_in_handle, profile_dir  # noqa: E402


def main() -> int:
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
    if not handle:
        log("❌ 로그인 상태가 확인되지 않았습니다. 다시 실행하세요.")
        return 1
    if want and handle.lower() != want.lower():
        log(f"⚠️ 로그인된 계정(@{handle})이 설정된 계정(@{want})과 다릅니다.")
        return 1
    log(f"✅ @{handle} 로그인 확인. 프로필이 {profile_dir()} 에 저장되었습니다.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
