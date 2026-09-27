# Görsel Cila Borçları — Kod Taraması (units / fx / world / game)

Tarama: src/units, src/fx, src/world, src/game + core/CONFIG.js karşılaştırmalı.
`node tools/dump_config.js` koşuldu: **779 anahtar, kayıp anahtar uyarısı YOK**
(tüm paket config'leri `Object.assign` kullanıyor — STATE.md'deki ezme tuzağı
tekerrür etmemiş). Bulgular aşağıda; "KESİN" = grep/satır kanıtıyla doğrulandı.

## 1. Ölü / kullanılmayan cila kodu

### F1 — Sub-dron kamikaze modu hiç çalışmıyor (çağrı sırası garanti ediyor)
- **Yer:** `src/units/Player.js:130-133` (`input._subLaunchQueued` kontrolü),
  `Player.js:59-74` (`launchSub`), `src/units/SubDrone.js:38-63` (kamikaze dalı),
  `SubDrone.js:69-76` (kamikaze kenar ışığı çizimi) — **KESİN**
- **Ne:** `Game._simStep` önce `this.input.consumeSubLaunch()` çağırır
  (`Game.js:477`) — bu, `_subLaunchQueued` bayrağını **temizler** — sonra
  `this.player.update()` çalışır (`Game.js:478`). Player'ın `if (input._subLaunchQueued)`
  kontrolü bu yüzden asla true olamaz. Gerçekleşen yol `Game.spawn.js:661 _trySubLaunch`
  (mermi tabanlı yedek implementasyon).
- **Neden cila sorunu:** Kamikaze moduna özgü görsel dil (turuncu kenar ışığı,
  döner çizim, hedefe kilitlenme) yazılmış ama oyuncu hiç görmez.
- **Düzeltme:** Player dalını kaldır ya da consume sırasını Player'ın arkasına al
  (tek yol kalsın).
- **Etki:** ORTA (işlevsel değil, saf ölü görsel kod; ~70 satır).

### F2 — İki sub-dron üst üste AYNI tarafta duruyor
- **Yer:** `src/units/Player.js:30` (`this._subSide = [1, -1]` — hiçbir yerde
  okunmuyor), `src/units/SubDrone.js:9` (`this._side = this._side || 1` — asla
  -1 atanmıyor) — **KESİN**
- **Ne:** Sol/sağ ayrımı için `_subSide` dizisi yazılmış ama `addSub` bağlamamış;
  her SubDrone `_side = 1` ile doğar → ikisi de oyuncunun +34 px SAĞINDA,
  birebir üst üste çizilir.
- **Düzeltme:** `addSub` içinde sıradaki sub'a `_subSide[i]` ata.
- **Etki:** ORTA-YÜKSEK (görünür görsel hata; "2 refakatçi" hissi yok).

### F3 — `pu_shield` hiç düşmüyor (HUD KALKAN satırı ölü)
- **Yer:** `src/game/Game.spawn.js:468-479` (`_maybeDropPowerup`: yalnız
  weapon/rocket/subdrone/repair dalları var), `Game.hud.js:717-723` (KALKAN HUD) — **KESİN**
- **Ne:** Drop tablosunda shield yok; `spawnPowerup('shield',...)` yalnız test
  kancası. `CONFIG.WEAPON.shieldMs: 6000` ve kalkan görsel dili (pu_shield sprite,
  mavi HUD) canlı ama oyuncu asla alamaz.
- **Düzeltme:** Drop zincirine shield dalı ekle veya özelliği bilinçli olarak
  test-kancası olarak işaretle.
- **Etki:** ORTA (yarım yapılmış özellik).

### F4 — Bina katmanı sim'de üretiliyor ama çizilmiyor (ölü yük + ölü config)
- **Yer:** `src/world/CityScroller.js:88-119` (`_ensureBuilt`/`_spawnAt` her sim
  adımında çalışır), `draw()` binaları çizmez; `CONFIG.PARALLAX.buildingDim /
  buildingShadowAlpha / buildingSpeed / maxBuildings / landmarkInterval`
  (core/CONFIG.js:54-60) hiçbir çizim kodu okumuyor — **KESİN**
- **Ne:** "Uçan binalar" düzeltmesinde çizim kaldırılmış ama üretim kalmış;
  `buildingsList` yalnız `onScreenCount()` test kancası okuyor.
- **Düzeltme:** Üretimi ve 5 ölü config anahtarını kaldır (veya kancayı koruyup
  yorumla belgele).
