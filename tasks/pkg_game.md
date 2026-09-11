# game paketi — Round 20: sonuç ekranı istatistikleri + kalıcı rekor + ipuçları

`Game.js` bölünmüş: doğuş/bölüm/boss → `Game.spawn.js`, çarpışma →
`Game.collide.js`, çizim/HUD/menü → `Game.hud.js`. Yeni kodu doğru dosyaya koy.

## 1. Koşu istatistikleri
Bir koşu boyunca topla (oyun başında sıfırlanır):
- `kills` (öldürülen düşman), `bestCombo` (koşudaki en yüksek kombo sayacı),
  `shots` (atılan mermi), `hits` (düşmana/kara hedefine isabet eden mermi),
  `accuracy` = hits/shots (shots 0 ise 0), `timeMs` (oyunda geçen süre).
- `state()`'e: `stats: { kills, bestCombo, shots, hits, accuracy, timeMs }`.
- **Tutarlılık şart:** `hits <= shots`, `accuracy` 0..1 arası.

## 2. Sonuç ekranı (gameover + victory)
Mevcut ekranı istatistik tablosuna çevir: SKOR, ÖLDÜRME, EN İYİ KOMBO,
İSABET %, SÜRE. Yeni rekor varsa "YENİ REKOR" satırı. Sade kal — mevcut
tipografi ve renk dili, yeni panel/kutu yığını yok.

## 3. Kalıcı rekor
- En iyi skoru `localStorage` ile sakla (`CONFIG.STATS.storageKey`).
- **Her okuma/yazma `try/catch` içinde olmalı**: `file://` ve gizli sekmede
  `localStorage` erişimi exception atabilir; oyun bu yüzden ASLA çökmemeli.
  Erişilemiyorsa bellekteki rekorla devam et.
- `state()`'e: `persist: { available: <bool>, best: <sayı> }`.

## 4. İpuçları
- `CONFIG.TIPS` listesinden sırayla, `showMs` kadar ekranın alt kısmında soluk
  bir satır; `gapMs` boşluk; yalnız ilk `onlyFirstRuns` koşuda.
- Kaçıncı koşuda olduğumuz da `localStorage`'da tutulur (aynı try/catch kuralı).
- `state()`'e: `tip: { text: <string|''>, index: <n> }`.
- İpucu oyunu duraklatmaz, girdiyi engellemez, sim'e dokunmaz.

## Yapma
- Determinizmi bozma: istatistik sayaçları sim adımında, `dt` birikimiyle.
- `state()` alanlarından hiçbirini silme.
