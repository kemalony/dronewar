# world — Dünya

Dosyalar: CityScroller.js, CloudLayer.js

Sorumluluk: şehir karoları, paralaks yalpalaması, bulut katmanı, bölüm geçişi.

Sözleşmeler:
- Ayrı BİNA SPRITE KATMANI YOK. Denendi ve kaldırıldı: zemin tam tepeden çekilmiş
  ortografik bir hava görüntüsü, bina sprite'ları eğik açıdan; iki farklı projeksiyon
  yan yana durunca binalar havada süzülüyor gibi okunuyor (kullanıcı bildirdi).
  Açı hissi karonun kendisinin zoom + yatay kaydırmasından gelir.
- Her şehrin iki karosu vardır (`city_x`, `city_x_b`) ve dikey döngüde sırayla dizilir.
- Bulutlar zeminin TERSİ yönde ve ondan GÜÇLÜ kayar; aynı yöne kayarsa yükseklik
  hissi yok olur (kullanıcı bildirdi). Havuzdan LCG ile seçilir, arka arkaya aynı
  bulut gelmez.
- Simge yapılar dünyada çizilmez; bölüm kartında amblem olarak kullanılır.
