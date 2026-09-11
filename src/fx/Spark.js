class Spark {
  constructor() { this.active = false; }
  spawn(x, y, seed) {
    let s = (seed * 40503 + 12345) >>> 0;
    const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
    const ang = rnd() * Math.PI * 2;
    const sp = CONFIG.FX.sparkSpeedMin + rnd() * (CONFIG.FX.sparkSpeedMax - CONFIG.FX.sparkSpeedMin);
    this.x = x; this.y = y;
    this.vx = Math.cos(ang) * sp;
    this.vy = Math.sin(ang) * sp;
    this.life = CONFIG.FX.sparkLifeMin + rnd() * (CONFIG.FX.sparkLifeMax - CONFIG.FX.sparkLifeMin);
    this.maxLife = this.life;
    // renk kovasi: 0 = turuncu, 1 = saribeyaz
    this.colorBin = rnd() < 0.6 ? 0 : 1;
    this.size = 1.5 + rnd() * 1.5;
    this.active = true;
  }
  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vy += 120 * dt;   // hafif yercekbim
    this.life -= dt;
    if (this.life <= 0) this.active = false;
  }
}

/* Kivilcim havuzu + gruplu cizim. Ayni anda cizilen parcalik <= sparkPool. */
