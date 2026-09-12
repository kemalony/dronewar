/* src/audio/audio.config.js — round 19: prosedurel muzik katmani sabitleri. */
/* DIKKAT: `Object.assign(CONFIG, { MUSIC: {...} })` yazilirsa core paketinin
   ayni turda ekledigi MUSIC.intensity/bpm anahtarlari EZILIR ve oyun ilk sim
   adiminda coker (olculdu: TypeError, `intensity.play` undefined). Paylasilan
   anahtar EZILMEZ, GENISLETILIR. */
/* Round 22: fircasiz motor ugultusu (Sound.hover). CONFIG.SOUND core'undur;
   EZMEDEN genisletiyoruz — `Object.assign(CONFIG.SOUND, {...})` maxConcurrent
   ve masterGain'i korur. Ic `hover` nesnesi de varsa uzerine yazilmaz. */
/* Round 23: mix zinciri (limiter + efekt veri yolu + mekan gonderisi) ve
   muzik katman tonlari. Ayni kural: ic nesneler `Object.assign(defaults,
   mevcut)` ile birlestirilir, mevcut degerler kazanir. */
Object.assign(CONFIG.SOUND, {
    hover: Object.assign({
        baseFreq: 85,          // Hz — level=1.0'daki temel frekans
        levelMin: 0.6,         // level kirpma araligi (hiza gore perde/genlik)
        levelMax: 1.0,
        gain: 0.08,            // surekli vizilti seviyesi (atis sesinin onune gecmez)
        amHz: 28,              // rotor donme hissi: genlik modulasyonu frekansi
        amDepth: 0.02,         // modulasyon derinligi (level ile olceklenir)
        attack: 0.15,          // fade-in zaman sabiti (s)
        glide: 0.05,           // perde degisim zaman sabiti (s)
        gainGlide: 0.08,       // genlik degisim zaman sabiti (s)
        release: 0.10,         // fade-out zaman sabiti (s)
        stopMs: 400,           // fade-out sonrasi dugum yikimi (ms)
        harmonics: [
            { mult: 1,   vol: 0.50 },   // temel (sawtooth)
            { mult: 2,   vol: 0.30 },   // 2. harmonik
            { mult: 3,   vol: 0.18 },   // 3. harmonik
            { mult: 4.9, vol: 0.07 },   // yukselton (fritter)
        ],
    }, CONFIG.SOUND.hover || {}),

    /* ---------------------------------------------------------------- mix
       Dinamik yonetimi. Onceden hicbir tavan yoktu: 8 ses ust uste bininca
       toplam genlik 1.0'i asiyor ve dijital kirpilma duyuluyordu.
       Zincir:  efektler -> fxBus (yumusak sikistirici) -> master -> limiter
                hover / muzik        ------------------> master -> limiter
       hover ve muzik fxBus'a GIRMEZ; girseydi her atista motor ugultusu ve
       muzik "pompalanir" (ducking) duyulurdu. */
    mix: Object.assign({
        noiseSec: 2,           // gurultu tamponu (s) — ofset cesitliligi icin
        // master cikis emniyeti: normalde devreye girmez, yalniz tepe keser
        limitThreshold: -3, limitKnee: 6, limitRatio: 8,
        limitAttack: 0.003, limitRelease: 0.18,
        // efekt veri yolu: yogun catismada toplu seviyeyi toparlar
        fxThreshold: -12, fxKnee: 10, fxRatio: 3.5,
        fxAttack: 0.002, fxRelease: 0.14,
        // mekan: kisa geri beslemeli gecikme (konvolusyon yok — mobilde ucuz)
        spaceDelay: 0.085,     // s — tek yansima araligi
        spaceFeedback: 0.30,   // geri besleme (0 = tek yanki)
        spaceTone: 2400,       // Hz — yankinin alcak gecirgen tonu
        spaceGain: 0.45,       // gonderi donusu (0 = mekan kapali)
        priorityReserve: 4,    // oncelikli seslere (oyuncu silahi, olum, boss)
                               // maxConcurrent USTUNE ek yuva. 0 = eski davranis:
                               // 8 yuva dolunca oyuncunun atis sesi de duserdi.
    }, CONFIG.SOUND.mix || {}),
});

Object.assign(CONFIG.MUSIC, {
    gain: 0.28,            // toplam muzik kazanci (efektlerin onune gecmez)
    layerGainMul: 1.0,     // katman genligi carpani
    rootHz: 110,           // A2 — taban perde
    scale: [0, 3, 7, 10],  // dorik yari tonlar (karanlik, sehir uzeri hissi)
    stepMs: 125,           // bir sekil adimi (16 adim = 2 sn cember)
    lookaheadMs: 200,      // ileri planlama penceresi
    tickMs: 80,            // setInterval araligi (< lookahead)
    rampMs: 400,           // katman acma/kapama yumusak gecisi
    thresholds: [0.25, 0.55, 0.55, 1.0],  // bass,pulse,arp,lead acilis yogunlugu
    bassWave: 'sawtooth', bassDur: 0.22, bassVol: 0.42, bassAtk: 0.012,
    pulseWave: 'sine',    pulseHz: 180, pulseDur: 0.05, pulseVol: 0.34,
    arpWave: 'square',    arpDur: 0.16,  arpVol: 0.20,
    leadWave: 'triangle', leadDur: 0.55, leadVol: 0.26, leadAtk: 0.05,

    /* Round 23 — katman tonlari. Dort katman da ham osilatorken hepsi ayni
       bantta ust uste biniyor, toplam bulaniyordu. Her katmana kendi bandi:
       bass alcak gecirgen (saw'in tizi kesilir, agirlik kalir), arp yuksek
       gecirgen (kare dalga bas bolgesini terk eder), lead yumusatilir. */
    layerTone: [
        { type: 'lowpass',  hz: 280,  q: 0.9 },   // 0 bass
        null,                                      // 1 pulse (kendi icinde sekilli)
        { type: 'highpass', hz: 190,  q: 0.7 },   // 2 arp
        { type: 'lowpass',  hz: 2800, q: 0.7 },   // 3 lead
    ],
    /* Hover ugultusu icin bass katmaninda kucuk cukur. Bass notalari
       55/65/82/98 Hz; hover temeli 51-85 Hz — 82 ile 85 ust uste gelince
       saniyede ~3 vurus (beating) duyuluyordu. ZEVK MESELESI: 0 yazilirsa
       cukur kapanir ve eski (dolu ama bulanik) bas geri gelir. */
    hoverDuckHz: 85, hoverDuckQ: 1.1, hoverDuckDb: -5,
    /* Lead: hafif detune'lu ikiz (koro/supersaw kalinligi). voices=1 kapatir. */
    leadVoices: 2, leadSpread: 9,      // cent
    /* Perkusif tik: sinus govde + yuksek gecirgen gurultu ucu. Muzikteki tek
       gurultu kaynagi; osilator corbasindan ayrilmasi icin. 0 = kapali. */
    pulseDropHz: 90,       // govde perdesi bu degere duser (tok tik)
    pulseNoiseVol: 0.16, pulseNoiseHz: 3600, pulseNoiseDur: 0.03,
});
