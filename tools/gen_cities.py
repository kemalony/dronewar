#!/usr/bin/env python3
"""Ikonik sehir bolumleri: kayan zemin karosu + bir kez gecen simge yapi.

Her bolum icin iki varlik:
  city_<ad>      — dikey kayan, tepeden bakis sehir dokusu (chroma yok, koyulastirilir)
  landmark_<ad>  — o sehrin simgesi, tepeden gorunumu (chroma var, sahnede bir kez gecer)

Simge yapilar gercek mimari; marka/karakter degil. Yine de her cikti IP taramasindan
gecirilir. Varliklar oyunda cizilecek boyutun 2 kati cozunurlukte saklanir.
"""
import json
import pathlib
import sys
import time

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "tools"))

from PIL import Image, ImageStat

from qwen_agent import generate, look
from chroma_key import process as chroma_process

ASSETS = ROOT / "assets"
LOG = ASSETS / "gen_log.md"

TILE_NEG = ("text, letters, watermark, people, faces, horizon, sky, side view, "
            "oblique view, perspective, blur, frame, border, vignette, pixel art")
MARK_SUFFIX = (
    "seen from directly above, orthographic top-down view, centered, single structure, "
    "solid pure magenta background (#FF00FF), no shadow, highly detailed digital "
    "illustration, clean rendered game asset, smooth shading, high detail, not pixelated"
)
MARK_NEG = ("text, letters, watermark, people, cars, streets, city blocks, multiple objects, "
            "cropped, blur, shadow, dark background, frame, border, pixel art, pixelated, "
            "side view, perspective, horizon, sky")

DARK = 62.0   # sehir sahnenin yildizi: 34 fazla karanlikti, vision 3 verdi

# name: (prompt, w, h, seed, chroma, darken)
SPRITES = {
    # ---------------- ISTANBUL ----------------
    "city_istanbul": (
        "a seamless vertical top-down aerial view of Istanbul at night, seen from directly "
        "above: the dark Bosphorus strait cutting through the frame with ferry wakes and "
        "boat lights, dense historic quarters on both banks with terracotta rooftops, "
        "domed mosques with slender minarets casting no shadow, winding narrow streets lit "
        "warm amber, a long suspension bridge with blue-white lights crossing the water",
        960, 1600, 8001, False, DARK),
    "landmark_istanbul": (
        # Avlu kaldirildi: amblem boyutunda dikdortgen avlu, sprite'in etrafinda
        # cerceve gibi okunuyordu.
        "a grand Ottoman mosque seen from directly above: one large central dome ringed by "
        "smaller half domes, four slender minarets at the corners, no courtyard, compact "
        "rounded silhouette, warm stone and lead-grey roofing",
        320, 320, 8002, True, None),
    # ---------------- PARIS ----------------
    "city_paris": (
        "a seamless vertical top-down aerial view of Paris at night, seen from directly "
        "above: uniform Haussmann blocks with pale zinc rooftops and inner courtyards, wide "
        "boulevards meeting at a radial star-shaped intersection, the Seine curving through "
        "with lit bridges, rows of warm street lamps, formal green squares",
        960, 1600, 8003, False, DARK),
    "landmark_paris": (
        "a tall iron lattice tower seen from directly above: a symmetrical four-legged "
        "square lattice footprint narrowing to a central spire, dark iron brown with warm "
        "golden uplighting on the legs",
        320, 320, 8004, True, None),
    # ---------------- NEW YORK ----------------
    "city_newyork": (
        "a seamless vertical top-down aerial view of Manhattan at night, seen from directly "
        "above: a strict rectangular street grid, tall tower rooftops with water tanks and "
        "helipads, avenues streaked with yellow taxi lights, the dark rectangle of a large "
        "park at one edge, steam vents",
        960, 1600, 8005, False, DARK),
    "landmark_newyork": (
        "a very tall art deco skyscraper seen from directly above: a stepped setback "
        "footprint narrowing to a slim spire mast, pale limestone with lit setback edges",
        320, 320, 8006, True, None),
    # ---------------- TOKYO ----------------
    "city_tokyo": (
        "a seamless vertical top-down aerial view of Tokyo at night, seen from directly "
        "above: extremely dense low blocks, elevated expressways curving over the city, "
        "railway lines, dense neon signage in cyan magenta and white along the avenues, "
        "narrow alleys glowing warm",
        960, 1600, 8007, False, DARK),
    "landmark_tokyo": (
        "a red and white steel lattice communications tower seen from directly above: a "
        "square lattice footprint with four legs narrowing to a central antenna mast, "
        "bright vermilion and white bands",
        320, 320, 8008, True, None),
}

IP_Q = ("Bu gorselde taninmis, markali veya telifli bir KARAKTER ya da urun var mi? "
        "Gercek mimari yapilar ve sehir dokusu sorun degil. "
        'SADECE JSON: {"ip_riski": true/false, "karakter": "ad veya bos"}')


def log(line):
    with LOG.open("a", encoding="utf-8") as f:
        f.write(line + "\n")


def build(name):
    prompt, w, h, seed, chroma, dark = SPRITES[name]
    path = ASSETS / f"{name}.png"
    full = f"{prompt}, {MARK_SUFFIX}" if chroma else f"{prompt}, no text, seamless tile"
    neg = MARK_NEG if chroma else TILE_NEG
    size = "icon" if abs(w / h - 1) < 0.18 else ("2:3" if w < h else "landscape")

    generate(full, style="raw", size=size, seed=seed, negative_prompt=neg, out=str(path))

    ip = "?"
    try:
        raw = look(str(path), IP_Q, max_tokens=180)
        ip = json.loads(raw[raw.index("{"):raw.rindex("}") + 1]).get("ip_riski")
    except Exception:
        pass

    note = ""
    if chroma:
        key, removed, fringe, total = chroma_process(str(path))
        note = f"key #{key[0]:02X}{key[1]:02X}{key[2]:02X} %{100*(removed+fringe)/total:.0f}"

    im = Image.open(path).convert("RGBA").resize((w, h), Image.LANCZOS)
    if dark:
        before = ImageStat.Stat(im.convert("L")).mean[0]
        f = min(1.0, dark / max(before, 0.1))
        im = im.point(lambda v, f=f: int(min(255, v * f)))
        note = f"koyulastirildi {before:.1f}->{ImageStat.Stat(im.convert('L')).mean[0]:.1f}"
    im.save(path)

    line = f"| {name} | {seed} | {w}x{h} | {note or 'ham'} | ip_riski={ip} |"
    log(line)
    print(line, flush=True)


def main():
    wanted = sys.argv[1:] or list(SPRITES)
    log(f"\n## Ikonik sehir bolumleri — {time.strftime('%F %H:%M')}\n")
    log("| varlik | seed | boyut | islem | IP |")
    log("|---|---|---|---|---|")
    for name in wanted:
        for attempt in range(3):
            try:
                build(name)
                break
            except Exception as e:
                print(f"!! {name} deneme {attempt+1}: {e}", flush=True)
                time.sleep(15)
        else:
            log(f"| {name} | - | - | BASARISIZ | - |")


if __name__ == "__main__":
    main()
