#!/usr/bin/env python3
"""Sehir karosu A/B ciftlerinin gecisini tonlayarak dikissiz yapar.

Oyun karolari A, B, A, B... diye dizer ve `tileZoom = 1.10` yuzunden bir sonraki
karo, oncekinin %90.9 satirinda baslar — yani A'nin alt %9.1'i HIC GORUNMEZ.
Gorunur dikis A'nin `H/1.10` satiri ile B'nin 0. satiri arasindadir. (Ilk yazimda
A'nin son satirini olcuyordum; o satir ekranda yok.)

Yontem: icerik harmanlamasi DEGIL, ton duzeltmesi. Iki karo ayri fotograflar
oldugu icin dikiste bir parlaklik/renk farki olur; bu fark N satira yayilarak
yarisi A'nin altina, yarisi B'nin ustune uygulanir. Dokusu bozulmaz, yalniz tonu
esitlenir — dikisin iki yani ayni degere yakinsar.

Neden icerik harmanlamasi degil: iki farkli fotografi caprazlamak hayalet
goruntu birakir; goz onu "iki sahne ust uste" diye okur, ki bu portta daha once
"ucan bina" olarak bedeli odenen hatanin ayni sinifi.

  python3 tools/blend_tiles.py [--apply] [sehir ...]
Varsayilan kuru kosum: neyin degisecegini yazar, dosyaya dokunmaz.
"""
import argparse
import json
import pathlib
import sys

from PIL import Image, ImageFilter

ROOT = pathlib.Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"
ZOOM = 1.10
BAND = 200          # duzeltmenin yayildigi satir sayisi
SMOOTH = 41         # sutun bazli farki yatayda yumusatma yaricapi


def junction_row(h):
    return int(h / ZOOM)


def row_rgb(im, y):
    """Bir satirin sutun bazli RGB degerleri, yatayda yumusatilmis."""
    w = im.size[0]
    strip = im.crop((0, y, w, y + 1)).resize((w, 1))
    strip = strip.filter(ImageFilter.GaussianBlur(SMOOTH / 3.0))
    return list(strip.getdata())


def apply_ramp(im, rows, delta, downward):
    """delta'yi `rows` satira rampali uygular. downward=True ise agirlik asagi artar."""
    w, h = im.size
    px = im.load()
    n = len(rows)
    for i, y in enumerate(rows):
        wgt = (i + 1) / n if downward else 1.0 - (i / n)
        for x in range(w):
            r, g, b = px[x, y][:3]
            dr, dg, db = delta[x]
            px[x, y] = (
                max(0, min(255, int(r + dr * wgt))),
                max(0, min(255, int(g + dg * wgt))),
                max(0, min(255, int(b + db * wgt))),
            )


def blend_pair(a_path, b_path, apply_changes):
    A = Image.open(a_path).convert("RGB")
    B = Image.open(b_path).convert("RGB")
    h = A.size[1]
    J = junction_row(h)

    reports = []
    # Iki gecis var: A(J) -> B(0) ve B(J) -> A(0).
    for (src, s_row, dst, d_row, tag) in (
        (A, J, B, 0, "A->B"),
        (B, J, A, 0, "B->A"),
    ):
        s = row_rgb(src, s_row)
        d = row_rgb(dst, d_row)
        # Fark, yarisi her tarafa: dikisin iki yani ortada bulusur.
        half = [tuple((d[x][c] - s[x][c]) / 2.0 for c in range(3)) for x in range(len(s))]
        mean = sum(abs(v) for px in half for v in px) / (len(half) * 3)
        reports.append(f"{tag}: ortalama duzeltme {mean:.1f}/255")
        if apply_changes:
            # src'nin dikise dogru son BAND satiri +half, dst'nin ilk BAND satiri -half
            apply_ramp(src, list(range(s_row - BAND + 1, s_row + 1)), half, downward=True)
            apply_ramp(dst, list(range(d_row, d_row + BAND)), [tuple(-v for v in px) for px in half],
                       downward=False)

    if apply_changes:
        A.save(a_path)
        B.save(b_path)
    return reports


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="dosyalari gercekten yaz")
    ap.add_argument("cities", nargs="*")
    args = ap.parse_args()

    manifest = json.loads((ASSETS / "manifest.json").read_text())
    names = {s["name"] for s in manifest["sprites"]}
    cities = args.cities or sorted(
        n[len("city_"):] for n in names
        if n.startswith("city_") and not n.endswith("_b") and f"{n}_b" in names
    )

    mode = "UYGULANIYOR" if args.apply else "kuru kosum (--apply ile yaz)"
    print(f"tileZoom={ZOOM}  gorunur dikis satiri=H/{ZOOM:.2f}  band={BAND}  [{mode}]\n")
    for c in cities:
        a = ASSETS / f"city_{c}.png"
        b = ASSETS / f"city_{c}_b.png"
        if not (a.exists() and b.exists()):
            print(f"{c}: karo cifti eksik, atlandi")
            continue
        rep = blend_pair(a, b, args.apply)
        print(f"{c:10s} " + "   ".join(rep))
    return 0


if __name__ == "__main__":
    sys.exit(main())
