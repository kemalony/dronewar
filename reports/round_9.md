# Round 9 — degerlendirme

Olcum: `tools/evaluate.py`, 2026-09-10 18:11

**26 PASS / 1 FAIL / 27**

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
- [PASS] `perf_heavy` — frames=312 median=0.30ms over50=0
- [PASS] `foreground_contrast` — en_zayif_mermi_kontrasti=146 ortalama=223 (>=60) mermi_sayisi=5
- [PASS] `touch_playable` — basladi=play ates_acildi=True birakinca_durdu=True hareket=(-100,-140) beklenen=(-100,-140)
- [PASS] `enemy_types` — scout: hp=1/1 puan=100/100  gunner: hp=3/3 puan=250/250  shield: hp=3/3 puan=400/400 kalkan=3
- [PASS] `enemy_determinism` — dusman=4/4 oyuncu_A=(240, 624) oyuncu_B=(240, 624) birebir ayni
- [PASS] `shield_absorb` — kalkan_emme=OK (v1:sh=2 v2:sh=1 v3:sh=0 v4:hp=2 v5:hp=1 v6:dead) 6_vurus_olumu=EVET
- [PASS] `stage_progress` — s1:istanbul(q=15) s2:paris(q=20) s3:newyork(q=25) s4:tokyo(q=30)
- [PASS] `stage_determinism` — A=(240, 624) B=(240, 624) dusman=2/2 sehir=paris/paris birebir ayni
- [PASS] `landmark_once` — yarida=True fazlasi=True yeni_bolum=False
- [PASS] `boss_spawn` — s1:stage=0 warn=True hp=60/60 spawn_durdu=True s2:stage=1 warn=True hp=90/90 spawn_durdu=True s3:stage=2 warn=True hp=120/120 spawn_durdu=True s4:stage=3 warn=True hp=160/160 spawn_durdu=True
- [PASS] `boss_phases` — aktif=True max_faz=3 min_can=22/60 (>=2 faz, can dustu)
- [PASS] `boss_determinism` — boss_A=(170.2664, 150) B=(170.2664, 150) mermi=6/6 birebir ayni
- [PASS] `victory` — son_mod=victory (beklenen=victory)
- [PASS] `audio_no_throw` — ses_cagrilarari=OK audio_hatalari=0
- [PASS] `shake_display_only` — max_sim_pos_diff=0.00e+00px over 60 frames (yalniz cizim)
- [PASS] `shake_triggered` — shakeT=0.2433s (beklenen >0)
- [PASS] `hud_states` — akis=menu->play->pause->play->gameover->menu beklenen=menu->play->pause->play->gameover->menu
- [FAIL] `vision_polish` — scores=[8, 8, 8, 7, 8] min=7 blocking=1
      shot_2.png: [danisma, olcum aksini soyluyor] mermiler çok ince ve arka planla karışarak görünmezlik riski taşıyor
      shot_3.png: mermiler (yukarı oklu ışık çizgileri) arka planla fazla bütünleşmiş, özellikle köprü ve su yüzeyi üzerinde okunaklılık düşük; drone net görünüyor, skor göstergesi ve hedefleme retikülleri yerinde.
      shot_4.png: [danisma, olcum aksini soyluyor] mermiler yukari dogru ucurken arka plandaki kule ve binalarla birleserek gorunmezlesiyor

## Kalanlar

- **vision_polish**: scores=[8, 8, 8, 7, 8] min=7 blocking=1
      shot_2.png: [danisma, olcum aksini soyluyor] mermiler çok ince ve arka planla karışarak görünmezlik riski taşıyor
      shot_3.png: mermiler (yukarı oklu ışık çizgileri) arka planla fazla bütünleşmiş, özellikle köprü ve su yüzeyi üzerinde okunaklılık düşük; drone net görünüyor, skor göstergesi ve hedefleme retikülleri yerinde.
      shot_4.png: [danisma, olcum aksini soyluyor] mermiler yukari dogru ucurken arka plandaki kule ve binalarla birleserek gorunmezlesiyor
