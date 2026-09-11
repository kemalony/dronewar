#!/usr/bin/env python3
"""5. parti — kullanici geri bildirimi: cesitlilik.

- 6 bulut (tek tip bulut tekrar ediyordu)
- 3 sehre ozel boss (her bolum ayni boss'tu)
- 3 yeni dusman tipi (saldiri cesitliligi icin)
- roket mermisi + roket kapsulu (kazanilabilir ek silah)
- 3 secilebilir oyuncu dronu (bonusla acilir)
- her sehir icin ikinci zemin karosu (goruntuler cok tekrar ediyordu)
"""
import pathlib, sys, time
ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT)); sys.path.insert(0, str(ROOT / "tools"))
from PIL import Image, ImageStat
from qwen_agent import generate
from chroma_key import process

SPR = ("top-down view seen from directly above, centered, single object, solid pure magenta "
       "background (#FF00FF), no shadow, highly detailed digital illustration, clean rendered "
       "game asset, crisp silhouette, not pixelated")
SPR_NEG = ("text, watermark, ground, city, buildings, multiple objects, cropped, blur, shadow, "
           "dark background, frame, border, pixel art, pixelated")
TILE_NEG = ("text, watermark, people, horizon, sky, side view, perspective, frame, border, "
            "vignette, pixel art")
DARK = 62.0

# name: (prompt, w, h, seed, rot180, chroma, darken)
JOBS = {
    # ---------------- BULUTLAR ----------------
    "cloud_a": ("a long thin streak of high altitude cirrus cloud seen from above, translucent "
                "white, feathered wispy ends", 560, 200, 9101, False, True, None),
    "cloud_b": ("a small round cotton cloud clump seen from above, soft white with pale grey "
                "underside", 320, 280, 9102, False, True, None),
    "cloud_c": ("a broken chain of small scattered cloudlets seen from above, translucent white, "
                "irregular spacing", 520, 260, 9103, False, True, None),
    "cloud_d": ("a dense billowing cumulus cloud seen from above, bright white top with soft grey "
                "shadowed folds", 400, 360, 9104, False, True, None),
    "cloud_e": ("a very faint thin haze veil seen from above, almost transparent white mist", 600,
                240, 9105, False, True, None),
    "cloud_f": ("a curved arc of cloud seen from above, translucent white with torn edges",
                480, 300, 9106, False, True, None),
    # ---------------- SEHRE OZEL BOSSLAR ----------------
    "boss_paris": ("a heavy armored assault airship seen from directly above, elongated armored "
                   "hull with four ducted rotor rings, pale steel and deep blue livery, gold trim, "
                   "twin cannon pods", 416, 352, 9110, True, True, None),
    "boss_newyork": ("a massive black stealth gunship seen from directly above, angular faceted "
                     "hull with two large ducted rotors, matte black and amber running lights, "
                     "missile racks", 416, 352, 9111, True, True, None),
    "boss_tokyo": ("a colossal drone carrier seen from directly above, wide hexagonal hull with "
                   "six rotor rings, white and vermilion livery, glowing cyan seams, launch bays",
                   416, 352, 9112, True, True, None),
    # ---------------- YENI DUSMANLAR ----------------
    "drone_bomber": ("a bulky bomber quadcopter seen from directly above, wide fuselage with two "
                     "bomb pods underneath, olive drab and rust livery, four heavy rotors",
                     176, 160, 9120, True, True, None),
    "drone_kamikaze": ("a small sharp arrowhead suicide drone seen from directly above, single "
                       "rotor pair, bright warning yellow and black hazard stripes, red nose",
                       112, 112, 9121, True, True, None),
    "drone_sniper": ("a slender long range drone seen from directly above, narrow body with a long "
                     "barrel underneath, dark violet and silver livery, four thin rotors",
                     160, 144, 9122, True, True, None),
    # ---------------- ROKET ----------------
    "rocket": ("a small guided missile seen from directly above, nose pointing up, white body with "
               "red tip, two small fins, bright cyan exhaust flame at the tail", 40, 88, 9130,
               False, True, None),
    "pu_rocket": ("a glowing hexagonal power-up capsule with a white missile silhouette on its "
                  "face, hot crimson and white, soft inner glow", 96, 96, 9131, False, True, None),
    # ---------------- SECILEBILIR DRONLAR ----------------
    "drone_swift": ("a slim racing quadcopter seen from directly above, narrow X frame, four small "
                    "rotors, lime green and white livery, single green sensor eye", 192, 192,
                    9140, False, True, None),
    "drone_tank": ("a heavy armored hexacopter seen from directly above, thick plated core, six "
                   "rotors, sand and gunmetal livery, twin gun pods", 208, 192, 9141, False, True, None),
    "drone_ghost": ("a stealth quadcopter seen from directly above, sharp angular black frame, four "
                    "rotors, matte black with violet edge glow", 192, 192, 9142, False, True, None),
    # ---------------- IKINCI SEHIR KAROLARI ----------------
    "city_istanbul_b": ("a seamless vertical top-down aerial view of Istanbul at night over a "
                        "different district: the Golden Horn waterway, dense low rooftops, a large "
                        "domed mosque complex, ferry piers, winding lit streets", 960, 1600, 9150,
                        False, False, DARK),
    "city_paris_b": ("a seamless vertical top-down aerial view of Paris at night over a different "
                     "quarter: long straight boulevards, a large formal garden rectangle, dense "
                     "zinc rooftops, a railway station roof", 960, 1600, 9151, False, False, DARK),
    "city_newyork_b": ("a seamless vertical top-down aerial view of Manhattan at night over a "
                       "different district: dense midtown towers, a bridge approach, piers along "
                       "the river, avenues of taxi lights", 960, 1600, 9152, False, False, DARK),
    "city_tokyo_b": ("a seamless vertical top-down aerial view of Tokyo at night over a different "
                     "ward: a huge scramble intersection, dense neon blocks, elevated rail lines, "
                     "a park rectangle", 960, 1600, 9153, False, False, DARK),
}

