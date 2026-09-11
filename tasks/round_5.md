# Round 5 — düşman dronları, çarpışma, skor + mermi kontrastı

Round 4 sonucu (orkestratör ölçümü): **11 PASS / 1 FAIL**. Tracer düzeldi
(`tracer_shape` 22 px, %2.8), `foreground_contrast` yeşil, determinizm 0.0000 px,
parallaks ve performans sağlam. Kalan: `vision_polish` min 7.

## A. Mermi kontrastı (küçük ama önce bu)

Vision'ın tutarlı şikayeti ve orkestratörün gözlemi aynı: mermiler Boğaz'ın koyu suyu
üzerinde net, ama **parlak turuncu sokak ışıklarının üzerinden geçerken eriyor**.
> "arka planin bazi bolgelerinde kontrast dusuklugu"  ·  "mermilerin yeri ve yolu belirsiz"

Sabit renk bu sorunu çözemez, çünkü arka plan hem çok koyu hem çok parlak bölgeler
içeriyor. Çözüm dron hâlesinde işe yarayanın aynısı: **kendi koyu zeminini taşısın**.
- Her merminin altına 1 px koyu kontur (siyaha yakın, alfa ~0.7), üstüne parlak çekirdek.
- Merminin arkasında ~10 px koyu, hızla sönen iz — parlak çatılarda bile yol okunur.
- Toplam genişlik yine ≤ 6 px, `tracer_shape` testi geçmeye devam etsin.

## B. Düşman dronları (yol haritası R5-6)

Üç tip, her biri kendi havuzunda, tamamı tek bir LCG'den beslenir (`Math.random()` yok):

| id | Sprite | HP | Puan | Davranış |
|---|---|---|---|---|
| `scout` | `drone_scout` | 1 | 100 | Hızlı (260 px/s), düz iner, ateş etmez |
| `gunner` | `drone_gunner` | 3 | 250 | Yavaş (110 px/s), 1500 ms'de bir oyuncuya nişanlı tek mermi |
| `shield` | `drone_shield` | 3 + kalkan 3 | 400 | Orta (140 px/s), kalkan 3 vuruş emer; kalkan varken kabarcık çizilir |

- Havuzlar önceden ayrılsın (scout ≥ 16, diğerleri ≥ 8), sıcak döngüde `new` yok.
- Spawn yönetimi: 1600 + rnd*500 ms aralık, x konumu kenara yakın ağırlıklı.
- Düşman mermileri ayrı havuz (32), 260 px/s, oyuncu mermilerinden **farklı renk**
  (turuncu-kırmızı) ve aynı koyu kontur numarasıyla okunur olsun.
- Her tip için prosedürel yedek çizim şart.

## C. Çarpışma, can, skor

- Daire-daire çarpışma: oyuncu mermisi r3 / düşman r(sprite yarısı × 0.7),
  düşman mermisi r5 / oyuncu r16.
- Oyuncu 3 can, hasar sonrası 1200 ms dokunulmazlık (yanıp sönerek).
- Skor tabloda; HUD'da skor + can. Can göstergesi `drone_player` küçültülmüş ikonuyla.
- Düşman ölünce şimdilik basit bir parlama yeterli — parçacık ve patlama Round 6'nın işi,
  erken yazma.

## Testler (mevcut 12'ye ekle)

- `enemy_types`: üç tipi de test kancasıyla doğur, HP ve puanları doğrulansın;
  ölümde skor artışı beklenen değerde olsun. Her tip KENDİ taze sayfasında ölçülsün
  (aynı koşuda peş peşe ölçmek oyuncuyu öldürüp alakasız FAIL üretiyor).
- `shield_absorb`: kalkan 3 vuruş emsin, 4. vuruştan itibaren gövde hasar alsın.
  3 kalkan + 3 can = 6 vuruşta ölür, yani en fazla 5 örnek canlı kalabilir.
- `enemy_determinism`: düşmanlar doğduktan sonra 240 kare, iki kare hızında
  oyuncu ve düşman konumları birebir aynı.
- `perf_heavy` yeni içerikle de geçsin.

## Süreç

Raporu harness yazıyor, sen yazma. `STATE.md`'yi kısa tut. Aynı aracı aynı
argümanlarla tekrarlama; dosyaları gereksiz yeniden okuma (tur başına çağrı sınırı var).
