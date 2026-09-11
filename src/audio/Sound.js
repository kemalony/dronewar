/* Fircasiz motor sesi icin yerel sabitler (CONFIG'e bagli degil). */
const HOVER_HARMONICS = [
  { mult: 1,   vol: 0.50 },   // temel
  { mult: 2,   vol: 0.30 },   // 2. harmonik
  { mult: 3,   vol: 0.18 },   // 3. harmonik
  { mult: 4.9, vol: 0.07 },   // yukselton (fritter)
];
const HOVER_BASE_FREQ = 85;   // Hz — level=1.0'daki temel frekans
const HOVER_LEVEL_MIN = 0.6;  // level araligi (hiza gore)
const HOVER_LEVEL_MAX = 1.0;

class Sound {
  constructor() {
    this.ctx = null;           // AudioContext (ilk etkilesimde olusturulur)
    this.master = null;        // master gain node
    this.muted = false;
    this._active = 0;          // aktif ses sayaci (toplam kazanc siniri)
    this._noiseBuf = null;     // once uretilen gürültü tamponu
    this._hover = null;        // surekli hover sesi (tek instance)
    this.music = new Music();  // katmanli prosedurel muzik (round 19)
    this._musicWasPlaying = false;
    this.music.attach(this);
  }
  /* Ilk kullanici etkilesinde cagrilir. Askida kalabilir — hata YOK. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = CONFIG.SOUND.masterGain;
      this.master.connect(this.ctx.destination);
      // 1 sn beyaz gürültü tamponu (isabet/olum sesleri icin)
      const len = this.ctx.sampleRate;
      this._noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this._noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { this.ctx = null; }
    // Muzik caliyorduysa (orn. mute sonrasi unlock) yeniden baslat.
    if (this.music && !this.muted && this._musicWasPlaying) this.music.start();
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
  }
  _ready() { return this.ctx && this.ctx.state === 'running' && !this.muted; }
  /* Toplam kazanc siniri: aktif ses sayacina gore master gain'i dusur. */
  _gate() {
    if (!this._ready()) return null;
    if (this._active >= CONFIG.SOUND.maxConcurrent) return null;
    this._active++;
    const g = this.ctx.createGain();
    g.connect(this.master);
    return g;
  }
  _release(g) { if (g) { g.disconnect(); this._active--; } }
  /* Kisa tonal ses: frekans, sure, dalga tipi, gain envelope. */
  _tone(freq, dur, type, vol, target) {
    const g = target || this._gate();
    if (!g) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, t);
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(vol, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(env); env.connect(g);
    osc.start(t); osc.stop(t + dur);
    osc.onended = () => this._release(g);
  }
  /* Gürültü patlamasi: bandpass filtreli, sure + gain envelope. */
  _noise(dur, freq, q, vol, target) {
    const g = target || this._gate();
    if (!g) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuf;
    src.loop = true;
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'bandpass'; filt.frequency.value = freq; filt.Q.value = q || 1;
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(vol, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filt); filt.connect(env); env.connect(g);
    src.start(t); src.stop(t + dur);
    src.onended = () => this._release(g);
  }
  /* Frekans kaydirma (pitch sweep): from -> to, sure icinde. */
  _sweep(f0, f1, dur, type, vol) {
    const g = this._gate();
    if (!g) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = type || 'sawtooth';
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(vol, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(env); env.connect(g);
    osc.start(t); osc.stop(t + dur);
    osc.onended = () => this._release(g);
  }
  /* --------------------------------------------------- hover (fircasiz motor) */
  /* Surekli dusuk seviyeli vizilti; level (0.6-1.0) perdede/genlikte hafif degisiklik. */
  hover(level) {
    const lv = Math.max(HOVER_LEVEL_MIN, Math.min(HOVER_LEVEL_MAX, level || 1));
    if (!this.ctx || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime;
    const baseFreq = HOVER_BASE_FREQ * lv;
    // Mevcut hover varsa parametreleri guncelle (yeniden olusturma).
    if (this._hover) {
      const h = this._hover;
      for (let i = 0; i < h.oscs.length; i++) {
        const target = baseFreq * HOVER_HARMONICS[i].mult;
        try { h.oscs[i].frequency.setTargetAtTime(target, t, 0.05); } catch(e) {}
      }
      try { h.env.gain.setTargetAtTime(0.08 * lv, t, 0.08); } catch(e) {}
      return;
    }
    // Ilk kurulum: harmonik osilatörler + am modülasyonu (rotor hissi).
    const env = this.ctx.createGain();
    env.gain.value = 0;
    env.connect(this.master);
    const oscs = [];
    for (let i = 0; i < HOVER_HARMONICS.length; i++) {
      const h = HOVER_HARMONICS[i];
      const osc = this.ctx.createOscillator();
      osc.type = i === 0 ? 'sawtooth' : 'sine';
      osc.frequency.value = baseFreq * h.mult;
      const og = this.ctx.createGain();
      og.gain.value = h.vol;
      osc.connect(og); og.connect(env);
      osc.start(t);
      oscs.push(osc);
    }
    // Hafif am modülasyonu (~28 Hz) — rotor dönme hissi.
    const lfo = this.ctx.createOscillator();
    lfo.type = 'sine'; lfo.frequency.value = 28;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 0.02 * lv;
    lfo.connect(lfoGain); lfoGain.connect(env.gain);
    lfo.start(t);
    this._hover = { oscs, env, lfo, lfoGain };
    // Fade-in.
    env.gain.setTargetAtTime(0.08 * lv, t, 0.15);
  }
  stopHover() {
    if (!this._hover || !this.ctx) return;
    const h = this._hover;
    const t = this.ctx.currentTime;
    try {
      h.env.gain.setTargetAtTime(0, t, 0.1);
      setTimeout(() => {
        try { h.oscs.forEach(o => o.stop()); } catch(e) {}
        try { h.lfo.stop(); } catch(e) {}
        try { h.env.disconnect(); } catch(e) {}
        try { h.lfoGain.disconnect(); } catch(e) {}
      }, 400);
    } catch(e) {}
    this._hover = null;
  }
  /* --------------------------------------------------- oyun olaylari */
  /* Kuru, kisa atis sesi (fircasiz karakter). */
  playerShot() { this._tone(1200, 0.025, 'square', 0.12); }
  enemyShot()  { this._tone(220, 0.08, 'triangle', 0.12); }
  bossShot()   { this._tone(110, 0.12, 'sawtooth', 0.15); this._noise(0.1, 200, 0.5, 0.06); }
  hit()        { this._noise(0.06, 3000, 2, 0.2); }
  /* Kara hedefine isabet: metalik, tok, alcak perdeli (hit'ten daha alcak). */
  groundHit()  { this._noise(0.05, 1200, 3, 0.22); this._tone(180, 0.08, 'square', 0.14); }
  /* Kara hedefi olumu: patlama + kisa metal cinlama kuyrugu. */
  groundDeath() {
    this._noise(0.3, 300, 0.8, 0.25);
    this._tone(120, 0.2, 'sine', 0.18);
    setTimeout(() => this._tone(2400, 0.12, 'triangle', 0.06), 80);
  }
  /* Uckasavar patlamasi: kuru, kisa gurultu patlamasi (hava patlamasi hissi). */
  flak()       { this._noise(0.08, 1500, 1.5, 0.2); }
  /* Alcalan gurultu + kisa govde — dusus hissi. */
  enemyDeath() {
    this._sweep(500, 60, 0.35, 'sawtooth', 0.18);
    this._noise(0.2, 400, 0.7, 0.18);
    this._tone(90, 0.15, 'sine', 0.15);
  }
  bossWarn()   { this._tone(440, 0.3, 'square', 0.2); setTimeout(() => this._tone(550, 0.3, 'square', 0.2), 350); }
  stageChange(){ this._tone(330, 0.15, 'triangle', 0.18); setTimeout(() => this._tone(494, 0.2, 'triangle', 0.18), 180); }
  victory()    {
    const notes = [523, 659, 784];
    notes.forEach((f, i) => setTimeout(() => this._tone(f, 0.3, 'triangle', 0.15), i * 120));
  }
}

/* ------------------------------------------------------------------ Renderer
   Uyarlabir cozunurluk + cizim. Boyut basina canvas onbellegi YASAK.       */
