# Vision Cila Denetimi — Bulgular

Yöntem: 8 ekran görüntüsünün her biri Evren vision API (gemma-4-31b) ile
aynı prompt'la 2 kez sorgulandı (non-deterministik). Tüm çağrılar başarılı;
toplam **44 kusur** kaydı (iki tekrarın ortak bulguları dahil). Öncelik 5 = oyun alanını
bozan kusur, 1 = estetik detay.

## shot_0.png

| Yer | Sorun | Öncelik |
|---|---|---|
| Sol üst HUD alanı | Metinler ekran kenarlarına çok yakın, güvenli alan bırakılmamış | 3 |
| Skor ve Silah yazıları | Font kalınlığı/renk açısından görsel tutarsızlık | 1 |
| Sol üst köşe HUD metinleri | Yazı tipi fütüristik dron tasarımıyla uyumsuz, çok basit | 2 |
| Dron önündeki mavi göstergeler/mermiler | Koyu lacivert zeminde kontrast yetersiz | 3 |

Genel not: Varlıklar ve arka plan kaliteli; UI modernize edilmeli.

## shot_1.png

| Yer | Sorun | Öncelik |
|---|---|---|
| Merkezi ateş hattı / mermiler | Mavi enerji kürelerinin etrafında alfa hatası gibi sert kenarlı koyu gri dikdörtgen bloklar | 3 |
| Sol üst skor/silah yazıları | Altında renk kaymasına neden olan gölge/mükerrer katmanlar | 2 |
| Atış hattındaki mavi noktalar | Arkalarında harmanlanmamış siyah dikdörtgen gölgeler | 2 |
| 'SİLAH 1' yazısı | Belirgin pikselleşme, anti-aliasing eksikliği | 2 |
| Mermi yolu | Markerlar arası dikey mesafe tutarsız | 1 |

Genel not: Renk paleti uyumlu; UI ve vfx temizliği gerekiyor.

## shot_2.png

| Yer | Sorun | Öncelik |
|---|---|---|
| Sağ üst hedefleme çerçevesi | Kırmızı hedef, parlak şehir ışıklarıyla düşük kontrastlı, zor fark ediliyor | 3 |
| Mermi efektleri | Motion blur yok, ateş hissi statik | 2 |
| Orta sağ duman bulutu | Kenarlar/ışıklandırma arka planla bütünleşmemiş, yapıştırılmış gibi | 2 |
| Sol üst silah menüsü | İkonlar ve 'SİLAH 1' yazısı üst üste binmiş, okunurluk düşük | 3 |
| Mermi serisi | Projektiller arası mesafe tutarsız, ritim bozuk | 3 |
| Dron arkasındaki duman | Derinlik/şeffaflık uyumsuz | 2 |
| HUD elementleri | Yüksek çözünürlüklü arka plana kıyasla pikselli/bulanık | 2 |

Genel not: UI yerleşimi ve efekt geçişlerinde ince ayar gerekli.

## shot_3.png

| Yer | Sorun | Öncelik |
|---|---|---|
| Sol üst silah simgeleri | Opaklık çok düşük, arka planda okunabilirlik zayıf | 3 |
| Merkezi rota noktaları | Arkalarındaki siyah dikdörtgen gölgeler kaba görünüyor | 2 |
| Hedef imleci | Nişangah merkezi düşman dronla tam hizada değil, hafif kaymış | 2 |
| Orta hattaki yol işaretçileri | Yarı şeffaf siyah dikdörtgenler tarzla uyumsuz, amatör | 3 |
| Köprü altı / sağ orta | Sis/bulut kenarları keskin, düşük kalite harman | 2 |
| 'SİLAH 1' yazısı | Açık mavi ince font parlak ışıklarla çakışınca okunmuyor | 2 |

Genel not: UI ve bazı vfx katmanları foto-gerçekçi arka planın kalitesinin altında.

## shot_4.png

| Yer | Sorun | Öncelik |
|---|---|---|
| Sol üst UI paneli | Sayısal değerler ve 'SİLAH' yazısı düzensiz, üst üste binmiş | 3 |
| Köprü üzerindeki beyaz duman efektleri | Kenar geçişleri sert, piksellenmiş/kesik | 2 |
| Duman efektleri (tekrar) | Foto-gerçekçi arka plana göre çok sentetik, ışığa uyumsuz | 2 |
| Sol üst HUD ikonları | Çözünürlük düşük, pikselli | 2 |

