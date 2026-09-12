#!/usr/bin/env bash
# :game dikey diliminin sprite yukunu assets/ icinden hazirlar.
set -euo pipefail
cd "$(dirname "$0")/../.."
dest="android/game/src/main/assets/sprites"
mkdir -p "$dest"
for f in city_istanbul city_istanbul_b drone_player drone_scout drone_gunner \
         drone_shield boom_flash boom_fire boom_smoke pu_weapon pu_shield \
         hud_target cloud_wisp cloud_puff muzzle_flash; do
  cp "assets/$f.png" "$dest/"
done
echo "15 sprite hazirlandi -> $dest"
