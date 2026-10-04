#!/usr/bin/env python3
"""VO-4 drift gate — .spec/powerup-drop-system/SPEC.md ve GDD'deki sayisal
degerlerin CONFIG (golden config.json uzerinden) ile birebir ayni oldugunu
dogrular. Kullanim: python3 .spec/powerup-drop-system/verify.py

Iki tarafli kontrol: (1) golden degeri beklenen literalle eslesmeli,
(2) literaller hem SPEC'te hem GDD'de metin olarak GECMELI. Uyusmazlikta
CIKIS 1 — spec'i koda uydurmak yerine DUR (SDD Drift Gate)."""
import json, struct, sys

ROOT = sys.argv[1] if len(sys.argv) > 1 else "."
GOLDEN = f"{ROOT}/android/harness/golden/config.json"
SPEC = f"{ROOT}/.spec/powerup-drop-system/SPEC.md"
GDD = f"{ROOT}/design/gdd/powerup-drop-system.md"

def f64(hx):
    return struct.unpack(">d", int(hx.removeprefix("f64:0x"), 16).to_bytes(8, "big"))[0]

# (golden_key, beklenen sayi, SPEC icindeki literaller, GDD icindeki literaller)
# ipler metin bicimine gore ayarlanir; sayisal dogrulama golden uzerinden ayri yapilir.
EXPECT = [
    ("WEAPON.dropChance", 0.12, ["0.12"], ["0.12"]),
    ("ROCKET.dropChance", 0.08, ["0.08"], ["0.08"]),
    ("SHIELD.dropChance", 0.06, ["0.06"], ["0.06"]),
    ("SUBDRONE.dropChance", 0.06, ["0.06"], ["0.06"]),
    ("REPAIR.dropChance", 0.05, ["0.05"], ["0.05"]),
    ("WEAPON.fallSpeed", 70, ["70"], ["70"]),
    ("WEAPON.shieldMs", 6000, ["6000"], ["6000"]),
    ("WEAPON.resetFlashMs", 1200, ["1200"], ["1200"]),
    ("ROCKET.speed", 520, ["520"], ["520"]),
    ("ROCKET.turnRate", 180, ["180"], ["180"]),
    ("ROCKET.damage", 3, ["180°/s / 3"], ["180°/s / 3"]),
    ("ROCKET.fireMs", 900, ["900"], ["900"]),
    ("ROCKET.durationMs", 15000, ["15000"], ["15000"]),
    ("ROCKET.pool", 8, ["15000 / 8"], ["havuz 8"]),
    ("WEAPON.maxLevel", 3, ["maxLevel / overMaxScore | 3 / 500"], ["max lv 3"]),
    ("WEAPON.overMaxScore", 500, ["3 / 500"], ["500"]),
    ("SUBDRONE.max", 2, ["0.06 / 2"], ["0..2"]),
    ("REPAIR.heal", 1, ["0.05 / 1"], ["1 / 3"]),
    ("REPAIR.maxLives", 3, ["maxLives / score | 3 / 250"], ["SABİT 3"]),
    ("REPAIR.score", 250, ["3 / 250"], ["250"]),
    ("COMBO.windowMs", 2600, [], ["2600"]),
    ("DRONES.3.invincibleMs", 2000, [], ["2000"]),
    ("WEAPON.levels.0.interval", 0.130, [".130"], ["130ms"]),
    ("WEAPON.levels.1.interval", 0.115, [".115"], ["115ms"]),
    ("WEAPON.levels.2.interval", 0.100, [".100"], ["100ms"]),
    ("WEAPON.levels.1.offset", 14, ["14"], ["±14"]),
    ("WEAPON.levels.2.offset", 26, ["26"], ["±26"]),
]

def main():
    g = json.load(open(GOLDEN))
    vals = g["values"]
    if g.get("destroyed"):
        print("FAIL dump_config destroyed:", g["destroyed"][:3]); return 1
    spec = open(SPEC, encoding="utf-8").read()
    gdd = open(GDD, encoding="utf-8").read()
    ok = fail = 0
    for key, want, s_lits, g_lits in EXPECT:
        enc = vals.get(key)
        if enc is None:
            print(f"FAIL {key}: golden'da yok"); fail += 1; continue
        got = f64(enc) if enc.startswith("f64:") else float(enc)
        if abs(got - want) > 1e-9:
            print(f"FAIL {key}: kod {got} != dokuman {want}"); fail += 1; continue
        miss = [t for t in s_lits if t not in spec] + [t for t in g_lits if t not in gdd]
        if miss:
            print(f"FAIL {key}: metinde yok {miss}"); fail += 1; continue
        ok += 1
    print(f"{'PASS' if not fail else 'FAIL'} VO-4 drift gate: {ok}/{ok+fail} eslesme"
          f" (kod ↔ SPEC ↔ GDD)")
    return 0 if not fail else 1

if __name__ == "__main__":
    sys.exit(main())