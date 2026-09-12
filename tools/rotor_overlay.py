#!/usr/bin/env python3
"""Sprite'in uzerine CONFIG.ROTOR.centers'i cizer — donen yaylar nereye dusuyor?

Neden var: `rotor_spin` kapisi yalnizca acinin degistigini ve deterministik
oldugunu olcer; yaylarin ROTORLARIN USTUNE dustugunu olcmez. Sprite degisirse
yaylar bosluga cizilebilir ve hicbir kapi bunu yakalamaz.

Otomatik bir esik denedim (cember uzerindeki opak piksel orani) ve ise yaramadi:
pervaneler ince, cember cogunlukla kanatlar ARASINDAN geciyor, dolayisiyla
dogru hizalanmis bir rotorda bile oran dusuk cikiyor. Bu yuzden betik bir kapi
degil, bir GOSTERGE: cikan goruntuye bakilir.

  python3 tools/rotor_overlay.py [sprite ...]   -> reports/rotor_overlay.png
"""
import json
import pathlib
import re
import sys

from PIL import Image, ImageDraw

ROOT = pathlib.Path(__file__).resolve().parent.parent
CONFIG_JS = ROOT / "src" / "core" / "CONFIG.js"
OUT = ROOT / "reports" / "rotor_overlay.png"


def parse_rotor_config():
    """CONFIG.js icindeki centers/radii bloklarini okur (tek kaynak: CONFIG.js)."""
    src = CONFIG_JS.read_text()
    centers, radii = {}, {}
    blk = re.search(r"centers:\s*\{(.*?)\n    \},", src, re.S)
    for name, body in re.findall(r"(\w+):\s*\[(.*?)\],\s*\n", blk.group(1) + "\n"):
        pts = [tuple(map(int, m)) for m in re.findall(r"\[(-?\d+)\s*,\s*(-?\d+)\]", body)]
        if pts:
            centers[name] = pts
    blk = re.search(r"radii:\s*\{(.*?)\},", src, re.S)
    for name, val in re.findall(r"(\w+):\s*(\d+)", blk.group(1)):
        radii[name] = int(val)
    return centers, radii


def draw_sizes():
    m = json.loads((ROOT / "assets" / "manifest.json").read_text())
    return {s["name"]: (s["width"], s["height"]) for s in m["sprites"]}


def main():
    centers, radii = parse_rotor_config()
    sizes = draw_sizes()
    names = sys.argv[1:] or [n for n in centers if (ROOT / "assets" / f"{n}.png").exists()]

    cell = 240
    sheet = Image.new("RGB", (cell * len(names), cell + 22), (34, 34, 40))
    label = ImageDraw.Draw(sheet)

    for i, name in enumerate(names):
        path = ROOT / "assets" / f"{name}.png"
        if not path.exists() or name not in centers:
            continue
        dw, dh = sizes.get(name, (96, 96))
        r = radii.get(name, 20)
        im = Image.open(path).convert("RGBA").resize((dw * 2, dh * 2), Image.LANCZOS)
        ov = Image.new("RGBA", im.size, (0, 0, 0, 0))
        d = ImageDraw.Draw(ov)
        for (cx, cy) in centers[name]:
            x = (dw / 2 + cx) * 2
            y = (dh / 2 + cy) * 2
            d.ellipse([x - r * 2, y - r * 2, x + r * 2, y + r * 2],
                      outline=(0, 255, 120, 255), width=3)
            d.line([x - 5, y, x + 5, y], fill=(0, 255, 120, 255), width=2)
            d.line([x, y - 5, x, y + 5], fill=(0, 255, 120, 255), width=2)
        im.alpha_composite(ov)
        # sehir parlakligi zemin (ort. 62) — silueti gercekci degerlendirmek icin
        bg = Image.new("RGB", im.size, (62, 62, 70))
        bg.paste(im, (0, 0), im)
        bg.thumbnail((cell - 16, cell - 16), Image.LANCZOS)
        sheet.paste(bg, (i * cell + 8, 8))
        label.text((i * cell + 10, cell + 4), name, fill=(235, 235, 235))

    OUT.parent.mkdir(exist_ok=True)
    sheet.save(OUT)
    print(f"yazildi: {OUT.relative_to(ROOT)}  ({len(names)} sprite)")


if __name__ == "__main__":
    sys.exit(main())
