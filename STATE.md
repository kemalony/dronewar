# DRONE WAR — Durum

## Tur: 25 (tamamlandı — web 68 PASS / 1 FAIL; tek FAIL vision_polish = ulaşılamayan LAN API)

## Tamamlanan
- **Motor:** Sabit adım sim (120Hz akümülatör), Clock, Input, Assets, Renderer, Pool, Player, Bullet, Enemy, Boss, Game
- **Determinizm:** İki kare hızında birebir aynı pozisyon (0.000000px fark)
- **Şehir parallaksı:** Üç katman + yalpalaması + bölüm geçişi (Round 3)
- **Mermi görsel dili (Round 4):** Ayrık tracer (22px iz, beyaz çekirdek + cyan dış). `tracer_shape` PASS.
- **Düşman tipleri (Round 5):** scout/gunner/shield, spawn yönetimi, çarpışma, skor + HUD.
- **Vuruş geri bildirimi (Round 6):** Beyaz tint parlaması (~90ms), üç katmanlı patlama, şok dalgası, gruplu kıvılcım.
- **Dört şehir (Round 7):** İstanbul→Paris→NY→Tokyo bölüm ilerlemesi, kota bazlı geçiş, 1500ms crossfade, zorluk eğrisi.
- **Boss (Round 8):** Bölüm sonu boss'u — fazlar, desenler, LCG deterministik, can çubuğu, ölüm sekansı.
- **Bölüm kartı + VICTORY (Round 8):** 1800ms amblem kartı, zafer ekranı.
- **Ses (Round 9):** Prosedürel WebAudio (`Sound` sınıfı), 8 ses karakteri, aktif ses sayacı (max 8), M ile sessize alma.
- **His (Round 9):** Ekran sarsıntısı, hit-stop, rotor tozu, nişan çerçevesi.
- **Menüler (Round 9):** Menü, duraklatma, game over, zafer. 150ms yumuşak geçiş.
- **Rotor spin (Round 10):** Her dronun rotor merkezlerinde dönen yay efekti (lighter, simTimeMs'e bağlı, yalnız çizim). Oyuncu 4 köşe, scout 4, gunner 6, shield 8, boss 2 büyük halka. Hızlandıkça %30'a kadar artış.
- **Silah yükseltmesi (Round 10):** 3 seviye paralel mermi (1/2/3 mermi, ±14/±26 px offset). `pu_weapon` %12 drop (LCG), alınınca seviye+1 (max 3), hasarda seviye-1 (min 1). Seviye 3'te alınırsa 500 puan. `pu_shield` 6sn kalkan. HUD'da SİLAH + KALKAN.
- **Bulut katmanı (Round 10):** `cloud_wisp`/`cloud_puff`, şehir üstünde dronlar altında, 185px/s paralaks, max 3 bulut, alfa 0.30-0.55, LCG deterministik yerleşim.
- **Zengin patlama (Round 10):** `boom_flash` (lighter, 110ms, 0.4→2.0), `boom_fire` (lighter, 260ms, 0.55→2.1, (1-t)^2.8), `boom_smoke` (normal, 210ms gecikmeli, 560ms, alfa≤0.16, yukarı sürüklenme) + şok dalgası + gruplu kıvılcım.
- **Varlık yüklemesi:** 60/60 PNG, prosedürel fallback hazır.
- **Yeni düşman tipleri (Round 12):** bomber (hp5, 350, 90px/s, 1800ms'de bir 3'lü bomba yelpazesi), kamikaze (hp1, 150, zikzak iniş + oyuncuya kilitlenip 520px/s dalış), sniper (hp2, 300, üst üçte birde telegraflı atış: 600ms kırmızı nişan çizgisi + 520px/s mermi). Her tip kendi havuzunda. Bölüme göre karışım: 1=scout+gunner, 2=+kamikaze, 3=+bomber, 4=+sniper ve hepsi.
- **Roket (Round 12):** `pu_rocket` %8 drop (LCG). Alınınca 15sn boyunca normal atışa ek olarak 900ms'de bir roket: hafif güdümlü (dönüş ≤180°/s), 520px/s, hasar 3, isabette patlama. Kendi havuzu (8). HUD'da ROKET süre.
- **Hasarda silah sıfırlama (Round 12):** Can kaybedince silah seviyesi DOĞRUDAN 1'e düşer (kademeli değil), roket süresi sıfırlanır, HUD'da SİLAH 1 kırmızı yanıp söner (1200ms). Q tuşu / HUD rozeti ile elle silah değiştirme.
- **Dron seçimi (Round 12):** 4 dron (falcon/swift/tank/ghost), `CONFIG.DRONES` tablosu. En yüksek skor bellekte tutulur; kilitler bestScore'a göre açılır. Menü → dron seçim ekranı → oyun. Dokunmatikte sol/sağ üçte biri seçim değiştirir, orta başlatır. Kilitli dronda soluk çizim + açılış şartı yazısı.

- **LİMAN bölümü (Round 16):** Beşinci bölüm `city:'port'` (kota 35, `ground:true`). İki karo (`city_port`/`city_port_b`), binası ve simge yapısı yok. Katalog artık `CONFIG.STAGES.map(s => s.city)`'ten türüyor.
- **Kara hedefleri (Round 16):** `GroundUnit` — radar (düşman ateşini %20 hızlandırır), uçaksavar (nişanlı 3'lü seri, menzil 620), jammer (180 px, ateş aralığını yavaşlatır). Zemine çivili: `screenY = y0 + (city.dist - spawnDist)`. Kotaya sayılmaz, oyuncu gövdesiyle çarpışmaz. YALNIZCA `ground:true` bölümde ve crossfade bittikten sonra.
- **Boss sırası (Round 16):** Taşıyıcı (çok parçalı) finale kaydı — bölüm 4 artık `boss_tokyo` normal boss, bölüm 5 taşıyıcı. `stageIdx === CONFIG.STAGES.length - 1`.

- **game paketi bölündü (Round 17):** `Game.js` 1926 → 573 satır; `Game.spawn.js`, `Game.collide.js`, `Game.hud.js` prototip genişletmesiyle. Davranış değişmedi.
- **Skimmer (Round 17):** Limanın deniz tarafından YANDAN giren dronu; ekranı yatay geçer, oyuncunun bandına gelince bir kez 3'lü seri atar. Yalnız liman + crossfade sonrası, en fazla 2 tane. Kotaya SAYILIR.
- **Zemin izi + flak (Round 17):** Kara hedefi ölünce zemine çivili is izi (3 sn). Uçaksavar mermisi hedefe kadar gitmez, `flakLead: 0.85` ile hedefin önünde havada patlar.

- **Kombo çarpanı (Round 18):** Art arda öldürmede x1→x5; `CONFIG.COMBO.windowMs` 2600 ms. Skor çarpanla eklenir (boss dahil), oyuncu hasar alınca anında sıfırlanır. HUD'da rozet + süre çubuğu.
- **Onarım kutusu (Round 18):** `pu_repair` %5 drop; can eksikse +1 can (max 3), doluysa +250 puan.
- **Skor baloncuğu (Round 18):** Öldürülen yerde yükselen puan yazısı, rengi kombo tier'ine göre ısınır.
- **`player_contrast` kapısı (Round 18):** Dronun kendi kontrastı ölçülüyor; vision'ın "dron görünmüyor" iddiası bu kapı geçerken danışma sayılır.

- **Prosedürel müzik (Round 19):** `src/audio/Music.js` — dört katman (bass/pulse/arp/lead), yoğunluk menü 0.25 → oyun 0.55 → boss 1.0, rampalı geçiş. Açılıştan itibaren çalar; M ile susar. Varlık yok, WebAudio.
- **Menü cilası (Round 19):** Arkada şehir kayar, üstünde degrade perde, seçili dronun dönen rotorlu önizlemesi.
- **Zorluk eğrisi ölçümü (Round 19):** Bölüm yükü [238, 252, 293, 675, 894] — monoton artıyor.

- **Round 21 — dört kırmızı kapı kapandı.** Round 20 ölçüm koşturulmadan commit edilmişti
  (`reports/round_20.md` yok) ve kendi eklediği üç kapı kırmızıydı.
  - `run_stats` / `stats_reset_per_run`: `Player` yalnız `game.shotsFired`'ı artırıyordu;
    `_stats.shots` **hiçbir yerde** artmıyordu ama `_stats.hits` beş yerde bağlıydı — isabet
    oranı gerçek payı sıfır paydaya bölüyordu. Tek giriş: `Game.addShots(n)`.
    `bestCombo` yalnız `_onKill`'de güncelleniyordu, artık her sim adımında.
  - `persist_best`: oyun sonu mantığı **tek bir çarpışma dalına gömülüydü**; can başka
    yoldan sıfırlanınca oyun `play`'de asılı kalıyor, rekor hiç kaydedilmiyordu.
    `_gameOver(cause)` eklendi, `_simStep` `lives<=0` görünce çağırıyor.
  - `foreground_contrast` (25, eşik 60): `lighter` çekirdek her zeminde 255'e **doyuyor**,
    yani tepe yükseltilemez — tek kaldıraç bandın medyanını düşürmek. Mermi artık kendi
    siyah halesini taşıyor (çarpımsal). Çizim `Bullet.drawPool`'a taşındı.

- **16 config anahtarı sessizce siliniyormuş (Round 21).** `units.config.js`
  `CONFIG.JAMMER = {...}` yazıp core'un `hp`/`score`/`glitchLevel`'ını yok ediyordu.
  Zincir: `glitchLevel` → `undefined` → `FxSystem`'de `level || 0` → **ambient glitch bu
  oyunun ömründe bir kez bile çizilmemiş.** `Object.assign`'a çevrildi. `CARRIER`'da ise
  bayat olan core'un kendisiydi (dizi şeklinde, `Carrier.js` hiç okumuyor) — silindi.

- **Android portu (ayrı belgeler).** `docs/adr-001-android-platform.md` (ölçülmüş platform
  kararı: OpenGL ES 2.0) ve `docs/android-architecture.md` (modül haritası, `FrameSink`
  dikişi, parity yöntemi). Modüller: `:rules` (596 sabit bit-bit), `:core-sim` (oyuncu
  fiziği, altın iz 720/720), `:harness` (kapılar), `:game` (emülatörde oynanabilir dilim).
  Kapılar: `tools/android/gate_*.sh`, yeniden senkron: `tools/android/resync_golden.sh`.

- **Round 22–23 — olu kod canlandirildi.** Denetimin bulduklari: `FallingWreck`
  (sinif tam, cagiran yok, ustelik `startVy`/`smokeEvery`/`smokeLife` eksik oldugu
  icin cagrilsa `NaN`), `FxSystem.glitch()` (cagiran yok), `Sound.hover()` (cagiran
  yok), jammer dronu (alti dusman havuzu taraniyor, `jammerPool` listede yok).
  Hepsi baglandi; `tools/gate_deadcode.py` 6/6 olcuyor. `glitch.level=0.5` ilk kez
  gercek deger uretiyor — `JAMMER.glitchLevel` Round 21'de ezilmekten kurtarilmisti.
- **Ses kalitesi (Round 23).** Her zarf `setValueAtTime` ile basliyordu (her sesin
  onunde genis bantli tik); `enemyDeath` 8 sesli butcenin UCUNU birden yiyordu;
  tavan yoktu. SFX -> kompresor -> master -> limiter zinciri, cok parcali sesler tek
  slot, atis/patlama gurultu tabanli yeniden yazildi. `Math.random()` artik `src/`
  icinde hic yok; ses varyasyonu yalniz `Sound`'un okudugu bir sayactan — sim LCG'sine
  DOKUNMUYOR, yani Android altin izi catallanmiyor.

- **Round 24 — menüler ve akış.** Akış zaten doğruymuş (`gate_ui` zinciri ve
  çıkışsız-ekran kontrolü ilk koşumda geçti), sorun görseldi. Her arayüz bloğu artık
  `_uiPlate` üstünde; bölüm kartı amblemi `_uiPedestal` ile arkadan aydınlatılıyor
  (landmark PNG'leri koyu silüet, medyan parlaklık 40–124 — koyu halenin üstünde her
  zeminde görünmezdi). Menü başlığı büyüdü + bölüm kataloğu, `shipselect` kahraman +
  şerit düzenine geçti (girdi modeli değişmedi), `pause` koşu özeti aldı.
  Ölçüm: yayılım menu 8→3, pause 24→5, stagecard 38→8.

- **Round 25 — gerçek örnek sesler.** Sahibin "web'deki sesler çok basitti" geri
  bildirimi üzerine prosedürel sentez örnek seslerle değiştirildi. Kaynak: Kenney
  "Sci-Fi Sounds", **CC0** (kamu malı, ticari serbest, atıf zorunlu değil). 73 sesin
  tamamı ölçülüp 18'i seçildi, 22 kHz mono'ya indirilip kırpıldı: 824 KB → 99 KB ham,
  132 KB base64. `index.html` 275 → 479 KB. `playerShot` 4 varyant + deterministik
  perde/kazanç jitter'ı (`_rotN`/`_varN`, sim LCG'sine DOKUNMAZ). Prosedürel kod
  SİLİNMEDİ — banka hazır değilse ya da çözülemezse ona düşülüyor.
  Kapı: `tools/gate_sfx.py` 7/7.

## Kalan / Sonraki Turlar
- **Vision polish (Round 13+):** min_score=7 (hedef 8), blocking değişken (hedef 0).
- **Cila (Round 13+):** Değerlendirici bulgularıyla ince ayar.

## Orkestratör Notları — Geri Alma
- **`file://` altında dış ses dosyası WebAudio'ya bağlanamaz — TAINTED.** Ölçüldü:
  `fetch` ve `XHR` bloklu; `new Audio('assets/...')` yükleniyor ve çalıyor AMA
  `ctx.createMediaElementSource()` bağlanıyor ve **sessiz** geliyor. Canvas'taki
  `toDataURL` tuzağının aynı sınıfı. O yol seçilirse kompresör/limiter zinciri, üst
  üste binme ve perde kontrolü komple kaybedilir. Doğru yol **base64 + `atob` +
  `decodeAudioData`**: hiç ağdan geçmiyor, ölçülen tepe 0.506, tam kontrol.
  `src/audio/sfx.data.js` ÜRETİLEN dosyadır — `tools/build_sfx.py` ile
  `assets/sfx/*.ogg` içinden üretilir, elle düzenlenmez.
- **Döngülenen ses ada göre değil ÖLÇEREK seçilir.** Beş saniyelik motor
  kayıtlarının baş/son süreksizliği: `spaceEngine` 0.233, `spaceEngineLow` 0.185,
  `engineCircular` **0.021**. Yalnız sonuncusu dikişsiz döner. İsimlere bakılsaydı
  yanlışı seçilirdi.
- **Hata ayıklama bayrağı uygulamayı kalıcı sağır bıraktı.** Android `:game`'de
  `--ei autoplay` ile açılan `autoplay` bayrağı hiç kapanmıyordu ve dokun-başlat dalı
  `!autoplay` ile korunduğu için uygulama oyun sonu ekranında **her dokunuşu yok
  sayıyordu**. Çökme yok, render döngüsü dönüyor, `frames` artıyor — dışarıdan hiçbir
  şey bozuk görünmüyor. Artık oyun sonuna geçerken bayrak temizleniyor.
  **Kapı deliği:** AC-4 yalnızca oyun sonuna VARILDIĞINI ölçüyordu, oradan
  ÇIKILABİLDİĞİNİ değil. Web tarafına `ui_no_deadend` yazmıştım, Android'e yazmamıştım.
  `AC-4b` eklendi.
- **Yüklü emülatörde tek ölçüm güvenilmez.** Aynı build arka arkaya 584–1026 ms soğuk
  açılış verirken, gradle derlemesi ve APK kurulumundan hemen sonra 1891 ms ölçüldü ve
  kapı yanlış kırmızı yandı. `AC-1` artık üç açılışın medyanını alıyor.
- **Arayüz okunurluğu arkadakine bağlı olmamalı.** Menüler canlı kayan şehrin üstüne
  çiziliyor; yumuşak radyal perde ekran KENARLARINDA sıfıra iniyordu ama ölçülen bant
  tam genişlik — yani perde tam ihtiyaç duyulan yerde yoktu. Bölüm kartı parlak
  köprünün üstüne denk gelince başlık ve amblem kayboluyordu (yazı arkasındaki medyan
  15↔53 arasında salınıyordu). Çözüm ölçmek değil, **yapısal**: tam genişlikte,
  çekirdeği neredeyse opak, yalnız üst/alt kenarı yumuşayan plaka. Sızma tam olarak
  `1 - alpha`. `tools/gate_ui.py` bunu ölçüyor: yazı arkasındaki medyan ≤45 ve beş
  farklı kaydırma konumunda yayılım ≤12.
- **Bu kapıyı yazarken "tepe − medyan" metriği AYIRT ETMEDİ.** Parlak arka plan, yazı
  olmasa da tepeyi 255'e çıkarıyor. Ölçülmesi gereken şey kontrast değil arka planın
  SIZMASI'ydı. Aynı tuzağa `player_contrast`'ta da düşülmüştü.
- **`CONFIG.ROTOR.centers`'ta `drone_swift`/`tank`/`ghost` YOK.** `Game.hud.js:504`
  sahnede sabit `'drone_player'` merkezlerini kullanıyor. Bakıldı: dördü de köşe
  rotorlu ve oranları benzer olduğu için falcon'un merkezleri üçüne de oturuyor,
  görünür kusur yok. Ama bu **kazara** doğru — geometrisi farklı bir dron eklenirse
  sessizce bozulur. `python3 tools/rotor_overlay.py` ile bak.
- **Karo hazirlarken kaynaktan GENIS kirpma.** 752 px'lik bir goruntuden 806 px
  isteyince PIL disariyi siyahla doldurur ve karonun iki yanina bant gomulur —
  oyunda kenarda siyah serit. Karo geometrisi DOGRUYKEN olur, o yuzden pay hesabi
  yakalamaz. Kural: kaynak hedeften darsa DIKEY kirp. `tools/tile_seam_check.py`
  artik `TILE_BORDER` ile olcuyor (manifest'teki karolar; `city_dusk`/`city_neon`
  kayitli degil, oyun yuklemiyor).
- **Karo kaydirma payi = (W*tileZoom - W)/2 ve kayma + sarsintiyi karsilamali.**
  1.10'da pay 24 px, maksimum kayma da tam 24 px idi — artan SIFIR, yani kenara
  dayanip sarsinti almak karonun kenarini ekrana sokuyordu. 1.18 -> pay 43.2 px.
  **`tileZoom` degistirmek gorunur dikis satirini (H/tileZoom) kaydirir**, karolar
  `tools/blend_tiles.py --from-ref <temiz>` ile TEMIZ TABANDAN yeniden
  harmanlanmali; ton duzeltmesi birikimlidir.
- **`CONFIG` degerinde `null` TOML'a yazilamaz.** `MUSIC.layerTone[1] = null`
  ("bu katmana filtre yok") web'de anahtarin olmamasiyla ayni davraniyor, o yuzden
  port tarafinda uretilmez — ama bu muafiyet degil SART: `ConfigParityTest` golden'da
  null olan bir anahtar Kotlin'de VARSA dusuyor.
- **`CONFIG.ROTOR.centers` sprite'la uyuşmuyorsa hiçbir kapı yakalamaz.** `rotor_spin`
  yalnızca açının değiştiğini ve deterministik olduğunu ölçer; yayların ROTORLARIN
  ÜSTÜNE düştüğünü ölçmez. Round 21'de ölçüldü: gunner'da 6 merkez / 4 rotor,
  shield'da 8 merkez / 4 rotor vardı — fazla yaylar **gövdeye** çiziliyordu, ki bu
  `visuals` kapısının "gövde çevresinde daire yok" şartının doğrudan ihlali. Sprite'lar
  6 ve 8 rotorlu olarak yeniden üretildi. Dron sprite'ı değiştirirsen
  `python3 tools/rotor_overlay.py` ile BAK — otomatik eşik denedim, pervaneler ince
  olduğu için çember çoğunlukla kanatlar arasından geçiyor ve doğru hizalanmış rotorda
  bile düşük oran veriyor. Bu bir gösterge, kapı değil.
- **Bir kapının yeşil olması koştuğu anlamına gelmez.** `:rules:test` golden dosyayı Gradle
  **girdisi** olarak bildirmiyordu; golden değişince `FROM-CACHE` dönüp yeşil dedi ve
  sahiplik kayması üç koşum boyunca fark edilmedi. Ölçüm dosyasını her zaman `inputs.file`
  ile bildir. Aynı tuzak `:harness`'ta fark edilip çözülmüştü.
- **Ezme, çift anahtardan daha sinsidir.** `CONFIG.X = {...}` kardeş anahtarları siler;
  geriye çift kalmaz, yani çift-anahtar denetimi göremez — kanıt anahtarla birlikte yok
  olur. `tools/dump_config.js` artık her dosyadan sonra kaybolan anahtarları raporluyor.
- **Sahiplik "son yazan"dır, "ilk görünen" değil.** İlk-görünen ataması, ezilen bir
  anahtarda değeri çöpe giden dosyayı sahip gösterir.
- **Çevrimdışı kontrast ölçümüne güvenme.** Sprite'ları ham şehir karosu üstünde ölçmek
  dronu değil şehri ölçüyor: dron KOYMADAN yapılan kontrol koşumu da aynı ~170'i veriyor.
  Sanat kararı yalnız oyun içi `evaluate.py` ile verilir.
- **`foreground_contrast` bir kez soğuk başlangıçta 145 verdi, kararlı değeri 25.** İlk
  koşum 10 mermi örnekledi, sonrakiler 11. Tek koşuma dayanarak "kapı gürültülü" deme;
  üçüncü koşum kararı verir.
- **`audio.config.js` `CONFIG.MUSIC`'i EZMEZ, genişletir.** `Object.assign(CONFIG, {MUSIC:{...}})` yazılınca core'un `intensity` anahtarları silindi ve oyun ilk sim adımında `TypeError` ile çöktü.
- **Vision puanı oyunun değil, modelin günlük salınımının ölçüsü:** aynı build iki ardışık koşuda medyan 8 ve 7 aldı. Kapı artık blocking==0 ve (medyan≥8 veya medyan≥7 + ölçülen kontrast kapıları yeşil). Bunu tek sayıya geri çevirme.
- **Müzik açılışta başlar** (`Game.start()` → `_startMusic()`), yalnız `startGame()`'de başlatılırsa menü sessiz kalır.
- **`Game.js` bölünmüş durumda.** Yeni metot eklerken doğru dosyaya koy: doğuş/bölüm/boss → `Game.spawn.js`, çarpışma → `Game.collide.js`, çizim/HUD/menü → `Game.hud.js`. `Game.js` sınıf gövdesi + `state()` olarak kalsın.
- **`fx.draw(c, assets, city)`** — üçüncü argüman zorunlu; zemine çivili is izleri onsuz çizilemez.
- **Uçaksavar mermisinin ömrü mesafeye bağlı** (`flakLead`). Sabit 4 sn yapılırsa mermi ekrandan çıkar ve flak patlaması hiç görünmez.
- **Kara hedefi YALNIZCA liman bölümünde.** Gerçek şehir fotoğrafının üstüne kara aracı koymak "uçan bina" hatasının aynısıdır. Crossfade sırasında (`city.fadeT < 1`) de doğmaz/çizilmez.
- **Temas gölgesi silüetin DIŞINA taşmalı** (`h*0.34 + shadowDy` merkez, `h*0.17` yarıçap). Gövde merkezine çizilince gölge sprite'ın altında kalıyor ve temas hissi hiç oluşmuyordu (ölçüldü: taşma +0 px).
- **`state().ground.units[].worldY` = `y0 - spawnDist`** (sabit). Önce `screenY` ile aynı değeri veriyordu; o zaman kare-kare eşleştirme için kimlik anahtarı yoktu.
- **`spawnGround(type, x, screenY)` üçüncü argümanı EKRAN y'sidir.**
- **Karo dikişi karonun son satırında değil:** `tileZoom = 1.10` olduğu için bir sonraki karonun üst kenarı, öncekinin `1/1.10 = %90.9` yüksekliğindeki satırına denk gelir. Liman karoları o satırda harmanlandı; karoları yeniden üretirsen bu adımı tekrarla.
- **`src/core/MANIFEST.js` elle tutuluyor** — `assets/manifest.json` büyüyünce senkronlanmazsa yeni varlıklar sessizce hiç yüklenmez.
- **Şehir karoları yeniden üretildi**, ortalama parlaklık 34 → 62. Karoları tekrar koyulaştırma; ön plan kontrastını dronları parlak çizerek sağla.
- **`tools/evaluate.py` vision denetimi GEREKÇE istiyor** (sadece sayı değil). Bu davranışı koru.
- Dokunmatik: dokun→başlat, birebir bağıl takip, parmak ekranda otomatik ateş. `Input._activePointer` `null` ile başlatılır ve korumalar `== null` ile yazılır. `touch_playable` kapısı bunu sürer.
- `Player.update` dokunmatik dalında **`return` etme** — ateş kodu çalışmaz, atış sayısı 0'a düşer.
- `foreground_contrast` ölçülen bir kapıdır (vision değil); ölçüm tek karede yapılır.
- **Ekran görüntüsü yolu oyunun gerçek çizimidir.** `_drawWorldNoHud` artık `_drawWorld`'ü çağırır. Oraya karartma/vinyet EKLEME.
- **Bina sprite katmanı yok.** Açı hissi şehir karosunun zoom+kaydırmasından gelir.
- **Simge yapılar sahnede ÇİZİLMEZ** — bölüm kartında amblem olarak kullanılır (round 8). Dünyaya geri koyma.
- **Dokunmatik dron seçimi (Round 12):** `shipselect` durumunda sol/sağ üçte biri seçim değiştirir, orta başlatır. Durum `shipselect` KALMALI, oyun başlamamalı (orta dışında). İlk denemede dokunuş doğrudan oyunu başlatıyordu ve seçim yapılamıyordu.

## Teknik Notlar
- `index.html`: Tek dosya, 480×800 iç çözünürlük, CDN yok.
- `tools/evaluate.py`: Playwright ile 16.67ms ve 6.94ms adımlarında test. Raporu harness yazar.
- `assets/manifest.json`: 60 varlık, her biri 2× saklanır.
- Canvas file:// altında tainted — `toDataURL` çalışmaz. Ekran görüntüsü için `page.screenshot` + `_drawWorldNoHud`.
- **FX sistemi yalnızca çizim katmanı** — sim'e dokunmaz, determinizm bozulmaz.
- **Beyaz tint:** `Assets.whiteTint(name)` offscreen canvas'a `source-in` + beyaz fillRect. `source-atop` KULLANILMAZ.
- **Patlama sönümü doğrusal değil:** `(1-t)^2.8`.
- **Crossfade:** `CityScroller.setCity(name, instant)` — instant=false ise prevCity/prevBuildingsList saklanır, fadeT 0→1 (1500ms).
- **STAGES:** CONFIG.STAGES[] — city, name, quota, spawnMul, enemySpeedMul, ebulletSpeed, gunnerFireMs, maxConcurrent.
- **BOSS:** CONFIG.BOSS — hp[4], fanMs/ringMs/sweepMs[4] (birikimli desenler), bulletSpeed, warnMs, entryMs, hoverY, swayAmp, swayPeriod, size, radius, score, deathExplosions, deathWindowMs, flashMs.
- **Boss döngüsü:** none → warn (1200ms DIKKAT) → active (giriş 1500ms + salınım) → dying (6 patlama + ekran parlaması) → none → bölüm geçişi veya VICTORY.
- **Bölüm geçişi boss ölümüne bağlı** (round 8): kota dolunca boss tetiklenir, boss ölünce sonraki bölüme geçilir.
- **Sound (round 9):** Prosedürel WebAudio. `unlock()` ilk etkileşimde. `_gate()` aktif ses sayacına göre gain node verir (max 8). Autotest'te AudioContext suspended kalır — tüm çağrılar sessizce no-op.
- **Sarsıntı (round 9):** `shakeT/shakeDur/shakeAmp` alanları. `_drawWorld` içinde `c.translate(sx, sy)` — yalnız çizim dönüşümü. Sönüm: `t²`.
- **Hit-stop (round 9):** `hitstopT` > 0 iken sim adımını ATLAR, sadece render eder. `CONFIG.AUTOTEST` true ise devre dışı.
- **Menu fade (round 9):** `menuFadeT` 0→1 (150ms). Tüm menu/pause/end çizimleri `globalAlpha = menuFadeT` kullanır.
- **Rotor spin (round 10):** `CONFIG.ROTOR.centers` — sprite geometrisine göre rotor merkezleri. Açı = `(simTimeMs/1000) * 18 * (1 + 0.3*speedFactor)`. Yalnız çizim, sim'e dokunmaz.
- **WEAPON (round 10+12):** `CONFIG.WEAPON.levels[3]` — count/interval/offset. Paralel mermi (vx=0). `pu_weapon` %12 LCG drop. Hasarda seviye DOĞRUDAN 1'e düşer (round 12, kademeli değil). `resetFlashMs: 1200` — SİLAH 1 kırmızı yanıp söner. Q tuşu ile elle değiştirme.
- **CLOUDS (round 10):** `CloudLayer` sınıfı. LCG slot tabanlı yerleşim. 185px/s dikey kayma. Max 3 bulut ekranda. Alfa 0.30-0.55.
- **Powerup (round 10+12):** `game.powerups[]` array. `_updatePowerups(dt)` — aşağı süzülme + pickup (30px mesafe). `spawnPowerup(type,x,y)` test kancası. Round 12: `pu_rocket` %8 drop.
- **ENEMIES (round 12):** 6 tip — scout/gunner/shield/bomber/kamikaze/sniper. Her tipin kendi havuzu. `Enemy.update` switch ile tip bazlı davranış. Bomber: 1800ms'de bir 3'lü bomba (vy=200). Kamikaze: zikzak iniş + y>=H/3'te kilitlenir, lockX'e 520px/s dalış. Sniper: y<H/3'te in, sonra telegraph (600ms kırmızı çizgi) + 520px/s mermi.
- **ROCKET (round 12):** `Rocket` sınıfı, `rocketPool` (8). `_updateRockets(dt)` — atış zamanlayıcısı + güdüm + çarpışma. Hedef seçimi: en yakın aktif düşman, eşitlikte en küçük havuz indeksi. Dönüş ≤180°/s. Hasar 3.
- **DRONES (round 12):** `CONFIG.DRONES[4]` — falcon/swift/tank/ghost. `Player(droneId)` constructor'da dron özelliklerini alır. `shipselect` state: `_drawShipSelect`, `toShipSelect()`, `shipSelectLeft/Right()`, `confirmShipSelect()`. Dokunmatik: sol/sağ üçte bir gezinir, orta başlatır. Klavye: ←/→ gezinir, Space başlatır.
