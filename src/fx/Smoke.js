class Smoke {
  constructor() { this.active = false; }
  spawn(x, y, life, rnd) {
    const S = CONFIG.FX.smoke;
    this.x = x; this.y = y;
    this.life = life;
    this.maxLife = life;
    // Boyut varyasyonu LCG'den (Math.random YASAK — determinizm). rnd == null
    // ise varyasyon 0: cagiran taraf seed akisi vermeden de guvenle kullanir.
    const v = rnd == null ? 0 : (rnd() - 0.5) * 2;      // -1..1
    this.size = S.size * (1 + v * S.sizeVar);
    this.grow = S.grow * (1 + v * 0.5);                 // buyume egrisi de degisir
    this.vy = S.vy;         // hafif yukari suruklenme
    this.active = true;
  }
  update(dt) {
    this.y += this.vy * dt;
    this.size += this.size * this.grow * dt;  // "yapistirilmis" sabit daireleri kirar
    this.life -= dt;
    if (this.life <= 0) this.active = false;
  }
}

/* Hurda duman izi parcacigi: gruplu cizimde alfa kovasina gore tek fill.
 * Kenarlar SmokeSystem'deki konsantrik edgePasses ile kademelendirilir. */
