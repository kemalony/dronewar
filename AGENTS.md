# Drone War — ajanlar için çalışma kuralları

Şehirlerin üzerinde geçen dikey kaydırmalı bir shoot 'em up. Kaynak paketlere
bölünmüştür; **her paketi ayrı bir ajan yürütür**. Bu dosya herkes için geçerlidir.

## Altın kural: yalnızca kendi paketine yaz

Sana verilen paket `src/<paket>/` altındadır. **Başka paketin dosyasına dokunma.**
Başka pakette değişiklik gerekiyorsa yapma; `reports/requests/<paket>.md` dosyasına
tek satır not bırak, orkestratör yönlendirir.

`index.html` **türetilmiş dosyadır** — elle düzenleme. `python3 tools/build.py`
onu `src/` içinden üretir. Sen build'i de ÇALIŞTIRMA, testleri de. Orkestratör
her turdan sonra derler ve ölçer; böylece paralel ajanlar birbirinin çıktısını bozmaz.

## Sabitler: kendi paketinin config dosyasına yaz

`src/core/CONFIG.js` **yalnızca core ajanınındır.** Kendi paketine ait sabit
eklemen gerekiyorsa `src/<paket>/<paket>.config.js` açıp `CONFIG`'i genişlet:

```js
/* src/units/units.config.js */
CONFIG.PLAYER.DASH = { ms: 180, speedMul: 3, cooldownMs: 2500 };
```

Dosyayı `build_order.json` içinde `core/CONFIG.js`'ten SONRA sırala.

**Paylaşılan bir anahtarı EZME, genişlet.** `CONFIG.X = {...}` yazmak, başka bir
paketin aynı anahtara koyduğu alanları siler. `Object.assign(CONFIG.X, {...})`
kullan. Bu yaşandı: `units` ve `game` ikisi de `CONFIG.SUBDRONE` tanımladı, sonra
derlenen diğerinin `pool` alanını sildi ve sub-dron havuzu 0 boyutunda oluştu —
özellik sessizce çalışmadı. Sebep: iki
ajan aynı anda `CONFIG.js`'e yazarsa biri diğerinin değişikliğini ezer — bu ilk
paralel dalgada yaşandı. `CONFIG` donmuş (`Object.freeze`) değildir, genişletme çalışır.

## Mimari sözleşme

- Tek dosya çıktısı zorunlu (yayın sayfası dışarıdan dosya okuyamaz), bu yüzden
  modüller `import/export` KULLANMAZ. Her dosya tek bir üst düzey yapı tanımlar
  (`class X` ya da `const X`), derleyici sırayla birleştirir.
- Derleme sırası `src/build_order.json` içindedir. Yeni dosya eklersen oraya da ekle.
- Global durum yok; her şey `Game` örneğinden geçer.

## Değişmezler (bozma)

- **Determinizm:** sim sabit adımlı (120 Hz akümülatör). İki kare hızında aynı girdi
  birebir aynı sonucu vermeli. `Math.random()` YASAK — tüm rastgelelik LCG'den.
  `performance.now()` yalnızca çizimde kullanılır, simülasyonda asla.
- **Çizim / sim ayrımı:** sarsıntı, yalpalama, parlama, rotor dönüşü, bulut kayması
  yalnızca çizimdir; hiçbiri sim durumunu değiştirmez.
- **Varlıklar:** `assets/manifest.json` hazır; yeni varlık ÜRETME. Her çizim yolu
  önce yüklenen görseli, yoksa prosedürel yedeği kullanır — asla tersi.
- **Performans:** sıcak döngüde `new` yok (havuzlar önceden ayrılır). Parçacıklar
  renk+alfa kovasına göre gruplu çizilir. Boyut başına canvas önbelleği YASAK.
- **Dokunmatik:** dokun→başlat, birebir bağıl parmak takibi, parmak ekranda otomatik
  ateş. `_activePointer` `null` başlar ve korumalar `== null` yazılır.
  `Player.update` dokunmatik dalında `return` etmez.
- **Ekran görüntüsü yolu oyunun gerçek çizimidir.** Denetime giden kareye karartma
  veya vinyet ekleme; bu bir kez yapıldı ve testi geçmek için görüntüyü karartmak
  sorunu gizlemekten başka bir şey değildi.
- Mermiler paralel (açılı yelpaze "yamuk mermi" olarak bildirildi).

## Çıktı

Kısa bir özet yaz: ne değişti, hangi dosyalar. Rapor yazma — raporu harness üretir.
Aynı aracı aynı argümanlarla tekrarlama; tur başına araç çağrısı sınırı var.
