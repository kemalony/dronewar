# Round 6 — degerlendirme

Olcum: `tools/evaluate.py`, 2026-09-09 05:31

**15 PASS / 1 FAIL / 16**

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
- [PASS] `perf_heavy` — frames=308 median=0.30ms over50=0
- [PASS] `foreground_contrast` — en_zayif_mermi_kontrasti=140 ortalama=207 (>=60) mermi_sayisi=4
- [PASS] `touch_playable` — basladi=play ates_acildi=True birakinca_durdu=True hareket=(-100,-140) beklenen=(-100,-140)
- [PASS] `enemy_types` — scout: hp=1/1 puan=100/100  gunner: hp=3/3 puan=250/250  shield: hp=3/3 puan=400/400 kalkan=3
- [PASS] `enemy_determinism` — dusman=4/4 oyuncu_A=(240, 624) oyuncu_B=(240, 624) birebir ayni
- [PASS] `shield_absorb` — kalkan_emme=OK (v1:sh=2 v2:sh=1 v3:sh=0 v4:hp=2 v5:hp=1 v6:dead) 6_vurus_olumu=EVET
- [FAIL] `vision_polish` — scores=[9, 8, 9, 8, 9] min=8 blocking=3
      shot_0.png: drone mermileri ve arka planla çakışarak görsel olarak kayboluyor
      shot_1.png: drone merkezi halka ile belirgin, ama mermiler (dikey çizgiler) çok ince ve arka planla karışıyor, özellikle üst kısımda görünürlük düşük.
      shot_3.png: Merminin yukari dogru gidiş yönü ve dronun arka planla kesişimi oyun mekanigini bozmuyor ancak drone’un merkezde yer almasi ve merminin çok ince çizgi halinde olmasi, özellikle mobil ekranlarda izlenmeyi zorlastirabilir; bu, bloking sayisina eklemez ama polish skorunu hafif etkiler.

## Kalanlar

- **vision_polish**: scores=[9, 8, 9, 8, 9] min=8 blocking=3
      shot_0.png: drone mermileri ve arka planla çakışarak görsel olarak kayboluyor
      shot_1.png: drone merkezi halka ile belirgin, ama mermiler (dikey çizgiler) çok ince ve arka planla karışıyor, özellikle üst kısımda görünürlük düşük.
      shot_3.png: Merminin yukari dogru gidiş yönü ve dronun arka planla kesişimi oyun mekanigini bozmuyor ancak drone’un merkezde yer almasi ve merminin çok ince çizgi halinde olmasi, özellikle mobil ekranlarda izlenmeyi zorlastirabilir; bu, bloking sayisina eklemez ama polish skorunu hafif etkiler.
