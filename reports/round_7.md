# Round 7 — degerlendirme

Olcum: `tools/evaluate.py`, 2026-09-10 07:20

**18 PASS / 1 FAIL / 19**

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
- [PASS] `perf_heavy` — frames=309 median=0.20ms over50=0
- [PASS] `foreground_contrast` — en_zayif_mermi_kontrasti=196 ortalama=219 (>=60) mermi_sayisi=5
- [PASS] `touch_playable` — basladi=play ates_acildi=True birakinca_durdu=True hareket=(-100,-140) beklenen=(-100,-140)
- [PASS] `enemy_types` — scout: hp=1/1 puan=100/100  gunner: hp=3/3 puan=250/250  shield: hp=3/3 puan=400/400 kalkan=3
- [PASS] `enemy_determinism` — dusman=4/4 oyuncu_A=(240, 624) oyuncu_B=(240, 624) birebir ayni
- [PASS] `shield_absorb` — kalkan_emme=OK (v1:sh=2 v2:sh=1 v3:sh=0 v4:hp=2 v5:hp=1 v6:dead) 6_vurus_olumu=EVET
- [PASS] `stage_progress` — s1:istanbul(q=15,k=0) s2:paris(q=20,k=0) s3:newyork(q=25,k=0) s4:tokyo(q=30,k=0)
- [PASS] `stage_determinism` — A=(240, 624) B=(240, 624) dusman=2/2 sehir=paris/paris birebir ayni
- [PASS] `landmark_once` — yarida=True fazlasi=True yeni_bolum=False
- [FAIL] `vision_polish` — scores=[8, 8, 8, 8, 8] min=8 blocking=3
      shot_0.png: dronun mermi atış noktası ve UI elemanları (skor, kompas) arasında hafif görsel çakışma var, ancak dron ve mermiler genel olarak belirgin.
      shot_3.png: drone arka planla çakışmasa da mermilerin görsel belirginliği düşük ve hedef alma mekanizması görsel olarak net değil
      shot_4.png: drone'ün mermi fırlattığı bölgede görsel çakışma var

## Kalanlar

- **vision_polish**: scores=[8, 8, 8, 8, 8] min=8 blocking=3
      shot_0.png: dronun mermi atış noktası ve UI elemanları (skor, kompas) arasında hafif görsel çakışma var, ancak dron ve mermiler genel olarak belirgin.
      shot_3.png: drone arka planla çakışmasa da mermilerin görsel belirginliği düşük ve hedef alma mekanizması görsel olarak net değil
      shot_4.png: drone'ün mermi fırlattığı bölgede görsel çakışma var
