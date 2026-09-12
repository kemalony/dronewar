/* ------------------------------------------------------------------ Music
   Katmanli, prosedurel muzik motoru (round 19). Dosya yok; her sey WebAudio.
   Simule ASLA dokunmaz: zamanlama AudioContext.currentTime + setInterval
   ile ileri planlama. Autotest'te ctx askida kalir -> tum cagrilar sessizce
   no-op ve hicbir kosulda exception atmaz (audio_no_throw kapisina girer).

   Round 23 — ses kalitesi:
   - Her katmanin KENDI tonu var (bass alcak gecirgen, arp yuksek gecirgen,
     lead yumusatilmis). Onceden dort katman da ham osilatordu ve hepsi ayni
     bantta ust uste biniyordu; toplam "bulanik" duyuluyordu.
   - Bass katmaninda, surekli hover ugultusunun temel frekansinda kucuk bir
     cukur var (CONFIG.MUSIC.hoverDuck*). Bass notalari 55/65/82/98 Hz; hover
     temeli 51-85 Hz. 82 Hz ile 85 Hz ust uste gelince saniyede ~3 kez vuran
     bir dalgalanma (beating) olusuyordu. Cukuru kapatmak icin hoverDuckDb=0.
   - Perkusif tik artik gurultu tabanli (Sound'un tamponu); tek basina sinus
     tik, muzigin geri kalaniyla ayni tinida kaliyordu.
   DETERMINIZM: Math.random() YOK. Gurultu tamponuna giris noktasi kendi
   sayacindan (_tickN) turetilir; sim bu sayaci ne okur ne yazar.            */