if __name__ == "__main__":
    for name in (sys.argv[1:] or list(JOBS)):
        prompt, w, h, seed, rot, chroma, dark = JOBS[name]
        p = ROOT / "assets" / f"{name}.png"
        full = f"{prompt}, {SPR}" if chroma else f"{prompt}, no text, seamless tile"
        neg = SPR_NEG if chroma else TILE_NEG
        ar = w / h
        size = ("icon" if 0.85 <= ar <= 1.18 else
                ("banner" if ar > 1.6 else ("landscape" if ar > 1.18 else "2:3")))
        for attempt in range(3):
            try:
                generate(full, style="raw", size=size, seed=seed, negative_prompt=neg, out=str(p))
                note = ""
                if chroma:
                    key, rm, fr, tot = process(str(p), aggressive=True)
                    note = f"key #{key[0]:02X}{key[1]:02X}{key[2]:02X} %{100*(rm+fr)/tot:.0f}"
                im = Image.open(p).convert("RGBA")
                if chroma:
                    bb = im.getbbox()
                    if bb: im = im.crop(bb)
                if rot: im = im.rotate(180)
                im = im.resize((w, h), Image.LANCZOS)
                if dark:
                    before = ImageStat.Stat(im.convert("L")).mean[0]
                    f = min(1.0, dark / max(before, 0.1))
                    im = im.point(lambda v, f=f: int(min(255, v * f)))
                    note = f"koyulastirildi {before:.0f}->{dark:.0f}"
                im.save(p)
                print(f"| {name} | {seed} | {w}x{h} | {note} |", flush=True)
                break
            except Exception as e:
                print(f"!! {name} deneme {attempt+1}: {e}", flush=True); time.sleep(15)
