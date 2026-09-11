# Round 9 — ses, his, menüler (yol haritası R9-10)

Durum (orkestratör ölçümü): **23 PASS / 0 FAIL** — ilk kez tamamı yeşil, vision dahil.
Motor, dört şehir, düşmanlar, boss, zafer ekranı hazır. Bu tur oyunun HİSSİ.

## A. Ses (prosedürel WebAudio, dosya yok)

Tek bir `Sound` sınıfı; `AudioContext` askıdayken hiçbiri hata fırlatmayacak.
İlk kullanıcı dokunuşunda/tuşunda açılır (mobilde şart). `M` ile sessize alma.

| Olay | Karakter |
|---|---|
| Oyuncu atışı | kısa, ince "tık" — üst üste binince kulak tırmalamamalı |
| Düşman atışı | boğuk, alçak |
| Boss atışı | daha alçak, hafif uğultu |
| İsabet | kısa gürültü patlaması |
| Düşman ölümü | alçalan gürültü + kısa gövde |
| Boss uyarısı | iki notalı siren |
| Bölüm geçişi | yükselen iki nota |
| Zafer | kısa akor |

Aynı anda çok ses varsa toplam kazanç sınırlansın (aktif ses sayacı). Ses üretimi
**simülasyonu etkilemeyecek** — determinizm testleri aynen geçmeli.

## B. His

- **Ekran sarsıntısı:** oyuncu hasar alınca 260 ms, boss ölümünde 500 ms. Sönümlü,
  yalnız çizim dönüşümü; sim'e dokunmaz.
- **Hit-stop:** düşman ölümünde 45 ms, boss ölümünde 120 ms sim duraklaması.
  Autotest altında devre dışı (determinizm testleri bozulmasın).
- **Rotor tozu:** oyuncunun altında `rotor_wash` sprite'ı, hıza göre hafif dönerek
  ve şeffaflaşarak — irtifa hissi verir.
- **Nişan çerçevesi:** `hud_target` en yakın düşmanın üstünde belirsin (yalnız çizim).

## C. Menüler ve akış

- Menü: oyun adı, `BAŞLA` (dokun/Space), en yüksek skor, kısa kontrol satırı.
- Duraklama (P veya menü butonu): oyun alanı %35 karartılır, `DURAKLADI` + kontroller.
- Game over: skor, en yüksek skor, ulaşılan bölüm/şehir, öldüren düşman tipi.
- Zafer: skor, süre, `YENİ REKOR` vurgusu.
- Üç ekranda da 150 ms yumuşak geçiş; en yüksek skor bellekte tutulur.

## Testler (mevcut 23'e ekle)

- `audio_no_throw`: AudioContext askıdayken tüm ses çağrıları hata fırlatmaz.
- `shake_display_only`: sarsıntı sırasında oyuncu/düşman **sim konumları** değişmez
  (iki kare hızında birebir aynı kalır).
- `hud_states`: menü → oyun → duraklat → devam → game over → menü akışı çalışır.
- Mevcut determinizm testleri bozulmayacak.

## Geri alma yasağı

- Ekran görüntüsü yolu oyunun **gerçek** çizimidir; karartma/vinyet ekleme.
- Bina sprite katmanı yok; açı hissi karo zoom+kaydırmasından gelir.
- Dokunmatik: dokun→başlat, birebir bağıl takip, otomatik ateş; `_activePointer`
  `null` başlar, korumalar `== null`. `Player.update` dokunmatik dalında `return` etme.

## Süreç

Raporu harness yazıyor. `STATE.md` kısa. Aynı aracı aynı argümanlarla tekrarlama.
