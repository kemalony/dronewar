#!/usr/bin/env python3
"""index.html gercekten uretilen PNG'leri kullaniyor mu? (file:// altinda)

Cikti: "ASSETS_CHECK: n_png=<N> n_procedural=<M> manifest=<K> VERDICT=PASS|FAIL"
Cikis kodu 0 = PASS, 1 = FAIL. FAIL ise tur bir DUZELTME turudur (prompt bolum 11).

Neden gerekli: oyun assets/manifest.json'i fetch ediyordu; fetch() file:// semasinda
Chromium tarafindan bloklanir, catch bunu yutar ve oyun sessizce prosedurel cizime duser.
Bu yuzden "sprite'lar goruntuleniyor" iddiasi 7 tur boyunca yanlis PASS verdi.
"""
import json
import pathlib
import re
import sys

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
INDEX = ROOT / "index.html"
MANIFEST = ROOT / "assets" / "manifest.json"

expected = 0
if MANIFEST.exists():
    expected = len(json.loads(MANIFEST.read_text()).get("sprites", []))

if not INDEX.exists():
    print("ASSETS_CHECK: index.html henuz yok VERDICT=FAIL")
    sys.exit(1)

msgs = []
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page()
    pg.on("console", lambda m: msgs.append(m.text))
    pg.goto(f"file://{INDEX}?debug=1&autotest=1")
    pg.wait_for_timeout(3500)
    b.close()

n_png = n_proc = None
for t in msgs:
    m = re.search(r"ready \((\d+) PNG, (\d+) procedural\)", t)
    if m:
        n_png, n_proc = int(m.group(1)), int(m.group(2))

fetch_fail = [t for t in msgs if "Fetch API cannot load" in t or "URL scheme" in t]

ok = n_png is not None and n_png > 0 and not fetch_fail
print(f"ASSETS_CHECK: n_png={n_png} n_procedural={n_proc} manifest={expected} "
      f"fetch_errors={len(fetch_fail)} VERDICT={'PASS' if ok else 'FAIL'}")
if fetch_fail:
    print("  ilk fetch hatasi:", fetch_fail[0])
if not ok:
    print("  -> Bu tur bir DUZELTME turudur: prompt bolum 11 ve 13'u uygula, "
          "yol haritasinda ilerleme YOK.")
sys.exit(0 if ok else 1)
