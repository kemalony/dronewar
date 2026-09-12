#!/usr/bin/env bash
# Oynanabilir dikey dilim kapisi (AC-1..AC-6, android/game/spec.md).
#
# Bu kapi "derleniyor mu" diye sormaz. Uygulamayi emulatorde surer ve OYNUYOR MU
# diye olcer: parmak dronu hareket ettiriyor mu, ates ediliyor mu, dusman oluyor
# mu, skor artiyor mu. Derlenen ama oynanmayan bir uygulama bu kapidan gecemez.
set -uo pipefail
cd "$(dirname "$0")/../.."

export JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk@17}"
GRADLE="${GRADLE:-$HOME/.gradle/wrapper/dists/gradle-8.0-all/a2o1xoguejy6msdh0lk99lxza/gradle-8.0/bin/gradle}"
ADB="$HOME/Library/Android/sdk/platform-tools/adb"
PKG="dev.dronewar.game"
ACT="$PKG/.GameActivity"
STATE="/sdcard/Android/data/$PKG/files/game-state.json"
BENCH="/sdcard/Android/data/$PKG/files/bench-result.json"
FAILURES=0

say()  { printf '\n=== %s ===\n' "$1"; }
pass() { printf '  PASS  %s\n' "$1"; }
fail() { printf '  FAIL  %s\n' "$1"; FAILURES=$((FAILURES + 1)); }

jq_get() { # jq_get <json> <key>
  python3 -c "import json,sys
try:
    print(json.loads(sys.argv[1]).get(sys.argv[2], ''))
except Exception:
    print('')" "$1" "$2"
}

read_state() { "$ADB" shell cat "$STATE" 2>/dev/null | tr -d '\r'; }

say "AC-0  cihaz ve APK"
if ! "$ADB" get-state >/dev/null 2>&1; then
  fail "adb cihaz gormuyor (emulator kapali mi?)"
  echo; echo "GATE RED: $FAILURES"; exit 1
fi
if "$GRADLE" -p android :game:assembleDebug --console=plain -q >/tmp/gate_game_build.log 2>&1; then
  pass ":game:assembleDebug yesil"
else
  fail ":game derlenmiyor (bkz /tmp/gate_game_build.log)"
  tail -12 /tmp/gate_game_build.log | sed 's/^/        /'
  echo; echo "GATE RED: $FAILURES"; exit 1
