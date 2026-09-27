# Round 26 — degerlendirme

Olcum: `tools/evaluate.py`, 2026-09-27 14:08

**69 PASS / 0 FAIL / 69**

## Assertion'lar

- [PASS] `assets_used` — png=71 proc=0 manifest=71 fetch_err=0
- [PASS] `no_console_errors` — pageerrors=0
- [PASS] `determinism_2fps` — max_pos_diff=0.000000px over 240 frames, first_diff@frame-1
- [PASS] `bounds` — out_of_bounds_frames=0
- [PASS] `parallax_lean` — right_off=-28.5548 left_off=3.4659 max_diff_2fps=0.00e+00 (reversed=True)
- [PASS] `building_budget` — max_buildings_on_screen=4
- [PASS] `fire_count` — shots=38 min~36 (5sn surekli ates)
- [PASS] `pool_no_exhaust` — exhausted=0 active=5
- [PASS] `tracer_shape` — tracer_len=22px ratio=2.8% (<=5%, <=22px)
- [PASS] `perf_heavy` — frames=307 median=0.20ms over50=0
- [PASS] `foreground_contrast` — en_zayif_mermi_kontrasti=221 ortalama=233 (>=60) mermi_sayisi=9
- [PASS] `player_contrast` — dron_kontrasti=214 (tepe=255 medyan=41, >=40)
- [PASS] `touch_playable` — basladi=play ates_acildi=True birakinca_durdu=True hareket=(-100,-140) beklenen=(-100,-140)
- [PASS] `jammer_drone` — aktif=True menzilde=True
- [PASS] `carrier_stages` — parca=['pylonL', 'pylonR', 'bay', 'antenna'] govde_kilitli=True
- [PASS] `dash_and_heat` — dash_acildi=True cooldown=2483ms sonra_kapandi=True isi 0->21.53333333333333
- [PASS] `heat_cooldown` — isi 21.53333333333333 -> 0 (dusmeli)
- [PASS] `sub_drones` — sub sayisi=1 mod=gun
- [PASS] `enemy_types` — scout: hp=1/1 puan=100/100  gunner: hp=3/3 puan=250/250  shield: hp=3/3 puan=400/400 kalkan=3
- [PASS] `enemy_determinism` — dusman=4/4 oyuncu_A=(240, 624) oyuncu_B=(240, 624) birebir ayni
- [PASS] `shield_absorb` — kalkan_emme=OK (v1:sh=2 v2:sh=1 v3:sh=0 v4:hp=2 v5:hp=1 v6:dead) 6_vurus_olumu=EVET
- [PASS] `stage_progress` — s1:istanbul(q=15) s2:paris(q=20) s3:newyork(q=25) s4:tokyo(q=30) s5:port(q=35)
- [PASS] `stage_determinism` — A=(240, 624) B=(240, 624) dusman=2/2 sehir=paris/paris birebir ayni
- [PASS] `landmark_once` — yarida=True fazlasi=True yeni_bolum=False
- [PASS] `boss_spawn` — s1:stage=0 warn=True hp=60/60 spawn_durdu=True s2:stage=1 warn=True hp=90/90 spawn_durdu=True s3:stage=2 warn=True hp=120/120 spawn_durdu=True s4:stage=3 warn=True hp=160/160 spawn_durdu=True s5:stage=4 warn=True hp=0/200 parca=4 spawn_durdu=True
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
- [PASS] `boss_variants_sprite` — s1:boss_gunship/boss_gunship hp=60/60 OK s2:boss_paris/boss_paris hp=90/90 OK s3:boss_newyork/boss_newyork hp=120/120 OK s4:boss_tokyo/boss_tokyo hp=160/160 OK s5:tasiyici parca=4 govde_savunmasiz=False OK
- [PASS] `tile_alternation` — karo_B_yuklendi=True dist=1295px (>800 = A+B bolgeleri gecildi)
- [PASS] `enemy_types_v2` — bomber: hp=5/5 puan=350/350  kamikaze: hp=1/1 puan=150/150  sniper: hp=2/2 puan=300/300
- [PASS] `kamikaze_lock` — kilitlendi=True ilk_mesafe=660 son_mesafe=1 (azalmali, n=120)
- [PASS] `sniper_telegraph` — telegraf_gorundu=True nisan_x=240 (state() icinde)
- [PASS] `rocket_homing` — min_mesafe=2 (<200=yaklasti) hasar_ok=True (hp 5 -> dead)
- [PASS] `weapon_reset_on_damage` — seviye 3->1 (beklenen 3->1) roket 10.0s->0.0s yanip_sonek=True
- [PASS] `drone_select` — secim_modu=shipselect swift_kilitli=True kilitli_secimde_mod=shipselect (shipselect kalmali) acik_secimde_mod=play can=3/3
- [PASS] `touch_drone_select` — baslangic_idx=0 sag=1(mod=shipselect) sol=0(mod=shipselect) orta_baslat=play
- [PASS] `ground_only_on_port` — sehir_bolumunde=0 zorla_dogurma=False (False olmali) liman=True limanda_hedef=2
- [PASS] `ground_locked_to_scroll` — ornek=90 en_buyuk_sapma=0.000000px (0 olmali)
- [PASS] `ground_contact_shadow` — tip=aa sprite_sag=272 alt=420 degisen_kutu=(208, 348, 278, 433) golge_tasmasi=(+6,+13) (>=3 olmali)
- [PASS] `ground_damage_score` — hp 6->1 oldu=True skor+=1500 kota_degismedi=True
- [PASS] `ground_aa_and_jammer` — aa_mermisi=3 (>0) kara_jammer_menzilde=True
- [PASS] `ground_determinism` — A=4 B=4 birebir ayni
- [PASS] `game_split` — game dosyalari=4 (>=4) Game.js=850 satir (<=1200)
- [PASS] `skimmer_enemy` — sehirde_dogdu=False (False olmali) limanda=True yatay_yol=445px tek_yon=True
- [PASS] `scorch_locked_to_scroll` — ornek=45 en_buyuk_sapma=0.000000px (0 olmali)
- [PASS] `flak_burst` — kivilcim 0 -> tepe 7 (AA mermisi havada patlamali)
- [PASS] `combo_multiplier` — carpanlar=[2, 3, 4, 5] skor_kombosuz=100 kombolu=500 sure_sonu=(count=0 mult=1)
- [PASS] `combo_reset_on_damage` — hasardan once x5 (count=16) sonra x1 (count=0)
- [PASS] `repair_pickup` — can 1->2 (2 olmali) doluyken_puan=+250 can_asilmadi=3/3
- [PASS] `score_pop` — baloncuk 0->1 yukseliyor=True (y 199.03703703703704->180.25925925925927) sonra=0
- [PASS] `music_intensity` — menu={'playing': True, 'intensity': 0, 'layers': 0} oyun={'playing': True, 'intensity': 0.55, 'layers': 3} boss={'playing': True, 'intensity': 1, 'layers': 4} sessiz={'playing': False, 'intensity': 1, 'layers': 0}
- [PASS] `difficulty_curve` — bolum_yuku=[238, 252, 293, 675, 894] (monoton~artan=True son>ilk=True)
- [PASS] `run_stats` — atis=30 isabet=6 isabet_orani=0.20 oldurme=6 sure=4000ms en_iyi_kombo=16/16 (baslangic=0 atis)
- [PASS] `stats_reset_per_run` — kosu1 atis=15 sure=2000ms -> kosu2 atis=0 oldurme=0 sure=17ms
- [PASS] `persist_best` — rekor yeniden yuklemeden sonra=12345 (>=12345) mod_oyun_sonu=gameover
- [PASS] `tips_shown` — gorulen_ipucu=3 ilk='PARMAĞINI SÜRÜKLE — DRON TAK' sim_ilerledi=True
- [PASS] `vision_polish` — scores=[8, 9, 9, 9, 8] medyan=9.0 min=8.0 blocking=0
