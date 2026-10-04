# Systems Index: Drone War

> **Status**: Draft
> **Created**: 2026-09-29
> **Last Updated**: 2026-09-29
> **Source Concept**: design/game-brief.md (minimal tier — concept doc yerine brief)

---

## Overview

Drone War; sabit-adımlı deterministik bir sim çekirdeği, göreceli dokunmatik girdi ve çizim/sim ayrımı üzerine kurulu dikey kaydırmalı bir shmup. Çekirdek döngü: kaçış-yerleşim → otomatik ateş → skor/kombo → powerup → boss. Tüm sistemler kodda mevcut ve 27 tur kapıyla doğrulanmış durumda; bu indeks GDD'lerle SÖZLEŞMELEŞTİRME sırasını verir. Durum sütunu gerçekleştirim durumudur; "Implemented (no GDD)" = çalışan ama tasarım sözleşmesi belgelenmemiş — `/design-system` için "Not Started"a eşdeğer sayılır (retro-dokümantasyon).

---

## Systems Enumeration

| # | System Name | Category | Priority | Status | Design Doc | Depends On |
|---|-------------|----------|----------|--------|------------|------------|
| 1 | Powerup & Drop System | Economy | Vertical Slice | Implemented + Designed | design/gdd/powerup-drop-system.md | Enemy kills, Player weapons, Score |
| 2 | Enemy Waves & Difficulty Curve | Gameplay | Vertical Slice | Implemented (no GDD) | — | Spawning, Stages |
| 3 | Combo & Scoring | Gameplay | Vertical Slice | Implemented (no GDD) | — | Kill events |
| 4 | Boss Battle Patterns | Gameplay | Vertical Slice | Implemented (no GDD) | — | Stages, Combat |
| 5 | Auxiliary Armament (Sub-Drones & Rockets) | Gameplay | Alpha | Implemented (no GDD) | — | Powerups, Weapons |
| 6 | Ground Support Units (Port) | Gameplay | Alpha | Implemented (no GDD) | — | Enemy waves, Stages |
| 7 | Game Feel & Feedback (FX, hit-stop, shake) | Gameplay | Alpha | Implemented (no GDD) | — | Combat |
| 8 | Meta-Progression (Achievements & Extended Unlocks) | Meta | Full Vision | Not Started | — | Persistence, Score |

Tasarım önceliği = bağımlılık + "numeric-rule yoğunluğu" (bir denge geçişi hangi sözleşmeyi en çok tartar). Powerup & Drop System bu yüzden 1. sıra: canlı drop oranları, süreler ve can/hasar ekonomisi tek GDD'de toplanmayı hak ediyor.

---

## Categories

| Category | Description | Typical Systems |
|----------|-------------|-----------------|
| **Core** | Her şeyin dayandığı temel | Sim clock, determinizm, girdi |
| **Gameplay** | Oyunu eğlenceli yapan sistemler | Düşman davranışı, boss, kombo |
| **Economy** | Kaynak üretimi ve tüketimi | Powerup drop tabloları, can/onarım |
| **Persistence** | Kayıt ve süreklilik | Rekor (bestScore) |
| **UI** | Oyuncuya dönük ekranlar | HUD, menüler, dron seçimi |
| **Audio** | Ses ve müzik | Örnek-ses bankası, prosedürel müzik |
| **Meta** | Çekirdek döngünün dışı | Başarımlar, genişletilmiş kilitler |

---

## Priority Tiers

| Tier | Definition | Design Urgency |
|------|------------|----------------|
| **MVP** | Çekirdek döngü olmadan oyun test edilemez | İlk |
| **Vertical Slice** | Bir alanın cilalı hâli; denge/sözleşme tartışmalı | İkinci |
| **Alpha** | Kapsam tamam, içerik kaba | Üçüncü |
| **Full Vision** | İyileştirme ve içerik tamamlama | Gerektikçe |

---

## Dependency Map

### Foundation Layer (bağımlılık yok)
1. Deterministic Simulation Core (Clock + fixed step) — her şeyin deterministik olduğu zemin

### Core Layer
1. Input & Touch Tracking — depends on: Sim Core
2. Player Drone & Weapons — depends on: Input, Sim

### Feature Layer
1. Enemy Waves & Difficulty Curve — depends on: Sim, Spawner
2. Powerup & Drop System — depends on: Enemy kills, Player
3. Combo & Scoring — depends on: Kill events
4. Boss Battle Patterns — depends on: Stages, Combat
5. Auxiliary Armament — depends on: Powerups
6. Ground Support Units — depends on: Stages (port), Enemy waves

### Presentation Layer
1. Game Feel & Feedback — depends on: Combat
2. HUD & Menu Flow — depends on: Player, Score
3. Sound & Adaptive Music — depends on: Game state

---

## Recommended Design Order

| Order | System | Priority | Layer | Agent(s) | Est. Effort |
|-------|--------|----------|-------|----------|-------------|
| 1 | Powerup & Drop System | Vertical Slice | Feature | systems-designer, economy-designer | M |
| 2 | Enemy Waves & Difficulty Curve | Vertical Slice | Feature | systems-designer | L |
| 3 | Combo & Scoring | Vertical Slice | Feature | systems-designer | S |
| 4 | Boss Battle Patterns | Vertical Slice | Feature | systems-designer | L |
| 5 | Auxiliary Armament (Sub-Drones & Rockets) | Alpha | Feature | systems-designer | S |
| 6 | Ground Support Units (Port) | Alpha | Feature | systems-designer | S |
| 7 | Game Feel & Feedback | Alpha | Presentation | creative-director, art-director | M |
| 8 | Meta-Progression | Full Vision | Feature | systems-designer, economy-designer | M |

---

## Circular Dependencies

- [None found]

## High-Risk Systems

| System | Risk Type | Risk Description | Mitigation |
|--------|-----------|-----------------|------------|
| Deterministic Sim | Technical | Yeni sim davranışı Android altın izini geçersiz kılar | Her davranış değişikliğinde `resync_golden.sh` zorunlu |
| Enemy Waves & Difficulty Curve | Design | Zorluk kayması porta bağlı vinç/karo okunurluğunu bozabilir | Measured gates (`difficulty_curve`) + vision denetimi |

---

## Progress Tracker

| Metric | Count |
|--------|-------|
| Total systems identified | 8 |
| Design docs started | 1 |
| Design docs reviewed | 0 |
| Design docs approved | 0 |
| Systems implemented without GDD | 6 |
| Greenfield (Not Started) | 1 |

---

## Next Steps

- [ ] `/design-system powerup-drop-system` ile GDD'leme turunu başlat
- [ ] Her GDD sonrası `/review-all-gdds` ile çapraz tutarlılık
- [ ] Numeric GDD'leri `tools/evaluate.py` kapılarıyla izlenebilir yap