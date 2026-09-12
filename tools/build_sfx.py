#!/usr/bin/env python3
"""assets/sfx/*.ogg -> src/audio/sfx.data.js (base64 banka)

Neden gomuluyor, dis dosya olarak yuklenmiyor: OLCULDU (2026-09-12).
  fetch('assets/...')            -> BLOKLU (file:// altinda)
  XMLHttpRequest                 -> BLOKLU
  new Audio('assets/...')        -> calisiyor AMA
  ctx.createMediaElementSource() -> baglaniyor, SES SESSIZ GELIYOR (tainted)
Yani dis dosya yolu, WebAudio karistirici zincirini (kompresor + limiter, pan,
ust uste binme, perde) kaybetmeden kullanilamiyor. Bu, projede canvas'ta
belgelenmis `toDataURL` tainted tuzaginin ayni sinifi.

Base64 + atob + decodeAudioData hic agdan gecmiyor, dolayisiyla tainted degil:
olculdu, analyser'da tepe 0.506 -- gercek ses, tam kontrol.

Boyut: 18 ses, 22 kHz mono, ~99 KB ham -> ~132 KB base64. Kaynak Kenney
"Sci-Fi Sounds" (CC0, ticari kullanim serbest, atif zorunlu degil).

  python3 tools/build_sfx.py
"""
import base64
import json
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SFX = ROOT / "assets" / "sfx"
OUT = ROOT / "src" / "audio" / "sfx.data.js"


def probe(path):
    r = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries",
         "stream=duration,sample_rate,channels", "-of", "json", str(path)],
        capture_output=True, text=True,
    )
    s = json.loads(r.stdout)["streams"][0]
    return float(s.get("duration", 0)), int(s["sample_rate"]), int(s["channels"])


def main():
    files = sorted(SFX.glob("*.ogg"))
    if not files:
        raise SystemExit(f"ses yok: {SFX}")

    entries = []
    total_raw = 0
    for f in files:
        dur, sr, ch = probe(f)
        if dur <= 0.05 or ch != 1:
            raise SystemExit(f"{f.name}: sure {dur:.3f}s kanal {ch} -- mono ve >0.05s olmali")
        raw = f.read_bytes()
        total_raw += len(raw)
        entries.append((f.stem, base64.b64encode(raw).decode("ascii"), dur))

    lines = [
        "/* src/audio/sfx.data.js — URETILEN DOSYA, ELLE DUZENLEME.",
        " * tools/build_sfx.py ile assets/sfx/*.ogg icinden uretilir.",
        " *",
        " * Neden gomulu: file:// altinda fetch ve XHR bloklu, ve dis ses dosyasi",
        " * createMediaElementSource uzerinden baglaninca SESSIZ geliyor (tainted).",
        " * Base64 + atob + decodeAudioData hic agdan gecmedigi icin sorunsuz ve",
        " * WebAudio'nun tam kontrolunu (ust uste binme, perde, pan, kompresor",
        " * zinciri) korur. Olcumler tools/build_sfx.py basliginda.",
        " *",
        " * Kaynak: Kenney 'Sci-Fi Sounds' — CC0 (kamu mali), ticari kullanim",
        " * serbest, atif zorunlu degil. https://kenney.nl",
        " */",
        "const SFX_DATA = {",
    ]
    for name, b64, dur in entries:
        lines.append(f"  /* {dur:.3f}s */ {name}: '{b64}',")
    lines.append("};")
    lines.append("")

    OUT.write_text("\n".join(lines))
    b64_total = sum(len(b) for _, b, _ in entries)
    print(f"{len(entries)} ses -> {OUT.relative_to(ROOT)}")
    print(f"  ham {total_raw/1024:.1f}K  base64 {b64_total/1024:.1f}K")
    for name, b64, dur in entries:
        print(f"    {name:12s} {dur:6.3f}s  {len(b64)/1024:6.1f}K")
    return 0


if __name__ == "__main__":
    sys.exit(main())
