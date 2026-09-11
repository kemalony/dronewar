# Round 8 — bölüm sonu boss'u, bölüm kartı, zafer

Durum (orkestratör ölçümü): **18 PASS / 1 FAIL**. Dört şehir ilerlemesi, düşmanlar,
kalkan, patlama, mobil oynanabilirlik, parallaks çalışıyor.

## A. Simge yapılar bölüm kartına taşınsın

"Uçuşan binalar" düzeltmesinde bina katmanı sahneden kaldırıldı; simge yapılar da
o katmanda çiziliyordu, yani şu an `buildingsList`'e ekleniyor ama **hiç görünmüyorlar**.
Dünyaya geri koyma — aynı sorunu yaratır (tepeden çekilmiş fotoğrafın üstünde eğik
açıdan çizilmiş sprite havada durur).

Bunun yerine **bölüm kartında amblem** olarak kullan:
- Bölüm başında 1800 ms kart: ortada `landmark_<sehir>` (128 px), altında
  `BÖLÜM n` ve şehir adı, ince bir çizgi.
- Kart oyun alanını karartmasın; yumuşak girip çıksın (300 ms).
- `city.landmarkShown` mantığı kalsın ama artık kartı tetiklesin.

## B. Bölüm sonu boss'u

Kota dolunca düşman doğumu durur, 1200 ms `DIKKAT` uyarısı (yanıp sönen), sonra
`boss_gunship` üstten girer.

| Bölüm | Can | Desen |
|---|---|---|
| 1 | 60 | nişanlı 3'lü yelpaze (1100 ms) |
| 2 | 90 | + 12'li dairesel patlama (1500 ms) |
| 3 | 120 | + iki taraftan çapraz tarama |
| 4 | 160 | üçü birden, aralıklar %20 kısa |

- Boss tek slot, önceden ayrılmış; `Math.random()` yok, tüm rastgelelik LCG'den.
- Girişte 1500 ms kapalı formda iniş, sonra y=150'de 70 px/3 s salınım.
- Can çubuğu üstte; hasar alınca beyaz tint karesi (önceden tint'lenmiş kopya).
- Boss ölünce: 6 patlama 500 ms içinde + kısa ekran parlaması, sonra bölüm geçişi.
- Bölüm 4 boss'u ölünce **VICTORY** ekranı: skor, süre, yeni rekor vurgusu.

## C. Testler (mevcut 19'a ekle)

- `boss_spawn`: kota dolunca boss doğar, düşman doğumu durur, can bölüme göre doğru.
- `boss_phases`: sürekli ateşle can düşer ve en az 2. faza ulaşılır.
- `boss_determinism`: boss sahnedeyken 240 kare, iki kare hızında birebir aynı
  (toplam sim süresi eşit olsun; artık tick ile tamamla).
- `victory`: bölüm 4 boss'u ölünce durum `victory` olsun.
- `perf_heavy` bozulmasın.

## Geri alma yasağı (orkestratör düzeltmeleri)

- **Ekran görüntüsü yolu oyunun gerçek çizimidir.** `_drawWorldNoHud` artık
  `_drawWorld`'ü çağırır. Oraya karartma/vinyet EKLEME — testi geçmek için
  denetime giden kareyi karartmak sorunu gizlemektir; bu yapılmıştı ve kaldırıldı.
- **Bina sprite katmanı yok.** Açı hissi şehir karosunun zoom+kaydırmasından gelir.
- Dokunmatik: dokun→başlat, birebir bağıl takip, otomatik ateş; `_activePointer`
  `null` başlar ve korumalar `== null` yazılır. `Player.update` dokunmatik dalında
  `return` etme.

## Süreç

Raporu harness yazıyor. `STATE.md` kısa. Aynı aracı aynı argümanlarla tekrarlama.
