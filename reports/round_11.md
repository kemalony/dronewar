# Round 11 — degerlendirme

Olcum: `tools/evaluate.py`, 2026-09-11 00:16

**36 PASS / 0 FAIL / 36**

## Assertion'lar

- [PASS] `assets_used` — png=52 proc=0 manifest=60 fetch_err=0
- [PASS] `no_console_errors` — pageerrors=0
- [PASS] `determinism_2fps` — max_pos_diff=0.000000px over 240 frames, first_diff@frame-1
- [PASS] `bounds` — out_of_bounds_frames=0
- [PASS] `parallax_lean` — right_off=-28.5548 left_off=3.4659 max_diff_2fps=0.00e+00 (reversed=True)
- [PASS] `building_budget` — max_buildings_on_screen=4
- [PASS] `fire_count` — shots=38 min~36 (5sn surekli ates)
- [PASS] `pool_no_exhaust` — exhausted=0 active=5
- [PASS] `tracer_shape` — tracer_len=22px ratio=2.8% (<=5%, <=22px)
- [PASS] `perf_heavy` — frames=306 median=0.30ms over50=0
- [PASS] `foreground_contrast` — en_zayif_mermi_kontrasti=140 ortalama=169 (>=60) mermi_sayisi=5
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
- [PASS] `rotor_spin` — aci_farkli=True (ang0=0.000 ang1=5.434) deterministik_sure=True (tA=2000.0 tB=2000.0)
- [PASS] `weapon_levels` — lv1:shots=1/>= 1 OK lv2:shots=2/>= 2 OK lv3:shots=3/>= 3 OK
- [PASS] `powerup_pickup` — baslangic=1 +pu=2 +pu=3 hasar=2 (beklenen 1→2→3→2)
- [PASS] `clouds_deterministic` — A=2 B=2 bulut birebir ayni
- [PASS] `explosion_layers` — flash=True fire=True smoke=True (uc katman da cizilmeli)
- [PASS] `cloud_parallax` — cloud_off=-56.00 city_off=-30.40 (ters_yon=True, guclu=True)
- [PASS] `cloud_variety` — farkli_sprite=5/12 arka_arka_tekrar=False liste=['cloud_b', 'cloud_e', 'cloud_a', 'cloud_d', 'cloud_f']
- [PASS] `boss_variants_sprite` — s1:boss_gunship/boss_gunship hp=60/60 OK s2:boss_paris/boss_paris hp=90/90 OK s3:boss_newyork/boss_newyork hp=120/120 OK s4:boss_tokyo/boss_tokyo hp=160/160 OK
- [PASS] `tile_alternation` — karo_B_yuklendi=True dist=1295px (>800 = A+B bolgeleri gecildi)
- [PASS] `vision_polish` — scores=[8, 7, 8, 8, 7] medyan=8.0 min=7.0 blocking=0
      shot_1.png: [danisma, olculen kapi soz sahibi] dron arka planla karisıyor ancak bu doğal; mermiler yukarı doğru net çizgilerle görülüyor, ancak hedef işaretinde hafif bulanıklık var
      shot_4.png: [danisma, olculen kapi soz sahibi] dronun mermi atarken yanındaki patlama efekti ile görsel olarak çakışması, küçük bir bloklama yaratıyor
