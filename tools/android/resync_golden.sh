#!/usr/bin/env bash
# Web referansi degisince port altin dosyalarini yeniden senkronlar ve kapilari olcer.
#
# Sira onemli: once web yeniden derlenir ve OLCULUR. Kirmizi bir web davranisinin
# izini kaydetmek, hatayi sozlesmeye cevirir -- bu yuzden web kapilari yesil
# degilse betik durur ve izi KAYDETMEZ.
#
#   tools/android/resync_golden.sh [--force-trace]
set -uo pipefail
cd "$(dirname "$0")/../.."

PY=".venv-mac/bin/python"
FORCE="${1:-}"

say() { printf '\n=== %s ===\n' "$1"; }

say "1/5  web yeniden derleniyor (src -> index.html)"
python3 tools/build.py >/tmp/resync_build.log 2>&1 \
  && echo "  build.py ok  ($(wc -l < index.html) satir)" \
  || { echo "  build.py DUSTU"; tail -12 /tmp/resync_build.log; exit 1; }

say "2/5  web kapilari olculuyor"
PW_CHANNEL=chrome "$PY" tools/evaluate.py >/tmp/resync_eval.txt 2>&1
SUMMARY=$(grep -E "^EVALUATE:" /tmp/resync_eval.txt | tail -1)
echo "  $SUMMARY"
REDS=$(grep -E "^  FAIL:" /tmp/resync_eval.txt | grep -v vision_polish || true)
if [ -n "$REDS" ]; then
  echo "$REDS" | sed 's/^/  /'
fi
HARD_RED=$(echo "$REDS" | grep -c . || true)

say "3/5  golden config yeniden dokuluyor"
BEFORE_CFG=$(md5 -q android/harness/golden/config.json 2>/dev/null || echo none)
node tools/dump_config.js | sed 's/^/  /'
AFTER_CFG=$(md5 -q android/harness/golden/config.json)
if [ "$BEFORE_CFG" = "$AFTER_CFG" ]; then
  echo "  CONFIG degismedi"
else
  echo "  CONFIG DEGISTI -- :rules TOML'lari yeniden uretilmeli:"
  echo "    $PY tools/android/bootstrap_rules_config.py"
fi

say "4/5  altin iz"
if [ "$HARD_RED" -gt 0 ] && [ "$FORCE" != "--force-trace" ]; then
  echo "  ATLANDI: web'de $HARD_RED kirmizi kapi var."
  echo "  Kirmizi bir davranisin izini kaydetmek hatayi sozlesmeye cevirir."
  echo "  Once web'i duzelt; gercekten istiyorsan --force-trace ile zorla."
else
  cp android/harness/golden/trace_player.ndjson.gz /tmp/resync_trace_before.gz 2>/dev/null || true
  "$PY" tools/record_trace.py --steps 720 | sed 's/^/  /'
  # Basligi DEGIL veri satirlarini karsilastir: header her koşumda webSha ve
  # configHash tasir, yani dosya md5'i konumlar birebir ayniyken de degisir.
  # Ilk yazimda md5 karsilastiriyordum ve "oyuncu fizigi degismis" diye yanlis
  # alarm veriyordu.
  "$PY" - <<'PYEOF'
import gzip, json, os, sys
def rows(p):
    if not os.path.exists(p): return None
    with gzip.open(p, "rt") as fh:
        return [json.loads(l) for l in fh][1:]
a = rows("/tmp/resync_trace_before.gz")
b = rows("android/harness/golden/trace_player.ndjson.gz")
if a is None:
    print("  iz ilk kez kaydedildi")
elif a == b:
    print("  iz degismedi (oyuncu fizigi ayni; yalniz baslik metadata'si guncellendi)")
else:
    d = [x["step"] for x, y in zip(a, b) if x != y]
    print(f"  IZ DEGISTI -- ilk farkli adim {d[0] if d else '?'}, parity yeniden olculecek")
PYEOF
  rm -f /tmp/resync_trace_before.gz
fi

say "5/5  port kapilari"
./tools/android/gate_rules.sh 2>&1 | tail -3 | sed 's/^/  /'
./tools/android/gate_core_sim.sh 2>&1 | tail -3 | sed 's/^/  /'

say "SONUC"
echo "  web:  $SUMMARY"
echo "  ayrinti: /tmp/resync_eval.txt"
