#!/usr/bin/env bash
# Merkezi dogrulama: derle + olc. Ajanlar bunu CALISTIRMAZ, orkestrator calistirir.
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="/home/synapso/projects/game/.venv/bin:$PATH"
python3 tools/build.py
python3 tools/assets_check.py | head -1
python3 tools/evaluate.py "${1:-x}" 2>&1 | grep -E "^\s+\[FAIL\]|EVALUATE:" || true
