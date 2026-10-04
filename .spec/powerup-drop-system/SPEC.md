# SPEC — Powerup & Drop System

> Sözleşme türü: **retro-spec (as-built, tur 27)**. Bu belge davranışı BELGELER,
> DEĞİŞTİRMEZ. Sayısal değerler tek kaynaktan türetilmiştir: `src/core/CONFIG.js`,
> `src/units/units.config.js`, `src/game/game.config.js`. Bu dosyaya koddan
> doğrulanmamış sayı yazmak yasaktır (Drift Gate: VO-4).
> Üretilen sözleşme: `design/gdd/powerup-drop-system.md` (türev; bu belgeye tabidir).

## Objectives (ölçülebilir uç durumlar)
- OBJ-1 Her düşman ölümünde **tek** LCG çekişi (`_puLcg`) ile dağılım:
  weapon p=0.12 | rocket p=0.08 | shield p=0.06 | subdrone p=0.06 | repair p=0.05 | düşmeme p=0.63.
  Toplam düşme olasılığı **0.37**.
- OBJ-2 Pickup geometrisi: 70 px/s süzülme, oyuncu merkezine **30 px** yarıçapta
  toplanma, `y > H+30`'da imha.
- OBJ-3 Hasar cezası: silah seviyesi doğrudan 1'e iner (min 1), roket süresi 0'lanır,
  HUD'da `resetFlashMs=1200` yanıp sönme; kombo sıfırlanır (COMBO sözleşmesine tabi).
- OBJ-4 Toplama etkileri birebir:
  | Tip | Etki | Doluluk / sınır davranışı |
  |---|---|---|
  | weapon | level < 3 → +1 | level = 3 → `+500` puan |
  | shield | `shieldT = 6.0 s` | yeniden toplama süreç yeniler |
  | rocket | `rocketT = 15.0 s`, ateş sayacı 0 | yeniden toplama süreç yeniler |
  | subdrone | `player.addSub()` (havuz max 2) | dolu → `+100` puan |
  | repair | lives < 3 → `+1 can` (clamp 3) | lives ≥ 3 → `+250` puan; `repairFlashT=0.6 s` |

## Non-Goals / Exclusions
- Drop ŞANSlarında (0.12/0.08/0.06/0.06/0.05) değişiklik — herhangi bir tuning bu
  spec'e değil ayrı bir tasarım kararına aittir; burada değişiklik = drift.
- Yeni powerup tipi, mıknatıs/toplama alanı, fiziksel sekmeler, powerup envanteri.
- Sim/determinizm dokunuşları, Android `:rules` port yeniden üretimi (yalnız
  davranış değişirse zorunlu senkron koşulu — INV-1).
- Görsel sanat değişimi (yalnız çizim katmanı; INV-7).

## Invariants & Constraints
- **INV-1 Determinizm:** `Math.random()` yasak. Drop zinciri her ölümde **bir**
  `_puLcg` çekişi kullanır (LCG: `imul(seed,1664525)+1013904223 >>> 0`). Zincirin
  şekil/sıra değişimi LCG akışını kaydırır ⇒ `tools/android/resync_golden.sh` zorunlu.
- **INV-2 Kümülatif eşik sırası:** `r<.12 w → r<.20 rocket → r<.26 shield → r<.32
  subdrone → r<.37 repair`. Sıra koddaki dal sırasıdır; yeniden dizme yasak.
- **INV-3 Config sahipliği:** `CONFIG.SUBDRONE` iki paketten `Object.assign` ile
  beslenir (units = gövde, game = `dropChance`). `CONFIG.SUBDRONE = {...}` yazmak
  (bütün-nesne atama) kardeş anahtarları siler — geçmişte pu_subdrone sessizce
  kırıldı. Ezme tespiti: `node tools/dump_config.js` (destroyed=[] şart).
- **INV-4 Repair tavanı sabittir (3):** `player.lives < 3` ise +1 (clamp 3), değilse
  +250 puan. **Tank (5 can) bu tavana tabidir** — 3'ün üstü hiçbir yolla onarılamaz.
  As-built sınırdır; düzeltme ayrı karar ister (OQ-1).
- **INV-5 Sub-dron tek kaynak:** `player.subs` havuzu (max 2, `Player._subSide` ±1
  taraf ayrımı). Ayrı sayaç tutmak yasak (koprü hatası: havuz-doluluk ayrışması).
- **INV-6 Silah seviyesi:** `levels[3]` = (1×130ms, ±0) / (2×115ms, ±14) / (3×100ms,
  ±26). Paralel mermi (vx=0). Tank `startWeapon: 2` ile başlar.
- **INV-7 Çizim/sim ayrımı:** kapsül parlaması (`simTimeMs` sinüsü), repair flashı,
  silah-sıfırlama flashı yalnız çizimdir; sim durumuna yazamaz.

## Verification Oracles (deterministik test koşulları)
- **VO-1 `powerup_pickup`** (evaluate.py): weapon 1→2→3, hasarla 2 — kapı mevcut, çalışır.
- **VO-2 `repair_pickup`** (evaluate.py): 1→2; doluyken +250; 3'ü aşmama.
- **VO-3 `weapon_reset_on_damage`** (evaluate.py): 3→1, roket 10.0s→0.0s, reset flash.
- **VO-4 Belge↔kod drift gate:** bu spec + GDD içindeki her sayısal değer
  CONFIG'teki karşılığıyla eşleşmelidir (doğrulama betiği, Level 4'te koşulur).
  Eşleşmeyen = DUR; spec'i koda uydurmak yasak.
- **VO-5 LCG altın izi:** aynı 720 adımda drop sırası birebir aynı; davranış
  değişikliğinden sonra `record_trace.py --steps 720` + parity kapıları yeşil.
- **VO-6 `dump_config` destroyed=[]** — INV-3'ün kanıtı.

## Kod kökenli sabit tablosu (tek kaynak: CONFIG)
| Anahtar | Değer | Kaynak |
|---|---|---|
| WEAPON.levels | [(1,.130s,±0),(2,.115s,±14),(3,.100s,±26)] | core/CONFIG.js |
| WEAPON.maxLevel / overMaxScore | 3 / 500 | core/CONFIG.js |
| WEAPON.dropChance / fallSpeed | 0.12 / 70 px/s | core/CONFIG.js |
| WEAPON.shieldMs / resetFlashMs | 6000 / 1200 | core/CONFIG.js |
| ROCKET.dropChance | 0.08 | core/CONFIG.js |
| ROCKET.speed / turnRate / damage | 520 px/s / 180°/s / 3 | core/CONFIG.js |
| ROCKET.fireMs / durationMs / pool | 900 / 15000 / 8 | core/CONFIG.js |
| SHIELD.dropChance | 0.06 | game/game.config.js |
| SUBDRONE.dropChance / max | 0.06 / 2 | game+units.config.js |
| REPAIR.dropChance / heal | 0.05 / 1 | core/CONFIG.js |
| REPAIR.maxLives / score | 3 / 250 | core/CONFIG.js |
| pickup yarıçap / off-screen | 30 px / y > H+30 | Game.spawn.js |