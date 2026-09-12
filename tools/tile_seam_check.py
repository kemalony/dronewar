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
import re
import statistics
import sys

from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"
MAX_RATIO = 1.0



def config_value(path, default=None):
    """CONFIG.js'ten tek bir sayiyi okur. Tek kaynak: src/core/CONFIG.js.
    Araclarin kendi kopyasini tutmasi, tam da bu projede bedeli odenmis hata."""
    src = (ROOT / "src" / "core" / "CONFIG.js").read_text()
    key = path.split(".")[-1]
    m = re.search(rf"\b{key}\s*:\s*([0-9.]+)", src)
    return float(m.group(1)) if m else default


ZOOM = config_value("PARALLAX.tileZoom", 1.10)


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




def check_black_borders():
    """Karonun kenarinda siyah sutun var mi?

    Bir karo hazirlanirken kaynaktan GENIS kirpilirsa (orn. 752 px'lik bir
    goruntuden 806 px istemek) PIL disariyi siyahla doldurur ve karonun iki
    yanina bant gomulur. Bu, oyunda kayan ekranin kenarinda siyah serit olarak
    gorunur ve karo geometrisi DOGRUYKEN bile olur -- bu yuzden kenar payi
    hesabi bunu yakalamaz. Olculdu 2026-09-12: uretilen istanbul karolarinda
    her yanda 32 sutun.
    """
    # Dosya sistemine degil MANIFEST'e bak: assets/ icinde oyunun hic yuklemedigi
    # artik karolar var (city_dusk, city_neon manifest'te kayitli degil) ve
    # cizilmeyen bir karoyu kirmizi yakmak kapiyi gurultuye bogar.
    manifest = json.loads((ASSETS / "manifest.json").read_text())
    files = [ASSETS / e["file"] for e in manifest["sprites"]
             if e["name"].startswith("city_")]
    bad = []
    for f in sorted(files):
        im = Image.open(f).convert("L")
        w, h = im.size
        def dark(x):
            return statistics.mean(im.crop((x, 0, x + 1, h)).get_flattened_data()) < 8
        left = sum(1 for x in range(60) if dark(x))
        right = sum(1 for x in range(60) if dark(w - 1 - x))
        if left or right:
            bad.append((pathlib.Path(f).name, left, right))

    print()
    if bad:
        print("TILE_BORDER: FAIL — karo kenarinda siyah sutun")
        for n, l, r in bad:
            print(f"  {n:22s} sol={l} sag={r}")
        return False
    print("TILE_BORDER: PASS — hicbir karoda siyah kenar yok")
    return True


def check_shift_margin():
    """Karo kaydirildiginda kenardan siyah gorunuyor mu?

    Karo ekrandan `tileZoom` kadar buyuk cizilir; her iki yanda `padX` kadar pay
    kalir. Oyuncunun yatay konumu karoyu `cityShift` kadar kaydirir ve sarsinti
    ustune biraz daha ekler. padX bu ikisinin toplamini karsilamazsa karonun
    kenari ekranin icine girer ve altindan SIYAH gorunur.

    Olculdu (2026-09-12): tileZoom=1.10 ile pay 24.0 px, maksimum kayma da tam
    24.0 px -- artan pay SIFIR. Yani sag kenara dayanip hasar almak yetiyordu.
    """
    W = config_value("W", 480.0)
    half = config_value("half", 48.0)
    zoom = config_value("PARALLAX.tileZoom", 1.10)
    shift = config_value("PARALLAX.cityShift", 30.0)
    shake = max(config_value("playerAmp", 8.0), config_value("bossAmp", 14.0))

    pad = (W * zoom - W) / 2.0
    max_norm = (W - half - W / 2.0) / (W / 2.0)     # oyuncu kenara dayanik
    need = max_norm * shift + shake
    margin = pad - need

    print()
    print(f"{'kaydirma payi':24s}: padX={pad:.1f} px")
    print(f"{'gereken':24s}: kayma {max_norm * shift:.1f} + sarsinti {shake:.1f} = {need:.1f} px")
    print(f"{'artan pay':24s}: {margin:+.1f} px")
    ok = margin > 0
    print(f"TILE_EDGE: {'PASS' if ok else 'FAIL'} — "
          + ("kenar acilmiyor" if ok else "kenardan SIYAH gorunur"))
    return ok


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

    if not check_black_borders():
        failures += 1
    if not check_shift_margin():
        failures += 1

    print()
    if failures:
        print(f"SONUC: FAIL — {failures} sorun")
        return 1
    print(f"SONUC: PASS — {len(cities)} cift dikissiz, kenar acilmiyor")
    return 0


if __name__ == "__main__":
    sys.exit(main())
