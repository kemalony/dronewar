# units paketi — Round 17: `Skimmer` (limanın deniz tarafından gelen düşmanı)

Liman bölümü şu an diğer bölümlerin düşman karışımını kullanıyor. Bu bölüme özgü
tek bir düşman tipi ekle: **skimmer** — deniz tarafından, ekranın YANINDAN giren
alçak uçuşlu hızlı dron.

Yeni dosya: `src/units/Skimmer.js`. Mevcut `Enemy` sınıfını şişirme, ayrı sınıf.

## Davranış
- Ekranın solundan veya sağından girer (hangisi olduğu doğuşta belirlenir, LCG),
  yatay olarak karşı kenara doğru geçer. Hafif dikey salınım (sinüs, `simTimeMs`
  değil `dt` birikimli kendi fazı — determinizm).
- Geçerken oyuncunun bulunduğu yatay banda geldiğinde **bir kez** 3'lü seri atar
  (mevcut düşman mermisi havuzu).
- Karşı kenardan çıkınca havuza iade.
- `CONFIG.SKIMMER` değerlerini `src/units/units.config.js` içinde `Object.assign`
  ile tanımla — `CONFIG` üzerine doğrudan yazma, paylaşılan anahtar ezme:
  `hp: 2, score: 350, speed: 300, waveAmp: 26, waveHz: 0.9, fireMs: 1200, burst: 3,
   burstGapMs: 120, bulletSpeed: 320, pool: 6, w: 72, h: 40`.
- Sprite: mevcut `drone_*` varlıklarından birini kullan (yeni varlık üretme);
  hangisini seçtiğini yorumda yaz. Prosedürel yedeği de olsun.

## Kurallar
- `Math.random()` yok; tüm rastgelelik LCG/dt birikimi.
- Oyuncu mermisi/roketi hasar verir; oyuncuya çarpınca normal düşman gibi hasar verir.
- `state()` kancasını game paketi açacak — sen `state()` için
  `{ x, y, dir, hp }` döndüren bir `state()` metodu koy.
