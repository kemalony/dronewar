# Round 7 — dört şehir: bölüm ilerlemesi, simge yapılar, zorluk eğrisi

Durum (orkestratör ölçümü): **15 PASS / 1 FAIL**. Motor, parallaks, düşmanlar,
çarpışma, kalkan, patlama, mobil oynanabilirlik hazır. Kalan tek kırmızı öznel
`vision_polish`. Şu an oyun tek şehirde (İstanbul) geçiyor — bu turda dördü de girsin.

## A. Bölüm ilerlemesi

| Bölüm | Şehir | Kota | Spawn aralığı çarpanı | Düşman hızı |
|---|---|---|---|---|
| 1 | İstanbul | 15 öldürme | 1.00 | 1.00 |
| 2 | Paris | 20 | 0.85 | 1.10 |
| 3 | New York | 25 | 0.72 | 1.20 |
| 4 | Tokyo | 30 | 0.62 | 1.30 |

- Şehir değişimi 1500 ms **çapraz geçiş** (crossfade): zemin karosu, binalar ve
  varsa renk tonu birlikte geçsin; ani sıçrama olmasın.
- Bina havuzu bölüme göre değişir: `building_<sehir>_1..4`.
- Bölüm başında 1500 ms `BÖLÜM n — <ŞEHİR>` başlığı (oyun alanını karartma).
- Düşman karışımı bölüme göre: 1'de scout+gunner, 2'de +shield, 3-4'te üçü de
  ve daha sık.

## B. Simge yapılar

Her bölümde `landmark_<sehir>` **bir kez** geçsin: bölümün ortasına gelindiğinde
(kotanın yarısı) ekranın üstünden girsin, zemin hızında değil **bina hızında** kaysın
(paralaksa dahil), altında yumuşak gölge. Vurulamaz, çarpışmaz — set parçası.

## C. Zorluk eğrisi

- Düşman mermisi hızı bölümle birlikte 260 → 320 px/s.
- `gunner` ateş aralığı 1500 → 1100 ms.
- Bölüm 3'ten itibaren aynı anda en fazla 6 düşman (öncesi 4).

## Testler (mevcut 16'ya ekle)

- `stage_progress`: `forceKills(n)` kancasıyla kota doldur; bölüm 1→2→3→4 sırayla
  geçsin, her geçişte aktif şehir adı ve bina havuzu değişsin.
- `stage_determinism`: bölüm geçişi sonrası 240 kare, iki kare hızında birebir aynı
  (toplam sim süresi eşit olsun — 240×16.67 ms, kalan artık tick ile tamamlanır).
- `landmark_once`: bir bölümde simge yapı en fazla bir kez doğsun.
- `perf_heavy` bozulmasın.

## Süreç

Raporu harness yazıyor. `STATE.md` kısa. Aynı aracı aynı argümanlarla tekrarlama,
dosyaları gereksiz yeniden okuma (tur başına araç çağrısı sınırı var).

## Geri alma yasağı (orkestratör düzeltmeleri)

- Dokunmatik: dokun→başlat, birebir bağıl takip, parmak ekranda otomatik ateş.
  `Input._activePointer` `null` ile başlatılır ve korumalar `== null` ile yazılır
  (`=== null` undefined'i kaçırıp konumu NaN yapıyordu). `touch_playable` kapısı bunu sürer.
- `Player.update` dokunmatik dalında **`return` etme** — ateş kodu çalışmaz, atış sayısı 0'a düşer.
- `foreground_contrast` ölçülen bir kapıdır (vision değil); ölçüm tek karede yapılır.
