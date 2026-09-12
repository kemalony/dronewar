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

    /* ---------------------------------------------------------------- sfx
       Round 25: GERCEK KAYITLI ORNEKLER. Cikartmali sentez (osilator ->
       zarf -> filtre) bir tavana carpti — "web'deki sesler cok basitti".
       Banka `src/audio/sfx.data.js` icinde base64 Ogg/Vorbis olarak GOMULU
       (22 kHz mono). Neden gomulu: file:// altinda fetch/XHR bloklu, disaridan
       yuklenen ses `createMediaElementSource` ile baglaninca SESSIZ geliyor
       (tainted, tuval `toDataURL` taintiyle ayni sinif). atob + decodeAudioData
       hic agdan gecmez: olculen analiz tepe degeri 0.506, ve WebAudio'nun tam
       kontrolu (ust uste binme, perde, pan, kompresor zinciri) korunur.

       Ornekler ayni mix zincirinden gecer: kaynak -> zarf -> yuva -> [pan]
       -> fxBus -> master -> limiter. Tek istisna hover: o KASTEN dogrudan
       master'a baglidir (yukaridaki mix notuna bak).

       Banka cozulene kadar VE bir ornek cozulemezse prosedurel ses devrede
       kalir — sessizlik sentetik biptan kotudur.

       Kaynak: Kenney 'Sci-Fi Sounds' — CC0 (kamu mali). */
    sfx: Object.assign({
        enabled: true,         // false = tumuyle prosedurel sese don
        gain: 1.0,             // banka geneli kazanc olcegi
        chunk: 3,              // tek turda base64'ten cozulen ornek sayisi
                               // (acilista ana is parcaciği kitlenmesin)
        detuneCents: 70,       // varsayilan +-perde sapmasi (cent)
        gainJitter: 0.14,      // +-genlik sapmasi (oran)
        fadeIn: 0.0015,        // tik onleyici mikro atak (s) — SIFIR DEGIL
        fadeOut: 0.012,        // kuyruk sonu inisi (s)

        /* hover: tek surekli dongu. 'hover' ornegi ADIYLA DEGIL OLCUMLE
           secildi — bes motor kaydi icinde bas/son sureksizligi 0.021
           (digerleri 0.185-0.233), yani dikissiz donen tek kayit bu.
           Seviye (0.6-1.0) playbackRate'e esleniyor: rate = base + span*level
           -> 0.904 .. 1.040. Perdeyi degistirir, dongu dikisini bozmaz. */
        hoverName: 'hover',
        hoverGain: 0.20,       // kayit gercek oldugu icin prosedurel 0.08'den yuksek
        hoverRateBase: 0.70,
        hoverRateSpan: 0.34,

        /* Olay -> ornek esleme. names: sirayla donulen varyantlar (ayni
           dalga formunun saniyede bes kez tekrari yorucuydu).
           gain  : olay kazanci        prio : oncelikli yuva payi
           send  : mekan gonderisi     pan  : panorama genisligi (+-yarisi)
           det   : sabit perde kaydirmasi (cent)
           spread: +-perde sapmasi; 0 = tonlu isaretler akortta kalsin. */
        voices: {
            shot:      { names: ['shot_0', 'shot_1', 'shot_2', 'shot_3'], gain: 0.42, prio: true, send: 0.05, pan: 0.24, spread: 70 },
            eshot:     { names: ['eshot_0', 'eshot_1'], gain: 0.34, send: 0.04, pan: 0.50, spread: 90 },
            bshot:     { names: ['bshot_0'], gain: 0.55, prio: true, send: 0.12, spread: 60 },
            hit:       { names: ['hit_0', 'hit_1', 'hit_2'], gain: 0.32, send: 0.05, pan: 0.40, spread: 110 },
            // kara hedefi: ayni isabet ornekleri, bir tam ses altta (tok, alcak)
            groundHit: { names: ['hit_0', 'hit_1', 'hit_2'], gain: 0.38, send: 0.07, pan: 0.30, det: -400, spread: 90 },
            gdeath:    { names: ['gdeath'], gain: 0.60, prio: true, send: 0.28, pan: 0.24, spread: 70 },
            flak:      { names: ['flak'], gain: 0.44, send: 0.14, pan: 0.60, spread: 120 },
            boom:      { names: ['boom_0', 'boom_1'], gain: 0.56, prio: true, send: 0.22, pan: 0.30, spread: 100 },
            warn:      { names: ['warn'], gain: 0.50, prio: true, send: 0.25, spread: 0 },
            stage:     { names: ['stage'], gain: 0.50, prio: true, send: 0.20, spread: 0 },
            victory:   { names: ['victory'], gain: 0.50, prio: true, send: 0.30, spread: 0 },
        },
    }, CONFIG.SOUND.sfx || {}),
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
