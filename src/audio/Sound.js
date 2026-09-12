/* Fircasiz motor sesi icin yedek sabitler. Asil degerler audio.config.js
   icinde CONFIG.SOUND.hover altindadir; bu nesne yalnizca CONFIG eksikse
   devreye giren guvenli varsayilandir (hicbir cagri hata firlatmasin). */
const HOVER_DEFAULTS = {
  harmonics: [
    { mult: 1,   vol: 0.50 },   // temel
    { mult: 2,   vol: 0.30 },   // 2. harmonik
    { mult: 3,   vol: 0.18 },   // 3. harmonik
    { mult: 4.9, vol: 0.07 },   // yukselton (fritter)
  ],
  baseFreq: 85,     // Hz — level=1.0'daki temel frekans
  levelMin: 0.6, levelMax: 1.0,
  gain: 0.08,       // surekli vizilti seviyesi (efektlerin onune gecmez)
  amHz: 28, amDepth: 0.02,
  attack: 0.15, glide: 0.05, gainGlide: 0.08, release: 0.10, stopMs: 400,
};

/* Mix yedek sabitleri (round 23). Asil degerler CONFIG.SOUND.mix altinda;
   burasi CONFIG eksik/kismi ise devreye giren guvenli taban. */
const MIX_DEFAULTS = {
  noiseSec: 2,               // gurultu tamponu uzunlugu (s) — ofset cesitliligi
  limitThreshold: -3, limitKnee: 6, limitRatio: 8,
  limitAttack: 0.003, limitRelease: 0.18,
  fxThreshold: -12, fxKnee: 10, fxRatio: 3.5,
  fxAttack: 0.002, fxRelease: 0.14,
  spaceDelay: 0.085, spaceFeedback: 0.30, spaceTone: 2400, spaceGain: 0.45,
  priorityReserve: 4,        // oncelikli seslerin ek yuva payi
};

/* Ornek bankasi yedek sabitleri (round 25). Asil degerler
   CONFIG.SOUND.sfx altinda; burasi CONFIG eksik/kismi ise devreye giren
   guvenli taban. Tablo burada da tam duruyor cunku audio.config.js dususe
   gecerse (sira hatasi, ezilen anahtar) ornekler SESSIZCE prosedurele
   dusmesin — bu paket bunu iki kez yasadi. */
const SFX_DEFAULTS = {
  enabled: true, gain: 1.0, chunk: 3,
  detuneCents: 70, gainJitter: 0.14, fadeIn: 0.0015, fadeOut: 0.012,
  hoverName: 'hover', hoverGain: 0.20, hoverRateBase: 0.70, hoverRateSpan: 0.34,
  voices: {
    shot:      { names: ['shot_0', 'shot_1', 'shot_2', 'shot_3'], gain: 0.42, prio: true, send: 0.05, pan: 0.24, spread: 70 },
    eshot:     { names: ['eshot_0', 'eshot_1'], gain: 0.34, send: 0.04, pan: 0.50, spread: 90 },
    bshot:     { names: ['bshot_0'], gain: 0.55, prio: true, send: 0.12, spread: 60 },
    hit:       { names: ['hit_0', 'hit_1', 'hit_2'], gain: 0.32, send: 0.05, pan: 0.40, spread: 110 },
    groundHit: { names: ['hit_0', 'hit_1', 'hit_2'], gain: 0.38, send: 0.07, pan: 0.30, det: -400, spread: 90 },
    gdeath:    { names: ['gdeath'], gain: 0.60, prio: true, send: 0.28, pan: 0.24, spread: 70 },
    flak:      { names: ['flak'], gain: 0.44, send: 0.14, pan: 0.60, spread: 120 },
    boom:      { names: ['boom_0', 'boom_1'], gain: 0.56, prio: true, send: 0.22, pan: 0.30, spread: 100 },
    warn:      { names: ['warn'], gain: 0.50, prio: true, send: 0.25, spread: 0 },
    stage:     { names: ['stage'], gain: 0.50, prio: true, send: 0.20, spread: 0 },
    victory:   { names: ['victory'], gain: 0.50, prio: true, send: 0.30, spread: 0 },
  },
};

