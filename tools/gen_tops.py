#!/usr/bin/env python3
"""Sehirlerin BINA TEPELERI katmani — parallaks yalpalamasi icin.

Zeminin uzerinde ters yonde kayar; boylece dron yana gidince binalar egilir ve
kamera acisi degisiyormus gibi gorunur. Model binalari yan yuzleriyle cizdigi
icin efekt kendiliginden ikna edici oluyor — prompt bunu bilerek istiyor.
"""
import sys, pathlib, time
ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT)); sys.path.insert(0, str(ROOT / "tools"))
from PIL import Image
from qwen_agent import generate
from chroma_key import process

COMMON = ("floating separately with clear gaps between them, solid pure magenta background "
          "(#FF00FF) filling every gap, no streets, no roads, no ground plane, slight visible "
          "building sides so the volumes read as tall, highly detailed digital illustration, "
          "clean rendered game asset, not pixelated")
NEG = ("text, watermark, streets, roads, ground, continuous city, horizon, sky, frame, border, "
       "pixel art, pixelated, people, cars")

JOBS = {
    "tops_istanbul": ("scattered tall building tops, mosque domes and minaret tips seen from "
                      "above, terracotta and lead-grey roofs, rooftop water tanks and terraces", 8101),
    "tops_paris": ("scattered tall Haussmann building tops with pale zinc roofs, chimney stacks "
                   "and inner courtyards seen from above", 8112),
    "tops_newyork": ("scattered art deco and glass skyscraper tops seen from above, rooftop water "
                     "tanks, helipads and mechanical penthouses, pale stone and dark glass", 8113),
    # Tokyo ilk denemede bosluk birakmadi ("dense" kelimesi karsi calisti): model
    # kesintisiz cati denizi cizdi, anahtar rengi bulunamadi. Az sayida ve
    # birbirinden ayrik bina istemek sorunu cozuyor.
    "tops_tokyo": ("about eight separate Tokyo building tops seen from above, widely spaced "
                   "apart, flat roofs crowded with air conditioning units, signage frames and "
                   "stair boxes, concrete and pale tile", 8125),
}

if __name__ == "__main__":
    for name in (sys.argv[1:] or list(JOBS)):
        prompt, seed = JOBS[name]
        p = f"assets/{name}.png"
        for attempt in range(3):
            try:
                generate(f"{prompt}, {COMMON}", style="raw", size="2:3", seed=seed,
                         negative_prompt=NEG, out=p)
                key, removed, fringe, total = process(p)
                Image.open(p).convert("RGBA").resize((960, 1600), Image.LANCZOS).save(p)
                im = Image.open(p).convert("RGBA")
                opaque = sum(1 for q in im.get_flattened_data() if q[3] > 0) \
                    if hasattr(im, "get_flattened_data") else \
                    sum(1 for q in list(im.getdata()) if q[3] > 0)
                pct = 100 * opaque / (im.width * im.height)
                print(f"| {name} | {seed} | anahtar #{key[0]:02X}{key[1]:02X}{key[2]:02X} | "
                      f"opak %{pct:.0f} |", flush=True)
                break
            except Exception as e:
                print(f"!! {name} deneme {attempt+1}: {e}", flush=True); time.sleep(15)
