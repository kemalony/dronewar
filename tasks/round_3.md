# Round 3 — şehir parallaksı + ön plan okunabilirliği

Round 2 sonucu: 7/8 PASS. Determinizm 0.000000 px, varlık kapısı 32/32, performans
medyan 0.40 ms. Kalan tek kırmızı `vision_polish`.

## A. Ön plan okunabilirliği (önce bunu çöz)

Orkestratörün ölçümünde vision'ın kendi cümleleri:
> "dronun sehir arka planiyla karsilastirildiginda belirginligi dusuk, oyuncunun
> takibini zorlastirabilir"
> "mermiler yukari dogru ates ettiginde gorunmez veya cok zayif cizgilere sahip"

Şehir zengin ve parlak; çözüm şehri karartmak DEĞİL (o denendi, ortalama parlaklık 34
iken vision 3 verdi, 62'ye çıkarınca 7-9 oldu). Çözüm ön planı güçlendirmek:

- Oyuncu dronunun altına yumuşak bir **kontrast halkası**: koyu bir dış hâle + ince
  cyan kenar ışığı. Şehir ne kadar karışık olursa olsun silüet okunmalı.
- **Mermiler:** daha uzun ve parlak izli (tracer). Çekirdek beyaz, dışı cyan,
  `lighter` karışımıyla. Şu anki ince çizgiler yetmiyor.
- Namlu alevi her atışta görünür olsun (60 ms).
- Kural: ekrandaki en parlak nesneler dron, mermiler ve patlamalar olacak.

## B. Şehir parallaksı — bu oyunun imzası

Üç katman:
1. `city_<sehir>` zemin karosu — dikey kayar, dikişsiz döngü.
2. `building_<sehir>_<n>` binalar — ekranda aynı anda **en fazla 5-6**, seyrek
   yerleştirilmiş, zeminden **daha hızlı** kayar.
3. `landmark_<sehir>` — bölüm başına **bir kez** geçer, set parçası.

Oyuncunun ekrandaki yatay konumu (`-1..1`) katmanları **ters yönde** kaydırır:
zemin ×8 px, binalar ×38 px (boyutuyla orantılı). Kayma yumuşatılmış olsun
(kritik sönümlü yaklaşım, ani zıplama yok). Ek olarak hızlı yana giderken tüm sahne
1-2° karşı yöne yatar (yalnız çizim).

Bina yerleştirme **deterministik** olsun: LCG ile, kaydırma mesafesine bağlı;
`Math.random()` yok. İki kare hızında aynı binalar aynı yerde olmalı.

## C. Testler

Mevcut 8'e ekle:
- `parallax_lean`: oyuncu sola/sağa gittiğinde bina katmanının ofseti ters yönde
  değişsin ve iki kare hızında **birebir aynı** olsun.
- `building_budget`: ekranda aynı anda çizilen bina sayısı ≤ 6.
- `foreground_contrast`: bir kareye vision'a şunu sor (aynen):
  *"Oyuncu dronu ve mermiler arka plandan net ayrılıyor mu? SADECE JSON:
  {dron_belirgin: true/false, mermiler_gorunur: true/false, not: 'tek cumle'}"*
  İkisinden biri false ise FAIL.

## Orkestratör düzeltmeleri — geri alma

- Şehir karoları ortalama parlaklık **62**; tekrar karartma.
- `tools/evaluate.py` ekran görüntülerini artık `?autotest=1` ile alıyor (debug
  kaplaması olmadan) ve vision'dan **gerekçe** istiyor. İkisini de koru.

## Kabul

- `assets_check.py` VERDICT=PASS (32/32), satırı raporda ver
- Mevcut 8 + yeni assertion'lar iki kare hızında PASS, konsol hatası 0
- Vision: her karede `polish_score >= 8`, blocking 0, ve "dron/mermi görünmüyor"
  şikayeti kalmayacak
- `assets/` silinince prosedürel çizimle çalışır; TODO/FIXME/stub yok