class Sound {
  constructor() {
    this.ctx = null;           // AudioContext (ilk etkilesimde olusturulur)
    this.master = null;        // master gain node
    this.muted = false;
    this._active = 0;          // aktif ses sayaci (toplam kazanc siniri)
    this._noiseBuf = null;     // once uretilen gürültü tamponu
    this._hover = null;        // surekli hover sesi (tek instance: {oscs,oscGains,env,lfo,lfoGain})
    this._hoverStop = null;    // sonumleme sonrasi yikim zamanlayicisi (setTimeout id)
    /* Round 23 mix zinciri. hover ve muzik master'a DOGRUDAN baglanir;
       yalniz efektler _fxBus'tan gecer (asagida gerekce var). */
    this._fxBus = null;        // efekt veri yolu (yumusak sikistirici)
    this._limiter = null;      // master cikisi: tepe emniyeti
    this._spaceIn = null;      // mekan (kisa geri besleme gecikmesi) gonderisi
    this._spaceNodes = null;
    /* Mantiksal hover bayragi — sesin GERCEKTEN duyulmasindan BAGIMSIZ.
       Autotest'te ctx askidadir ve hicbir dugum kurulmaz, ama hover DEVREDE
       ise bu bayrak yine true olur; olcum bunu okur (Game.state().sound.hover). */
    this.hoverOn = false;
    this.hoverLevel = 1;       // son istenen seviye (0.6-1.0)
    /* DETERMINIZM: ses tarafinda Math.random() YOK. Gurultu tamponu ve atis
       basina varyasyon bu iki sayactan turetilir. Sim ne _seed'i ne _varN'i
       okur/yazar; Sound sim durumuna hicbir sey yazmaz. Sim LCG'lerine de
       DOKUNMAZ — dokunsaydi altin iz catallanirdi. */
    this._seed = 0x1a2b3c4d | 0;
    this._varN = 0;
    /* ------------------------------------------- ornek bankasi (round 25)
       Gomulu base64 Ogg -> AudioBuffer. `unlock()`te asenkron cozulur; o ana
       kadar (ve bir ornek cozulemezse) PROSEDUREL ses devrededir. */
    this._bank = {};           // ad -> AudioBuffer
    this._bankOn = false;      // cozme baslatildi mi (tek sefer)
    this._bankFail = 0;        // cozulemeyen ornek sayisi
    /* Varyant sirasi. `_varN` gibi: yalniz Sound okur/yazar, sim ne okur ne
       yazar, Math.random YOK. Hash DEGIL saf sira — hash ile art arda ayni
       varyanta dusmek mumkundu, sira ile dort atista dort ornek garanti. */
    this._rotN = 0;
    this._lastSrc = '';        // 'sample' | 'proc' — olcum kancasi
    this._lastVar = '';        // calinan ornegin adi
    this._hoverOld = null;     // prosedurel -> ornek gecisinde sonen eski hover
    this._hoverOldT = null;
    this.music = new Music();  // katmanli prosedurel muzik (round 19)
    this._musicWasPlaying = false;
    this.music.attach(this);
  }
  /* ---------------------------------------------- deterministik varyasyon */
  _rndBits() { this._seed = (Math.imul(this._seed, 1664525) + 1013904223) | 0; return this._seed; }
  _rnd01() { return ((this._rndBits() >>> 8) & 0xffffff) / 0x1000000; }
  /* Atis basina 0..1 arasi kucuk varyasyon. Sayac tabanli (saat degil), yani
     tekrarlanabilir; sim tarafindan ne okunur ne yazilir. */
  _var() {
    this._varN = (this._varN + 1) & 0x3fffffff;
    let n = this._varN | 0;
    n = Math.imul(n ^ (n >>> 15), 0x2545f491) | 0;
    n = (n ^ (n >>> 13)) | 0;
    return ((n >>> 8) & 0xffff) / 0x10000;
  }
  _mix(k) {
    const m = (typeof CONFIG !== 'undefined' && CONFIG.SOUND && CONFIG.SOUND.mix) || null;
    if (m && m[k] != null) return m[k];
    return MIX_DEFAULTS[k];
  }
  _mkComp(th, knee, ratio, atk, rel) {
    try {
      const c = this.ctx.createDynamicsCompressor();
      c.threshold.value = th; c.knee.value = knee; c.ratio.value = ratio;
      c.attack.value = atk; c.release.value = rel;
      return c;
    } catch (e) { return null; }
  }
  /* ------------------------------------------------ ornek bankasi (round 25)
     Olcum kancalari (tools/gate_sfx.py sozlesmesi). */
  bankSize() { let n = 0; for (const k in this._bank) if (this._bank[k]) n++; return n; }
  bankFailed() { return this._bankFail; }
  lastSource() { return this._lastSrc; }
  lastVariant() { return this._lastVar; }
  _sfx() {
    const s = (typeof CONFIG !== 'undefined' && CONFIG.SOUND && CONFIG.SOUND.sfx) || null;
    return s || SFX_DEFAULTS;
  }
  _voice(k) {
    const S = this._sfx();
    return (S.voices && S.voices[k]) || SFX_DEFAULTS.voices[k] || null;
  }
  /* base64 -> Uint8Array. atob tarayicida her zaman var; yine de cagiran
     try icinde tutuluyor (bir ornek patlarsa banka tumuyle dusmesin). */
  _b64(s) {
    const bin = atob(s);
    const n = bin.length;
    const u8 = new Uint8Array(n);
    for (let i = 0; i < n; i++) u8[i] = bin.charCodeAt(i);
    return u8;
  }
  /* Bankayi coz. Idempotent; ctx yoksa hicbir sey yapmaz.
     PARCALI: 18 ornegin base64 cozumu tek karede yapilirsa ilk dokunusta
     gorunur bir takilma olur. `chunk` kadarini isler, kalanini bir sonraki
     goreve birakir. decodeAudioData zaten asenkron ve ctx ASKIDAYKEN DE
     calisir — autotest'te de banka dolar. */
  _bankStart() {
    if (this._bankOn || !this.ctx) return;
    const S = this._sfx();
    if (S.enabled === false) return;
    if (typeof SFX_DATA === 'undefined' || !SFX_DATA) return;
    this._bankOn = true;
    let names;
    try { names = Object.keys(SFX_DATA); } catch (e) { return; }
    const step = Math.max(1, S.chunk || 3);
    const run = (i) => {
      for (let k = 0; k < step && i + k < names.length; k++) {
        this._decode(names[i + k], SFX_DATA[names[i + k]]);
      }
      if (i + step < names.length) setTimeout(() => run(i + step), 0);
    };
    run(0);
  }
  /* Tek ornek. `done` bayragi SART: Chrome hem geri cagriyi cagirir hem de
     sozu cozer — ikisini de saymak banka boyutunu ikiye katlardi. */
  _decode(name, b64) {
    let done = false;
    const ok = (buf) => {
      if (done) return;
      done = true;
      if (buf) { this._bank[name] = buf; this._bankReady(name); }
      else this._bankFail++;
    };
    const bad = () => { if (done) return; done = true; this._bankFail++; };
    try {
      const u8 = this._b64(b64);
      const p = this.ctx.decodeAudioData(u8.buffer, ok, bad);
      if (p && p.then) p.then(ok, bad);
    } catch (e) { bad(); }
  }
  /* Bir ornek hazir oldu. Hover devredeyse ve hala PROSEDUREL calisiyorsa
     hemen gecise zorla — yoksa motor ugultusu, oyuncu hizini degistirene
     kadar (hover() yeniden cagrilana kadar) sentetik kalirdi. */
  _bankReady(name) {
    const S = this._sfx();
    if (name !== (S.hoverName || 'hover')) return;
    if (this.hoverOn) { try { this.hover(this.hoverLevel); } catch (e) {} }
  }
  /* Sirayla varyant sec. Yalniz COZULMUS ornekler arasindan secer; banka
     yarim doluyken de dogru calisir. Hicbiri hazir degilse null. */
  _pick(list) {
    if (!list || !list.length) return null;
    let n = 0;
    for (let i = 0; i < list.length; i++) if (this._bank[list[i]]) n++;
    if (!n) return null;
    this._rotN = (this._rotN + 1) & 0x3fffffff;
    let k = this._rotN % n;
    for (let i = 0; i < list.length; i++) {
      if (!this._bank[list[i]]) continue;
      if (k === 0) return list[i];
      k--;
    }
    return null;
  }
  /* Ornek calar. Zincir prosedurel seslerle AYNI: kaynak -> zarf -> yuva
     -> [pan] -> _fxBus -> master -> limiter (yuvayi `_gate` kurar).
     opt: {det, delay, prio, pan, send}. det = cent cinsinden perde kaydirma;
     AudioBufferSourceNode.detune her tarayicida yok, playbackRate her yerde
     var — perdeyle birlikte sure de kayar, atis varyasyonunda istenen sey. */
  _sample(name, vol, target, opt) {
    const o = opt || {};
    const buf = this._bank[name];
    if (!buf) return false;
    const g = target || this._gate(o);
    if (!g) return false;
    this._hold(g);
    try {
      const S = this._sfx();
      const t = this.ctx.currentTime + (o.delay || 0);
      const rate = o.det ? Math.pow(2, o.det / 1200) : 1;
      const dur = Math.max(0.02, buf.duration / rate);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      if (rate !== 1) src.playbackRate.value = rate;
      /* Kayit zaten kendi atagiyla basliyor; burada yalniz olasi DC sicramasi
         icin mikro rampa var (prosedurel tarafla ayni gerekce: sifirdan tepe
         degere ANINDA sicramak genis bantli bir tik uretir). Arasi DUZ —
         ustel sonum uygulansa kaydin dogal kuyrugu ezilirdi. */
      const a = Math.min(S.fadeIn == null ? 0.0015 : S.fadeIn, dur * 0.25);
      const r = Math.min(S.fadeOut == null ? 0.012 : S.fadeOut, dur * 0.25);
      const v = Math.max(0.0002, vol);
      const env = this.ctx.createGain();
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(v, t + a);
      env.gain.setValueAtTime(v, t + dur - r);
      env.gain.linearRampToValueAtTime(0, t + dur);
      src.connect(env); env.connect(g);
      src.start(t);
      src.stop(t + dur + 0.005);
      src.onended = () => this._release(g);
      return true;
    } catch (err) { this._release(g); return false; }
  }
  /* Olay icin ornek dene. `true` = ornek YOLU secildi (yuva butcesi doluysa
     ses duyulmaz ama prosedurel yedek de yuva bulamazdi — cift calma yok).
     `false` = banka hazir degil; cagiran prosedurel sese duser.
     v, w: `_var()`den gelen iki deterministik 0..1 sapma. */
  _sfxPlay(key, v, w) {
    const S = this._sfx();
    if (S.enabled === false) return false;
    const V = this._voice(key);
    if (!V) return false;
    const name = this._pick(V.names);
    if (!name) return false;
    this._lastSrc = 'sample';
    this._lastVar = name;
    const spread = V.spread == null ? (S.detuneCents || 0) : V.spread;
    const jit = S.gainJitter == null ? 0 : S.gainJitter;
    const scale = S.gain == null ? 1 : S.gain;
    this._sample(name, (V.gain || 0.4) * scale * (1 + (w - 0.5) * 2 * jit), null, {
      det: (V.det || 0) + (v - 0.5) * 2 * spread,
      prio: !!V.prio,
      send: V.send || 0,
      pan: (v - 0.5) * (V.pan || 0),
    });
    return true;
  }
  _proc() { this._lastSrc = 'proc'; this._lastVar = ''; }
  /* Ilk kullanici etkilesinde cagrilir. Askida kalabilir — hata YOK. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      this._bankStart();   // idempotent: ilk turda basladiysa hicbir sey yapmaz
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = CONFIG.SOUND.masterGain;
      /* Cikis emniyeti: tepe sinirlayici. Normal seviyede DEVREYE GIRMEZ;
         yalniz ayni anda cok ses caldiginda kirpilma (clip) yerine yumusak
         bastirma yapar. Onceden hicbir tavan yoktu: 8 ses ust uste bindiginde
         toplam genlik 1.0'i asiyor ve dijital kirpilma duyuluyordu. */
      this._limiter = this._mkComp(this._mix('limitThreshold'), this._mix('limitKnee'),
                                   this._mix('limitRatio'), this._mix('limitAttack'),
                                   this._mix('limitRelease'));
      if (this._limiter) { this.master.connect(this._limiter); this._limiter.connect(this.ctx.destination); }
      else this.master.connect(this.ctx.destination);
      /* Efekt veri yolu: yalniz SES EFEKTLERI buradan gecer. Hover ugultusu ve
         muzik master'a dogrudan baglidir — boylece her atista surekli motor
         sesi "pompalanmaz" ve muzik nefes almaz. */
      this._fxBus = this._mkComp(this._mix('fxThreshold'), this._mix('fxKnee'),
                                 this._mix('fxRatio'), this._mix('fxAttack'),
                                 this._mix('fxRelease'));
      if (this._fxBus) this._fxBus.connect(this.master);
      this._buildSpace();
      this._buildNoise();
      /* AYRI degil ama SON: banka cozulemese bile (kodek yok, bellek) yukaridaki
         zincir kurulmus olur ve prosedurel ses calmaya devam eder. */
      this._bankStart();
    } catch (e) { this.ctx = null; }
    // Muzik caliyorduysa (orn. mute sonrasi unlock) yeniden baslat.
    if (this.music && !this.muted && this._musicWasPlaying) this.music.start();
    // Hover devredeyse ses artik acilabilir — dugumleri kur.
    if (this.hoverOn) this.hover(this.hoverLevel);
  }
  /* Kisa geri beslemeli gecikme: "gece sehri" derinligi. Konvolusyon yerine
     gecikme — mobilde ucuz, dosya gerektirmez, kapatmak icin spaceGain=0. */
  _buildSpace() {
    try {
      const c = this.ctx;
      const inG = c.createGain(); inG.gain.value = 1;
      const dly = c.createDelay(0.5); dly.delayTime.value = this._mix('spaceDelay');
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = this._mix('spaceTone');
      const fb = c.createGain(); fb.gain.value = this._mix('spaceFeedback');
      const out = c.createGain(); out.gain.value = this._mix('spaceGain');
      inG.connect(dly); dly.connect(lp); lp.connect(fb); fb.connect(dly);
      lp.connect(out); out.connect(this.master);
      this._spaceIn = inG;
      this._spaceNodes = { dly, lp, fb, out };
    } catch (e) { this._spaceIn = null; this._spaceNodes = null; }
  }
  /* Gurultu tamponu — DETERMINISTIK (Math.random YOK). 2 sn: her sesin
     tampona farkli yerden girmesi icin yeterli cesitlilik.
     AYRI try: tampon uretilemezse (bellek/uygulama farki) SES TUMDEN olmesin —
     tonal sesler calmaya devam eder, yalniz gurultu katmani duser. */
  _buildNoise() {
    try {
      const secs = Math.max(0.5, this._mix('noiseSec'));
      const len = Math.floor(this.ctx.sampleRate * secs);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = this._rnd01() * 2 - 1;
      this._noiseBuf = buf;
    } catch (e) { this._noiseBuf = null; }
  }
  toggleMute() {
    this.muted = !this.muted;
    // muted bayragina saygi: sessize alinca muzik de susar (playing false).
    if (this.music) {
      if (this.muted) {
        this._musicWasPlaying = this.music.state().playing;
        this.music.stop();
      } else if (this._musicWasPlaying) {
        this.music.start();
      }
    }
    // Hover mantiksal olarak devrede kalir; yalnizca sesi susar/geri doner.
    if (this.muted) this._hoverFade();
    else if (this.hoverOn) this.hover(this.hoverLevel);
  }
  _ready() { return this.ctx && this.ctx.state === 'running' && !this.muted; }
  /* Toplam kazanc siniri: aktif ses sayacina gore yeni ses reddedilir.
     opt: { prio, pan, send }.
     - prio: oncelikli sesler (oyuncunun kendi silahi, olum, boss) ek yuva
       payindan yararlanir. Onceden 8 yuva dolunca OYUNCUNUN ATIS SESI de
       sessizce dusuyordu; yogun catismada silah "bozulmus" gibi duyuluyordu.
     - Bir ses BIRDEN COK parcadan olussa bile TEK yuva tutar (parca sayaci
       g._n). Onceden enemyDeath uc ayri yuva yiyordu — tek bir olum, sekiz
       sesin ucunu birden harciyordu. */
  _gate(opt) {
    if (!this._ready()) return null;
    const o = opt || {};
    const base = (CONFIG.SOUND && CONFIG.SOUND.maxConcurrent) || 8;
    const cap = base + (o.prio ? this._mix('priorityReserve') : 0);
    if (this._active >= cap) return null;
    this._active++;
    const g = this.ctx.createGain();
    g._n = 0; g._pan = null; g._send = null;
    let tail = g;
    if (o.pan) {
      try {
        if (this.ctx.createStereoPanner) {
          const p = this.ctx.createStereoPanner();
          p.pan.value = Math.max(-1, Math.min(1, o.pan));
          tail.connect(p); tail = p; g._pan = p;
        }
      } catch (e) {}
    }
    tail.connect(this._fxBus || this.master);
    if (o.send > 0 && this._spaceIn) {
      try {
        const s = this.ctx.createGain();
        s.gain.value = o.send;
        tail.connect(s); s.connect(this._spaceIn); g._send = s;
      } catch (e) {}
    }
    return g;
  }
  _hold(g) { if (g) g._n = (g._n || 0) + 1; }
  _release(g) {
    if (!g) return;
    g._n = (g._n || 1) - 1;
    if (g._n > 0) return;
    const kill = (n) => { if (n) { try { n.disconnect(); } catch (e) {} } };
    kill(g._send); kill(g._pan); kill(g);
    g._send = null; g._pan = null;
    this._active--;
    if (this._active < 0) this._active = 0;
  }
  /* Ortak zarf. ONEMLI: eskiden `setValueAtTime(vol, t)` ile 0'dan tepe degere
     ANINDA siciliyordu — bu bir dalga formu sicramasidir, genis bantli bir
     "tik" duyulur ve her sesin onune ayni tik yapisir. Burada atak cok kisa
     (varsayilan 2 ms, atis transientlerinde 0.6 ms) ama SIFIR DEGIL: vurus
     keskin kalir, tik gider. Kuyrukta da 0.0001'de kesmek yerine sifira
     dogrusal iniyoruz — bitis tiki de yok. */
  _env(t, dur, vol, atk) {
    const a = Math.max(0.0005, atk == null ? 0.002 : atk);
    const v = Math.max(0.0002, vol);
    const d = Math.max(a + 0.006, dur);
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(v, t + a);
    env.gain.exponentialRampToValueAtTime(0.0002, t + d);
    env.gain.linearRampToValueAtTime(0, t + d + 0.005);
    return { env, end: t + d + 0.008 };
  }
  /* Kisa tonal ses. opt: {delay, atk, sweepTo, lp, lpQ, detune, prio, pan, send} */
  _tone(freq, dur, type, vol, target, opt) {
    const o = opt || {};
    const g = target || this._gate(o);
    if (!g) return;
    this._hold(g);
    try {
      const t = this.ctx.currentTime + (o.delay || 0);
      const osc = this.ctx.createOscillator();
      osc.type = type || 'square';
      osc.frequency.setValueAtTime(Math.max(1, freq), t);
      if (o.sweepTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.sweepTo), t + Math.max(0.01, dur));
      if (o.detune) { try { osc.detune.setValueAtTime(o.detune, t); } catch (e) {} }
      const e = this._env(t, dur, vol, o.atk);
      let node = osc;
      if (o.lp) {
        const f = this.ctx.createBiquadFilter();
        f.type = 'lowpass'; f.frequency.value = o.lp; f.Q.value = o.lpQ || 0.7;
        node.connect(f); node = f;
      }
      node.connect(e.env); e.env.connect(g);
      osc.start(t); osc.stop(e.end);
      osc.onended = () => this._release(g);
    } catch (err) { this._release(g); }
  }
  /* Gürültü patlamasi. opt: {delay, atk, type, sweepTo, offset, prio, pan, send}
     type: 'bandpass' (varsayilan) | 'lowpass' | 'highpass'
     sweepTo: filtre frekansi sure boyunca buraya kayar — patlamanin acilip
     donuklasmasi bu kaymadan gelir (sabit bantli gurultu "sss" gibi durur).
     offset: 0..1, tampona giris noktasi — ayni gurultu deseni tekrar etmesin. */
  _noise(dur, freq, q, vol, target, opt) {
    const o = opt || {};
    const g = target || this._gate(o);
    if (!g) return;
    this._hold(g);
    if (!this._noiseBuf) { this._release(g); return; }
    try {
      const t = this.ctx.currentTime + (o.delay || 0);
      const src = this.ctx.createBufferSource();
      src.buffer = this._noiseBuf;
      src.loop = true;
      const filt = this.ctx.createBiquadFilter();
      filt.type = o.type || 'bandpass';
      filt.frequency.setValueAtTime(Math.max(20, freq), t);
      if (o.sweepTo) filt.frequency.exponentialRampToValueAtTime(Math.max(20, o.sweepTo), t + Math.max(0.01, dur));
      filt.Q.value = q || 1;
      const e = this._env(t, dur, vol, o.atk);
      src.connect(filt); filt.connect(e.env); e.env.connect(g);
      const off = Math.max(0, Math.min(0.98, o.offset || 0)) * this._noiseBuf.duration;
      src.start(t, off); src.stop(e.end);
      src.onended = () => this._release(g);
    } catch (err) { this._release(g); }
  }
  /* Frekans kaydirma (pitch sweep): from -> to, sure icinde. */
  _sweep(f0, f1, dur, type, vol, target, opt) {
    const o = opt || {};
    this._tone(f0, dur, type || 'sawtooth', vol, target,
               { delay: o.delay, atk: o.atk, sweepTo: f1, lp: o.lp, prio: o.prio, pan: o.pan, send: o.send });
  }
  /* --------------------------------------------------- hover (fircasiz motor)
     Surekli dusuk seviyeli vizilti; level (0.6-1.0) perdeyi ve genligi kaydirir.
     SES BUTCESI: hover `_gate()` KULLANMAZ, dogrudan master'a baglanir. Sebep:
     (1) surekli calan tek bir vizilti, 8 esz amanli ses kotasindan kalici bir yer
     yeseydi atis/patlama sesleri bir slot eksigiyle calisirdi; (2) ters yonde,
     gate'e sokulsaydi yogun catismada `_active >= maxConcurrent` oldugu an hover
     SESSIZCE DUSERDI ve motor sesi rastgele kesilirdi. Ikisi de istenmiyor;
     seviyesi zaten dusuk (CONFIG.SOUND.hover.gain) ve tek instance.
     Round 23: hover ayrica efekt veri yolundan (_fxBus) da GECMEZ — gecseydi
     her atis/patlama motor ugultusunu bastirir, motor "kekeliyor" gibi olurdu. */
  _hoverCfg() { return (CONFIG.SOUND && CONFIG.SOUND.hover) || HOVER_DEFAULTS; }
  /* Olcum kancasi: hover DEVREDE mi? Sesin duyulup duyulmadigindan bagimsiz
     (autotest'te ctx askida, mute'ta sessiz — bayrak yine dogruyu soyler). */
  hoverActive() { return this.hoverOn; }
  /* Hover ornegi hazir mi? (round 25) Hazirsa gercek motor KAYDI donguye
     alinir; degilse asagidaki prosedurel osilator yigini devrede kalir. */
  _hoverBuf() {
    const S = this._sfx();
    if (S.enabled === false) return null;
    return this._bank[S.hoverName || 'hover'] || null;
  }
  _hoverRate(lv) {
    const S = this._sfx();
    const b = S.hoverRateBase == null ? SFX_DEFAULTS.hoverRateBase : S.hoverRateBase;
    const sp = S.hoverRateSpan == null ? SFX_DEFAULTS.hoverRateSpan : S.hoverRateSpan;
    return Math.max(0.25, b + sp * lv);
  }
  _hoverGain(lv) {
    const S = this._sfx();
    return (S.hoverGain == null ? SFX_DEFAULTS.hoverGain : S.hoverGain) * lv;
  }
  hover(level) {
    const H = this._hoverCfg();
    const lv = Math.max(H.levelMin, Math.min(H.levelMax, level || 1));
    // Mantiksal durum her kosulda guncellenir (ses kurulmasa bile).
    this.hoverOn = true;
    this.hoverLevel = lv;
    // Askida / susturulmus: dugum kurma, varsa yumusakca sustur. Hata YOK.
    if (!this._ready()) { this._hoverFade(); return; }
    try {
      const t = this.ctx.currentTime;
      // Sonumlenmekte olan bir hover varsa yikimi iptal et, ayni dugumleri geri ac.
      if (this._hoverStop) { clearTimeout(this._hoverStop); this._hoverStop = null; }
      const buf = this._hoverBuf();
      const h = this._hover;
      // Mevcut hover varsa parametreleri guncelle (YENIDEN OLUSTURMA — yigilmaz).
      if (h) {
        if (h.kind === 'sample') { this._hoverTuneSample(h, lv, t, H); return; }
        if (!buf) { this._hoverTuneProc(h, lv, t, H); return; }
        /* Banka unlock'tan SONRA doluyor: hover o ana kadar prosedurel
           basladiysa burada kayda gecilir. Eskisi sonerken yenisi aciliyor
           (capraz gecis) — sert yikim bir tik duyururdu. */
        this._hoverRetire(h, H, t);
      }
      if (buf) this._hoverBuildSample(buf, lv, t, H);
      else this._hoverBuildProc(lv, t, H);
    } catch (e) { this._hoverTeardown(); }
  }
  /* --- ornek hover: tek dongulu kaynak.
     `hover` ornegi bas/son sureksizligi 0.021 ile olculerek secildi (diger
     motor kayitlarinda 0.185-0.233) — dikissiz donen tek kayit bu.
     _fxBus BYPASS: yukaridaki gerekce (her atista motor pompalanmasin). */
  _hoverBuildSample(buf, lv, t, H) {
    const env = this.ctx.createGain();
    env.gain.value = 0;
    env.connect(this.master);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.loopStart = 0;
    src.loopEnd = buf.duration;
    src.playbackRate.value = this._hoverRate(lv);
    src.connect(env);
    src.start(t);
    this._hover = { kind: 'sample', src, env };
    env.gain.setTargetAtTime(this._hoverGain(lv), t, H.attack);   // fade-in
  }
  _hoverTuneSample(h, lv, t, H) {
    try { h.src.playbackRate.setTargetAtTime(this._hoverRate(lv), t, H.glide); } catch (e) {}
    try { h.env.gain.setTargetAtTime(this._hoverGain(lv), t, H.gainGlide); } catch (e) {}
  }
  /* --- prosedurel hover (yedek): harmonik osilatörler + am modülasyonu. */
  _hoverBuildProc(lv, t, H) {
    const baseFreq = H.baseFreq * lv;
    const harm = H.harmonics || HOVER_DEFAULTS.harmonics;
    const env = this.ctx.createGain();
    env.gain.value = 0;
    env.connect(this.master);
    const oscs = [], oscGains = [];
    for (let i = 0; i < harm.length; i++) {
      const hh = harm[i];
      const osc = this.ctx.createOscillator();
      osc.type = i === 0 ? 'sawtooth' : 'sine';
      osc.frequency.value = baseFreq * hh.mult;
      const og = this.ctx.createGain();
      og.gain.value = hh.vol;
      osc.connect(og); og.connect(env);
      osc.start(t);
      oscs.push(osc); oscGains.push(og);
    }
    // Hafif am modülasyonu (~28 Hz) — rotor dönme hissi.
    const lfo = this.ctx.createOscillator();
    lfo.type = 'sine'; lfo.frequency.value = H.amHz;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = H.amDepth * lv;
    lfo.connect(lfoGain); lfoGain.connect(env.gain);
    lfo.start(t);
    this._hover = { kind: 'proc', oscs, oscGains, env, lfo, lfoGain };
    env.gain.setTargetAtTime(H.gain * lv, t, H.attack);   // fade-in
  }
  _hoverTuneProc(h, lv, t, H) {
    const baseFreq = H.baseFreq * lv;
    const harm = H.harmonics || HOVER_DEFAULTS.harmonics;
    const n = Math.min(h.oscs.length, harm.length);
    for (let i = 0; i < n; i++) {
      try { h.oscs[i].frequency.setTargetAtTime(baseFreq * harm[i].mult, t, H.glide); } catch (e) {}
    }
    try { h.env.gain.setTargetAtTime(H.gain * lv, t, H.gainGlide); } catch (e) {}
    try { h.lfoGain.gain.setTargetAtTime(H.amDepth * lv, t, H.gainGlide); } catch (e) {}
  }
  /* Eski hover'i sondur ve yuvayi hemen bosalt — cagiran hemen ardindan
     yenisini kurar. Ayri zamanlayici: `_hoverStop` "SU ANKI hover sonuyor"
     demektir, ikisi karisirsa stopHover sirasinda yeni hover kaliyordu. */
  _hoverRetire(h, H, t) {
    this._hover = null;
    this._hoverOldKill();          // bekleyen daha eski bir tane varsa hemen git
    this._hoverOld = h;
    try { h.env.gain.setTargetAtTime(0, t, H.release); } catch (e) {}
    this._hoverOldT = setTimeout(() => { this._hoverOldT = null; this._hoverOldKill(); }, H.stopMs);
  }
  _hoverOldKill() {
    if (this._hoverOldT) { clearTimeout(this._hoverOldT); this._hoverOldT = null; }
    const h = this._hoverOld;
    if (!h) return;
    this._hoverOld = null;
    this._hoverKill(h);
  }
  /* Idempotent: arka arkaya cagrilabilir, ikinci cagri hicbir sey yapmaz. */
  stopHover() {
    this.hoverOn = false;
    this._hoverFade();
  }
  /* Sonumlendir, sonra dugumleri yik. Zaten sonuyorsa dokunma (cift zamanlayici yok). */
  _hoverFade() {
    const h = this._hover;
    if (!h) { this._hoverTeardown(); return; }
    if (this._hoverStop) return;
    const H = this._hoverCfg();
    try {
      if (this.ctx) h.env.gain.setTargetAtTime(0, this.ctx.currentTime, H.release);
    } catch(e) {}
    this._hoverStop = setTimeout(() => {
      this._hoverStop = null;
      this._hoverTeardown();
    }, H.stopMs);
  }
  /* Tum hover dugumlerini durdur + kopar. Cagrilmasi her zaman guvenli.
     Iki bicimi de bilir: ornek ({src,env}) ve prosedurel ({oscs,...}). */
  _hoverTeardown() {
    if (this._hoverStop) { clearTimeout(this._hoverStop); this._hoverStop = null; }
    this._hoverOldKill();
    const h = this._hover;
    if (!h) return;
    this._hover = null;
    this._hoverKill(h);
  }
  _hoverKill(h) {
    const kill = (n) => { if (!n) return; try { if (n.stop) n.stop(); } catch(e) {} try { n.disconnect(); } catch(e) {} };
    try { if (h.oscs) h.oscs.forEach(kill); } catch(e) {}
    try { if (h.oscGains) h.oscGains.forEach(kill); } catch(e) {}
    kill(h.src); kill(h.lfo); kill(h.lfoGain); kill(h.env);
  }
  /* --------------------------------------------------- oyun olaylari
     Her olay TEK ses yuvasi tutar; katmanlar ayni `g` uzerine binir.
     Zamanlanmis parcalar setTimeout DEGIL, ses saati (opt.delay) kullanir —
     kare gecikmesinden bagimsiz, orneklem hassasiyetinde. */
  /* Birincil silah: saniyede birkac kez calar; en cok duyulan ses budur.
     (1) 14 ms parlak transient  = vurus / "snap" (onceden hic yoktu),
     (2) hizla asagi kayan govde = elektrikli silah karakteri,
     (3) kisa alt vurus          = agirlik.
     Her atista perde/gurultu-ofseti/panorama deterministik olarak biraz
     kayar; ayni dalga formunun saniyede bes kez tekrari yorucuydu. */
  playerShot() {
    const v = this._var(), w = this._var();
    /* Round 25: once GERCEK KAYIT (dort varyant sirayla + kucuk perde/genlik
       sapmasi). Banka hazir degilse asagidaki prosedurel ses calar. */
    if (this._sfxPlay('shot', v, w)) return;
    this._proc();
    const g = this._gate({ prio: true, send: 0.05, pan: (v - 0.5) * 0.24 });
    if (!g) return;
    this._hold(g);
    const det = 1 + (v - 0.5) * 0.08;
    this._noise(0.014, 3800 + v * 1800, 0.7, 0.085, g, { type: 'highpass', atk: 0.0006, offset: w, sweepTo: 1800 });
    this._tone(1460 * det, 0.05, 'square', 0.10, g, { sweepTo: 560 * det, atk: 0.0008, lp: 5400 });
    this._tone(196, 0.055, 'sine', 0.045, g, { sweepTo: 120, atk: 0.0012 });
    this._release(g);
  }
  /* Dusman atisi: kuru, alcak, kisa; genis panorama (ekranin baska yerinden). */
  enemyShot() {
    const v = this._var(), w = this._var();
    if (this._sfxPlay('eshot', v, w)) return;
    this._proc();
    const g = this._gate({ send: 0.04, pan: (v - 0.5) * 0.5 });
    if (!g) return;
    this._hold(g);
    this._tone(300 + v * 40, 0.07, 'sawtooth', 0.095, g, { sweepTo: 150, atk: 0.001, lp: 1700 });
    this._noise(0.022, 1800, 0.8, 0.05, g, { offset: v, atk: 0.0008 });
    this._release(g);
  }
  /* Boss atisi: agir, alcak, gecikmeli govdeli. */
  bossShot() {
    const v = this._var(), w = this._var();
    if (this._sfxPlay('bshot', v, w)) return;
    this._proc();
    const g = this._gate({ prio: true, send: 0.12 });
    if (!g) return;
    this._hold(g);
    this._tone(132, 0.22, 'sawtooth', 0.13, g, { sweepTo: 46, atk: 0.002, lp: 900 });
    this._noise(0.18, 900, 0.6, 0.07, g, { type: 'lowpass', sweepTo: 220, offset: v, atk: 0.002 });
    this._release(g);
  }
  /* Isabet: metalik, cok kisa. Gurultu tamponuna her seferinde farkli yerden
     girilir — art arda isabetler ayni "tik"in kopyasi gibi duyulmasin. */
  hit() {
    const v = this._var(), w = this._var();
    if (this._sfxPlay('hit', v, w)) return;
    this._proc();
    const g = this._gate({ send: 0.05, pan: (v - 0.5) * 0.4 });
    if (!g) return;
    this._hold(g);
    this._noise(0.055, 2600 + v * 1400, 2.2, 0.16, g, { offset: v, atk: 0.0006, sweepTo: 1400 });
    this._tone(2100 + v * 500, 0.035, 'triangle', 0.05, g, { atk: 0.0006 });
    this._release(g);
  }
  /* Kara hedefine isabet: metalik, tok, alcak perdeli (hit'ten daha alcak). */
  groundHit() {
    const v = this._var(), w = this._var();
    if (this._sfxPlay('groundHit', v, w)) return;
    this._proc();
    const g = this._gate({ send: 0.07, pan: (v - 0.5) * 0.3 });
    if (!g) return;
    this._hold(g);
    this._noise(0.05, 1500, 2.5, 0.17, g, { offset: v, atk: 0.0008, sweepTo: 600 });
    this._tone(210, 0.09, 'square', 0.11, g, { sweepTo: 120, atk: 0.001, lp: 1200 });
    this._release(g);
  }
  /* Kara hedefi olumu: patlama + kisa metal cinlama kuyrugu.
     Sub, hover ugultusunun (85 Hz) ALTINA kayarak biter; sabit vizilti ile
     patlamanin govdesi ayni bantta birbirini bulandirmasin diye. */
  groundDeath() {
    const v = this._var(), w = this._var();
    if (this._sfxPlay('gdeath', v, w)) return;
    this._proc();
    const g = this._gate({ prio: true, send: 0.28, pan: (v - 0.5) * 0.24 });
    if (!g) return;
    this._hold(g);
    this._noise(0.05, 4200, 0.5, 0.14, g, { type: 'highpass', offset: v, atk: 0.0005, sweepTo: 1600 });
    this._noise(0.45, 1600, 0.5, 0.21, g, { type: 'lowpass', offset: 0.3 + v * 0.4, atk: 0.004, sweepTo: 150 });
    this._tone(66, 0.40, 'sine', 0.19, g, { sweepTo: 30, atk: 0.005 });
    this._tone(2350, 0.14, 'triangle', 0.05, g, { delay: 0.08, atk: 0.002 });
    this._tone(3120, 0.11, 'triangle', 0.035, g, { delay: 0.105, atk: 0.002 });
    this._release(g);
  }
  /* Uckasavar patlamasi: kuru, kisa hava patlamasi — parlak baslar, donuklasir. */
  flak() {
    const v = this._var(), w = this._var();
    if (this._sfxPlay('flak', v, w)) return;
    this._proc();
    const g = this._gate({ send: 0.14, pan: (v - 0.5) * 0.6 });
    if (!g) return;
    this._hold(g);
    this._noise(0.09, 2600 + v * 900, 0.7, 0.16, g, { type: 'lowpass', offset: v, atk: 0.0008, sweepTo: 500 });
    this._tone(120, 0.08, 'sine', 0.07, g, { sweepTo: 60, atk: 0.002 });
    this._release(g);
  }
  /* Dusman olumu: on uc (parlak), govde (alcalan gurultu), sub, dusus kuyrugu.
     Dortu de TEK yuvada — eskiden uc ayri yuva yiyordu. */
  enemyDeath() {
    const v = this._var(), w = this._var();
    if (this._sfxPlay('boom', v, w)) return;
    this._proc();
    const g = this._gate({ prio: true, send: 0.22, pan: (v - 0.5) * 0.3 });
    if (!g) return;
    this._hold(g);
    this._noise(0.045, 5200, 0.5, 0.15, g, { type: 'highpass', offset: v, atk: 0.0005, sweepTo: 2200 });
    this._noise(0.34, 2200, 0.6, 0.19, g, { type: 'lowpass', offset: 1 - v * 0.5, atk: 0.003, sweepTo: 190 });
    this._tone(78, 0.30, 'sine', 0.16, g, { sweepTo: 34, atk: 0.004 });
    this._tone(430, 0.16, 'sawtooth', 0.05, g, { sweepTo: 70, atk: 0.004, lp: 1400 });
    this._release(g);
  }
  /* Uyari: iki notali korna. Ikinci ses ses saatinden zamanlanir (setTimeout
     yerine) ve hafif detune ikizle kalinlastirilir. */
  bossWarn() {
    const v = this._var(), w = this._var();
    if (this._sfxPlay('warn', v, w)) return;
    this._proc();
    const g = this._gate({ prio: true, send: 0.25 });
    if (!g) return;
    this._hold(g);
    this._tone(440, 0.30, 'square', 0.15, g, { atk: 0.006, lp: 2400 });
    this._tone(440, 0.30, 'square', 0.07, g, { atk: 0.006, lp: 2400, detune: 9 });
    this._tone(550, 0.32, 'square', 0.15, g, { delay: 0.35, atk: 0.006, lp: 2400 });
    this._tone(550, 0.32, 'square', 0.07, g, { delay: 0.35, atk: 0.006, lp: 2400, detune: 9 });
    this._release(g);
  }
  stageChange() {
    const v = this._var(), w = this._var();
    if (this._sfxPlay('stage', v, w)) return;
    this._proc();
    const g = this._gate({ prio: true, send: 0.20 });
    if (!g) return;
    this._hold(g);
    this._tone(330, 0.15, 'triangle', 0.16, g, { atk: 0.004, lp: 3000 });
    this._tone(494, 0.20, 'triangle', 0.16, g, { delay: 0.18, atk: 0.004, lp: 3000 });
    this._tone(988, 0.16, 'sine', 0.05, g, { delay: 0.18, atk: 0.004 });
    this._release(g);
  }
  victory() {
    const v = this._var(), w = this._var();
    if (this._sfxPlay('victory', v, w)) return;
    this._proc();
    const g = this._gate({ prio: true, send: 0.30 });
    if (!g) return;
    this._hold(g);
    const notes = [523, 659, 784, 1046];
    for (let i = 0; i < notes.length; i++) {
      const dly = i * 0.12;
      const dur = i === notes.length - 1 ? 0.55 : 0.30;
      this._tone(notes[i], dur, 'triangle', 0.13, g, { delay: dly, atk: 0.005, lp: 4000 });
      this._tone(notes[i], dur, 'triangle', 0.05, g, { delay: dly, atk: 0.005, lp: 4000, detune: 7 });
      this._tone(notes[i] * 0.5, dur, 'sine', 0.06, g, { delay: dly, atk: 0.006 });
    }
    this._release(g);
  }
}

/* ------------------------------------------------------------------ Renderer
   Uyarlabir cozunurluk + cizim. Boyut basina canvas onbellegi YASAK.       */
