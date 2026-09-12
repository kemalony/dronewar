#!/usr/bin/env bash
# R0 gate: ownership + config_parity for the :rules module.
#
# The third check is the important one. It does not ask whether the build passes;
# it deliberately injects a duplicate config key and demands that the build FAIL.
# A gate that has never been seen red is decoration.
set -uo pipefail
cd "$(dirname "$0")/../.."

export JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk@17}"
GRADLE="${GRADLE:-$HOME/.gradle/wrapper/dists/gradle-8.0-all/a2o1xoguejy6msdh0lk99lxza/gradle-8.0/bin/gradle}"
GOLDEN="android/harness/golden/config.json"
FAILURES=0

say()  { printf '\n=== %s ===\n' "$1"; }
pass() { printf '  PASS  %s\n' "$1"; }
fail() { printf '  FAIL  %s\n' "$1"; FAILURES=$((FAILURES + 1)); }

say "AC-0  golden reference present"
if [ -f "$GOLDEN" ]; then
  COUNT=$(python3 -c "import json;print(json.load(open('$GOLDEN'))['count'])")
  pass "golden config has $COUNT keys"
else
  fail "missing $GOLDEN (run: node tools/dump_config.js)"
  echo; echo "GATE RED: $FAILURES failure(s)"; exit 1
fi

say "AC-1/AC-5  :rules:generateConfig and compile"
if "$GRADLE" -p android :rules:generateConfig :rules:compileKotlin --console=plain -q >/tmp/gate_rules_build.log 2>&1; then
  pass "generateConfig + compileKotlin green"
else
  fail "generateConfig/compileKotlin failed (see /tmp/gate_rules_build.log)"
  tail -15 /tmp/gate_rules_build.log | sed 's/^/        /'
fi

say "AC-2  config_parity — 578/578 keys, bit-exact"
if "$GRADLE" -p android :rules:test --console=plain -q >/tmp/gate_rules_test.log 2>&1; then
  pass "ConfigParityTest green"
else
  fail "ConfigParityTest failed (see /tmp/gate_rules_test.log)"
  tail -15 /tmp/gate_rules_test.log | sed 's/^/        /'
fi

say "AC-2b  config_parity must go RED on a 1-ulp drift"
# A bit-exactness claim is worthless until a change too small to see breaks it.
# 400.0 -> 400.00000000000006 is one ulp: equal to six decimal places, one bit apart.
PARITY_VICTIM="android/rules/config/core.toml"
if [ -f "$PARITY_VICTIM" ] && grep -q "^PLAYER.maxSpeed = 400.0$" "$PARITY_VICTIM"; then
  cp "$PARITY_VICTIM" /tmp/gate_rules_parity.bak
  perl -0pi -e 's/PLAYER\.maxSpeed = 400\.0\n/PLAYER.maxSpeed = 400.00000000000006\n/' "$PARITY_VICTIM"
  if "$GRADLE" -p android :rules:test --console=plain -q >/tmp/gate_rules_ulp.log 2>&1; then
    fail "a 1-ulp drift in PLAYER.maxSpeed did NOT fail ConfigParityTest - parity is decoration"
  else
    # Gradle -q keeps assertion text out of the console; it lands in the JUnit XML.
    if grep -qi "maxSpeed" /tmp/gate_rules_ulp.log \
       || grep -qri "maxSpeed" android/rules/build/test-results/test/ 2>/dev/null; then
      pass "1-ulp drift failed the parity test and named the key"
    else
      fail "parity test failed but did not name the drifted key"
      tail -10 /tmp/gate_rules_ulp.log | sed 's/^/        /'
    fi
  fi
  cp /tmp/gate_rules_parity.bak "$PARITY_VICTIM"
  rm -f /tmp/gate_rules_parity.bak
else
  fail "PLAYER.maxSpeed anchor not found in $PARITY_VICTIM - cannot falsify parity"
fi

say "AC-3/AC-4  ownership gate must go RED on a duplicate key"
VICTIM="android/rules/config/core.toml"
INTRUDER="android/rules/config/game.toml"
if [ -f "$VICTIM" ] && [ -f "$INTRUDER" ]; then
  cp "$INTRUDER" /tmp/gate_rules_intruder.bak
  # SIM_HZ belongs to core.toml; redefining it in game.toml must stop the build.
  printf '\n[SIM_HZ_DUPLICATE_PROBE]\n' >> "$INTRUDER"
  printf 'SIM_HZ = 120\n' >> "$INTRUDER"
  # The probe key is written flat so the generator sees the same dotted key twice.
  python3 - "$INTRUDER" <<'PY'
import sys
p = sys.argv[1]
s = open(p).read().replace("[SIM_HZ_DUPLICATE_PROBE]\nSIM_HZ = 120\n", "")
open(p, "w").write(s.rstrip() + "\nSIM_HZ = 120\n")
PY
  if "$GRADLE" -p android :rules:generateConfig --console=plain -q >/tmp/gate_rules_dup.log 2>&1; then
    fail "duplicate key SIM_HZ did NOT break the build — ownership gate is decoration"
  else
    if grep -qi "SIM_HZ" /tmp/gate_rules_dup.log \
       && grep -qi "core.toml" /tmp/gate_rules_dup.log \
       && grep -qi "game.toml" /tmp/gate_rules_dup.log; then
      pass "duplicate key broke the build and both files were named"
    else
      fail "build broke but the message did not name the key and both files"
      tail -10 /tmp/gate_rules_dup.log | sed 's/^/        /'
    fi
  fi
  cp /tmp/gate_rules_intruder.bak "$INTRUDER"
  rm -f /tmp/gate_rules_intruder.bak
else
  fail "config TOMLs not found — cannot test the ownership gate"
fi

say "RESULT"
if [ "$FAILURES" -eq 0 ]; then
  echo "GATE GREEN"
  exit 0
fi
echo "GATE RED: $FAILURES failure(s)"
exit 1
