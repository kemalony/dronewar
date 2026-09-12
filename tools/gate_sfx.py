#!/usr/bin/env python3
"""Ornek sesler gercekten calisiyor mu? (prosedurel yedege dusmeden)

Sozlesme (Sound bunlari saglayacak):
  sound.bankSize()      -> cozulmus ornek sayisi (int)
  sound.bankFailed()    -> cozulemeyen ornek sayisi (int)
  sound.lastSource()    -> son calinan ses icin 'sample' | 'proc'
  sound.lastVariant()   -> son calinan ornegin adi (varyasyonu olcmek icin)

  PW_CHANNEL=chrome .venv-mac/bin/python tools/gate_sfx.py
"""
import os, pathlib, sys
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
INDEX = ROOT / "index.html"
EXPECT = 18
MAX_INDEX_KB = 520   # banka gomulu: 275K -> ~462K; pay birakildi

res = []
def check(n, ok, d):
    res.append((n, bool(ok), d)); print(f"  [{'PASS' if ok else 'FAIL'}] {n}  ({d})")

def main():
    kb = INDEX.stat().st_size / 1024
    check("sfx_budget", kb <= MAX_INDEX_KB, f"index.html {kb:.0f}K (<={MAX_INDEX_KB}K)")

    ch = os.environ.get("PW_CHANNEL", "")
    with sync_playwright() as p:
        b = (p.chromium.launch(channel=ch, args=["--autoplay-policy=no-user-gesture-required"])
             if ch else p.chromium.launch(args=["--autoplay-policy=no-user-gesture-required"]))
        pg = b.new_page(viewport={"width": 480, "height": 800})
        errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto(f"file://{INDEX}?autotest=1")
        pg.wait_for_function("window.__game !== undefined", timeout=20000)
        pg.wait_for_timeout(2500)

        # autotest'te ctx askida: hicbir cagri PATLAMAMALI
        try:
            pg.evaluate("() => { const s=window.__game.game.sound;"
                        " s.playerShot(); s.hit(); s.enemyDeath(); s.hover(0.5); s.stopHover(); }")
            check("sfx_no_throw_suspended", True, "ctx askidayken cagrilar sessizce gecti")
        except Exception as e:
            check("sfx_no_throw_suspended", False, f"{type(e).__name__}: {str(e)[:70]}")

        pg.mouse.click(240, 400); pg.wait_for_timeout(1200)
        st = pg.evaluate("() => { const s=window.__game.game.sound;"
                         " if (!s.ctx) s.unlock(); return s.ctx ? s.ctx.state : 'null'; }")
        pg.wait_for_timeout(1500)

        d = pg.evaluate("""() => { const s = window.__game.game.sound; return {
            size: typeof s.bankSize === 'function' ? s.bankSize() : null,
            failed: typeof s.bankFailed === 'function' ? s.bankFailed() : null }; }""")
        check("sfx_decoded", d["size"] == EXPECT and d["failed"] == 0,
              f"cozulen={d['size']}/{EXPECT} basarisiz={d['failed']} ctx={st}")

        out = pg.evaluate("""async () => {
            const s = window.__game.game.sound, ctx = s.ctx;
            const an = ctx.createAnalyser(); an.fftSize = 2048;
            s.master.connect(an);
            const kinds = [], variants = [];
            let peak = 0;
            for (let i = 0; i < 8; i++) {
              s.playerShot();
              if (typeof s.lastSource === 'function') kinds.push(s.lastSource());
              if (typeof s.lastVariant === 'function') variants.push(s.lastVariant());
              await new Promise(r => setTimeout(r, 60));
              const buf = new Float32Array(an.fftSize); an.getFloatTimeDomainData(buf);
              for (const v of buf) peak = Math.max(peak, Math.abs(v));
            }
            return { peak: +peak.toFixed(4), kinds, variants }; }""")
        check("sfx_plays", out["peak"] > 0.001, f"olculen tepe={out['peak']}")
        # Bos listede all() DOGRU doner: kanca yoksa bu kapi bosuna yesil yanardi.
        # Bugun ucuncu kez ayni tuzak; kaynak sayisi da sart kosuluyor.
        kinds = out["kinds"]
        check("sfx_is_sample", len(kinds) == 8 and all(k == "sample" for k in kinds),
              f"kaynak sayisi={len(kinds)}/8 kaynaklar={kinds}")
        check("sfx_variation", len(set(out["variants"])) >= 2,
              f"8 atista farkli varyant={len(set(out['variants']))} ({out['variants'][:4]}...)")
        check("sfx_no_pageerror", not errs,
              f"pageerror={len(errs)}" + (f" ilk={errs[0][:60]}" if errs else ""))
        b.close()

    ok = sum(1 for _, o, _ in res if o)
    print(f"\nSFX: {ok} PASS, {len(res)-ok} FAIL / {len(res)}")
    return 0 if ok == len(res) else 1

if __name__ == "__main__":
    sys.exit(main())
