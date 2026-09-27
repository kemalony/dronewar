class Explosion {
  constructor() { this.active = false; }
  spawn(x, y, seed) {
    this.x = x; this.y = y;
    this.t = 0;
    // LCG ile deterministik donme acisi (Math.random YOK)
    let s = (seed * 2654435761 + 1013904223) >>> 0;
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    this.rot = (s / 4294967296) * Math.PI * 2;
    this.active = true;
  }
  update(dt) {
    this.t += dt;
    const F = CONFIG.FX;
    const total = Math.max(F.flashMs, F.fireMs, F.smokeDelay * 1000 + F.smokeMs) / 1000 + 0.05;
    if (this.t > total) this.active = false;
  }
  draw(c, assets) {
    const F = CONFIG.FX;
    const t = this.t;
    const flashT = t / (F.flashMs / 1000);           // 0..1
    const fireT = t / (F.fireMs / 1000);             // 0..1
    const smokeT = (t - F.smokeDelay) / (F.smokeMs / 1000);  // 0..1 (gecikmeli)
    c.save();
    c.translate(this.x, this.y);
    // --- 1) boom_flash (lighter, 110ms, olcek 0.4→2.0, alfa 1→0)
    if (flashT < 1) {
      const sc = 0.4 + flashT * 1.6;
      const a = 1 - flashT;
      const sz = CONFIG.FX.explosion.baseSize * sc;
      c.globalCompositeOperation = 'lighter';
      c.globalAlpha = a;
      assets.draw(c, 'boom_flash', -sz / 2, -sz / 2, sz, sz);
      c.globalAlpha = 1;
    }
    // --- 2) boom_fire (lighter, 260ms, olcek 0.55→2.1, rastgele donus, (1-t)^2.8)
    if (fireT < 1) {
      const sc = 0.55 + fireT * 1.55;
      const decay = Math.pow(1 - fireT, 2.8);   // DOGRUSAL DEGIL
      const sz = CONFIG.FX.explosion.baseSize * sc;
      c.globalCompositeOperation = 'lighter';
      c.globalAlpha = decay;
      c.rotate(this.rot);
      assets.draw(c, 'boom_fire', -sz / 2, -sz / 2, sz, sz);
      c.rotate(-this.rot);
      c.globalAlpha = 1;
    }
    // --- 3) boom_smoke (normal karisim, gecikmeli, alfa <= 0.16, yukari suruklenme)
    if (smokeT > 0 && smokeT < 1) {
      const sc = 0.6 + smokeT * 1.2;
      const a = F.smokeMaxAlpha * (1 - smokeT);
      const driftY = smokeT * CONFIG.FX.explosion.smokeDrift;   // hafif yukari suruklenme
      const sz = CONFIG.FX.explosion.baseSize * sc;
      const E = CONFIG.FX.explosion;
      c.globalCompositeOperation = 'source-over';
      // Yumusak kenar (vision P2): once genis/soluk hale, uzerine cekirdek.
      // Hale payi cekirdekten dikiliyor (core = a*(1-pay)) — boylece merkezde
      // toplam alfa smokeMaxAlpha'yi ASMAZ, yalnizca kenar gecisi kademelenir.
      const hsz = sz * E.smokeHaloScale;
      c.globalAlpha = a * E.smokeHaloAlpha;
      assets.draw(c, 'boom_smoke', -hsz / 2, driftY - hsz / 2, hsz, hsz);
      c.globalAlpha = a * (1 - E.smokeHaloAlpha);
      assets.draw(c, 'boom_smoke', -sz / 2, driftY - sz / 2, sz, sz);
      c.globalAlpha = 1;
    }
    c.restore();
  }
}

/* Sok dalgasi: ince halka, yaricap <= 34 px, omru <= 190 ms, karesel sonum.
   Uzun omurlu/genis halka ekranda "alakasiz daire" olarak okunur.       */
