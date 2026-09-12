Game.state() oyuncu nesnesine `dash: { active: this.player.dashActive, cooldownMs: Math.ceil(this.player.dashCd * 1000) }` alanini eklesin (acro-dash; harness bunu state() uzerinden olemcek).
2. Isisi tek kaynagi Game.heat olsun: Player dash()/launchSub() artik game._addHeat() cagirir ve kendi heat/overheated degiskenini tutmaz (units turu — dash_and_heat/heat_cooldown kapilari icin).
3. Autotest kancasi `window.__game.grantSubDrone()` eksik: sub_drones kapisinin else dali "grantSubDrone kancasi yok" der; en az 1 sub-drone verip sayaci artiran bir kanca lazim (subDrones < CONFIG.SUBDRONE.max iken).
4. Jammer entegrasyonu (units turu): Game constructor'a `this.jammerPool = new Pool(CONFIG.JAMMER.pool, () => new Jammer())` ekle; _simStep'te jammerPool.forEach((j) => j.update(dt, this)); _collidePlayerBullets veya ayri bir metotta jammer spawn yonetimi (bolum bazli, LCG ile); Player.update fireTimer hesabina jammer.inRange kontrolu (fireSlowMul carpani); _drawWorld'de jammerPool.forEach((j) => j.draw(c, this.assets)); state()'a `jammer: { active, inRange }` ekle.
5. Carrier entegrasyonu (units turu): Bolum 4 boss'u olarak Boss yerine Carrier kullan. forceBoss'te stageIdx===3 ise `this.boss = new Carrier(); this.boss.reset(3);` yap. _updateBoss'ta carrier.update(dt, this) cagir. _collidePlayerBullets'ta carrier.hitBullet(bx, by, br) sonucuyla parca/govde hasari yonet (parca dustugunde fx.explode + sound). state()'a `carrier: this.boss && this.boss.state ? this.boss.state() : null` ekle. killBoss test kancasinda carrier.bodyVulnerable mi kontrol et.
6. Round 16 (game turu): Player.update fireTimer hesabina `game.fireSlowMul` carpani eklesin: `if (game.fireSlowMul < 1) interval /= game.fireSlowMul;` — kara jammer menzildeyken oyuncu birincil ates araligi yavaslar (hava jammer'i ile ayni etki, ikisi ayni anda etkiliyse bir kez uygulanir; Game._computeFireMods her sim adiminda hesaplar).
7. Round 17 (game turu): Skimmer + scorch/flak baglamasi icin eksik bagimliliklar: (a) units paketi `src/units/Skimmer.js` sinifini ve `CONFIG.SKIMMER` sabitlerini (pool, speed, hp, score, dir, spawnIntervalMs) ekle; (b) fx paketi `FxSystem.scorch(x, screenY, cityDist)` ve `FxSystem.flak(x, y)` metotlarini + `scorches` havuzunu ekle; (c) build_order.json'a yeni dosyalar eklensin. Bunlar gelince game paketi Skimmer havuzu + spawn + carpisma + state() alanlarini ve scorch/flak cagri noktalarini baglayacak.

# :game — :rules / spec'e istekler (R2 oynanabilir dikey dilim)

Hepsi tek satırlık notlar; karar orkestratörün.

- **Oyuncu çarpışma yarıçapı `:rules`'ta yok.** Web `Game.collide.js` içinde satır içi
  `PR = 16` kullanıyor, `CONFIG`'te karşılığı yok. Dilim şimdilik
  `Config.ROTOR.radii.drone_player` (22) okuyor — yeni sabit tanımlamamak için.
  Mimari §5'teki `Hit.aabb(kind, ...)` tablosu geldiğinde buradan oraya taşınmalı.
- **Düşman yatay salınımı için sabit yok.** Web'de kamikaze dalında satır içi
  (`sin(y*0.04)*120`). Dilim `Config.SKIMMER.waveAmp`/`waveHz` okuyor (zaten yanlamasına
  hareket eden bir dronun dalga tanımı). Kendi anahtarı gerekiyorsa `units.toml`.
- **Düşman havuzu boyutu `:rules`'ta yok.** Dilim eşzamanlılık sınırını
  `Config.STAGES[0].maxConcurrent` (4) olarak alıyor ve havuzu aynı boyda ayırıyor.
  Bu yüzden spec AC-5'teki "ekranda >=20 düşman" bölüm 1'de ERİŞİLEMEZ: bölüm 1 dört
  eşzamanlı düşman demek. `gate_game.sh` varlık sayısı ölçmüyor, yalnız `cpu_p95`
  ölçüyor, dolayısıyla kapı etkilenmiyor — ama spec metni ile Config çelişiyor.
- **`fps` / `dropped_frames`:** bu dilimde emülatörde 300 karede ~100 düşük kare
  çıkıyor (%34). Aynı emülatörde aynı anda koşan `bench-gl` 59/300 (%20) veriyor,
  yani fark mutlak değil oransal ve ADR-001 bu iki sütunu bu donanımda kanıt
  saymıyor. Spec AC-5'in "<= %5 düşen kare" cümlesi emülatörde tutmuyor; fiziksel
  cihazda yeniden ölçülmeli. `cpu_p95` (kapının ölçtüğü) 1.06 ms.
- **Dokunmatik altın izi yok.** `:core-sim`'e `touchMove/touchRelease` eklendi
  (AGENTS'taki tek istisna). Klavye dalı değişmedi; iz R2'de kaydedilmeli.
- **Tracer karanlık halesi `:rules`'a taşınmalı (web-contrast'tan gelen ölçüm).**
  `src/fx/fx.config.js` içindeki `CONFIG.FX.tracer.haloW/haloA` `android/rules/config/fx.toml`'a
  HENÜZ girmemiş; üretilen `Config`'te `FX.tracer` yok. Android dilimi mermiyi şu an
  cyan kılıf + beyaz çekirdek olarak çiziyor, hale YOK. web-contrast'ın ölçümü:
  çekirdek toplamalı bileşikte 255'e doyuyor, yani tepe sabit ve `delta = 255 - band_median`;
  bulut katmanı üstünde parlak yolda medyan ~230'a çıkıyor (ölçülen 25). Tek kaldıraç
  medyanı indirmek, onu da hale çarpımsal olarak yapıyor. Port reçetesi: çekirdeğin
  ALTINA 4 iç içe dörtgen, iz boyu yükseklikte, genişlik `BULLET.w * haloW`, alfa `haloA`,
  düz src-over siyah. Anahtarlar `fx.toml`'a girince `GameView.drawBullets` bunları
  `Config`'ten okuyup çizecek — çizim çağrısı ARTMAZ (aynı doku, aynı harman, aynı yığın).
  Sabitleri `:game` içinde yeniden tanımlamıyorum; sahiplik kapısının engellediği şey tam bu.
  (Not: bulut alfası düzeltildi — dilim artık `CLOUDS.alphaMin..alphaMax` ve
  `scaleMin..scaleMax` aralığını slot başına LCG'den çekiyor, `alphaMin`'e sabitlemiyor.
  Yani web'deki kontrast vakası — parlak yol üstünde kalın bulut — native'de de
  üretilebiliyor; hale gerekliliği "yok" diye yanlış sonuçlanmaz. Çizim çağrısı 5'te kaldı.)
  Ölçüm yöntemi (web-contrast, render turu için): haleyi "kalın bulut parlak yolun
  üstüne denk gelen kare"yi arayarak DEĞİL, sentetik düz parlak bant üstünde ölç.
  Asıl iddia taban değeri; bulut yerleşiminden bağımsız ve halenin hem koyu şehirde
  hem beyaz bulutta çalışmasının sebebi o.
  Bulut yerleşimi/sürüklenmesi bilerek deterministik sim sözleşmesinin DIŞINDA
  (çizim-only invaryantı). Altın iz bulut durumunu karşılaştırmamalı; `:game`'in
  ayrı tohumlu çizim LCG'si bu yüzden çatallanma değil. Yalnız biri bulut durumuna
  iddia yazmaya kalkarsa gündeme gelsin.
