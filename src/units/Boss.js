class Boss {
  constructor() { this.active = false; }
  reset(stageIdx) {
    const B = CONFIG.BOSS;
    this.stageIdx = stageIdx;
    this.maxHp = B.hp[stageIdx];
    this.sprite = B.sprite[stageIdx];   // bolum bazli boss sprite'i (round 11)
    this.hp = this.maxHp;
    this.x = CONFIG.W / 2;
    this.y = -B.size / 2;        // üstten girecek
    this.t = 0;                  // giriş + salınım saati (s)
    this.phase = 1;              // can eşiğine göre 1..4
    this.hitFlash = 0;           // beyaz tint parlaması kalan süre (s)
    this.fanT = 0; this.ringT = 0; this.sweepT = 0;
    this._seed = (1000 + stageIdx * 7919) >>> 0;
    this.active = true;
  }
  _lcg() {
    this._seed = (Math.imul(this._seed, 1664525) + 1013904223) >>> 0;
    return this._seed / 4294967296;
  }
  /* Can eşiği fazı: hp/maxHp >= .75 -> 1, >= .5 -> 2, >= .25 -> 3, aksi 4. */
  _updatePhase() {
    const r = this.hp / this.maxHp;
    this.phase = r >= 0.75 ? 1 : r >= 0.5 ? 2 : r >= 0.25 ? 3 : 4;
  }
  update(dt, game) {
    if (!this.active) return;
    const B = CONFIG.BOSS;
    this.t += dt;
    if (this.hitFlash > 0) this.hitFlash -= dt;
    const entryT = B.entryMs / 1000;
    if (this.t < entryT) {
      // kapalı formda iniş: üstten hoverY'ye doğru sabit hız
      this.y = -B.size / 2 + (B.hoverY + B.size / 2) * (this.t / entryT);
      this.x = CONFIG.W / 2;
      return;
    }
    // salınım: y=hoverY'de sabit, x = merkez ± swayAmp, periyot swayPeriod
    const ph = ((this.t - entryT) / B.swayPeriod) * Math.PI * 2;
    this.x = CONFIG.W / 2 + Math.sin(ph) * B.swayAmp;
    this.y = B.hoverY;
    // --- desen zamanlayıcıları (yalnizca aktif fazdaki desenler ates eder)
    const st = this.stageIdx;
    const fanMs = B.fanMs[st], ringMs = B.ringMs[st], sweepMs = B.sweepMs[st];
    if (this.phase >= 1 && fanMs > 0) {
      this.fanT -= dt * 1000;
      if (this.fanT <= 0) { this.fanT = fanMs; this._fireFan(game); }
    }
    if (this.phase >= 2 && ringMs > 0) {
      this.ringT -= dt * 1000;
      if (this.ringT <= 0) { this.ringT = ringMs; this._fireRing(game); }
    }
    if (this.phase >= 3 && sweepMs > 0) {
      this.sweepT -= dt * 1000;
      if (this.sweepT <= 0) { this.sweepT = sweepMs; this._fireSweep(game); }
    }
  }
  /* Nişanlı 3'lü yelpaze: oyuncuya bakan merkezi açı ± 18°. */
  _fireFan(game) {
    const B = CONFIG.BOSS;
    const p = game.player;
    const dx = p.x - this.x, dy = p.y - this.y;
    const base = Math.atan2(dy, dx);
    for (let i = -1; i <= 1; i++) {
      const a = base + i * (18 * Math.PI / 180);
      this._emit(game, this.x, this.y + 40, Math.cos(a) * B.bulletSpeed, Math.sin(a) * B.bulletSpeed);
    }
  }
  /* 12'li dairesel patlama: tam turda eşit açılar, hafif LCG kayması. */
  _fireRing(game) {
    const B = CONFIG.BOSS;
    const off = this._lcg() * Math.PI * 2;
    for (let i = 0; i < 12; i++) {
      const a = off + (i / 12) * Math.PI * 2;
      this._emit(game, this.x, this.y + 20, Math.cos(a) * B.bulletSpeed, Math.sin(a) * B.bulletSpeed);
    }
  }
  /* İki taraftan çapraz tarama: soldan ve sağdan aşağı-yoğun 3'er mermi. */
  _fireSweep(game) {
    const B = CONFIG.BOSS;
    const jx = (this._lcg() - 0.5) * 0.3;   // hafif LCG sapması
    for (const side of [-1, 1]) {
      const ox = this.x + side * 60;
      for (let i = 0; i < 3; i++) {
        const a = (Math.PI / 2) + side * (0.28 + i * 0.16) + jx;
        this._emit(game, ox, this.y + 30, Math.cos(a) * B.bulletSpeed, Math.sin(a) * B.bulletSpeed);
      }
    }
  }
  _emit(game, x, y, vx, vy) {
    const b = game.ebulletPool.acquire();
    if (!b) return;
    b.reset(x, y, true);
    b.vx = vx; b.vy = vy;
    game.sound.bossShot();
  }
  hit() {
    this.hp--;
    this.hitFlash = CONFIG.FX.hitFlashMs / 1000;
    this._updatePhase();
    return this.hp <= 0;
  }
  draw(c, assets) {
    const B = CONFIG.BOSS;
    const s = B.size;
    c.save();
    c.translate(this.x, this.y);
    // gövde sprite'i — bölüm bazlı (round 11), önce yüklenen görsel
    assets.draw(c, this.sprite, -s / 2, -s / 2, s, s);
    // vuruş parlaması: sprite'ın önceden beyaz tint'lenmiş kopyası (~90ms)
    if (this.hitFlash > 0) {
      const a = Math.min(1, this.hitFlash / (CONFIG.FX.hitFlashMs / 1000));
      c.globalAlpha = a;
      c.globalCompositeOperation = 'lighter';
      const w = assets.whiteTint(this.sprite);
      if (w) c.drawImage(w, -s / 2, -s / 2, s, s);
      c.globalAlpha = 1;
      c.globalCompositeOperation = 'source-over';
    }
    c.restore();
  }
}

/* -------------------------------------------------------------------- Player
   Helikopter hissi: ivme + ustel sonum (biraz "kayar"). Hitbox ekranda kalir. */
