/* units paketinin kendi sabitleri — CONFIG'i genisletir.
 *
 * Neden ayri dosya: src/core/CONFIG.js yalnizca core ajaninindir.
 * build_order.json icinde core/CONFIG.js'ten SONRA siralanir.            */
/* Dusman halesi (yalnizca cizim): yeşil scout / cyan tonlu tipler parlak
 * sehir karosu ve liman suyu ustunde ayrismiyordu (mimo denetimi, _gnd_a/shot_2,
 * oncelik 4). Cozum oyuncunun halesi deseni (Player.js): govdenin altina
 * carpimsal koyu radyal hale — sim'e dokunmaz, hitbox degismez.
 *
 * radiusMul: cizim kutusunun (s = radius*2) kaci kati — sprite'in TASINA
 * kadar uzanir (oyuncu temas golgesi kurali: tasma olmali).
 * pos/col: Player.js'teki rgba kademe deseninin config'li hali.
 * haloLight: Skimmer icin hafifletilmis surum (liman sahnesi, yandan giris).
 *
 * Dikkat: `CONFIG.ENEMY = {...}` YAZMA — burada yeni anahtar aciliyor ama
 * desen olarak Object.assign korunsun; baska paket alan eklerse ezilmez. */
CONFIG.ENEMY = Object.assign(CONFIG.ENEMY || {}, {
  halo: {
    radiusMul: 1.05,       // hale yaricapi = cizim kutusu x 1.05 (tasma var)
    innerMul: 0.15,        // ic baslangic yaricapi (gradeyanin ic cukuru)
    pos: [0, 0.45, 0.75, 1],
    col: ['rgba(3,6,12,0.55)', 'rgba(3,6,12,0.34)',
          'rgba(3,6,12,0.14)', 'rgba(3,6,12,0)'],
  },
  haloLight: {
    radiusMul: 1.0,
    innerMul: 0.15,
    pos: [0, 0.45, 0.75, 1],
    col: ['rgba(3,6,12,0.40)', 'rgba(3,6,12,0.22)',
          'rgba(3,6,12,0.09)', 'rgba(3,6,12,0)'],
  },
});

/* Mermi kontrast halesinin BICIMI (yalnizca cizim, Bullet.drawPool).
 *
 * Round 21'de hale 4 kademeli DIKDORTGEN fillRect'ti; vision denetimi üç
 * karede tekrarladi: "harmanlanmamis siyah dikdortgen golgeler, kenarlar
 * cok keskin" (shot_1/shot_3/_contrast, P2-3). Cozum bicim degisikligi:
 * her kademeyi round-cap cizgi (kapsul) olarak cizmek — ucler yuvarlanir,
 * yatayda 6 ince kademeli katman kenar bantlanmasini eritir.
 *
 * widths: CONFIG.BULLET.w'nin kati (carpisma kutusuna dokunmaz).
 * alphas: katman basina carpimsal siyah alfa; birikimli tepe karanlik
 * ~0.83 — eski 4 kademeli desene (~0.81) gore ALTIN DEGIL, ustu.
 * foreground_contrast kapisinin 60 esigine ayni marjla hizmet eder.
 *
 * Dikkat: CONFIG.FX.tracer'a buradan anahtar EKLENMEZ — fx.config.js
 * build sirasinda bundan sonra calisir ve tracer nesnesini komple
 * atar. Bu yuzden hale bicimi BULLET altinda, units'e ait anahtarda. */
Object.assign(CONFIG.BULLET, {
  halo: {
    widths: [6.3, 5.2, 4.1, 3.0, 2.0, 1.2], // kapsul kademeleri (bw kati)
    alphas: [0.24, 0.20, 0.22, 0.24, 0.28, 0.34], // katman alfalari
  },
});

CONFIG.SUBDRONE = Object.assign(CONFIG.SUBDRONE || {}, {
  pool: 2,                // havuz boyutu (2 mini refakatci)
  offset: 34,             // oyuncunun yanindaki mesafe (px)
  followSmooth: 10,       // yumusak gecikme (1/s) — kritik sonumlu yaklasim
  fireIntervalMs: 190,    // namlu modu ates araligi
  size: 48,               // cizim boyutu (manifest sub_drone 48x48)
});
/* Jammer dronu: ateş ETMEZ; ekranda kaldigi surece oyuncuyu zayiflatir.
 * Oyuncu radius icindeyken birincil ates araligi fireSlowMul kadar yavaslar.
 * Havuz 4, onceden ayrilmis; Math.random YASAK (LCG).
 *
 * DIKKAT: `CONFIG.JAMMER = {...}` YAZMA — core/CONFIG.js bu anahtara
 * hp / score / glitchLevel koyuyor; komple atama o ucunu de siliyordu.
 * glitchLevel silindigi icin Game._updateJammerFx() undefined gonderiyor,
 * FxSystem.setAmbientGlitch `level || 0` ile 0'a cekiyor ve jammer menzil
 * glitch'i hic cizilmiyordu. Paylasilan anahtar EZILMEZ, genisletilir. */
