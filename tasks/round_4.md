# Round 4 — mermi/dron görsel dili + bina yerleşimi

Round 3 sonucu (orkestratör ölçümü): **9 PASS / 2 FAIL**. Parallaks çalışıyor
(`parallax_lean` ters yön + iki kare hızında 0.00 fark), `building_budget` 4/6,
determinizm 0.000000 px, performans medyan 0.30 ms.

## A. Mermiler — şu an fazla, tracer değil sütun

Round 3'te "mermiler görünmüyor" sorununu çözerken diğer uca geçildi: orkestratörün
ekran görüntülerinde mermiler **kesintisiz parlak dikey sütunlar** halinde. Vision da
"mermilerin parlaklığı hafif aşırı" dedi. İstenen: ayrık, hızlı, okunur **tracer**.

- Mermi uzunluğu ≤ 22 px, ardışık mermiler arasında görünür boşluk kalsın
  (atış aralığı 130 ms ve hız 850 px/s ile bu doğal olarak oluşur — çizimi
  merminin gerçek konumuna bağla, iz uzatma).
- İz: çekirdek beyaz (2 px), dışı cyan, `lighter`. Toplam genişlik ≤ 6 px.
- Ekranı yıkamasın: mermi başına alfa ≤ 0.9, glow yarıçapı ≤ 5 px.

## B. Dron kontrast halkası — çember değil, hâle

Şu an dronun etrafında tam bir cyan çember var; okunur ama yapay, "kabarcık" gibi
duruyor. Yerine:
- dronun altına yumuşak, radyal, koyu bir **hâle** (alfa ≤ 0.35, yarıçap ≈ dron
  genişliği × 0.8) — şehir dokusunu bastırıp silüeti ayırır,
- gövde kenarına ince cyan **kenar ışığı** (1-2 px).
Amaç: dron her zaman okunsun ama sahneye ait görünsün.

## C. Binalar sahneye otursun

Binalar üstüne yapıştırılmış gibi duruyor: kenarları sert, ışıkları zeminle uyumsuz,
bazıları çok büyük.
- Bina çizim ölçeği manifest boyutunun 0.45-0.65 katı aralığında olsun (şu an bazıları
  ekranın üçte birini kaplıyor).
- Her binanın altına yumuşak bir gölge elipsi (alfa ≤ 0.35), kaydırma yönünün tersine
  hafif kaydırılmış — yükseklik hissi verir ve kenarı yumuşatır.
- Bina katmanı zemine göre çok az koyultulsun (çarpan 0.92) ki aynı gece ışığına ait dursun.

## Kabul

- `assets_check.py` VERDICT=PASS (32/32), satırı raporda ver
- Mevcut 11 assertion PASS, konsol hatası 0, determinizm 0.0000 px
- `foreground_contrast` testi: `dron_belirgin=true` VE `mermiler_gorunur=true`
- Yeni test `tracer_shape`: tek atışta çizilen mermi izinin ekran yüksekliğine oranı
  ≤ %5 olsun (sütun değil tracer olduğunun kanıtı)
- Vision: her karede `polish_score >= 8`, blocking 0
- TODO/FIXME/stub yok

## Süreç notu

`reports/round_N.md` artık **harness tarafından** yazılıyor (`tools/evaluate.py`),
senin yazmana gerek yok. Round 1 ve Round 3, qwen döngü koruması turu kestiği için
raporsuz bitmişti; bu bağımlılık kaldırıldı. Sen sadece `STATE.md`'yi kısa tut ve
işi bitir. Aynı aracı aynı argümanlarla tekrarlama, dosyaları gereksiz yere yeniden
okuma — tur başına araç çağrısı sınırı var.