- **Etki:** DÜŞÜK (performans önemsiz; ama tur başına bakım yükü ve "config'de
  var mı?" aramasında yanlış iz).

### F5 — `Player.poolSize` tanımsız alan
- **Yer:** `src/units/Player.js:190` — `this.fireTimer = this.poolSize || interval;` — **KESİN**
- **Ne:** `poolSize` Player'da hiç atanmıyor (projede tek geçiş bu satır);
  `|| interval` her zaman interval'i seçer. Ölü kalıntı, okuyucuyu yanıltır.
- **Düzeltme:** `this.fireTimer = interval;` yap.
- **Etki:** DÜŞÜK.

### F6 — Ölü config sabitleri (tanımlı ama okunmayan)
- **KESİN** (grep: yalnız tanım satırı):
  - `CONFIG.CLOUDS.maxClouds` (core/CONFIG.js:237) — CloudLayer spacing tabanlı;
    STATE.md "max 3 bulut" diyor ama kod aralıkla sınırlıyor.
  - `CONFIG.SUBDRONE.damage` (units.config.js:10) — SubDrone gun mermisi hasarı
    çarpışmada sabit 1 (`Game.collide.js` üzerinden).
- **Düzeltme:** Kaldır ya da gerçek kaynağa bağla.
- **Etki:** DÜŞÜK.

## 2. Yarım yapılmış / config-kod uyumsuz

### F7 — HUD can ikonları 3'te kesiliyor, tank 5 canla başlıyor
- **Yer:** `src/game/Game.hud.js:698` (`for i < CONFIG.PLAYER_LIVES` = 3) vs
  `CONFIG.DRONES.tank.lives = 5`; shipselect `_uiPips(..., 5, ...)` (hud.js:240) — **KESİN**
- **Ne:** Tank seçilirse 4. ve 5. can hiç gösterilmez; seçim ekranı 5'e kadar
  gösterdiği için ekranlar birbirini yalanlıyor.
- **Düzeltme:** Döngü üst sınırını `this.player.lives` başlangıç değeri /
  DRONES tablosundan türet.
- **Etki:** ORTA.

### F8 — Rotor merkezleri yalnız falcon için (bilinen tuzak, iki ayrı tezahür)
- **Yer:** `src/game/Game.hud.js:504` (oyunda seçilen drona bakılmaksızın sabit
  `'drone_player'` merkezleri), `hud.js:226` (`_drawShipSelect` → `D.sprite`
  geçirir; swift/tank/ghost'ta `_drawRotorSpin` hud.js:377'de erken döner, yay
  hiç çizilmez) — **KESİN** (STATE.md "Orkestratör Notları"nda da kayıtlı)
- **Ne:** Menü/dron seçim önizlemesinde 4 dronun 3'ünde rotor spin görünmez;
  oyunda ise falcon'un merkezleri diğer dronlara "kazara" oturuyor.
- **Düzeltme:** `CONFIG.ROTOR.centers`'a dört dron için merkez ekle
  (`tools/rotor_overlay.py` ile doğrula).
- **Etki:** ORTA (yeni dron eklendiğinde sessiz bozulma riski + önizleme cilası eksik).

### F9 — Kamikaze kilit çizgisi magic 620, sniper CONFIG.H kullanıyor
- **Yer:** `src/units/Enemy.js:188` (`lineTo(..., 620 - this.y)` — "oyuncu y'si ~620"
  varsayımı), `Enemy.js:201` (sniper: `CONFIG.H - this.y`) — **KESİN**
- **Ne:** Aynı kavram (telegraf/uyarı çizgisi) iki farklı yöntemle; 620, oyuncu
  gerçek konumunu değil H*0.78 yakınsamasını temsil ediyor.
- **Düzeltme:** Kamikaze çizgisini de gerçek oyuncu konumuna (p.x/p.y) veya
  CONFIG türevli bir sabite bağla.
- **Etki:** DÜŞÜK-ORTA (oyuncu y'si değişkense çizgi yanlış yere gider; şimdi
  tesadüfen yakın).

## 3. Çizim tutarsızlıkları

### F10 — HUD'da iki farklı cyan
- **Yer:** `CONFIG.UI.accentRGB = '110,235,255'` (#6EEBFF) vs hardcoded
  `'#6fe3ff'` (hud.js:712 SİLAH, 781/787 kombo, 875 DOKUN/SPACE) — **KESİN**
- **Ne:** Araları 1-2 birim; tek renk dili iddiasıyla çelişiyor, tema
  değişikliğinde sessizce dağılır.
- **Düzeltme:** Hardcoded cyan'ları `accentRGB` türevine çevir.
- **Etki:** DÜŞÜK.

### F11 — HUD gölge/alfa dili tutarsız
- **Yer:** SKOR/SİLAH/KALKAN/ROKET gölgeli (`rgba(0,0,0,0.35)` +2px, hud.js:692-730);
  `ISI YETMİYOR` (757), `JAMMER MENZİLİ` (766) ve kombo rozeti (779-782) gölgesiz — **KESİN**
- **Neden:** Parlak karo üstünde gölgesiz satırlar okunurluk kapısının
  (gate_ui) ölçtüğü bandın dışına düşebilir.
- **Düzeltme:** Tek `_uiHudText(c, text, x, y, col)` yardımcısına topla.
- **Etki:** DÜŞÜK-ORTA.

### F12 — Aynı efekt sınıfında config'li ve hardcoded değerler karışık
- **KESİN:**
  - `src/fx/Smoke.js:7-8`: size 5, vy -18; `SmokeSystem.js:18`: renk
    `180,185,195` hardcoded — kardeşi scorch tümünü config'ten okuyor.
  - `src/fx/Spark.js:15,21`: boyut 1.5-3, yerçekimi 120 hardcoded.
  - `src/fx/Explosion.js:30,40,52`: taban boyut 96, smoke drift -18 hardcoded
    (süreler core CONFIG'de).
  - `src/units/Jammer.js:21`: `entryT = 1.2` s hardcoded (Boss/CARRIER
    entryMs config'de).
  - `src/units/Carrier.js:175`: `bodyW/bodyH = 208/176` hardcoded
    (BOSS.size config'de varken).
  - `src/units/Player.js:242-257`: koyu hale alfa kademeleri ve cyan kenar
    rgba(110,235,255,0.95) hardcoded.
- **Neden:** Cila ayarı turu geldiğinde (ör. "dumanı biraz koyulaştır") değer
  koddan aranacak; karışık desen bakım hatası üretir.
- **Düzeltme:** Her efektin kendi `<paket>.config.js` bloğuna taşı
  (kural zaten var: `Object.assign(CONFIG.FX, {...})`).
- **Etki:** DÜŞÜK (tek tek), toplamda ORTA (bakım yükü).

### F13 — Boss/carrier can barı renkleri dağınık
- **Yer:** `hud.js:567-571` (`'#ff5540'` + `rgba(255,120,90,0.7)` stroke),
  `Carrier.js:214` (`'#ff5540'`), `hud.js:739/740` ısı barı kendi kırmızıları — **KESİN**
- **Düzeltme:** UI kırmızı tonunu `CONFIG.UI`'ye koy, üç yeri bağla.
- **Etki:** DÜŞÜK.

## 4. dump_config.js sonucu
- Kayıp anahtar / ezme uyarısı YOK; 779 anahtar golden'a yazıldı.
- Tüm paket config'leri (`fx.config`, `units.config`, `game.config`) doğrulandı:
  komple atama YOK, hepsi `Object.assign` — STATE.md'deki SUBDRONE/JAMMER/CARRIER
  tuzağı tekerrür etmemiş.

## 5. Spekülatif (DOĞRULANMALI)
- `Game.js:39` `this.hp = 1` ("boss turunde hasarla dolacak" yorumu) —
  okunduğu yer görülmedi; boss canı artık `boss.hp` üzerinden. Güncel değilse
  kaldırılabilir ölü alan. **DOĞRULANMALI** (görsel cila değil, not).
- `Skimmer` yedek çizim dalı (`Skimmer.js:81-85`, `GroundUnit.js:146-157`
  prosedürel yedekler) manifest 60/60 yüklü olduğu için pratikte ölü; kasıtlı
  fallback sözleşmesi — dokunma. **Bilgi notu.**

## Öncelik sırası (öneri)
1. F2 (üst üste sub-dronlar — görünür hata)
2. F7 (tank can göstergesi) + F3 (pu_shield düşmüyor)
3. F1 (ölü kamikaze modu — kaldır ya da bağla)
4. F8 (rotor merkezleri) — STATE.md'de zaten "yeni dronda sessiz bozulur" diye işaretli
5. F10-F13 tutarlılık temizliği (tek tura sığar)
