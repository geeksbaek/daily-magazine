#!/bin/bash
# One-time environment setup for the collection pipeline (macOS host).
set -e
cd "$(dirname "$0")/.."
python3 -m pip install --quiet --upgrade feedparser playwright
python3 -m playwright install chromium
echo "✓ python deps + chromium ready"
echo "Next: python3 scripts/x_login.py   (log in once as the X account in config/sources.json)"
