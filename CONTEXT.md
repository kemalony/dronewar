# CONTEXT.md — ICM Katman 1 (Routing)

Aktif girişim: **Powerup & Drop System GDD** (design-system skill, autonomous override).
Protokol: SDD (.spec) + ICM (bu dosya) + Progressive Outlining.

## Katman haritası (bu girişim için)
| Katman | Dosya | Rol |
|---|---|---|
| L0 Kök | `AGENTS.md`, `STATE.md` | Proje kuralları, tur geçmişi |
| L1 Routing | `CONTEXT.md` (bu dosya) | İş akışı yönlendirmesi |
| L2 Aşama sözleşmesi | `.spec/powerup-drop-system/SPEC.md` | SDD sözleşmesi (Objectives/Non-Goals/Invariants/Oracles) |
| L3 Referans | `src/core/CONFIG.js`, `src/units/units.config.js`, `src/game/game.config.js`, `src/game/Game.spawn.js`, `src/units/Player.js`, `reports/requests/polish_code_review.md` | Değişmez sabitler + as-built davranış |
| L4 Çalışma nesneleri | `design/gdd/powerup-drop-system.md` (üretim), `design/registry/entities.yaml` (kayıt), `production/session-state/active.md` | Dinamik çıktı |

## Kurallar
- Bağlam izolasyonu: her aşamada yalnız L3'ün gerekli satırları okunur (tam dosya değil, blok).
- Evre handoff: SPEC (L2) → GDD (L4) → doğrulama (Level 4). Her aşama çıktısı bir sonrakinin girdisidir.
- Drift Gate: L4'teki her sayı L3'e karşı doğrulanır; uyuşmazlıkta DUR.
- Framework yan bağlamı: `.claude/skills/design-system/SKILL.md` (+ `.claude/docs/` rehberleri, `.claude/agents/` uzman tanımları).