Object.assign(CONFIG.JAMMER, {
  pool: 4,                // havuz boyutu
  speed: 55,              // px/s — yavas inis
  hoverY: CONFIG.H * 0.30,   // ekranin ust yarısında kalmaya calisir
  swayAmp: 70,            // yatay salinim genligi (px)
  swayPeriod: 4,          // salinim periyodu (s)
  radius: 200,            // jamming menzili (px) — oyuncu merkezine uzaklik
  fireSlowMul: 0.5,       // menzil icinde ates araligi carpani (yavaslatma)
  size: 80,               // cizim boyutu (manifest drone_jammer 80x72)
  ringPulse: 1.6,         // nabiz halka frekansi (rad/s) — yalniz cizim
});
/* Cok asamali tasici boss (bolum 4 / Tokyo): parcalar sirayla cokertilir.
 * Sira: iki yan pilon -> kargo kapagi -> komuta anteni -> govde.
 * Govde ancak anten dustuktan sonra hasar alir. Her parcain kendi sprite'i
 * ve can'i var; dusen parca patlar ve o parcain saldirisi durur.
 * Tum zamanlama sim zamanina bagli; performance.now() YOK.
 * CARRIER'in TEK tanimi burasidir: core/CONFIG.js'teki eski blok (bodyHp 40 +
 * dizi seklinde parts) Carrier.js'in okudugu sekle uymuyordu, olu koddu ve
 * silindi. game.config.js bunun uzerine Object.assign ile ekleme yapar. */
CONFIG.CARRIER = Object.assign(CONFIG.CARRIER || {}, {
  entryMs: 1800,          // giris inişi (ustten -> hoverY)
  hoverY: 150,            // salinim merkezi (y)
  swayAmp: 45,            // yatay salinim genligi (px)
  swayPeriod: 5,          // salinim periyodu (s)
  score: 2500,            // tam olum skoru
  deathExplosions: 8,     // govde olumunde patlama sayisi
  deathWindowMs: 600,     // ...bu sure icinde esit araliklarla
  flashMs: 350,           // kisa ekran parlamasi
  bodyHp: 60,             // govde can'i (anten dustuktan sonra acilir)
  parts: {
    pylonL:  { sprite: 'boss_pylon',   hp: 30, w: 72, h: 88 },
    pylonR:  { sprite: 'boss_pylon',   hp: 30, w: 72, h: 88 },
    bay:     { sprite: 'boss_bay',     hp: 40, w: 88, h: 72 },
    antenna: { sprite: 'boss_antenna', hp: 35, w: 64, h: 64 },
  },
  /* Parca konumlari: govde merkezine gore ofsetler (cizim + hitbox).
     Pilonlar iki yanda, kargo kapagi altta ortada, anten ustte ortada. */
  partOffsets: {
    pylonL:  { x: -100, y: -10 },
    pylonR:  { x: 100,  y: -10 },
    bay:     { x: 0,    y: 55 },
    antenna: { x: 0,    y: -70 },
  },
  /* Atis desenleri (parca bazli). Araliklar ms; 0 = o desen yok. */
  pylonFireMs: 1300,      // pilon top atesi: nişanlı 3'lü yelpaze
  bayLaunchMs: 2600,      // kargo kapagi: dusman dronu firlatma araligi
  antennaJamRadius: 180,  // anten jammer alanı yaricapi (px)
  antennaJamMul: 0.6,     // anten menzilde ates araligi carpani
  bulletSpeed: 300,       // boss mermisi px/s
});

/* Round 17: skimmer — limanin deniz tarafindan YANDAN giren alcak ucuslu dronu.
   Yalnizca liman bolumunde dogar; ekrani yatay gecer, oyuncunun bandina gelince
   BIR KEZ uclu seri atar. Paylasilan anahtar ezilmez, CONFIG genisletilir. */
Object.assign(CONFIG, {
  SKIMMER: {
    pool: 6,
    hp: 2,
    score: 350,
    speed: 300,          // px/s yatay
    waveAmp: 26,         // dikey salinim genligi (px)
    waveHz: 0.9,         // salinim frekansi
    fireMs: 1200,        // oyuncu bandina girdikten sonraki atis kilidi
    burst: 3,
    burstGapMs: 120,
    bulletSpeed: 320,
    bandY: 90,           // oyuncu ile dikey fark bu esigin altindaysa ates acar
    w: 72, h: 40,
    radius: 22,
    spawnIntervalMs: 2600,   // liman bolumunde dogus araligi
    maxConcurrent: 2,
  },
});
