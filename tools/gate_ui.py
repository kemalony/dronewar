#!/usr/bin/env python3
"""Menu/akis kapisi: arayuz okunurlugu arkadakinden BAGIMSIZ mi, ve akis kapali mi?

Arayuz canli kayan sehrin uzerine ciziliyor. Okunurluk o an arkada ne oldugunu
bagliysa kirilgandir: ayni ekran bir karede okunur, digerinde kaybolur.

OLCUM (ui_scrim): arayuz yazisinin ARKASINDAKI medyan parlaklik, bes farkli
kaydirma konumunda. Perde isini yapiyorsa hem DUSUK hem KARARLI olur.
Olculdu 2026-09-12 (duzeltmeden once): menu yayilim 8 (iyi), pause 24,
stagecard 38 -- tepe 53, yani kart parlak koprunun uzerine denk gelince
yazi ve amblem kayboluyordu.

Esik neden 12: menu perdesi bu haliyle 8 veriyor, yani hedef ulasilabilir ve
projenin kendi en iyi orneginden turetildi.

Not: once "tepe - medyan" olcmeyi denedim; ayirt ETMEDI, cunku parlak arka plan
tepeyi yazi olmasa da 255'e cikariyor. Olculmesi gereken sey arka planin
SIZMASI, kontrastin kendisi degil.

  PW_CHANNEL=chrome .venv-mac/bin/python tools/gate_ui.py
"""
import os
import pathlib
import statistics
import sys

from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
INDEX = ROOT / "index.html"
STEP = 1000.0 / 120.0
SHOT = "/tmp/gate_ui_probe.png"
MAX_SPREAD = 12
MAX_MEDIAN = 45

results = []


def check(name, ok, detail):
    results.append((name, bool(ok), detail))
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}  ({detail})")


def tick(pg, n):
    for _ in range(n):
        pg.evaluate(f"window.__game.tick({STEP})")


def band_median(y0, y1):
    im = Image.open(SHOT).convert("L")
    w, _ = im.size
    px = sorted(im.crop((0, y0, w, y1)).get_flattened_data())
    return px[len(px) // 2]


def mode(pg):
    return pg.evaluate("window.__game.state().mode")


def main():
    ch = os.environ.get("PW_CHANNEL", "")
    with sync_playwright() as p:
        b = p.chromium.launch(channel=ch) if ch else p.chromium.launch()
        pg = b.new_page(viewport={"width": 480, "height": 800})
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto(f"file://{INDEX}?autotest=1")
        pg.wait_for_function("window.__game !== undefined", timeout=20000)
        pg.wait_for_timeout(3000)

        # ------------------------------------------------------------ ui_scrim
        for name, band in (("menu", (180, 260)), ("pause", (300, 380)), ("stagecard", (340, 420))):
            meds = []
            for k in range(5):
                pg.evaluate("window.__game.toMenu()")
                tick(pg, 20)
                if name == "menu":
                    tick(pg, k * 60)
                else:
                    pg.evaluate("window.__game.startGame()")
                    tick(pg, 60 + k * 90)
                    if name == "pause":
                        pg.evaluate("window.__game.togglePause()")
                        tick(pg, 20)
                    else:
                        pg.evaluate("() => { window.__game.game.stageTitleT ="
                                    " CONFIG.STAGE_TITLE_MS / 1000 * 0.6; }")
                        tick(pg, 3)
                pg.screenshot(path=SHOT)
                meds.append(band_median(*band))
            spread = max(meds) - min(meds)
            ok = spread <= MAX_SPREAD and max(meds) <= MAX_MEDIAN
            check(f"ui_scrim_{name}", ok,
                  f"medyanlar={meds} yayilim={spread} (<={MAX_SPREAD}) tepe={max(meds)} (<={MAX_MEDIAN})")

        # ------------------------------------------------------------- ui_flow
        pg.evaluate("window.__game.toMenu()"); tick(pg, 20)
        m0 = mode(pg)
        pg.evaluate("() => window.__game.game.toShipSelect()"); tick(pg, 10)
        m1 = mode(pg)
        pg.evaluate("() => window.__game.game.confirmShipSelect()"); tick(pg, 10)
        m2 = mode(pg)
        pg.evaluate("window.__game.togglePause()"); tick(pg, 5)
        m3 = mode(pg)
        pg.evaluate("window.__game.togglePause()"); tick(pg, 5)
        m4 = mode(pg)
        pg.evaluate("() => { window.__game.game.player.lives = 0; }"); tick(pg, 20)
        m5 = mode(pg)
        pg.evaluate("() => window.__game.game.toShipSelect()"); tick(pg, 10)
        m6 = mode(pg)
        chain = [m0, m1, m2, m3, m4, m5, m6]
        want = ["menu", "shipselect", "play", "pause", "play", "gameover", "shipselect"]
        check("ui_flow", chain == want, f"{' -> '.join(chain)}  (beklenen {' -> '.join(want)})")

        # ------------------------------------------------------- ui_no_deadend
        # Her ekrandan oyuna donulebilmeli; bir ekran cikissizsa oyun orada kilitlenir.
        stuck = []
        for st, enter in (("menu", "window.__game.toMenu()"),
                          ("gameover", None),
                          ("pause", None)):
            pg.evaluate("window.__game.toMenu()"); tick(pg, 10)
            if st == "gameover":
                pg.evaluate("window.__game.startGame()"); tick(pg, 20)
                pg.evaluate("() => { window.__game.game.player.lives = 0; }"); tick(pg, 20)
            elif st == "pause":
                pg.evaluate("window.__game.startGame()"); tick(pg, 20)
                pg.evaluate("window.__game.togglePause()"); tick(pg, 5)
            pg.evaluate("() => window.__game.game.toShipSelect()"); tick(pg, 10)
            pg.evaluate("() => window.__game.game.confirmShipSelect()"); tick(pg, 10)
            if mode(pg) != "play":
                stuck.append(f"{st}->{mode(pg)}")
        check("ui_no_deadend", not stuck, f"cikissiz ekran={stuck or 'yok'}")

        check("ui_no_pageerror", not errs,
              f"pageerror={len(errs)}" + (f" ilk={errs[0][:70]}" if errs else ""))
        b.close()

    ok = sum(1 for _, o, _ in results if o)
    print()
    print(f"UI: {ok} PASS, {len(results) - ok} FAIL / {len(results)}")
    return 0 if ok == len(results) else 1


if __name__ == "__main__":
    sys.exit(main())
