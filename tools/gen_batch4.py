#!/usr/bin/env python3
"""4. parti: bulutlar, silah kapsulleri, patlama katmanlari.

Kullanici istegi: havada oldugumuz hissi (bulut), silah yukseltmesi (kapsul),
daha zengin patlama (uc katman: parlama / ates topu / duman).

Patlama icin FLIPBOOK URETILMEZ — game/ projesinde denendi ve basarisiz oldu:
ayni seed ayni kareyi, farkli seed uyumsuz kareler uretiyor. Bunun yerine uc
katman uretilir ve animasyon KODDA yapilir (olcek + donus + additive karisim).
"""
import pathlib, sys, time
ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT)); sys.path.insert(0, str(ROOT / "tools"))
from PIL import Image
from qwen_agent import generate
from chroma_key import process

SUF = ("centered, single object, solid pure magenta background (#FF00FF) on all sides, "
       "no ground, no shadow, highly detailed digital illustration, clean rendered game "
       "asset, not pixelated")
NEG = ("text, watermark, multiple objects, ground, city, buildings, frame, border, "
       "pixel art, pixelated, cropped")

JOBS = {
    # --- bulutlar: sehrin uzerinde suzulen ince katman ---
    "cloud_wisp":  ("a thin wispy stretched cloud seen from above, soft translucent white "
                    "vapour, feathered edges, very light", 512, 256, 9001),
    "cloud_puff":  ("a small rounded cloud clump seen from above, soft translucent white "
                    "vapour with subtle grey underside, feathered edges", 384, 320, 9002),
    # --- silah yukseltme kapsulleri ---
    "pu_weapon":   ("a glowing hexagonal power-up capsule with a white chevron arrow symbol "
                    "on its face, electric cyan and white, soft inner glow", 96, 96, 9010),
    "pu_shield":   ("a glowing hexagonal power-up capsule with a shield emblem on its face, "
                    "emerald green and white, soft inner glow", 96, 96, 9011),
    # --- patlama katmanlari (kodda canlandirilir) ---
    "boom_flash":  ("a compact white hot flash burst, brilliant white core fading to pale "
                    "blue, round, radiant", 192, 192, 9020),
    "boom_fire":   ("a rolling fireball, white hot core with golden yellow inner flame and "
                    "deep orange outer flame, soft round billowing edges, no sharp spikes",
                    192, 192, 9021),
    "boom_smoke":  ("a soft round puff of thick grey smoke, billowing rounded edges, no "
                    "flames, no sparks", 192, 192, 9022),
}

if __name__ == "__main__":
    for name in (sys.argv[1:] or list(JOBS)):
        prompt, w, h, seed = JOBS[name]
        p = ROOT / "assets" / f"{name}.png"
        ar = w / h
        size = "icon" if 0.85 <= ar <= 1.18 else ("banner" if ar > 1.6 else "landscape")
        for attempt in range(3):
            try:
                generate(f"{prompt}, {SUF}", style="raw", size=size, seed=seed,
                         negative_prompt=NEG, out=str(p))
                key, removed, fringe, total = process(str(p), aggressive=True)
                im = Image.open(p).convert("RGBA")
                bb = im.getbbox()
                if bb: im = im.crop(bb)
                im = im.resize((w, h), Image.LANCZOS)
                im.save(p)
                print(f"| {name} | {seed} | {w}x{h} | anahtar #{key[0]:02X}{key[1]:02X}{key[2]:02X} "
                      f"| %{100*(removed+fringe)/total:.0f} |", flush=True)
                break
            except Exception as e:
                print(f"!! {name} deneme {attempt+1}: {e}", flush=True); time.sleep(15)
