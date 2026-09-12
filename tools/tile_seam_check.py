#!/usr/bin/env python3
"""Sehir karosu A/B ciftlerinin gecisi dikissiz mi? (tarayici gerekmez)

Oyun her sehir icin iki karoyu dikey dongude SIRAYLA dizer (A, B, A, B...), yani
A'nin alt kenari B'nin ust kenarina degen bir noktasi vardir. Iki karo ayni
fotografin devami gibi durmazsa orada gorunur bir bant olusur.

Olcut: gecisteki parlaklik siçramasi / karo ICINDEKI tipik satir siçramasinin
p95'i. Ayni goruntunun devami olsaydi gecis, karo ici bir satir gecisi kadar
olurdu; oran 1'e yakin cikar.

Esik neden 1.0: STATE.md yalnizca LIMAN karolarinin dikis satirinda harmanlandigini
kaydediyor. Bu betik o bilgiyi kullanmadan olcuyor ve limani 0.01x ile buluyor --
neredeyse tam eslesme; geri kalan dordu 3.4x - 8.1x. Esik, belgelenen tek iyi
ornegi genis farkla geciren yerde duruyor.

  python3 tools/tile_seam_check.py            -> 0 = PASS, 1 = FAIL
"""
import json
import pathlib
import statistics
import sys

from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"
MAX_RATIO = 1.0
ZOOM = 1.10   # CONFIG.PARALLAX.tileZoom


def row_mean(im, y):
    return statistics.mean(im.crop((0, y, im.size[0], y + 1)).get_flattened_data())


def measure(a_path, b_path):
    a = Image.open(a_path).convert("L")
    b = Image.open(b_path).convert("L")
    h = a.size[1]
    # GORUNUR dikis satiri A'nin SONU degil: tileZoom yuzunden bir sonraki karo
    # oncekinin H/zoom satirinda baslar ve A'nin alt %9.1'ini ORTER. Ilk yazimda
    # son satiri olcuyordum -- ekranda hic gorunmeyen bir satiri.
    j = int(h / ZOOM)
    # Karo ICI gurultu tabani: kenarlardan uzak duruyoruz ki kendi kenar
    # artefaktlari tabani sismesin.
    inner = [abs(row_mean(a, y + 1) - row_mean(a, y)) for y in range(int(h * 0.1), int(h * 0.9))]
    inner += [abs(row_mean(b, y + 1) - row_mean(b, y)) for y in range(int(h * 0.1), int(h * 0.9))]
    p95 = sorted(inner)[int(len(inner) * 0.95)]
    ab = abs(row_mean(b, 0) - row_mean(a, j))
    ba = abs(row_mean(a, 0) - row_mean(b, j))
    worst = max(ab, ba)
    return p95, ab, ba, worst, (worst / p95 if p95 else float("inf"))


def main():
    manifest = json.loads((ASSETS / "manifest.json").read_text())
    names = {s["name"] for s in manifest["sprites"]}
    cities = sorted(
        n[len("city_"):] for n in names
        if n.startswith("city_") and not n.endswith("_b") and f"{n}_b" in names
    )

    failures = 0
    print(f"{'sehir':10s} {'karo ici p95':>12s} {'A->B':>7s} {'B->A':>7s} {'oran':>7s}  sonuc")
    print("-" * 60)
    for c in cities:
        a = ASSETS / f"city_{c}.png"
        b = ASSETS / f"city_{c}_b.png"
        if not (a.exists() and b.exists()):
            continue
        p95, ab, ba, worst, ratio = measure(a, b)
        ok = ratio < MAX_RATIO
        if not ok:
            failures += 1
        print(f"{c:10s} {p95:12.2f} {ab:7.2f} {ba:7.2f} {ratio:6.2f}x  {'PASS' if ok else 'FAIL'}")

    print()
    if failures:
        print(f"TILE_SEAM: FAIL — {failures}/{len(cities)} cift dikisli (esik {MAX_RATIO}x)")
        return 1
    print(f"TILE_SEAM: PASS — {len(cities)}/{len(cities)} cift dikissiz")
    return 0


if __name__ == "__main__":
    sys.exit(main())
