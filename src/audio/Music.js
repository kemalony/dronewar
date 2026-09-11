/* ------------------------------------------------------------------ Music
   Katmanli, prosedurel muzik motoru (round 19). Dosya yok; her sey WebAudio.
   Simule ASLA dokunmaz: zamanlama AudioContext.currentTime + setInterval
   ile ileri planlama. Autotest'te ctx askida kalir -> tum cagrilar sessizce
   no-op ve hicbir kosulda exception atmaz (audio_no_throw kapisina girer). */
class Music {
  constructor() {
    this._sound = null;        // Sound referansi (ctx/master/muted)
    this._playing = false;
    this._intensity = 0;       // hedef yogunluk 0..1
    this._timer = null;        // setInterval id (nota kuyrugu)
    this._nextTime = 0;        // bir sonraki planlanacak an (ctx saati)
    this._step = 0;            // sekil icinde sayac
    this._layers = [           // katman gain node'lari (sira: bass,pulse,arp,lead)
      null, null, null, null
    ];
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
  /* Bir katmanin gain node'u; yoksa olusturup master'a bagla. */
  _layerGain(i) {
    let g = this._layers[i];
    if (g) return g;
    const s = this._sound;
    if (!s || !s.ctx || !s.master) return null;
    g = s.ctx.createGain();
    g.gain.value = 0;
    g.connect(s.master);
    this._layers[i] = g;
    return g;
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
      this._pulse(t, M);
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
  /* Kisa osilatör: hedef gain node'a, t aninda, env ile. */
  _osc(type, freq, t, dur, vol, layerIdx) {
    const s = this._sound;
    if (!s || !s.ctx) return;
    const g = this._layerGain(layerIdx);
    if (!g) return;
    try {
      const osc = s.ctx.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      const env = s.ctx.createGain();
      env.gain.setValueAtTime(0.0001, t);
      env.gain.linearRampToValueAtTime(vol, t + 0.008);
      env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(env); env.connect(g);
      osc.start(t); osc.stop(t + dur + 0.02);
    } catch (e) {}
  }
  _bass(freq, t, M) { this._osc(M.bassWave || 'triangle', freq, t, (M.bassDur || 0.22), (M.bassVol || 0.5), 0); }
  _arp(freq, t, M)   { this._osc(M.arpWave || 'square',   freq, t, (M.arpDur || 0.16),  (M.arpVol || 0.22), 2); }
  _lead(freq, t, M)   { this._osc(M.leadWave || 'sine',    freq, t, (M.leadDur || 0.55), (M.leadVol || 0.28), 3); }
  /* Perkusif tik: buyuk genlikli, cok kisa (noise yerine keskin sine darbesi). */
  _pulse(t, M) {
    const s = this._sound;
    if (!s || !s.ctx) return;
    const g = this._layerGain(1);
    if (!g) return;
    try {
      const osc = s.ctx.createOscillator();
      osc.type = M.pulseWave || 'sine';
      osc.frequency.setValueAtTime(M.pulseHz || 180, t);
      const env = s.ctx.createGain();
      env.gain.setValueAtTime(0.0001, t);
      env.gain.linearRampToValueAtTime(M.pulseVol || 0.4, t + 0.004);
      env.gain.exponentialRampToValueAtTime(0.0001, t + (M.pulseDur || 0.05));
      osc.connect(env); env.connect(g);
      osc.start(t); osc.stop(t + (M.pulseDur || 0.05) + 0.02);
    } catch (e) {}
  }
}
