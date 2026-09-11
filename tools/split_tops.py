#!/usr/bin/env python3
"""Tepe katmanini TEK TEK bina sprite'larina ayirir.

Neden: tam ekran bir "catilar" katmani zemini tamamen kapatiyor (Bogaz, Seine,
izgara kayboluyor) ve oyun alani okunmuyor. Binalari ayri sprite'lar olarak
tutunca oyun bunlari seyrek yerlestirip parallaks ile kaydirabiliyor; yogunlugu
sahne kontrol ediyor, doku degil.

Alfa kanalinda bagli bilesen etiketleme yapar, kucuk parcalari eler, kalanlari
kirpip assets/buildings/<sehir>_<n>.png olarak yazar.
"""
import pathlib
import sys
from collections import deque

from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "buildings"
MIN_SIDE = 90          # bundan kucuk parcalar cop
MIN_FILL = 0.25        # kutunun en az bu kadari dolu olmali


def split(city):
    src = ROOT / "assets" / f"tops_{city}.png"
    im = Image.open(src).convert("RGBA")
    w, h = im.size
    px = im.load()
    seen = bytearray(w * h)
    boxes = []
    for sy in range(h):
        for sx in range(w):
            if seen[sy * w + sx] or px[sx, sy][3] < 40:
                continue
            q = deque([(sx, sy)])
            seen[sy * w + sx] = 1
            x0 = x1 = sx
            y0 = y1 = sy
            n = 0
            while q:
                x, y = q.popleft()
                n += 1
                if x < x0: x0 = x
                if x > x1: x1 = x
                if y < y0: y0 = y
                if y > y1: y1 = y
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx] \
                            and px[nx, ny][3] >= 40:
                        seen[ny * w + nx] = 1
                        q.append((nx, ny))
            bw, bh = x1 - x0 + 1, y1 - y0 + 1
            if bw >= MIN_SIDE and bh >= MIN_SIDE and n / (bw * bh) >= MIN_FILL:
                boxes.append((n, x0, y0, x1, y1))

    boxes.sort(reverse=True)
    OUT.mkdir(parents=True, exist_ok=True)
    kept = 0
    for i, (n, x0, y0, x1, y1) in enumerate(boxes[:10]):
        crop = im.crop((x0, y0, x1 + 1, y1 + 1))
        crop.save(OUT / f"{city}_{i+1}.png")
        kept += 1
        print(f"  {city}_{i+1}.png  {crop.width}x{crop.height}")
    print(f"{city}: {kept} bina ayrildi ({len(boxes)} aday)")


if __name__ == "__main__":
    for c in (sys.argv[1:] or ["istanbul", "paris", "newyork", "tokyo"]):
        split(c)
