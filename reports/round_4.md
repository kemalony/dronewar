# Round 4 — degerlendirme

Olcum: `tools/evaluate.py`, 2026-09-08 19:35

**11 PASS / 1 FAIL / 12**

## Assertion'lar

- [PASS] `assets_used` — png=32 proc=0 manifest=32 fetch_err=0
- [PASS] `no_console_errors` — pageerrors=0
- [PASS] `determinism_2fps` — max_pos_diff=0.000000px over 240 frames, first_diff@frame-1
- [PASS] `bounds` — out_of_bounds_frames=0
- [PASS] `parallax_lean` — right_off=-28.5548 left_off=3.4659 max_diff_2fps=0.00e+00 (reversed=True)
- [PASS] `building_budget` — max_buildings_on_screen=4
- [PASS] `fire_count` — shots=38 min~36 (5sn surekli ates)
- [PASS] `pool_no_exhaust` — exhausted=0 active=5
- [PASS] `tracer_shape` — tracer_len=22px ratio=2.8% (<=5%, <=22px)
- [PASS] `perf_heavy` — frames=311 median=0.30ms over50=0
- [PASS] `foreground_contrast` — dron_belirgin=True mermiler_gorunur=True not='Dron ve mermiler arka plandaki şehir manzarasından net bir şekilde ayrılıyor.'
- [FAIL] `vision_polish` — scores=[8, 8, 8, 7, 8] min=7 blocking=5
      shot_1.png: mermi yolu ile arka planın bazı bölgelerinde kontrast düşüklüğü nedeniyle mermilerin bazı kısımlarında netlik kaybı var
      shot_2.png: Dronun alt kismi biraz arka planla karisiyor ve merminin yukarida parlayan efekti biraz silik; ancak genel olarak dron ve mermi belirgin, sahne dinamik.
      shot_3.png: mermilerin yeri ve yolu belirsiz, dronun hareketi ve nişan alanı görsel olarak net değil

## Kalanlar

- **vision_polish**: scores=[8, 8, 8, 7, 8] min=7 blocking=5
      shot_1.png: mermi yolu ile arka planın bazı bölgelerinde kontrast düşüklüğü nedeniyle mermilerin bazı kısımlarında netlik kaybı var
      shot_2.png: Dronun alt kismi biraz arka planla karisiyor ve merminin yukarida parlayan efekti biraz silik; ancak genel olarak dron ve mermi belirgin, sahne dinamik.
      shot_3.png: mermilerin yeri ve yolu belirsiz, dronun hareketi ve nişan alanı görsel olarak net değil
