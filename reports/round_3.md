# Round 3 — degerlendirme

Olcum: `tools/evaluate.py`, 2026-09-08 17:47

**10 PASS / 1 FAIL / 11**

## Assertion'lar

- [PASS] `assets_used` — png=32 proc=0 manifest=32 fetch_err=0
- [PASS] `no_console_errors` — pageerrors=0
- [PASS] `determinism_2fps` — max_pos_diff=0.000000px over 240 frames, first_diff@frame-1
- [PASS] `bounds` — out_of_bounds_frames=0
- [PASS] `parallax_lean` — right_off=-28.5548 left_off=3.4659 max_diff_2fps=0.00e+00 (reversed=True)
- [PASS] `building_budget` — max_buildings_on_screen=4
- [PASS] `fire_count` — shots=38 min~36 (5sn surekli ates)
- [PASS] `pool_no_exhaust` — exhausted=0 active=5
- [PASS] `perf_heavy` — frames=310 median=0.30ms over50=0
- [PASS] `foreground_contrast` — dron_belirgin=True mermiler_gorunur=True not='Dron ve mermiler, arka plandaki şehir manzarasına rağmen belirgin bir şekilde görünmektedir.'
- [FAIL] `vision_polish` — scores=[8, 7, 7, 9, 9] min=7 blocking=1
      shot_1.png: 
      shot_2.png: dron ve mermiler belirgin, arka planla çakışma doğal görünüyor; genel cila iyi ancak mermilerin parlaklığı hafif aşırı
      shot_4.png: dron tamamen gorunmuyor

## Kalanlar

- **vision_polish**: scores=[8, 7, 7, 9, 9] min=7 blocking=1
      shot_1.png: 
      shot_2.png: dron ve mermiler belirgin, arka planla çakışma doğal görünüyor; genel cila iyi ancak mermilerin parlaklığı hafif aşırı
      shot_4.png: dron tamamen gorunmuyor