class Music {
  constructor() {
    this._sound = null;        // Sound referansi (ctx/master/muted)
    this._playing = false;
    this._intensity = 0;       // hedef yogunluk 0..1
    this._timer = null;        // setInterval id (nota kuyrugu)
    this._nextTime = 0;        // bir sonraki planlanacak an (ctx saati)
    this._step = 0;            // sekil icinde sayac
    this._tickN = 0;           // perkusyon varyasyon sayaci (deterministik)
    this._layers = [           // katman gain node'lari (sira: bass,pulse,arp,lead)
      null, null, null, null
    ];
    this._chains = [null, null, null, null];  // katman tonu (filtre) zincirleri
  }
  /* Sound tarafindan baglanir; sim'e dokunmaz. */
  attach(sound) { this._sound = sound; }
  _cfg() { return CONFIG.MUSIC || {}; }
  _ready() {
    const s = this._sound;
    return !!(s && s.ctx && s.ctx.state === 'running' && !s.muted);
  }
  /* state() → { playing, intensity, layers: <acik katman sayisi> }. */
  state() {
    return {
      playing: this._playing,
      intensity: this._intensity,
      layers: this._activeLayers(),
    };
  }
  _activeLayers() {
    if (!this._playing) return 0;
    const i = this._intensity;
    let n = 0;
    if (i >= 0.25) n++;          // bass
    if (i >= 0.55) n += 2;       // pulse + arp
    if (i >= 1.0) n++;           // lead
    return n;
  }
  start() {
    if (this._playing) return;
    this._playing = true;
    try {
      const M = this._cfg();
      const ramp = (M.rampMs || 400) / 1000;
      const base = (M.gain != null ? M.gain : 0.3) * (M.layerGainMul || 1);
      for (let i = 0; i < 4; i++) {
        const g = this._layerGain(i);
        const target = (this._intensity >= this._threshold(i)) ? base : 0;
        this._ramp(g, target, ramp);
      }
      this._startTimer();
    } catch (e) {}
  }
  stop() {
    if (!this._playing) return;
    this._playing = false;
    try {
      const M = this._cfg();
      const ramp = (M.rampMs || 400) / 1000;
      for (let i = 0; i < 4; i++) this._ramp(this._layerGain(i), 0, ramp);
      this._stopTimer();
    } catch (e) {}
  }
  setIntensity(v) {
    this._intensity = Math.max(0, Math.min(1, v || 0));
    try {
      if (!this._playing) return;
      const M = this._cfg();
      const ramp = (M.rampMs || 400) / 1000;
      const base = (M.gain != null ? M.gain : 0.3) * (M.layerGainMul || 1);
      for (let i = 0; i < 4; i++) {
        const target = (this._intensity >= this._threshold(i)) ? base : 0;
        this._ramp(this._layerGain(i), target, ramp);
      }
    } catch (e) {}
  }
  _threshold(i) {
    const th = (this._cfg().thresholds) || [0.25, 0.55, 0.55, 1.0];
    return th[i] != null ? th[i] : [0.25, 0.55, 0.55, 1.0][i];
  }
  /* Bir katmanin gain node'u; yoksa olusturup ton zinciriyle master'a bagla.
     Notalar HEP gain node'una baglanir (katman sesi buradan rampalanir);
     filtreler gain'den SONRA gelir, yani rampa davranisi degismez. */
  _layerGain(i) {
    let g = this._layers[i];
    if (g) return g;
    const s = this._sound;
    if (!s || !s.ctx || !s.master) return null;
    try {
      const M = this._cfg();
      g = s.ctx.createGain();
      g.gain.value = 0;
      let tail = g;
      const chain = [];
      const tone = (M.layerTone || [])[i];
      if (tone && tone.type) {
        const f = s.ctx.createBiquadFilter();
        f.type = tone.type;
        f.frequency.value = tone.hz || 1000;
        if (tone.q != null) f.Q.value = tone.q;
        tail.connect(f); tail = f; chain.push(f);
      }
      // Bass katmani: hover ugultusunun temel frekansinda kucuk cukur.
      if (i === 0 && M.hoverDuckDb) {
        const p = s.ctx.createBiquadFilter();
        p.type = 'peaking';
        p.frequency.value = M.hoverDuckHz || 85;
        p.Q.value = M.hoverDuckQ || 1.0;
        p.gain.value = M.hoverDuckDb;      // negatif = cukur
        tail.connect(p); tail = p; chain.push(p);
      }
      tail.connect(s.master);
      this._layers[i] = g;
      this._chains[i] = chain;
      return g;
    } catch (e) { return null; }
  }
  /* Yumusak gecis: ani acma/kapama yok. */
  _ramp(g, target, ramp) {
    if (!g) return;
    const t = this._sound.ctx.currentTime;
    try {
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), t);
      g.gain.linearRampToValueAtTime(Math.max(0.0001, target), t + Math.max(0.01, ramp));
    } catch (e) {}
  }
  _startTimer() {
    if (this._timer != null) return;
    const M = this._cfg();
    const look = (M.lookaheadMs || 200) / 1000;
    const stepDur = (M.stepMs || 125) / 1000;
    this._nextTime = this._sound.ctx.currentTime + 0.06;
    this._step = 0;
    this._timer = setInterval(() => this._tick(look, stepDur), (M.tickMs || 80));
  }
  _stopTimer() {
    if (this._timer != null) { clearInterval(this._timer); this._timer = null; }
  }
  /* IlERI PLANLAMA: su anki ctx saatinden look kadar onceki notalari yerlestir. */
  _tick(look, stepDur) {
    try {
      const s = this._sound;
      if (!this._playing || !s || !s.ctx || s.ctx.state !== 'running' || s.muted) return;
      while (this._nextTime < s.ctx.currentTime + look) {
        this._scheduleStep(this._step, this._nextTime);
        this._nextTime += stepDur;
        this._step = (this._step + 1) % 16;
      }
    } catch (e) {}
  }
  _scheduleStep(step, t) {
    const M = this._cfg();
    const i = this._intensity;
    const root = M.rootHz || 110;
    const scale = M.scale || [0, 3, 7, 10];
    const f = (semi) => root * Math.pow(2, semi / 12);
    // bass: her adimda nabiz (kare/ucgen).
    if (i >= this._threshold(0)) {
      const deg = scale[step % scale.length];
      this._bass(f(deg - 12), t, M);
    }
    // pulse: perkusif tik — ciftlerde (her 2 adim).
    if (i >= this._threshold(1) && (step % 2) === 0) {
      this._pulse(t, M, step);
    }
    // arp: arpej — her adimda yukselen perde.
    if (i >= this._threshold(2)) {
      const deg = scale[(step * 3) % scale.length];
      this._arp(f(deg + 12), t, M);
    }
    // lead: uzun, suzulen ton — her 4 adimda bir.
    if (i >= this._threshold(3) && (step % 4) === 0) {
      const deg = scale[(step >> 2) % scale.length];
      this._lead(f(deg + 24), t, M);
    }
  }
  /* Kisa osilatör: hedef gain node'a, t aninda, env ile.
     opt.voices>1 ise hafif detune'lu ikizler eklenir (kalinlik); toplam genlik
     ses sayisina bolunur, yani katman seviyesi degismez.
     Kuyrukta 0.0001'de kesmek yerine sifira dogrusal iniyoruz — bitis tiki yok. */
  _osc(type, freq, t, dur, vol, layerIdx, opt) {
    const s = this._sound;
    if (!s || !s.ctx) return;
    const g = this._layerGain(layerIdx);
    if (!g) return;
    const o = opt || {};
    const n = Math.max(1, o.voices || 1);
    const spread = o.spread || 0;
    try {
      for (let k = 0; k < n; k++) {
        const det = n > 1 ? (k - (n - 1) / 2) * spread : 0;
        const osc = s.ctx.createOscillator();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, t);
        if (det) { try { osc.detune.setValueAtTime(det, t); } catch (e) {} }
        const env = s.ctx.createGain();
        const a = o.atk || 0.008;
        env.gain.setValueAtTime(0.0001, t);
        env.gain.linearRampToValueAtTime(vol / n, t + a);
        env.gain.exponentialRampToValueAtTime(0.0002, t + dur);
        env.gain.linearRampToValueAtTime(0, t + dur + 0.006);
        osc.connect(env); env.connect(g);
        osc.start(t); osc.stop(t + dur + 0.02);
      }
    } catch (e) {}
  }
  _bass(freq, t, M) {
    this._osc(M.bassWave || 'triangle', freq, t, (M.bassDur || 0.22), (M.bassVol || 0.5), 0,
              { atk: M.bassAtk || 0.012 });
  }
  _arp(freq, t, M) {
    this._osc(M.arpWave || 'square', freq, t, (M.arpDur || 0.16), (M.arpVol || 0.22), 2,
              { atk: 0.006 });
  }
  _lead(freq, t, M) {
    this._osc(M.leadWave || 'sine', freq, t, (M.leadDur || 0.55), (M.leadVol || 0.28), 3,
              { atk: M.leadAtk || 0.05, voices: M.leadVoices || 1, spread: M.leadSpread || 0 });
  }
  /* Perkusif tik: kisa sinus govdesi + yuksek gecirgen gurultu ucu.
     Gurultu, Sound'un onceden uretilmis deterministik tamponundan gelir;
     giris noktasi _tickN sayacindan turetilir (Math.random YOK, sim'e dokunmaz). */
  _pulse(t, M, step) {
    const s = this._sound;
    if (!s || !s.ctx) return;
    const g = this._layerGain(1);
    if (!g) return;
    try {
      const osc = s.ctx.createOscillator();
      osc.type = M.pulseWave || 'sine';
      osc.frequency.setValueAtTime(M.pulseHz || 180, t);
      if (M.pulseDropHz) osc.frequency.exponentialRampToValueAtTime(M.pulseDropHz, t + (M.pulseDur || 0.05));
      const env = s.ctx.createGain();
      const dur = M.pulseDur || 0.05;
      env.gain.setValueAtTime(0.0001, t);
      env.gain.linearRampToValueAtTime(M.pulseVol || 0.4, t + 0.004);
      env.gain.exponentialRampToValueAtTime(0.0002, t + dur);
      env.gain.linearRampToValueAtTime(0, t + dur + 0.005);
      osc.connect(env); env.connect(g);
      osc.start(t); osc.stop(t + dur + 0.02);
    } catch (e) {}
    // Gurultu ucu — muzigin tek gurultu kaynagi; tiniyi osilator corbasindan ayirir.
    const nv = M.pulseNoiseVol;
    if (!nv || !s._noiseBuf) return;
    try {
      this._tickN = (this._tickN + 1) & 0xffff;
      const off = ((this._tickN * 2654435761) >>> 16 & 0xffff) / 0x10000;
      const ndur = M.pulseNoiseDur || 0.03;
      const src = s.ctx.createBufferSource();
      src.buffer = s._noiseBuf;
      src.loop = true;
      const hp = s.ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = M.pulseNoiseHz || 3200;
      const env2 = s.ctx.createGain();
      env2.gain.setValueAtTime(0.0001, t);
      env2.gain.linearRampToValueAtTime(nv, t + 0.002);
      env2.gain.exponentialRampToValueAtTime(0.0002, t + ndur);
      env2.gain.linearRampToValueAtTime(0, t + ndur + 0.004);
      src.connect(hp); hp.connect(env2); env2.connect(g);
      src.start(t, off * s._noiseBuf.duration * 0.9);
      src.stop(t + ndur + 0.02);
    } catch (e) {}
  }
}
