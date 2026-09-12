#!/usr/bin/env bash
# Runs one ADR candidate on the connected device and prints its result JSON.
# Usage: bench.sh <canvas|gl> [frames] [nodraw]
set -euo pipefail

BACKEND="${1:?usage: bench.sh <canvas|gl> [frames] [nodraw]}"
FRAMES="${2:-900}"
NODRAW="${3:-false}"

SDK="$HOME/Library/Android/sdk"
ADB="$SDK/platform-tools/adb"
PKG="dev.dronewar.bench.$BACKEND"
case "$BACKEND" in
  canvas) ACT=".BenchCanvasActivity" ;;
  gl)     ACT=".BenchGlActivity" ;;
  *) echo "unknown backend: $BACKEND" >&2; exit 2 ;;
esac

RESULT="/sdcard/Android/data/$PKG/files/bench-result.json"

"$ADB" shell am force-stop "$PKG"
"$ADB" shell rm -f "$RESULT" >/dev/null 2>&1 || true
"$ADB" logcat -c
# Drop caches the launcher may hold so every candidate gets the same cold start.
"$ADB" shell am kill-all >/dev/null 2>&1 || true
sleep 1

LAUNCH=$("$ADB" shell am start -W -n "$PKG/$ACT" --ei frames "$FRAMES" --ez nodraw "$NODRAW")
TOTAL_TIME=$(echo "$LAUNCH" | awk -F': ' '/^TotalTime/{print $2}')

# Drive the same touch script into every candidate.
for _ in $(seq 1 40); do
  "$ADB" shell input swipe 300 1500 800 900 700 >/dev/null 2>&1 || true
  if "$ADB" logcat -d -s DroneWarBench 2>/dev/null | grep -q "DONE $BACKEND"; then break; fi
done

for _ in $(seq 1 60); do
  if "$ADB" logcat -d -s DroneWarBench 2>/dev/null | grep -q "DONE $BACKEND"; then break; fi
  sleep 1
done

JSON=$("$ADB" shell cat "$RESULT" 2>/dev/null || true)
if [ -z "$JSON" ]; then
  echo "no result produced by $BACKEND" >&2
  "$ADB" logcat -d -s DroneWarBench AndroidRuntime 2>/dev/null | tail -30 >&2
  exit 1
fi

python3 - "$TOTAL_TIME" <<PY
import json, sys
d = json.loads('''$JSON''')
d["launch_total_ms"] = int(sys.argv[1])
print(json.dumps(d, indent=2))
PY
