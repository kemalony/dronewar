class SubDrone {
  constructor() { this.active = false; }
  reset(x, y) {
    this.x = x; this.y = y;
    this.mode = 'gun';         // 'gun' | 'kamikaze'
    this.target = null;        // Enemy nesnesi (kamikaze modu)
    this.fireTimer = 0;
    this.angle = -Math.PI / 2; // varsayilan: yukari
    this._side = this._side || 1;   // sag/sol — ilk atamada belirlenir
    this.active = true;
  }
  /* Kamikaze moduna gec: en yakin aktif dusmana kilitlen. */
  launch(target) {
    if (!target) return;
    this.mode = 'kamikaze';
    this.target = target;
  }
  update(dt, game) {
    const S = CONFIG.SUBDRONE;
    const p = game.player;
    if (this.mode === 'gun') {
      /* Yumusak gecikmeyle takip: oyuncunun ±offset px yanina kritik sonumlu
         yaklasim. Hedef konum her adimda hesaplanir, konum ustel sonumle
         hedefe dogru ilerler — ani sikintilar yok. */
      const side = this._side || 1;   // -1 sol, +1 sag
      const tx = p.x + side * S.offset;
      const ty = p.y + 8;             // hafif asagida
      const f = Math.min(1, S.followSmooth * dt);
      this.x += (tx - this.x) * f;
      this.y += (ty - this.y) * f;
      // Ates: oyuncuyla birlikte, hasar 1, aralik fireIntervalMs
      this.fireTimer -= dt;
      if (game.input.firing() && this.fireTimer <= 0) {
        this.fireTimer = S.fireIntervalMs / 1000;
        const b = game.bulletPool.acquire();
        if (b) { b.reset(this.x, this.y - 12); }
      }
    } else {
      /* Kamikaze modu: hedefe 620 px/s hiza. Geri gelmez. */
      if (!this.target || !this.target.active) {
        // Hedef olduruldu: son bilinen yone devam et, ekrandan cik
        this.x += Math.cos(this.angle) * S.kamikazeSpeed * dt;
        this.y += Math.sin(this.angle) * S.kamikazeSpeed * dt;
        if (this.y < -40 || this.y > CONFIG.H + 40 || this.x < -40 || this.x > CONFIG.W + 40) this.active = false;
        return;
      }
      const dx = this.target.x - this.x, dy = this.target.y - this.y;
      const d = Math.hypot(dx, dy) || 1;
      this.angle = Math.atan2(dy, dx);
      this.x += (dx / d) * S.kamikazeSpeed * dt;
      this.y += (dy / d) * S.kamikazeSpeed * dt;
      // Carpisma kontrolu (Player tarafinda da yapilir ama buradan erken donus)
      const rr = 10 + (this.target.radius || 20);
      if (dx * dx + dy * dy <= rr * rr) {
        for (let i = 0; i < S.kamikazeDamage; i++) {
          if (!this.target.active) break;
          const killed = this.target.hit();
          if (killed) game._onEnemyKilled(this.target);
        }
        game.fx.explode(this.x, this.y);
        this.active = false;
      }
    }
  }
  draw(c, assets) {
    const s = CONFIG.SUBDRONE.size;
    c.save();
    c.translate(this.x, this.y);
    if (this.mode === 'kamikaze') {
      // Kamikaze: hafif parlayici turuncu kenar isigi
      c.rotate(this.angle + Math.PI / 2);
      assets.draw(c, 'sub_drone', -s / 2, -s / 2, s, s);
      c.globalCompositeOperation = 'lighter';
      c.strokeStyle = 'rgba(255,150,40,0.7)';
      c.lineWidth = 1.5;
      c.beginPath(); c.arc(0, 0, s * 0.35, 0, Math.PI * 2); c.stroke();
    } else {
      // Namlu modu: normal cizim
      assets.draw(c, 'sub_drone', -s / 2, -s / 2, s, s);
    }
    c.restore();
  }
}

/* ---------------------------------------------------------------------- Player
   Oyuncu dronu: hareket, ates, dash, sub-dronlar, isi.                     */
