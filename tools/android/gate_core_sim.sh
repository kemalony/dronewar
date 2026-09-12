#!/usr/bin/env bash
# R1 gate: parity + determinism for :core-sim, measured by :harness.
#
# Checks 5 and 6 are the ones that matter. They do not ask whether the build passes;
# they corrupt the trace and scan the bytecode, and demand the gate notice. A parity
# gate that has never been seen red proves nothing about the port.
set -uo pipefail
cd "$(dirname "$0")/../.."

export JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk@17}"
GRADLE="${GRADLE:-$HOME/.gradle/wrapper/dists/gradle-8.0-all/a2o1xoguejy6msdh0lk99lxza/gradle-8.0/bin/gradle}"
TRACE="android/harness/golden/trace_player.ndjson.gz"
FAILURES=0

say()  { printf '\n=== %s ===\n' "$1"; }
pass() { printf '  PASS  %s\n' "$1"; }
fail() { printf '  FAIL  %s\n' "$1"; FAILURES=$((FAILURES + 1)); }

say "AC-0  golden trace present"
if [ -f "$TRACE" ]; then
  N=$(python3 -c "import gzip,sys; print(sum(1 for _ in gzip.open('$TRACE','rt')) - 1)")
  pass "golden trace has $N steps"
else
  fail "missing $TRACE (run: .venv-mac/bin/python tools/record_trace.py)"
  echo; echo "GATE RED: $FAILURES failure(s)"; exit 1
fi

say "AC-1  :core-sim and :harness compile"
if "$GRADLE" -p android :core-sim:compileKotlin :harness:compileTestKotlin --console=plain -q >/tmp/gate_sim_build.log 2>&1; then
  pass "both modules compile"
else
  fail "compile failed (see /tmp/gate_sim_build.log)"
  tail -12 /tmp/gate_sim_build.log | sed 's/^/        /'
fi

say "AC-3  parity + determinism tests"
if "$GRADLE" -p android :harness:test --console=plain -q >/tmp/gate_sim_test.log 2>&1; then
  pass ":harness:test green (parity + determinism)"
else
  fail ":harness:test failed (see /tmp/gate_sim_test.log)"
  tail -12 /tmp/gate_sim_test.log | sed 's/^/        /'
  grep -rhoE "step [0-9]+[^<]*" android/harness/build/test-results/test/ 2>/dev/null | head -3 | sed 's/^/        /'
fi

say "AC-4/AC-5  bytecode scan: no Float, no java/lang/Math in :core-sim"
CLASSES="android/core-sim/build/classes/kotlin/main"
if [ -d "$CLASSES" ]; then
  JAVAP="$JAVA_HOME/bin/javap"
  DUMP=$(find "$CLASSES" -name '*.class' -exec "$JAVAP" -p -c {} + 2>/dev/null)
  if [ -z "$DUMP" ]; then
    fail "could not disassemble :core-sim classes"
  else
    if echo "$DUMP" | grep -qE "java/lang/Math\.|java/lang/Math\b"; then
      fail "java/lang/Math is called in :core-sim — must be StrictMath"
      echo "$DUMP" | grep -E "java/lang/Math" | head -3 | sed 's/^/        /'
    else
      pass "no java/lang/Math call sites"
    fi
    if echo "$DUMP" | grep -qE "\bfloat\b|java/lang/Float"; then
      fail "Float appears in :core-sim bytecode"
      echo "$DUMP" | grep -E "\bfloat\b|java/lang/Float" | head -3 | sed 's/^/        /'
    else
      pass "no Float in bytecode"
    fi
  fi
else
  fail "no compiled classes at $CLASSES"
fi

say "AC-4(harness)  parity must go RED on a 1-ulp trace corruption"
# Shift one step's x by a single ulp. Decimal-identical to six places, one bit apart.
# If the comparator is using a tolerance instead of raw bits, this slips through.
if [ -f "$TRACE" ] && [ -d android/harness/src ]; then
  cp "$TRACE" /tmp/gate_sim_trace.bak
  CORRUPT_STEP=$(python3 - "$TRACE" <<'PY'
import gzip, json, struct, sys
p = sys.argv[1]
with gzip.open(p, "rt") as fh:
    lines = [json.loads(l) for l in fh]
header, rows = lines[0], lines[1:]
target = len(rows) // 2
raw = struct.unpack(">Q", bytes.fromhex(rows[target]["x"][6:]))[0]
rows[target]["x"] = "f64:0x" + struct.pack(">Q", raw + 1).hex()
with gzip.open(p, "wt", encoding="utf-8") as fh:
    fh.write(json.dumps(header, sort_keys=True) + "\n")
    for r in rows:
        fh.write(json.dumps(r, sort_keys=True) + "\n")
print(target)
PY
)
  if "$GRADLE" -p android :harness:test --console=plain -q >/tmp/gate_sim_ulp.log 2>&1; then
    fail "a 1-ulp trace corruption at step $CORRUPT_STEP did NOT fail parity — the gate is decoration"
  else
    if grep -q "$CORRUPT_STEP" /tmp/gate_sim_ulp.log \
       || grep -rq "$CORRUPT_STEP" android/harness/build/test-results/test/ 2>/dev/null; then
      pass "1-ulp corruption failed parity and named step $CORRUPT_STEP"
    else
      fail "parity failed but did not name the corrupted step $CORRUPT_STEP"
      grep -rhoE "step [0-9]+" android/harness/build/test-results/test/ 2>/dev/null | head -3 | sed 's/^/        /'
    fi
  fi
  cp /tmp/gate_sim_trace.bak "$TRACE"
  rm -f /tmp/gate_sim_trace.bak
else
  fail "cannot falsify parity: trace or :harness sources missing"
fi

say "RESULT"
if [ "$FAILURES" -eq 0 ]; then
  echo "GATE GREEN"
  exit 0
fi
echo "GATE RED: $FAILURES failure(s)"
exit 1
