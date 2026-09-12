const CONFIG = {
  W: 480, H: 800,                 // ic cozunurluk
  SIM_HZ: 120,                    // sabit adim sim (akumulator)
  MAX_DT: 1 / 30,                 // rawDt ust siniri
  PLAYER: {
    maxSpeed: 400,                // px/s
    accel: 2200,                  // px/s^2
    decayHalfLife: 0.12,          // girdi yokken ustel sonum yaromuru (s)
    size: 96,                     // hitbox karesi (sprite boyu)
    half: 48,
    r: 48,                        // sinir kelepcesi icin yaricap
    followSpeed: 1500,            // dokunmatik birebir takipte en yuksek kapanma hizi
    DASH: { ms: 180, speedMul: 3, cooldownMs: 2500, trailLen: 6, trailGap: 4 },
  },
  BULLET: {
    speed: 850,                   // px/s yukari
    life: 1.2,                    // s
    w: 6, h: 14,
  },
  EBULLET: {
    speed: 260,                   // px/s asagi
    life: 4.0,                    // s (ekranda kalma payi)
  },
  FIRE: { interval: 0.130, pool: 96, muzzleMs: 60 },
  ENEMY_BULLET_POOL: 32,
  ENEMIES: {
    scout:  { sprite: 'drone_scout',  hp: 1, score: 100, speed: 260, radius: 22 },
    gunner: { sprite: 'drone_gunner', hp: 3, score: 250, speed: 110, radius: 31, fireInterval: 1.5 },
    shield: { sprite: 'drone_shield', hp: 3, score: 400, speed: 140, radius: 34, shieldHp: 3 },
    /* Round 12: uc yeni tip — hepsi tek LCG'den beslenir (Game._lcg). */
    bomber:   { sprite: 'drone_bomber',   hp: 5, score: 350, speed: 90,  radius: 33, bombMs: 1800 },
    kamikaze: { sprite: 'drone_kamikaze', hp: 1, score: 150, speed: 260, radius: 20, lockSpeed: 520 },
    sniper:   { sprite: 'drone_sniper',   hp: 2, score: 300, speed: 0,   radius: 28, telegraphMs: 600, fireMs: 2200, bulletSpeed: 520 },
  },
  SPAWN: { base: 1600, variance: 500 },   // ms
  PLAYER_LIVES: 3,
  INVINCIBLE_MS: 1200,
  SCROLL: { speed: 120 },         // zemin dikey kayma px/s
  PARALLAX: {
    cityShift: 30,                // oyuncu x (-1..1) -> karo yatay kayma (px)
    /* Karo ekrandan buyuk cizilir ki kayarken kenar acilmasin. Pay her iki yanda
       (W*tileZoom - W)/2. 1.10'da bu 24 px'ti ve maksimum kayma da tam 24 px --
       artan pay SIFIRDI, yani sag kenara dayanip sarsinti almak karonun kenarini
       ekrana sokuyor ve altindan SIYAH gorunuyordu (olculdu 2026-09-12).
       1.18 -> pay 43.2 px; kayma 24 + en buyuk sarsinti 14 = 38, artan +5.2 px.
       DIKKAT: bunu degistirmek gorunur dikis satirini (H/tileZoom) kaydirir --
       karolarin ton harmanlamasi o satirda yapilir, tools/blend_tiles.py ile
       TEMIZ TABANDAN yeniden calistirilmali. tools/tile_seam_check.py ikisini de
       olcer. */
    tileZoom: 1.18,
    buildingShift: 38,            // oyuncu x (-1..1) -> bina katmani kayma (px)
    leanMaxDeg: 2,                // hizli yana giderken sahne egimi (derece, yalniz cizim)
    smooth: 8,                    // soneum hizi (1/s) — kritik sonumlu yaklasim
    buildingSpeed: 170,           // bina katmani dikey hiz (zemin 120'den hizli)
    maxBuildings: 6,              // ekranda ayni anda en fazla bina
    landmarkInterval: 4500,       // sim ms — landmark bir kez gecis araligi
    buildingScaleMin: 0.45,       // bina cizim olcegi: manifest boyutunun 0.45-0.65'i
    buildingScaleMax: 0.65,
    buildingDim: 0.92,            // bina katmani zemine gore hafif koyu (ayni gece isigi)
    buildingShadowAlpha: 0.35,    // bina altindaki yumusak golge elipsi
  },
  RES: {                          // uyarlabilir cozunurluk
    minScale: 1, maxScale: 2,
    windowFrames: 40,            // medyan son 40 kare
    dropBelow: 20,               // ms -> ornegi dusur
    raiseAbove: 17.2,            // ms -> ornegi cikar
    changeInterval: 1,           // sn'de en fazla bir degisiklik
  },
  FX: {                           // vuruş geri bildirimi + zengin patlama (round 10)
    hitFlashMs: 90,              // beyaz tint'lenmiş sprite parlamasi omru
    flashMs: 110,                // boom_flash: lighter, 0.4→2.0 olcek, alfa 1→0
    fireMs: 260,                 // boom_fire: lighter, 0.55→2.1 olcek, (1-t)^2.8 sonum
    smokeDelay: 0.21,            // boom_smoke gecikmesi (s)
    smokeMs: 560,                // boom_smoke omru
    smokeMaxAlpha: 0.16,         // duman maks alfa
    shockMaxR: 34,               // sok dalgasi maksimum yaricap (px)
    shockMs: 190,                // sok dalgasi omru
    sparksPerExplosion: 14,      // patlama basina kivilcim (<= 14)
    sparkPool: 110,              // ayni anda cizilen parcalik siniri (<= 110)
    sparkLifeMin: 0.25,          // kivilcim omru araligi (s)
    sparkLifeMax: 0.5,
    sparkSpeedMin: 60,           // kivilcim hiz araligi (px/s)
    sparkSpeedMax: 220,
  },
  STAGES: [
    { city: 'istanbul', name: 'İSTANBUL', quota: 15, spawnMul: 1.00, enemySpeedMul: 1.00, ebulletSpeed: 260, gunnerFireMs: 1500, maxConcurrent: 4 },
    { city: 'paris',    name: 'PARIS',    quota: 20, spawnMul: 0.85, enemySpeedMul: 1.10, ebulletSpeed: 275, gunnerFireMs: 1400, maxConcurrent: 4 },
    { city: 'newyork',  name: 'NEW YORK', quota: 25, spawnMul: 0.72, enemySpeedMul: 1.20, ebulletSpeed: 300, gunnerFireMs: 1300, maxConcurrent: 6 },
    { city: 'tokyo',    name: 'TOKYO',    quota: 30, spawnMul: 0.62, enemySpeedMul: 1.30, ebulletSpeed: 320, gunnerFireMs: 1100, maxConcurrent: 6 },
    /* Round 16: liman — kara hedefleri YALNIZCA bu bolumde (ground:true). */
    { city: 'port',     name: 'LİMAN',    quota: 35, spawnMul: 0.55, enemySpeedMul: 1.35, ebulletSpeed: 330, gunnerFireMs: 1000, maxConcurrent: 6, ground: true },
  ],
  BOSS: {
    /* Boss canı + desenler bölüm bazlı (round 8). Desenler birikimli:
       1: yelpaze | 2: +daire | 3: +çapraz tarama | 4: üçü birden, aralık %20 kısa */
    hp: [60, 90, 120, 160, 200],
    /* Round 16: tasici boss finale kaydi — bolum 5 sprite'i okunmayacak
       (tasici kendi parcalarini kullanir), ama dizi STAGES.length kadar. */
    sprite: ['boss_gunship', 'boss_paris', 'boss_newyork', 'boss_tokyo', 'boss_tokyo'],  // bolum bazli (round 11)
    fanMs:      [1100, 1100, 1100, 880, 820],   // nişanlı 3'lü yelpaze
    ringMs:     [0,    1500, 1500, 1200, 1100],  // 12'li dairesel patlama (0 = yok)
    sweepMs:    [0,    0,    2000, 1600, 1400],  // iki taraftan çapraz tarama (0 = yok)
    bulletSpeed: 300,                       // boss mermisi px/s
    warnMs: 1200,                           // kota dolunca DIKKAT uyarısı
    entryMs: 1500,                          // kapalı formda iniş (üstten -> y=150)
    hoverY: 150,                            // salınım merkezi
    swayAmp: 70,                            // yatay salınım genliği (px)
    swayPeriod: 3,                          // salınım periyodu (s)
    size: 208,                              // cizim boyutu (manifest)
    radius: 64,                             // hitbox yaricapi
    score: 1000,
    deathExplosions: 6,                     // olumde 6 patlama
    deathWindowMs: 500,                     // ...500 ms icinde
    flashMs: 300,                           // kisa ekran parlamasi
  },
  /* Round 14: jammer — menzildeki oyuncuyu yavaslatan karisiklik dronu. */
  JAMMER: {
    hp: 4,
    score: 400,
    speed: 95,                              // px/s asagi
    radius: 200,                            // etki menzili (px)
    fireSlowMul: 0.6,                       // menzilde birincil ates araligi carpani
    glitchLevel: 0.5,                       // cizim glitch yogunlugu (0..1)
  },
  /* Round 14: cok asamali boss (CARRIER) BURADA TANIMLI DEGIL.
     Tanim units/units.config.js icindedir: Carrier.js parcalari id'ye gore
     anahtarlanmis bir nesne olarak okur, buradaki dizi sekli olu koddu ve
     units'in komple atamasi tarafindan zaten siliniyordu.                */
  /* Round 16: kara hedefleri. YALNIZCA ground:true olan bölümde doğar.
     Kara hedefi zemine ÇİVİLİDİR: dünya koordinatında durur, ekran konumu
     city.dist'ten türetilir — zeminle birebir aynı hızda kayar (uçan bina olmaz). */
  GROUND: {
    pool: 8,                 // havuz boyutu
    spacing: 520,            // iki hedef arası dünya mesafesi (px)
    marginX: 70,             // kenardan asgari uzaklık
    shadowDx: 7, shadowDy: 12, shadowAlpha: 0.45,   // sert temas gölgesi
    hitPad: 4,               // hitbox sprite'tan bu kadar içeride
    types: {
      radar:  { sprite: 'gnd_radar',  hp: 6,  score: 300, w: 56, h: 80,
                enemyFireMul: 0.8 },      // sağken düşman ateş aralığı çarpanı
      aa:     { sprite: 'gnd_aa',     hp: 10, score: 500, w: 64, h: 72,
                fireMs: 1600, burst: 3, burstGapMs: 140, bulletSpeed: 300,
                range: 620,               // menzil içindeyken nişanlı seri atış
                /* Round 17: mermi hedefe kadar gitmez, hedefin biraz ÖNÜNDE
                   havada patlar (flak). Ömür = mesafe/hız * flakLead. */
                flakLead: 0.85, flakMinS: 0.35, flakMaxS: 2.0 },
      jammer: { sprite: 'gnd_jammer', hp: 8,  score: 450, w: 48, h: 64,
                radius: 180, fireSlowMul: 0.6 },   // hava jammer'ı ile aynı etki
    },
  },
  CROSSFADE_MS: 1500,
  STAGE_TITLE_MS: 1800,        // bolum karti: amblem + ad (round 8)
  SHAKE: {
    playerHitMs: 260,          // oyuncu hasar alinca sarsinti suresi
    bossDeathMs: 500,          // boss olumunde sarsinti suresi
    playerAmp: 8,              // px (maksimum kayma)
    bossAmp: 14,               // px
  },
  HITSTOP: {
    enemyMs: 45,               // dusman olumunde sim duraklamasi
    bossMs: 120,               // boss olumunde sim duraklamasi
  },
  WEAPON: {                    // silah yukseltmesi (round 10): uc seviye, PARALEL mermi
    levels: [
      { count: 1, interval: 0.130, offset: 0 },       // seviye 1: duz
      { count: 2, interval: 0.115, offset: 14 },      // seviye 2: ±14 px paralel
      { count: 3, interval: 0.100, offset: 26 },      // seviye 3: ±26 px paralel
    ],
    maxLevel: 3,
    dropChance: 0.12,         // dusman olumunde pu_weapon duses olasiligi (LCG)
    fallSpeed: 70,            // powerup asagi suzuleme hizi (px/s)
    shieldMs: 6000,           // pu_shield kalkan sure (ms)
    overMaxScore: 500,        // seviye 3'te alinca bonus puan
    resetFlashMs: 1200,       // hasarda SİLAH 1 yanip sonek suresi (round 12)
  },
  /* Round 12: kazanilabilir roket — normal atisa EK olarak hafif gaitli. */
  ROCKET: {
    pool: 8,                  // kendi havuzu
    speed: 520,               // px/s
    turnRate: 180,            // derece/san — maks donus hizi
    damage: 3,                // isabette hasar
    fireMs: 900,              // aralik (roket aktifken)
    durationMs: 15000,        // alininca kalan sure
    dropChance: 0.08,         // dusman olumunde %8 (LCG)
    size: 44,                 // cizim boyutu (manifest rocket 20x44 -> 2x)
  },
  /* Round 12: bonusla acilan dron secimi. En yuksek skor bellekte tutulur;
     kilitler bestScore'a gore acilir. falcon baslangicta acik.             */
  DRONES: [
    { id: 'falcon', sprite: 'drone_player', speed: 400, lives: 3, unlock: 0,     desc: 'dengeli' },
    { id: 'swift',  sprite: 'drone_swift',  speed: 520, lives: 2, unlock: 5000,  desc: 'ates araligi %15 kisa' },
    { id: 'tank',   sprite: 'drone_tank',   speed: 320, lives: 5, unlock: 12000, desc: 'hitbox %15 buyuk, silah 2 baslar', hitboxMul: 1.15, startWeapon: 2 },
    { id: 'ghost',  sprite: 'drone_ghost',  speed: 440, lives: 3, unlock: 25000, desc: 'hasar sonrasi dokunulmazlik 2000 ms', invincibleMs: 2000 },
  ],
  ROTOR: {                     // rotor spin efekti (round 10) — yalniz cizim
    speed: 18,                 // rad/s taban donus hizi
    speedBoost: 0.30,          // oyuncu hizlandikca %30'a kadar artis
    blurAlpha: 0.15,           // rotor altindaki bulaniklik halkasi (<= 0.18)
    /* Rotor merkezleri sprite geometrisine gore (sprite koordinatlari, merkezden).
       Oyuncu 4 kose, scout 4, gunner 6, shield 8, boss 2 buyuk halka. */
    centers: {
      drone_player: [[-30,-30],[30,-30],[-30,30],[30,30]],
      drone_scout:  [[-18,-18],[18,-18],[-18,18],[18,18]],
      drone_gunner: [[-28,-22],[0,-26],[28,-22],[-28,22],[0,26],[28,22]],
      drone_shield: [[-30,-30],[0,-34],[30,-30],[30,0],[30,30],[0,34],[-30,30],[-30,0]],
      boss_gunship: [[-70,0],[70,0]],
    },
    radii: {
      drone_player: 22, drone_scout: 15, drone_gunner: 17, drone_shield: 20,
      boss_gunship: 58,   // buyuk halka -> daha yavas doner
    },
    /* Boss rotorlari (round 11): her boss icin merkezler + IC yaricaplar
       (sprite koordinatlari, merkezden). Efekt halkanin IC capina oturur:
       buyuk halka ~10 rad/s (yavas), kucuk olan hizli (taban 18). */
    bossRotors: {
      boss_gunship: [
        { x: -70, y: 0, innerR: 52, speed: 10 },   // buyuk halka: yavas
        { x: 70,  y: 0, innerR: 34, speed: 18 },   // kucuk halka: hizli
      ],
      boss_paris: [
        { x: -66, y: 0, innerR: 50, speed: 10 },
        { x: 66,  y: 0, innerR: 34, speed: 18 },
      ],
      boss_newyork: [
        { x: -70, y: 0, innerR: 52, speed: 10 },
        { x: 70,  y: 0, innerR: 32, speed: 18 },
      ],
      boss_tokyo: [
        { x: -68, y: 0, innerR: 50, speed: 10 },
        { x: 68,  y: 0, innerR: 36, speed: 18 },
      ],
    },
  },
  CLOUDS: {                    // bulut katmani (round 10+11) — sehir uzerinde, dronlar altinda
    speed: 185,                // dikey kayma px/s (zemin 120'den hizli — yukseklik hissi)
    hShift: 70,                // oyuncu x (-1..1) -> yatay kayma (px); TERS yonde (zeminden guclu)
    maxClouds: 3,              // ekranda ayni anda en fazla bulut
    alphaMin: 0.28, alphaMax: 0.55,
    scaleMin: 0.7, scaleMax: 1.3,   // her dogustaki olcek araligi (round 11)
    driftAmp: 14,              // yatay suruklenme genligi (px)
    driftPeriod: 9,            // yatay suruklenme periyodu (s)
    spacing: 620,              // bulut araligi (px, dist uzayinda)
    smooth: 8,                 // yatay soneum hizi (1/s) — zeminle ayni karakter
  },
  MENU_FADE_MS: 150,           // menu/pause/gameover yumusak gecis
  SOUND: {
    maxConcurrent: 8,          // ayni anda en fazla aktif ses
    masterGain: 0.7,
  },
  /* Round 19: prosedürel müzik. Varlık yok — WebAudio ile üretilir. Yoğunluk
     (intensity) oyun durumuna göre değişir: menü sakin, oyun orta, boss gergin. */
  MUSIC: {
    bpm: 104,
    bassNotes: [55.00, 61.74, 49.00, 58.27],   // Hz — dört ölçülük döngü
    arpNotes: [220.00, 261.63, 329.63, 392.00],
    layers: ['bass', 'pulse', 'arp', 'lead'],  // yoğunluk arttıkça sırayla açılır
    intensity: { menu: 0.25, play: 0.55, boss: 1.0, victory: 0.4 },
    rampMs: 900,        // yoğunluk değişiminde yumuşak geçiş
    gain: 0.16,         // ana müzik seviyesi (efektlerin ÖNÜNE geçmesin)
  },
  /* Isisi sistemi (round 13): tek kaynak — diger paketler buradan okur.
     BIRINCIL ATIS IS HARCAMAZ: dokunmatikte otomatik ates var, oyuncuyu
     cezalandirmak olurdu. Is yalnizca dash / roket / sub-drone lansmaninda. */
  HEAT: {
    max: 100,
    cooldownPerSec: 28,        // isin saniyede dusus hizi
    overheatAt: 100,           // bu seviyede asiri sicaklik -> kilit
    recoverAt: 55,             // kilidin acilmasi icin isi bu seviyeye inmeli
    cost: { dash: 22, rocket: 14, subLaunch: 30 },
    overheatFireMul: 0.55,     // asiri sicaklikta birincil ates araligi carpani
  },
  /* Round 18: kombo — art arda öldürmede skor çarpanı. Zamanlayıcı her öldürmede
     yenilenir; süre dolunca çarpan 1'e döner. Shmup'ların temel keyif döngüsü. */
  COMBO: {
    windowMs: 2600,        // bir sonraki öldürme için süre
    step: 1,               // her öldürme kombo sayacını bu kadar artırır
    tiers: [3, 6, 10, 16], // bu sayılara ulaşınca çarpan yükselir
    mults: [1, 2, 3, 4, 5],// tier'lara karşılık gelen çarpanlar (ilk eleman taban)
    maxMult: 5,
  },
  /* Round 18: onarım kutusu — nadir düşen can yenileme. */
  REPAIR: {
    dropChance: 0.05,      // öldürülen düşman başına (LCG)
    heal: 1,               // kaç can ekler
    maxLives: 3,           // bu sayının üstüne çıkarmaz
    score: 250,            // can zaten doluysa bunun yerine puan
  },
  /* Round 20: oyun sonu istatistikleri — oyuncu neyi ne kadar iyi yaptığını görsün. */
  STATS: {
    storageKey: 'dronewar_best_v1',   // localStorage anahtarı (en iyi skor + rekorlar)
    rows: ['score', 'kills', 'bestCombo', 'accuracy', 'timeMs'],
  },
  /* Round 20: kısa ipuçları — ilk koşuda, oyun akışını kesmeden. */
  TIPS: {
    showMs: 2600,        // bir ipucu ekranda bu kadar kalır
    gapMs: 1200,         // iki ipucu arası boşluk
    onlyFirstRuns: 2,    // yalnızca ilk iki koşuda gösterilir
    list: [
      'PARMAĞINI SÜRÜKLE — DRON TAKİP EDER',
      'DOKUNUNCA OTOMATİK ATEŞ',
      'KUTULARI TOPLA — SİLAH SEVİYESİ ARTAR',
      'ART ARDA VUR — SKOR ÇARPANI YÜKSELİR',
      'HASAR ALINCA ÇARPAN SIFIRLANIR',
    ],
  },
  DEBUG: false, AUTOTEST: false,
};

/* --------------------------------------------------------------- MANIFEST
   assets/manifest.json ile birebir ayni. GOMULU: file:// altinda fetch()
   bloklanir ve oyun sessizce prosedurele duserdi — bu hatayi tekrar etme.   */
