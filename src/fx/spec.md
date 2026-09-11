# fx — Efektler

Dosyalar: Explosion.js, Shockwave.js, Spark.js, SparkSystem.js, Smoke.js,
SmokeSystem.js, FallingWreck.js, FxSystem.js

Sorumluluk: patlama, şok dalgası, kıvılcım, ekran sarsıntısı, glitch, düşen hurda.

Sözleşmeler:
- Patlama ÜÇ KATMAN + kodda animasyon: flash (lighter, ~110 ms), fire (lighter,
  ~260 ms, rastgele döndürülmüş), smoke (normal, gecikmeli). Flipbook DENEME —
  denendi, kareler tutmuyor ve animasyon zıplıyor.
- Ateşin alfa sönümü `(1-t)^2.8`; doğrusal sönüm `lighter` altında beyaz çekirdeği
  griye çevirip patlamayı zeytin rengi bir topa döndürüyor.
- Şok dalgası yarıçapı ≤ 34 px, ömrü ≤ 190 ms; geniş ve uzun ömürlü halka ekranda
  "alakasız daire" olarak okunuyor.
- Kıvılcımlar renk+alfa kovasına göre gruplu çizilir (grup başına tek `beginPath`
  + tek `fill`); parçacık başına `drawImage` YASAK.
- Vuruş parlaması sprite'ın önceden beyaz tint'lenmiş kopyasıyla yapılır;
  `source-atop` + `fillRect` tuvalin tamamına göre çalışır ve ekrana dikdörtgen bırakır.
- Düşen hurda (Round 15): vurulan düşman anında patlamaz — `FallingWreck`
  pervanesi kırılıp dönerek süzülür (açısal hız ±3 rad/s, yerçekimi ~380 px/s²,
  hafif yatay savrulma), arkasında incelen duman izi (Smoke havuzu, gruplu fill,
  alfa ≤ 0.16). 1200 ms sonra küçük patlama ile yok olur. Açısal hız ve savrulma
  LCG'den (`spawnWreck(x, y, sprite, seedStream)`); havuz 12, önceden ayrılmış.
- Glitch / statik (Round 15): `FxSystem.glitch(ms, amp)` — yatay kayma şeritleri
  (kaynak tuvalden kesilip yerinde kaydırılır) + deterministik statik gürültü
  satırları. YALNIZ ÇİZİM: süre sim adımında sayılır ama görüntüdeki kayma
  `performance.now()`'a bağlıdır; sim durumuna asla dokunmaz. Oyuncu hasarında
  260 ms tam genlik; jammer menzilinde sürekli hafif (amp < 1).
