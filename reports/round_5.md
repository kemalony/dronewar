# Round 5 — degerlendirme

Olcum: `tools/evaluate.py`, 2026-09-08 21:24

**13 PASS / 1 FAIL / 14**

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
- [PASS] `perf_heavy` — frames=311 median=0.40ms over50=0
- [PASS] `foreground_contrast` — en_zayif_mermi_kontrasti=145 ortalama=213 (>=60) mermi_sayisi=5
- [PASS] `enemy_types` — scout: hp=1/1 puan=100/100  gunner: hp=3/3 puan=250/250  shield: hp=3/3 puan=400/400 kalkan=3
- [PASS] `enemy_determinism` — dusman=4/4 oyuncu_A=(240, 624) oyuncu_B=(240, 624) birebir ayni
- [FAIL] `vision_polish` — scores=[8, 9, 8, 3, 9] min=3 blocking=5
      shot_0.png: dronun etrafındaki halka ve merminin parıltısı görsel olarak dikkat çekiyor; ancak bazı mermiler ve arka planın karışıklığı nedeniyle netlik azalmış.
      shot_1.png: mermi izleri cok silik ve uzak mesafede gorunmezlik yaratiyor
      shot_2.png: dronun altinda yer alan halka ve isik efekti, arka planla karsitlik yaratarak dikkat cekiyor; ancak mermilerin yukariya dogru atildigi yolda gozle gorulebilir hareket izi veya parcalaşma etkisi eksik
      shot_3.png: mermiler yukari dogru belirgin olmayan mavi çizgilerle gösterilmiş, dron ise alt kısımda parlak halka ile vurgulanmış ancak arka planla çakışması görsel karmaşa yaratmıyor; sadece mermilerin görünürliği düşük

## Kalanlar

- **vision_polish**: scores=[8, 9, 8, 3, 9] min=3 blocking=5
      shot_0.png: dronun etrafındaki halka ve merminin parıltısı görsel olarak dikkat çekiyor; ancak bazı mermiler ve arka planın karışıklığı nedeniyle netlik azalmış.
      shot_1.png: mermi izleri cok silik ve uzak mesafede gorunmezlik yaratiyor
      shot_2.png: dronun altinda yer alan halka ve isik efekti, arka planla karsitlik yaratarak dikkat cekiyor; ancak mermilerin yukariya dogru atildigi yolda gozle gorulebilir hareket izi veya parcalaşma etkisi eksik
      shot_3.png: mermiler yukari dogru belirgin olmayan mavi çizgilerle gösterilmiş, dron ise alt kısımda parlak halka ile vurgulanmış ancak arka planla çakışması görsel karmaşa yaratmıyor; sadece mermilerin görünürliği düşük
