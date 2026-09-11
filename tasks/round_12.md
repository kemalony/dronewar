# Round 12 — düşman saldırı çeşitliliği, roket, silah düşüşü, dron seçimi

Kullanıcı geri bildiriminin 4, 6, 7, 8. maddeleri. Varlıklar hazır (60), yeni üretme.

## A. Yeni düşman tipleri ve saldırı çeşitliliği

Mevcut üçü (scout/gunner/shield) kalsın; üç yeni tip, hepsi tek LCG'den beslenir:

| id | Sprite | HP | Puan | Davranış |
|---|---|---|---|---|
| `bomber` | `drone_bomber` | 5 | 350 | Yavaş (90 px/s), 1800 ms'de bir **aşağı doğru 3'lü bomba yelpazesi** (mermiden yavaş, 200 px/s, büyük hitbox) |
| `kamikaze` | `drone_kamikaze` | 1 | 150 | Üstten zikzak inip **oyuncunun o anki x'ine kilitlenir** ve hızlanarak dalar (260→520 px/s). Kilitlenme anında kısa bir uyarı çizgisi |
| `sniper` | `drone_sniper` | 2 | 300 | Ekranın üst üçte birinde durur, 2200 ms'de bir **telegraflı** atış: 600 ms boyunca ince kırmızı nişan çizgisi, sonra hızlı tek mermi (520 px/s) |

- Bölüme göre karışım: 1'de scout+gunner, 2'de +kamikaze, 3'te +bomber, 4'te +sniper ve hepsi.
- Havuzlar önceden ayrılsın; sıcak döngüde `new` yok. Her tip için prosedürel yedek.

## B. Roket — kazanılabilir ek silah

- `pu_rocket` kapsülü düşman ölümlerinde %8 olasılıkla düşer (LCG).
- Alınınca 15 saniye boyunca **normal atışa ek olarak** 900 ms'de bir roket:
  `rocket` sprite'ı, 520 px/s, en yakın düşmana **hafif güdümlü** (dönüş ≤ 180°/s),
  hasar 3, isabette patlama efekti.
- Hedef seçimi deterministik: "en yakın aktif düşman, eşitlikte en küçük havuz indeksi".
- Kendi havuzu (8). HUD'da kalan süre.

## C. Hasar alınca klasik mermiye düşüş

- Can kaybedince silah seviyesi **1'e** düşsün (kademeli değil) ve HUD'da
  `SİLAH 1` kısa süre yanıp sönsün — oyuncu ne kaybettiğini görsün.
- Roket süresi de sıfırlansın.
- Ek olarak **elle silah değiştirme**: `Q` tuşu / HUD'daki silah rozetine dokunma
  ile sahip olunan seviyeler arasında geçiş (ör. dar ve isabetli seviye 1'i
  bilerek tercih edebilmek). Seçim `state()`'te görünsün.

## D. Bonusla açılan dron seçimi

Dört dron, `CONFIG.DRONES` tablosunda:

| id | Sprite | Hız | Can | Özellik | Açılış |
|---|---|---|---|---|---|
| `falcon` | `drone_player` | 400 | 3 | dengeli | başlangıçta açık |
| `swift` | `drone_swift` | 520 | 2 | atış aralığı %15 kısa | 5.000 puan |
| `tank` | `drone_tank` | 320 | 5 | hitbox %15 büyük, silah seviyesi 2 başlar | 12.000 puan |
| `ghost` | `drone_ghost` | 440 | 3 | hasar sonrası dokunulmazlık 2000 ms | 25.000 puan |

- En yüksek skor bellekte tutulur; kilitler ona göre açılır.
- Menü → **dron seçim ekranı** → oyun. Dokunmatikte ekranın sol/sağ üçte biri
  seçimi değiştirir, orta üçte bir başlatır (mobil uçak seçimi `game/` projesinde
  bu şekilde çözüldü; ilk denemede dokunuş doğrudan oyunu başlatıyordu ve seçim
  yapılamıyordu).
- Kilitli dronda `badge` yerine soluk çizim + açılış şartı yazısı; seçilemez.

## Testler (mevcut 36'ya ekle)

- `enemy_types_v2`: üç yeni tipin HP/puanı doğru; her tip KENDİ taze sayfasında ölçülür.
- `kamikaze_lock`: kamikaze oyuncunun x'ine kilitlenip hızlanır (mesafe azalır).
- `sniper_telegraph`: atıştan önce 600 ms nişan çizgisi durumu `state()`'te görünür.
- `rocket_homing`: roket hedefe yaklaşır (mesafe azalır), isabette hasar 3.
- `weapon_reset_on_damage`: hasar sonrası seviye 1 olur, roket süresi sıfırlanır.
- `drone_select`: kilitli dron seçilemez; açık dron seçilince hız/can değerleri gelir.
- `touch_drone_select`: `shipselect` durumunda sol/sağ dokunuş seçimi değiştirir,
  orta dokunuş başlatır — durum **`shipselect` kalmalı**, oyun başlamamalı.
- Determinizm ve `perf_heavy` bozulmayacak.

## Geri alma yasağı

- Ekran görüntüsü yolu oyunun gerçek çizimidir; karartma/vinyet ekleme.
- Bina sprite katmanı yok. Mermiler paralel. Nişan çerçevesi vektör.
- Dokunmatik: birebir bağıl takip + otomatik ateş; `_activePointer` `null` başlar,
  korumalar `== null`; `Player.update` dokunmatik dalında `return` etme.
