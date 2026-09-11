#!/usr/bin/env python3
"""Dron savasi — ilk gorsel kadro (onay icin).

Varliklar oyunda cizilecek boyutun 2 KATI cozunurlukte saklanir: uyarlanabilir
renderer yuksek piksel yogunluklu ekranda 2x arka bellege cikabiliyor, o zaman
1x varlik yumusak gorunurdu. Uretim cozunurlugu ayni, sadece daha az kuculuyoruz.

Yon: gece sehri uzerinde TEPEDEN BAKIS. Dronlar tam tepeden gorunur (rotor
diskleri, govde, altta yanan konum isiklari). Zemin: neon aydinlatmali sokaklar,
catilar, arac isiklari.

Boru hatti game/ ile ayni: uret -> IP taramasi -> olculen chroma key -> yon
duzeltmesi -> manifest boyutuna olcekle. GPU tek kuyruk, her sey sirali.
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

# Dronlar/varliklar icin ortak stil eki (keylenebilir zemin)
SPRITE_SUFFIX = (
    "top-down view seen from directly above, centered, single object, "
    "solid pure magenta background (#FF00FF), no shadow, "
    "highly detailed digital illustration, clean rendered game asset, smooth shading, "
    "subtle rim light, metallic surfaces, crisp silhouette, high detail, not pixelated"
)
SPRITE_NEG = ("text, letters, watermark, ground, buildings, city, multiple objects, cropped, "
              "blur, shadow, dark background, frame, border, pixel art, pixelated, 8-bit, low resolution")

# Zemin karolari: chroma yok, koyulastirilir
TILE_NEG = ("text, letters, watermark, people, faces, cars from the side, horizon, sky, "
            "blur, photo, frame, border, vignette")

# name: (prompt, w, h, seed, rotate180, chroma, darken_target|None)
SPRITES = {
    # --- SEHIR ZEMINI: iki farkli yon, kullanici secsin ---
    "city_neon": (
        "a seamless top-down aerial view of a dense night city block, seen from directly "
        "above: dark rooftops with vents and water tanks, narrow streets between them lit "
        "by rows of warm street lamps, thin neon signs in cyan and magenta along the "
        "avenues, tiny car headlights as bright dots, deep blue-black asphalt",
        960, 1600, 7001, False, False, 34.0),
    "city_dusk": (
        "a seamless top-down aerial view of an industrial district at dusk, seen from "
        "directly above: concrete rooftops, cargo containers in rust and teal, freight "
        "yards with pale amber floodlights, cranes, wide empty lots, muted slate and "
        "ochre palette",
        960, 1600, 7002, False, False, 34.0),
    # --- OYUNCU DRONU ---
    "drone_player": (
        "a sleek quadcopter combat drone seen from directly above, X-shaped carbon frame "
        "with four rotor discs, a glowing cyan sensor eye at the centre, two small missile "
        "pods under the arms, white and cyan livery",
        192, 192, 7010, False, True, None),
    # --- DUSMAN DRONLARI (asagi bakacak sekilde 180 cevrilir) ---
    "drone_scout": (
        "a small fast reconnaissance quadcopter seen from directly above, slim frame, four "
        "small rotor discs, single red camera eye, matte grey and red livery",
        128, 128, 7020, True, True, None),
    "drone_gunner": (
        "an armed hexacopter attack drone seen from directly above, six rotor discs, bulky "
        "armored core, two chin-mounted gun barrels, orange and gunmetal livery",
        176, 160, 7021, True, True, None),
    "drone_shield": (
        "a heavy octocopter drone seen from directly above, eight rotor discs, thick armor "
        "plating, a translucent blue energy shield dome over the core, silver and electric "
        "blue livery",
        192, 192, 7022, True, True, None),
    # --- BOSS ---
    "boss_gunship": (
        "a massive armored assault gunship seen from directly above, wide fuselage with two "
        "huge ducted rotor rings, missile racks along both flanks, glowing crimson cockpit "
        "core, dark gunmetal and crimson livery, menacing symmetrical design",
        416, 352, 7030, True, True, None),
    # --- EFEKTLER / UI ---
    "muzzle_flash": (
        "a small bright muzzle flash burst, white hot core with a short yellow star flare, "
        "compact",
        96, 96, 7040, False, True, None),
    "rotor_wash": (
        "a faint circular downwash ring of swirling dust, thin translucent grey spiral, "
        "mostly transparent",
        192, 192, 7041, False, True, None),
    "hud_target": (
        "a thin targeting reticle bracket, four corner marks forming a square, bright cyan, "
        "minimal, no fill",
        96, 96, 7042, False, True, None),
}

IP_Q = ("Bu gorselde taninmis, markali veya telifli bir karakter/arac var mi? "
        'SADECE JSON: {"ip_riski": true/false, "karakter": "ad veya bos"}')


def log(line):
    with LOG.open("a", encoding="utf-8") as f:
        f.write(line + "\n")


def build(name):
    prompt, w, h, seed, rot, chroma, dark = SPRITES[name]
    path = ASSETS / f"{name}.png"
    full = f"{prompt}, {SPRITE_SUFFIX}" if chroma else f"{prompt}, no text, seamless tile"
    neg = SPRITE_NEG if chroma else TILE_NEG
    ar = w / h
    size = ("icon" if 0.85 <= ar <= 1.18 else
            ("landscape" if ar > 1.18 else ("2:3" if ar < 0.72 else "portrait")))

    generate(full, style="raw", size=size, seed=seed, negative_prompt=neg, out=str(path))

    ip = "?"
    try:
        raw = look(str(path), IP_Q, max_tokens=150)
        ip = json.loads(raw[raw.index("{"):raw.rindex("}") + 1]).get("ip_riski")
    except Exception:
        pass

    note = ""
    if chroma:
        key, removed, fringe, total = chroma_process(str(path))
        note = f"key #{key[0]:02X}{key[1]:02X}{key[2]:02X} %{100*(removed+fringe)/total:.0f}"

    im = Image.open(path).convert("RGBA")
    if rot:
        im = im.rotate(180)
    im = im.resize((w, h), Image.LANCZOS)   # render tarzi: NEAREST testere disi birakir
    if dark:
        before = ImageStat.Stat(im.convert("L")).mean[0]
        f = min(1.0, dark / max(before, 0.1))
        im = im.point(lambda v, f=f: int(min(255, v * f)))
        note = f"koyulastirildi {before:.1f}->{ImageStat.Stat(im.convert('L')).mean[0]:.1f}"
    im.save(path)

    line = f"| {name} | {seed} | {w}x{h} | {'180°' if rot else '-'} | {note or 'ham'} | ip_riski={ip} |"
    log(line)
    print(line, flush=True)


def main():
    ASSETS.mkdir(exist_ok=True)
    wanted = sys.argv[1:] or list(SPRITES)
    log(f"\n## Dron savasi — konsept kadrosu — {time.strftime('%F %H:%M')}\n")
    log("| sprite | seed | boyut | donus | islem | IP |")
    log("|---|---|---|---|---|---|")
    for name in wanted:
        for attempt in range(3):
            try:
                build(name)
                break
            except Exception as e:
                print(f"!! {name} deneme {attempt+1}: {e}", flush=True)
                time.sleep(15)
        else:
            log(f"| {name} | - | - | - | BASARISIZ | - |")


if __name__ == "__main__":
    main()