fi
APK=$(ls android/game/build/outputs/apk/debug/*.apk 2>/dev/null | head -1)
"$ADB" install -r -g "$APK" >/dev/null 2>&1 || fail "APK kurulamadi"

say "AC-1  soguk acilis <= 1500 ms, FATAL yok"
"$ADB" shell am force-stop "$PKG"; "$ADB" logcat -c; sleep 1
# Uc soguk acilisin MEDYANI. Tek olcum yuklu emulatorde guvenilmez: ayni build
# arka arkaya 584-1026 ms verirken, gradle derlemesi ve APK kurulumundan hemen
# sonra 1891 ms olculdu. Medyan tek bir stall'a dayanir, gercek bir gerilemeyi
# yine yakalar.
TIMES=""
for _ in 1 2 3; do
  "$ADB" shell am force-stop "$PKG" >/dev/null 2>&1
  "$ADB" shell am kill-all >/dev/null 2>&1
  sleep 2
  T=$("$ADB" shell am start -W -n "$ACT" 2>/dev/null | awk -F': ' '/^TotalTime/{print $2}')
  [ -n "$T" ] && TIMES="$TIMES $T"
done
TOTAL=$(echo $TIMES | tr ' ' '\n' | sort -n | sed -n 2p)
if [ -n "$TOTAL" ] && [ "$TOTAL" -le 1500 ]; then
  pass "soguk acilis medyan ${TOTAL} ms (olcumler:$TIMES)"
else
  fail "soguk acilis medyan ${TOTAL:-yok} ms (<=1500 olmali, olcumler:$TIMES)"
fi
sleep 3
if "$ADB" logcat -d -s AndroidRuntime 2>/dev/null | grep -q "FATAL"; then
  fail "AndroidRuntime FATAL"
  "$ADB" logcat -d -s AndroidRuntime | grep -A 6 FATAL | head -10 | sed 's/^/        /'
else
  pass "FATAL yok"
fi

say "AC-2  parmak dronu suruyor + otomatik ates"
S0=$(read_state); X0=$(jq_get "$S0" playerX)
for _ in 1 2 3 4 5 6; do "$ADB" shell input swipe 250 1400 820 700 600 >/dev/null 2>&1; done
sleep 1
S1=$(read_state); X1=$(jq_get "$S1" playerX); SHOTS=$(jq_get "$S1" shotsFired)
if [ -z "$S1" ]; then
  fail "game-state.json okunamadi (debug kancasi yok mu?)"
else
  MOVED=$(python3 -c "print(abs(float('${X1:-0}') - float('${X0:-0}')) > 8)")
  [ "$MOVED" = "True" ] && pass "dron parmakla hareket etti (${X0} -> ${X1})" \
                        || fail "dron hareket etmedi (${X0} -> ${X1})"
  [ "${SHOTS:-0}" -gt 0 ] 2>/dev/null && pass "otomatik ates calisti (shotsFired=$SHOTS)" \
                                      || fail "hic ates edilmedi (shotsFired=${SHOTS:-yok})"
fi

say "AC-3  dusman oluyor ve skor artiyor"
"$ADB" shell am force-stop "$PKG"; "$ADB" logcat -c; sleep 1
"$ADB" shell am start -W -n "$ACT" --ei autoplay 12 >/dev/null 2>&1
sleep 15
S2=$(read_state); KILLS=$(jq_get "$S2" kills); SCORE=$(jq_get "$S2" score)
if [ "${KILLS:-0}" -gt 0 ] 2>/dev/null && [ "${SCORE:-0}" -gt 0 ] 2>/dev/null; then
  pass "12 sn otomatik oyunda kills=$KILLS score=$SCORE"
else
  fail "oldurme/skor yok (kills=${KILLS:-yok} score=${SCORE:-yok})"
fi

say "AC-4  can bitince oyun sonu"
"$ADB" shell am force-stop "$PKG"; sleep 1
"$ADB" shell am start -W -n "$ACT" --ei autoplay 12 --ez killplayer true >/dev/null 2>&1
sleep 8
S3=$(read_state); MODE=$(jq_get "$S3" mode); LIVES=$(jq_get "$S3" lives)
[ "$MODE" = "over" ] && pass "can 0 -> mode=over (lives=$LIVES)" \
                     || fail "oyun sonuna gecmedi (mode=${MODE:-yok} lives=${LIVES:-yok})"

say "AC-4b  oyun sonundan dokunusla cikilabiliyor"
# AC-4 yalnizca oyun sonuna VARILDIGINI olcuyordu, oradan CIKILABILDIGINI degil.
# Gercek bir hata bu delikten gecti: `--ei autoplay` ile baslatilan build'de
# autoplay bayragi hic kapanmiyordu ve dokun-baslat dali !autoplay ile korunduğu
# icin uygulama oyun sonu ekraninda kalici olarak sagir kaliyordu. Cokme yok,
# render dongusu donuyor -- disaridan hicbir sey bozuk gorunmuyor.
"$ADB" shell input tap 540 1100 >/dev/null 2>&1
sleep 2
S4=$(read_state); MODE4=$(jq_get "$S4" mode)
[ "$MODE4" = "play" ] && pass "oyun sonunda dokunus -> mode=play" \
                      || fail "oyun sonundan cikilamiyor (dokunus sonrasi mode=${MODE4:-yok})"

say "AC-5  sicak kare cpu_p95 <= 2.0 ms"
B=$("$ADB" shell cat "$BENCH" 2>/dev/null | tr -d '\r')
if [ -z "$B" ]; then
  fail "bench-result.json yok (Metrics dokumu eksik)"
else
  P95=$(jq_get "$B" cpu_p95_ms); DROP=$(jq_get "$B" dropped_frames); FR=$(jq_get "$B" frames)
  OK=$(python3 -c "print(float('${P95:-99}') <= 2.0)")
  [ "$OK" = "True" ] && pass "cpu_p95=${P95} ms (dropped=${DROP}/${FR})" \
                     || fail "cpu_p95=${P95} ms (<=2.0 olmali, dropped=${DROP}/${FR})"
fi

say "AC-6  tek kaynak: oynanis sabiti :game icinde tanimlanmamis"
HITS=$(grep -rnE "(maxSpeed|accel|decayHalfLife|followSpeed|fireInterval)\s*[:=]\s*[0-9]" \
       android/game/src/main/ 2>/dev/null | grep -v "Config\." | head -5)
if [ -z "$HITS" ]; then
  pass "oynanis sabiti yok, hepsi :rules'tan"
else
  fail "oynanis sabiti :game icinde tanimlanmis"
  echo "$HITS" | sed 's/^/        /'
fi

say "SONUC"
if [ "$FAILURES" -eq 0 ]; then echo "GATE GREEN"; exit 0; fi
echo "GATE RED: $FAILURES hata"
exit 1
