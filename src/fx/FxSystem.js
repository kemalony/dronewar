class FxSystem {
  constructor() {
    this.explosions = new Pool(16, () => new Explosion());
    this.shockwaves = new Pool(16, () => new Shockwave());
    this.sparks = new SparkSystem(CONFIG.FX.sparkPool);
    /* Round 15: dusen hurda + duman izi */
    this.wrecks = new Pool(CONFIG.FX.wreck.pool, () => new FallingWreck());
    this.smoke = new SmokeSystem(CONFIG.FX.wreck.smokePool);
    /* Round 17: zemin izi (scorch) — kara hedefi ölünce yerde kalan is izi.
       Zemine civili: y0/spawnDist ile city.dist'ten türetilir (GroundUnit modeli). */
    this.scorches = new Pool(CONFIG.FX.scorch.pool, () => new Scorch());
    /* Round 18: skor baloncuğu — öldürülen düşmanın yerinde yükselip sönen
       puan yazısı. Yalniz cizim; game paketi state() kancasiyla okur. */
    this.scorePops = new Pool(CONFIG.FX.scorePop.pool, () => new ScorePop());
    /* Glitch / statik — yalniz cizim (sim'e dokunmaz).
       _glitchT/_glitchDur/_glitchAmp: anlik hasar glitch'i (sonekli).
       _ambientGlitch: surekli zayif seviye (jammer menzili), 0..1. */
    this._glitchT = 0;
    this._glitchDur = 0;
    this._glitchAmp = 1;
    this._ambientGlitch = 0;
    /* Round 17: flak parlama — kisa lighter flash (yalniz cizim). */
    this._flakFlash = null;
    this._seed = 1;
  }
  explode(x, y) {
    this._seed++;
    const e = this.explosions.acquire();
    if (e) e.spawn(x, y, this._seed);
    const w = this.shockwaves.acquire();
    if (w) w.spawn(x, y);
    this.sparks.burst(x, y, CONFIG.FX.sparksPerExplosion);
  }
  hit(x, y) {
    // kucuk vurus: yalniz kivilcim (patlama degil)
    this._seed++;
    this.sparks.burst(x, y, 5);
  }
  /* Vurulan dron: aninda patlamak yerine pervanesi kirilip donerek asagi
     suzulen hurda. sprite: Enemy.sprite (drone_*). seedStream: LCG tohumu. */
  spawnWreck(x, y, sprite, seedStream) {
    this._seed++;
    const w = this.wrecks.acquire();
    if (w) w.spawn(x, y, sprite, (seedStream | 0) + this._seed);
  }
  /* Round 17: kara hedefi ölünce zeminde kalan is izi. Zemine civili —
     y0/spawnDist ile city.dist'ten türetilir (GroundUnit modeli). Cizim katmani. */
  spawnScorch(x, y0, spawnDist) {
    const s = this.scorches.acquire();
    if (s) s.spawn(x, y0, spawnDist);
  }
  /* Round 18: öldürülen düşmanın yerinde yükselip sönen puan yazısı.
     tier 0..4 rengi soğuktan sıcağa ısıtır (kombo çarpanı). Yalniz cizim. */
  scorePop(x, y, text, tier) {
    const p = this.scorePops.acquire();
    if (p) p.spawn(x, y, text, tier);
  }
  /* Round 17: ucaksavar mermisinin havada patlamasi — kisa parlama + 6-8
     kivilcim. Mevcut Spark/SparkSystem havuzlarini kullanir; yeni parcacik
     sinifi YOK. Parcaliklar gruplu cizilir (renk/alfa kovasi). */
  flak(x, y) {
    this._seed++;
    this.sparks.burst(x, y, CONFIG.FX.flak.sparks);   // 7 kivilcim (havuzdan)
    this._flakFlash = { x, y, t: 0, dur: CONFIG.FX.flak.flashMs / 1000 };
  }
  /* Glitch / statik: yatay kayma seritleri + statik gurultu. YALNIZ CIZIM.
     ms: sure; amp: genlik (1 = tam, <1 = hafif/jammer). */
  glitch(ms, amp) {
    const t = ms / 1000;
    if (t > this._glitchT || !this._glitchDur) {
      this._glitchDur = t;
      this._glitchAmp = amp != null ? amp : 1;
    }
    this._glitchT = Math.max(this._glitchT, t);
  }
  /* Surekli zayif glitch (jammer menzili): level 0..1. Yalniz cizim — sim'e
     dokunmaz, update() sayacini kullanmaz; her karede aktif kalir. */
  setAmbientGlitch(level) {
    this._ambientGlitch = Math.max(0, Math.min(1, level || 0));
  }
  get glitchActive() { return this._glitchT > 0 || this._ambientGlitch > 0; }
  /* ---------------------------------------------------------------- olcum
     Round 22: bu iki ozellik (dusen hurda + glitch) yazilmisti ama hicbir
     kapi onlari goremiyordu; enkaz NaN koordinata ucsa bile ekranda ayirt
     edilemiyordu. Asagidakiler game paketinin state() kancasiyla disari
     verecegi duz okuyuculardir. YALNIZ OKUR — sim'e de cizime de dokunmaz. */
  wreckCount() { return this.wrecks.count(); }
  /* Tum aktif enkazin x/y/ang degerleri sonlu mu. NaN NOBETI: kasten
     savunmaci degil — config anahtari yine kaybolursa bu false donmeli. */
  wreckFinite() {
    let ok = true;
    this.wrecks.forEach((w) => {
      if (!(isFinite(w.x) && isFinite(w.y) && isFinite(w.ang))) ok = false;
    });
    return ok;
  }
  /* Ornek enkaz (ilk aktif): y'nin kare kare ARTTIGI olculur — yani gercekten
     dusuyor mu. Aktif enkaz yoksa null. */
  wreckSample() {
    for (const w of this.wrecks.items) {
      if (w.active) return { x: w.x, y: w.y, ang: w.ang };
    }
    return null;
  }
  /* Ambient (jammer) glitch yogunlugu 0..1. */
  ambientGlitchLevel() { return this._ambientGlitch; }
  /* Anlik hasar glitch'inin kalan suresi, saniye (sonmusse 0). */
  damageGlitchT() { return this._glitchT > 0 ? this._glitchT : 0; }
  update(dt) {
    this.explosions.forEach((e) => e.update(dt));
    this.shockwaves.forEach((w) => w.update(dt));
    this.sparks.update(dt);
    this.wrecks.forEach((w) => w.update(dt, this));
    this.smoke.update(dt);
    this.scorches.forEach((s) => s.update(dt));
    this.scorePops.forEach((p) => p.update(dt));
    if (this._flakFlash && (this._flakFlash.t += dt) >= this._flakFlash.dur) this._flakFlash = null;
    /* Sayac 0'in ALTINA dusmemeli: eskiden sinirsiz negatife gidiyordu ve
       _glitchDur eski degerinde kaliyordu; sonraki (daha zayif) glitch dogru
       genligi alsa da damageT olcumu anlamsiz negatif bir sayi veriyordu.
       Sonunce dur'u da sifirla — glitch()'in `!this._glitchDur` dali boylece
       yeni genligi kesin olarak devralir. */
    if (this._glitchT > 0) {
      this._glitchT -= dt;
      if (this._glitchT <= 0) { this._glitchT = 0; this._glitchDur = 0; }
    }
  }
  draw(c, assets, city) {
    /* Round 17: zemin izi — sehir zemininin UZERINDE, kara hedeflerinin ALTINDA.
       Zeminle birebir ayni hizda kayar (city.dist'ten türetilir). */
    this.scorches.forEach((s) => s.draw(c, city));
    this.explosions.forEach((e) => e.draw(c, assets));
    this.shockwaves.forEach((w) => w.draw(c));
    this.sparks.draw(c);
    this.smoke.draw(c);
    this.wrecks.forEach((w) => w.draw(c, assets));
    this.scorePops.forEach((p) => p.draw(c));
    this._drawFlakFlash(c);
    if (this.glitchActive) this._drawGlitch(c);
  }
  /* Round 17: flak parlama — kisa lighter flash (yalniz cizim, sim'e dokunmaz). */
  _drawFlakFlash(c) {
    const f = this._flakFlash;
    if (!f) return;
    const t = f.t / f.dur;                 // 0..1
    const a = Math.pow(1 - t, 2);          // karesel sonum
    const r = CONFIG.FX.flak.flashR * (0.5 + t * 0.8);
    c.save();
    c.globalCompositeOperation = 'lighter';
    const g = c.createRadialGradient(f.x, f.y, 0, f.x, f.y, r);
    g.addColorStop(0, `rgba(255,240,200,${a.toFixed(3)})`);
    g.addColorStop(1, 'rgba(255,200,120,0)');
    c.fillStyle = g;
    c.beginPath();
    c.arc(f.x, f.y, r, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }
  /* Glitch cizimi: ekranin KENDISINI kesip yatay kaydiran seritler +
     deterministik statik gurultu satirlari. performance.now() YALNIZ cizimde.
     Anlik hasar glitch'i (sonekli) ile ambient seviye toplanir ama toplam
     CONFIG.FX.glitchMaxCap'te tavani asamaz — ikisi ayni anda gorse bile
     ekran donmez. Ambient tek basina seyrek ve zayif kalir. */
  _drawGlitch(c) {
    const W = CONFIG.W, H = CONFIG.H;
    const cap = CONFIG.FX.glitchMaxCap;
    let amp = 0;
    if (this._glitchT > 0 && this._glitchDur > 0) {
      const t = this._glitchT / this._glitchDur;   // 1 -> 0
      amp += this._glitchAmp * t;                  // anlik, sonen genlik
    }
    if (this._ambientGlitch > 0) amp += this._ambientGlitch;
    if (amp > cap) amp = cap;
    if (amp <= 0) return;
    const now = performance.now();
    c.save();
    // --- yatay kayma seritleri: kaynak tuvalden kes, yonunde kaydir
    // ambient tek basina oldugunda seritler seyrek (2/4) ve dar olur.
    const strips = this._glitchT > 0 ? 4 : 2;
    for (let i = 0; i < strips; i++) {
      const sy = ((Math.sin(now * 0.021 + i * 1.7) * 0.5 + 0.5) * H) | 0;
      const sh = 8 + ((Math.sin(now * 0.033 + i * 2.9) * 0.5 + 0.5) * 18) | 0;
      const off = Math.sin(now * 0.05 + i * 4.1) * 14 * amp;
      if (off === 0 || sy + sh > H) continue;
      c.drawImage(c.canvas, 0, sy, W, sh, off, sy, W, sh);
    }
    // --- statik gurultu: az sayida ince beyaz/koyu satir (deterministik)
    let s = (now * 0.017) | 0;
    const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
    c.globalCompositeOperation = 'lighter';
    const lines = this._glitchT > 0 ? 6 : 3;
    for (let i = 0; i < lines; i++) {
      const gy = (rnd() * H) | 0;
      const gh = 1 + (rnd() * 2) | 0;
      c.fillStyle = `rgba(200,220,255,${(0.10 * amp).toFixed(3)})`;
      c.fillRect(0, gy, W, gh);
    }
    c.restore();
  }
  reset() {
    this.explosions.reset();
    this.shockwaves.reset();
    this.sparks.reset();
    this.wrecks.reset();
    this.smoke.reset();
    this.scorches.reset();
    this.scorePops.reset();
    this._flakFlash = null;
    this._glitchT = 0;
    this._glitchDur = 0;
    this._glitchAmp = 1;
    this._ambientGlitch = 0;
  }
}

/* -------------------------------------------------------------- CityScroller
   Sehir uc katman: zemin karosu (dikey kayar), binalar (daha hizli + seyrek),
   bir kez gecen simge yapi. Oyuncunun yatay konumu (-1..1) katmanlari TERS
   yonde kaydirir (parallaks). Kayma soneumlu — ani ziplama yok.

   Bina yerlesimi DETERMINISTIK: LCG ile, kaydirma mesafesine bagli.
   Math.random() YOK. Iki kare hizinda ayni binalar ayni yerde olmalidir.      */
