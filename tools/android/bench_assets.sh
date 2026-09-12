#!/usr/bin/env bash
# Copies the ADR benchmark's sprite subset out of assets/ into each candidate module.
set -euo pipefail
cd "$(dirname "$0")/../.."
SPRITES=(city_istanbul drone_player drone_scout drone_gunner drone_shield boom_fire)
for m in bench-canvas bench-gl; do
  dest="android/$m/src/main/assets/sprites"
  mkdir -p "$dest"
  for f in "${SPRITES[@]}"; do cp "assets/$f.png" "$dest/"; done
done
echo "sprite payload staged into bench-canvas and bench-gl"
