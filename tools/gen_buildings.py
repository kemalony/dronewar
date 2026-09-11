#!/usr/bin/env python3
"""Sehir basina TEK TEK bina sprite'lari (parallaks katmani icin).

Neden tek tek: tam ekran "catilar" dokusu zemini kapatiyordu, otomatik ayirma da
birbirine degen binalarda tek blok veriyordu. Her binayi ayri uretmek hem temiz
alfa hem de sahnede yogunlugu oyunun kontrol etmesini sagliyor.

Her bina TEPEDEN gorunur ama yan yuzleri hafif gorunur — dron yana kayinca
parallaks ile bu yuzler acilip kapanir, kamera acisi degisiyormus gibi olur.
"""
import pathlib, sys, time
ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT)); sys.path.insert(0, str(ROOT / "tools"))
from PIL import Image
from qwen_agent import generate
from chroma_key import process

COMMON = ("a SINGLE isolated building seen from above at a slight angle so its side walls are "
          "just visible, standing alone, nothing else in frame, solid pure magenta background "
          "(#FF00FF) on all sides, no ground, no street, no neighbouring buildings, no shadow, "
          "highly detailed digital illustration, clean rendered game asset, not pixelated")
NEG = ("text, watermark, multiple buildings, city block, street, road, ground, horizon, sky, "
       "people, cars, frame, border, pixel art, pixelated, cropped")

CITY = {
    "istanbul": [
        ("a domed Ottoman mosque with a lead-grey dome and two slender minarets", 8201),
        ("a narrow terracotta-roofed apartment building with rooftop terraces", 8202),
        ("a modern glass office tower with a helipad on its roof", 8203),
        ("an old stone tower with a conical roof and a viewing balcony", 8204),
    ],
    "paris": [
        ("a Haussmann apartment block with a pale zinc mansard roof and chimney stacks", 8211),
        ("a domed beaux-arts building with a green patina dome and stone balustrade", 8212),
        ("a narrow six-storey stone building with wrought iron balconies", 8213),
        ("a glass and steel modern office block with a roof garden", 8214),
    ],
    "newyork": [
        ("an art deco skyscraper with stepped setbacks and a slim spire", 8221),
        ("a brick apartment block with wooden rooftop water tanks and fire escapes", 8222),
        ("a black glass corporate tower with a mechanical penthouse", 8223),
        ("a low brownstone row building with a tarred flat roof", 8224),
    ],
    "tokyo": [
        ("a slim concrete tower crowded with air conditioning units on its roof", 8231),
        ("a low building whose facade is covered in vertical neon signage frames", 8232),
        ("a white tiled office block with a rooftop stair box and antenna mast", 8233),
        ("a small traditional wooden-roofed building wedged between taller walls", 8234),
    ],
}

if __name__ == "__main__":
    out = ROOT / "assets" / "buildings"
    out.mkdir(parents=True, exist_ok=True)
    cities = sys.argv[1:] or list(CITY)
    for city in cities:
        for i, (prompt, seed) in enumerate(CITY[city], start=1):
            p = out / f"{city}_{i}.png"
            for attempt in range(3):
                try:
                    generate(f"{prompt}, {COMMON}", style="raw", size="icon", seed=seed,
                             negative_prompt=NEG, out=str(p))
                    key, removed, fringe, total = process(str(p), aggressive=True)
                    im = Image.open(p).convert("RGBA")
                    bbox = im.getbbox()
                    if bbox:
                        im = im.crop(bbox)
                    k = 340 / max(im.width, im.height)
                    im = im.resize((max(1, int(im.width * k)), max(1, int(im.height * k))),
                                   Image.LANCZOS)
                    im.save(p)
                    print(f"| {city}_{i} | {seed} | {im.width}x{im.height} | "
                          f"anahtar #{key[0]:02X}{key[1]:02X}{key[2]:02X} |", flush=True)
                    break
                except Exception as e:
                    print(f"!! {city}_{i} deneme {attempt+1}: {e}", flush=True); time.sleep(15)
