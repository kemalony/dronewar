# Powerup & Drop System

> **Status**: Designed (autonomous SDD run — design-review bekliyor)
> **Author**: main agent + skill (design-system, autonomous override)
> **Last Updated**: 2026-09-29
> **Last Verified**: 2026-09-29 (Level-4 drift gate: 27/27)
> **Implements Pillar**: kontrol adaleti — her kayıp oyuncunun "benim hatamdı" diyebilmesi
> **Creative Director Review (CD-GDD-ALIGN)**: NOT ASSESSED [2026-09-29] — solo mode (uzman danışımları atlandı; taze oturumda /design-review önerilir)
> **Contract**: `.spec/powerup-drop-system/SPEC.md` (bu belge onun türevidir)

## Summary

Powerup & Drop System; düşman ölümlerinden düşen beş toplanabilir kapsül (silah, roket, kalkan, refakatçi dron, onarım) ve bunların hasar cezası karşısındaki kaybını yönetir. Oyuncuya şunu verir: riske girip öldürdükçe güçlenme umudu ve hasar almanın bedelini bilerek oynama gerilimi. Bu oyunda var çünkü affetmeyen hasar cezası (silah sıfırlama) yalnızca geri kazanma yolu bu sistemin üzerinden geçer.

> **Quick reference** — Layer: `Feature` (inferred from the brief — bu tier'da systems index okunmadı) · Priority: `Vertical Slice` (inferred from the brief — ...) · Key deps: `Enemy kill events, Player drone & weapons, Score` · Sözleşme: `.spec/powerup-drop-system/SPEC.md`

## Overview

Düşman her öldüğünde tek bir LCG çekişi yapılır; 0.37 olasılıkla beş kapsülden biri düşer, kalanı düşmez. Kapsüller 70 px/s süzülür, oyuncu 30 px yaklaştığında toplanır. Oyuncu bu sistemi aktif değil pasif deneyimler: kapsülü avlamak tek bilinçli karardır (riskli konuma dal). Sistem, hasarın ağır bedelini geri dönüşü mümkün kılan ekonomik denge katmanıdır. *(Açılış çerçevesi [C] Both; ADR referansı [B] yok — powerup'a ait ADR yok; oyuncu fantezisi [A] doğrudan. Uzman danışımları atlandı — Solo mode; `economy-designer` (primary), `systems-designer`/`game-designer` (destek) review öncesi elle gözden geçirilmeli.)*

## Detailed Design

### Core Rules

1. Her düşman ölümünde `_maybeDropPowerup(x, y)` **tek** `_puLcg()` çekişi yapar; kümülatif eşik zinciri (sıra değişmez): weapon → rocket → shield → subdrone → repair.
2. Toplama: oyuncu merkezine kuclid mesafe < 30 px; kapsül düşerken `y > H+30`'da imha olur.
3. Hasar alınınca: silah seviyesi doğrudan 1'e iner (min 1), roket süresi sıfırlanır, kombo sıfırlanır.
4. Powerup başına değişken tablosu (Formulas bu tier'da atlanır — sayılar inline; kaynak = CONFIG):

| Variable | Type | Range | Source | Description |
|---|---|---|---|---|
| dropChance.weapon | float | 0.12 | config (WEAPON) | r ∈ [0,.12) → silah kapsülü |
| dropChance.rocket | float | 0.08 | config (ROCKET) | r ∈ [.12,.20) |
| dropChance.shield | float | 0.06 | config (SHIELD) | r ∈ [.20,.26) |
| dropChance.subdrone | float | 0.06 | config (SUBDRONE) | r ∈ [.26,.32) |
| dropChance.repair | float | 0.05 | config (REPAIR) | r ∈ [.32,.37) |
| fallSpeed | float | 70 px/s | config (WEAPON) | süzülme |
| pickRadius | const | 30 px | Game.spawn.js | toplama yarıçapı |
| shieldMs | int | 6000 | config (WEAPON) | kalkan süresi |
| rocket duration/fire/speed/turn/dmg/pool | mix | 15000ms / 900ms / 520px/s / 180°/s / 3 / havuz 8 | config (ROCKET) | güdümlü ek ateş |
| weapon levels | table | (1,130ms,±0)(2,115ms,±14)(3,100ms,±26) — max lv 3 | config (WEAPON) | paralel mermi |
| overMaxScore / subdroneFull / repairFull | int | 500 / 100 / 250 | config (WEAPON/SUBDRONE/REPAIR) | doluluk taşma ödülleri |
| repair heal / maxLives | int | 1 / 3 | config (REPAIR) | onarım (tavan SABİT 3) |
| resetFlashMs | int | 1200 | config (WEAPON) | hasar sıfırlama flashı |

### States and Transitions

Kapsül: `spawn (y=-30) → falling → (picked | expired)`; sim'de ikinci hâl yok.
Oyuncu ekonomisi: `base → weaponLv1/2/3 (tek yön yukarı; hasar → 1)`, `rocketT ∈ {0, 15s}`, `shieldT ∈ {0, 6s}`, `subs ∈ [0..2]`, `lives` (3; tank 5).

### Interactions with Other Systems

- ↓ Enemy kill events → `_maybeDropPowerup(x,y)` (sahiplik: game; LCG akışı sözleşmeyle kilitli).
- ↔ Player: `addSub()` (havuz tek kaynak), `lives`, `weaponLevel` (game ile paylaşılan sayaç).
- ↑ Score: 500 / 100 / 250 taşma ödülleri; skor sistemi sahiplenir.
- ↑ HUD: SİLAH/KALKAN/ROKET satırları + hasar/reset flaşları (yalnız çizim).

*(İnceleme modu: `economy-designer` (primary), `systems-designer`, `game-designer` — Solo mode nedeniyle danışılmadı; production öncesi elle gözden geçirilmeli.)*

## Edge Cases

- **Eğer oyuncu weapon seviye 3'teyken kapsül alırsa**: +500 puan; seviye sabit.
- **Eğer sub-dron havuzu doluyken (2) kapsül alınırsa**: +100 puan; dron eklenmez.
- **Eğer can 3/3 iken repair alınırsa**: +250 puan; can değişmez; flaş yine çakar.
- **Eğer tank (5 can) lives ≥ 3 ile repair alırsa**: +250 puan — tank asla 3'ün üstüne onarılamaz (INV-4; bilinçli as-built sınır).
- **Eğer kalkan/roket sürerken aynı kapsül tekrar alınırsa**: süre baştan kurulur (yenileme, üst üste bindirme yok).
- **Eğer oyuncu hit-stop sırasında kapsülün üstünden geçerse**: toplama sim adımında normal işlenir; hit-stop yalnız çizim-sim zamanlamasını duraklatır, kayıp yok.
- **Eğer iki kapsül aynı anda yarıçapa girerse**: update turundaki sıra (dizi sırası) belirler; ikisi de toplanır.
- **Eğer kapsül ekranın altından çıkarsa**: `y > H+30`'da `active=false`, kayıp yok.
- **Eğer hasar ile aynı anda kapsül alınırsa**: hasar sıfırlama önce koşarsa level kazanç 1→2 olur; GWT VO-3 bu yarışın kabul edilmiş sonucudur (sıra: `_simStep` hasar → güncelleme turları).
- **Eğer LCG çekişi 0.37 üstü gelirse**: hiçbir şey düşmez (p=0.63) — bu normal, hata değil.

*(İnceleme modu: `systems-designer` — Solo mode nedeniyle danışılmadı.)*

## Dependencies

| Yön | Sistem | Arayüz (sahiplik) | Sert/Yumuşak |
|---|---|---|---|
| ↑ upstream | Enemy kill events | `game._maybeDropPowerup(x, y)` ölüm başına 1 çağrı | sert |
| ↑ upstream | Simulation Clock | sabit adım; LCG sim zamanına bağlı değil, çağrı sayısına bağlı | sert |
| ↔ lateral | Player drone & weapons | `weaponLevel`, `rocketT`, `shieldT`, `subs` (game yazar, units çizer) | sert |
| ↔ lateral | Score & Combo | `score +=` taşma ödülleri; hasar kombo sıfırlar (COMBO sözleşmesi) | yumuşak |
| ↓ downstream | HUD & Menü akışı | SİLAH/KALKAN/ROKET satırları, flaş sayaçları | yumuşak |
| ↓ downstream | Ses & FX | pickup sesleri/patlama — davranışa bağımlı değil | yumuşak |
| ↓ downstream | Android parity | LCG akışı altın izi kayar ⇒ resync zorunlu (INV-1) | sert (süreç) |

Ters yön tutarlılığı: bu GDD yazıldığında diğer sistemlerin GDD'leri yok — `/review-all-gdds` turunda karşılıkları güncellenmeli.

## Acceptance Criteria

- **GIVEN** temiz sim başlangıcı, **WHEN** sabit LCG tohumuyla 720 adımlık senaryo koşulur, **THEN** drop sırası altın izle birebir aynıdır (VO-5).
- **GIVEN** oyuncu silah seviye 3, **WHEN** weapon kapsülü toplanır, **THEN** skor +500 artar ve seviye 3'te kalır (rule 4, overMaxScore).
- **GIVEN** oyuncu can 1, **WHEN** repair kapsülü toplanır, **THEN** can 2 olur ve +250 yolu işlemez (VO-2, evaluate `repair_pickup`).
- **GIVEN** tank dron can 4, **WHEN** repair kapsülü toplanır, **THEN** can 4 kalır ve skor +250 artar (INV-4; OQ-1 ile izlenen bilinçli sınır).
- **GIVEN** oyuncu seviye 3 + roket 10.0s aktif, **WHEN** düşman temasıyla hasar alır, **THEN** seviye 1'e iner, roket 0.0s ve HUD reset flashı 1200ms çakar (VO-3, `weapon_reset_on_damage`).
- **GIVEN** sub-dron havuzu 2 dolu, **WHEN** subdrone kapsülü toplanır, **THEN** skor +100 artar, havuz 2'de kalır (INV-5).
- **GIVEN** kapsül ekranın altında, **WHEN** `y > H+30` olur, **THEN** kapsül imha olur ve toplanamaz (rule 2).
- **GIVEN** herhangi bir düşman ölümü, **WHEN** `_puLcg()` çekişi yapılırsa, **THEN** çağrı başına tek çekiştir; `Math.random` hiçbir yolda kullanılmaz (INV-1, VO-6 `dump_config` + kaynak taraması).
- **GIVEN** drop zinciri kodu değiştirilmiş, **WHEN** commit öncesi kapı koşulur, **THEN** web 69 kapı yeşil VE `resync_golden.sh` ile parity yeniden ölçülmüştür (VO-4/VO-5).

*(İnceleme modu: `qa-lead` — Solo mode nedeniyle danışılmadı; kriterler kendi kendine test edilebilirlik için elle gözden geçirilmeli. D Bölümü bu tier'da atlandığı için formül-başına-kriter yükü yok; tüm sayısal değerler Core Rules inline tablosunda ve oradan doğrulanır.)*

## Visual/Audio Requirements

- Kapsüller zıplayan ışık pulsu ile çizilir (`lighter`, sin dalga — yalnız çizim); kalkan mavisi, onarım yeşili, silah sarısı-kırmızı ayrımı okunur.
- Pickup'ta kısa parlama + karakterli pling sesi; doluluk-taşma ödülünde (500/100/250) daha tok ses. (Economy kategorisi bu bölümü zorunlu kılmıyor; ayrıntı gerektiğinde `art-director`/`audio-director`.)

## Game Feel

- Hasar sıfırlama flashı (1200ms) cezanın "görünür acı"sıdır; kapsül pulsu avlanabilirliği işaretler. (Bu kategori için opsiyonel.)

## UI Requirements

- HUD sol blok: SİLAH lv, KALKAN süre çubuğu (yalnız kalkanlıyken), ROKET süre; can + sub-dron ikonları. Doluluk ödülleri skor baloncuğunda görünür.

## Cross-References

| Referans | Değer/kural | Sahip |
|---|---|---|
| Combo & Scoring | hasarda kombo sıfırlama (eşik COMBO.windowMs 2600) | `core/CONFIG.js` COMBO (GDD yok — kod kaynak) |
| Player Drone & Weapons | `startWeapon: 2` (tank), `invincibleMs: 2000` (ghost) | `core/CONFIG.js` DRONES (GDD yok) |
| Boss & Ground kills | `_maybeDropPowerup` çağrılmaz (yalnız standart düşman ölümü) | `Game.collide.js` (GDD yok) |

> Not: başka GDD yok (ilk retro-GDD) — Cross-References şimdilik kod sahiplerine işaret eder.

## Open Questions

- **OQ-1 (owner: orchestrator; hedef: bir sonraki tuning turu)** — Repair tavanı neden `REPAIR.maxLives=3` sabit? Tank'ın 2 canı geri kazanılamıyor; kasıtlı zayıflık mı, hatırda kalıntı mı? *(Düzeltme istenirse INV-4 ve VO-2 güncellenmeli — drift gate izin vermez.)*
- **OQ-2 (owner: orchestrator)** — Toplam drop P=0.37 ve subdrone-taşma +100'ün weapon-taşma +500'e oranı kasıtlı mı? Measured-odak bir denge geçişi istenirse `economy-designer` taze oturumda.
- **OQ-3 (owner: orchestrator)** — Hasar-alma ile pickup aynı sim adımında çakışırsa sıra (hasar önce) OYUNUN tercihi mi, yoksa emergent mı? GWT kabul sonucu yazdı; bilinçli karara bağlanmalı.