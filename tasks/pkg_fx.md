# fx paketi — Round 18: skor baloncuğu (score popup)

Öldürülen düşmanın yerinde yükselip sönen küçük puan yazısı. Kombo çarpanı
yükseldikçe rengi ısınır — oyuncu çarpanın işe yaradığını ekranda görsün.

`src/fx/ScorePop.js` + `FxSystem.scorePop(x, y, text, tier)`:
- ~900 ms, 26 px yukarı süzülür, son %30'da alfa 1→0.
- `tier` 0..4: renk soğuktan sıcağa (beyaz → açık sarı → turuncu → kırmızımsı).
- Havuzlu (`CONFIG.FX.scorePop.pool`, 12), sayılar `fx.config.js` içinde
  `Object.assign(CONFIG.FX, { scorePop: {...} })`.
- Yazı tek `fillText`, gölge/stroke için tek `strokeText` — kare başına yeni
  nesne tahsisi yok, boyut başına canvas önbelleği YASAK.
- Yalnız çizim katmanı; sim'e dokunmaz.

`FxSystem.reset()` bu havuzu da temizlesin. `state()` kancasını game paketi açar —
sen `scorePops` havuzunu dışarıdan okunabilir bırak (`this.scorePops`).
