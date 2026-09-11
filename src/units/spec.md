# units — Birimler

Dosyalar: Bullet.js, Rocket.js, Enemy.js, Boss.js, Player.js

Sorumluluk: oyuncu dronu, düşman tipleri, boss, mermi ve roket davranışı.

Sözleşmeler:
- Tüm rastgelelik LCG'den; `Math.random()` YASAK.
- Her düşman tipi kendi havuzunda, önceden ayrılmış; sıcak döngüde `new` yok.
- Roket hedefi deterministik seçer: "en yakın aktif düşman, eşitlikte en küçük
  havuz indeksi".
- Boss bölüme göre sprite ve can alır (`CONFIG.BOSSES`); desen tablodan gelir.
- Rotor dönüş efekti yalnız çizimdir; rotor merkezleri ve yarıçapları CONFIG'de
  tablodadır, koda gömülmez.