Genel not: UI yerleşim hataları giderilirse sunum profesyonelleşir.

## _gnd_a.png (zemin kolajı A)

| Yer | Sorun | Öncelik |
|---|---|---|
| Ekranın en üst kısmı | Ciddi aynalama hataları ve tekrar eden bozuk dokular | 4 |
| Tankın yanı beyaz duman/bulut | Asset kötü harmanlanmış, sert kenarlı kesme izi | 3 |
| Sağ üst liman bölgesi | Perspektif tutarsızlıkları, anormal uzamalar | 2 |
| En üst bölge (tekrar) | Arka plan fotoğraflarında aynalama ve ek yeri (seam) hataları | 3 |
| Vinçlerin arası (gemi) | Kötü maskeleme sonucu beyaz lekeler ve sert kenarlar | 4 |
| Kamuflajlı tank | Işıklandırma/gölge sarı atmosferik ışıkla uyumsuz | 2 |

Genel not: Üst bölge montaj hataları ve varlık maskeleme eksikleri belirgin.

## _gnd_b.png (zemin kolajı B)

| Yer | Sorun | Öncelik |
|---|---|---|
| Orta sağ taraf | Gemi/vinçlerin arkasında dikdörtgen, kötü maskelenmiş beyaz boşluk | 4 |
| Ekranın en üst bölümü | Dokularda aynalanma/anormal tekrar bozulmaları | 3 |
| Üst bölgedeki yatay eklem hattı | Birleşim noktasında hizalama hatası ve sert kesilme çizgisi | 3 |
| Üst vincin altı | Ortama ait olmayan beyaz bulut benzeri grafik lekesi | 2 |
| Katmanlar arası perspektif | Dikey istiflenen liman görselleri arasında perspektif tutarsızlığı | 3 |

Genel not: Kolaj geçişleri yumuşatılmamış, görsel süreklilik bozuk.

## _contrast.png (kontrast testi)

| Yer | Sorun | Öncelik |
|---|---|---|
| Sol üst köşe / silah ikonları | Mühimmat simgeleri üst üste binmiş, sayı takibi zor | 2 |
| Merkezdeki rehber ışıklar | Dikey boşluklar tutarsız, görsel ritim bozuk | 2 |
| En üstteki rehber ışığı | Ekran kenarına çok yakın, kesilme riski | 3 |
| Skor altındaki simgeler | Bulanık, düşük çözünürlüklü | 2 |
| Orta rehber hattı | Mavi noktaların arkasındaki siyah dikdörtgenlerin kenarları çok keskin | 3 |
| Hedef alınan düşman dron | Ana karaktere kıyasla çok küçük, detay yetersiz | 2 |
| Hedefleme imleci | Kırmızı nişangah merkezi düşmanla tam hizalı değil | 2 |

Genel not: Kompozisyon başarılı; UI ve yardımcı grafikler cilalanmalı.

## Tekrarlayan / en yüksek öncelikli bulgular

- **Zemin kolajı maskeleme hataları (P4):** _gnd_a ve _gnd_b'de gemi/vinçlerin
  çevresinde kötü maskelenmiş beyaz dikdörtgen lekeler ve sert kenarlar —
  kolaj katmanlarının kenarları yumuşatılmalı/maske temizlenmeli.
- **Arka plan ek yeri (seam) hataları (P3-4):** Her iki zemin kolajının üst
  bölgesinde aynalama, tekrar eden doku ve yatay eklem çizgisi — kaydırmalı
  birleştirmede geçiş karıştırma (blend) düzeltilmeli.
- **Sol üst HUD ikon/metin üst üste binmesi ve düşük çözünürlük (P2-3):**
  shot_2, shot_4 ve _contrast'ta tekrarlanıyor — silah ikonları ile 'SİLAH'
  metni ayrıştırılmalı, ikonlar keskin/ yüksek çözünürlüklü çizilmeli.
- **Mermilerin arkasındaki harmanlanmamış koyu/siyah dikdörtgen gölgeler
  (P2-3):** shot_1, shot_3 ve _contrast'ta tekrarlanıyor — mermi sprite'ının
  alfa kenarları temizlenmeli ya da additive blending kullanılmalı.
- **Efekt (duman/sis) kenar sertliği (P2):** shot_2, shot_3, shot_4 ve _gnd_a'da
  tekrarlanıyor — parçacık kenar yumuşatma ve ortam ışığına uyum artırılmalı.
