#!/usr/bin/env python3
"""src/ paketlerinden tek dosyalik index.html uretir.

Neden boyle: teslim edilen sey TEK dosya olmak zorunda (Artifact sayfasi disaridan
dosya okuyamaz ve CSP gomulu gorselleri engelliyor), ama 3300 satirlik tek dosyada
paralel calismak imkansiz. Kaynak paketlere bolunur, derleyici birlestirir.

Kullanim: python3 tools/build.py   ->  index.html
"""
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "src"
OUT = ROOT / "index.html"


def build():
    order = json.loads((SRC / "build_order.json").read_text(encoding="utf-8"))
    shell = (SRC / "shell.html").read_text(encoding="utf-8")
    parts = []
    for rel in order:
        p = SRC / rel
        if not p.exists():
            print(f"HATA: {rel} yok", file=sys.stderr)
            return 1
        parts.append(f"/* ---- src/{rel} ---- */\n" + p.read_text(encoding="utf-8"))
    body = "\n".join(parts)
    if "/*__BUILD__*/" not in shell:
        print("HATA: shell.html icinde /*__BUILD__*/ isareti yok", file=sys.stderr)
        return 1
    OUT.write_text(shell.replace("/*__BUILD__*/", body), encoding="utf-8")
    n = len(OUT.read_text(encoding="utf-8").splitlines())
    print(f"index.html yazildi: {n} satir, {len(order)} kaynak dosya")
    return 0


if __name__ == "__main__":
    sys.exit(build())
