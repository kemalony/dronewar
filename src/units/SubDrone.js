class SubDrone {
  constructor() { this.active = false; }
  reset(x, y) {
    this.x = x; this.y = y;
    this.fireTimer = 0;
    this.active = true;
  }
  update(dt, game) {
    const S = CONFIG.SUBDRONE;
    const p = game.player;
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
  }
  draw(c, assets) {
    const s = CONFIG.SUBDRONE.size;
    c.save();
    c.translate(this.x, this.y);
    assets.draw(c, 'sub_drone', -s / 2, -s / 2, s, s);
    c.restore();
  }
}

/* ---------------------------------------------------------------------- Player
   Oyuncu dronu: hareket, ates, dash, sub-dronlar, isi.                     */
