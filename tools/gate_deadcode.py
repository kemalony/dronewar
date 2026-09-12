#!/usr/bin/env python3
"""Yazilmis ama hic calismayan ozellikler artik calisiyor mu?

Denetim (Round 21) su bes seyi buldu: sinif/metot tam yazilmis, CAGIRAN YOK ya da
cagrilsa NaN uretiyor. Hicbiri mevcut kapilarla gorunmuyordu.

Bu betik onlari state() uzerinden olcer. state() sozlesmesi (paket ajanlari buna
uyacak):

  state().fx.wrecks        -> aktif enkaz sayisi (int)
  state().fx.wreckFinite   -> tum enkaz x/y/ang degerleri sonlu mu (bool)
  state().glitch.level     -> ambient glitch yogunlugu 0..1 (float)
  state().glitch.damageT   -> hasar glitch'i kalan sure, sn (float)
  state().sound.hover      -> surekli motor sesi acik mi (bool)
  state().jammer.killed    -> vurularak dusurulen jammer sayisi (int)

  PW_CHANNEL=chrome .venv-mac/bin/python tools/gate_deadcode.py
"""
import os
import pathlib
import sys

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
INDEX = ROOT / "index.html"
STEP = 1000.0 / 120.0

results = []


def guard(fn, name):
    """Bir olcum coker ya da kanca yoksa kapi CRASH degil KIRMIZI vermeli."""
    try:
        fn()
    except Exception as e:
        check(name, False, f"olcum hatasi: {type(e).__name__}: {e}"[:110])


def check(name, ok, detail):
    results.append((name, bool(ok), detail))
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}  ({detail})")


def get(pg, path, default=None):
    return pg.evaluate(
        "(p) => { let v = window.__game.state();"
        " for (const k of p.split('.')) { if (v == null) return null; v = v[k]; }"
        " return v === undefined ? null : v; }",
        path,
    )


def tick(pg, n):
    for _ in range(n):
        pg.evaluate(f"window.__game.tick({STEP})")


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
        pg.evaluate("window.__game.startGame()")
        tick(pg, 30)

        def _falling_wreck():
            # ---------------------------------------------------------- falling_wreck
            # Dusman olunce enkaz dogmali, sonlu koordinatlarda olmali ve DUSMELI.
            pg.evaluate("() => window.__game.spawnEnemy('scout', 240, 200)")
            tick(pg, 10)
            pg.evaluate("() => window.__game.killNearestEnemy && window.__game.killNearestEnemy()")
            tick(pg, 6)
            n0 = get(pg, "fx.wrecks")
            finite = get(pg, "fx.wreckFinite")
            y0 = get(pg, "fx.wreckSample.y")
            tick(pg, 30)
            y1 = get(pg, "fx.wreckSample.y")
            fell = (y0 is not None and y1 is not None and y1 > y0)
            check("falling_wreck", (n0 or 0) > 0 and finite is True and fell,
                  f"enkaz={n0} sonlu={finite} dustu={fell} (y {y0} -> {y1})")

        guard(_falling_wreck, "falling_wreck")


        def _damage_glitch():
            # ----------------------------------------------------------- damage_glitch
            before = get(pg, "glitch.damageT") or 0
            pg.evaluate("() => window.__game.damagePlayer && window.__game.damagePlayer()")
            tick(pg, 2)
            after = get(pg, "glitch.damageT") or 0
            check("damage_glitch", after > before,
                  f"hasar oncesi damageT={before} sonrasi={after}")

        guard(_damage_glitch, "damage_glitch")


        def _ambient_glitch():
            # ---------------------------------------------------------- ambient_glitch
            pg.evaluate("() => window.__game.spawnJammer && window.__game.spawnJammer(240, 300)")
            tick(pg, 120)
            lvl = get(pg, "glitch.level") or 0
            inr = get(pg, "jammer.inRange")
            # Menzile giremezsek bu GECMEZ, DUSER: olculemeyen kapi dekordur.
            # Ilk yazimda "menzilde degilse True" yazmistim ve bos yere yesil yandi.
            check("ambient_glitch", inr is True and lvl > 0,
                  f"jammer menzilde={inr} glitch.level={lvl} "
                  f"(menzile girilemezse olcum yapilamadi demektir)")

        guard(_ambient_glitch, "ambient_glitch")


        def _jammer_killable():
            # ----------------------------------------------------------- jammer_killable
            k0 = get(pg, "jammer.killed") or 0
            for _ in range(40):
                pg.evaluate("() => window.__game.killNearestJammer && window.__game.killNearestJammer()")
                tick(pg, 4)
                if (get(pg, "jammer.killed") or 0) > k0:
                    break
            k1 = get(pg, "jammer.killed") or 0
            check("jammer_killable", k1 > k0, f"dusurulen jammer {k0} -> {k1}")

        guard(_jammer_killable, "jammer_killable")


        def _hover_sound():
            # -------------------------------------------------------------- hover_sound
            hv = get(pg, "sound.hover")
            check("hover_sound", hv is True,
                  f"sound.hover={hv} (autotest'te AudioContext suspended; bayrak yine de acilmali)")

        guard(_hover_sound, "hover_sound")

        check("no_pageerror", not errs, f"pageerror={len(errs)}"
              + (f" ilk={errs[0][:70]}" if errs else ""))
        b.close()

    ok = sum(1 for _, o, _ in results if o)
    print()
    print(f"DEADCODE: {ok} PASS, {len(results) - ok} FAIL / {len(results)}")
    return 0 if ok == len(results) else 1


if __name__ == "__main__":
    sys.exit(main())
