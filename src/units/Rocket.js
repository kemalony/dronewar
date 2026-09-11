class Rocket {
  constructor() { this.active = false; }
  reset(x, y, target) {
    this.x = x; this.y = y;
    this.target = target;            // Enemy nesnesi (referans)
    const R = CONFIG.ROCKET;
    this.speed = R.speed;
    // Baslangic acisi: hedefe dogru
    this.angle = Math.atan2(target.y - y, target.x - x);
    this.maxTurn = R.turnRate * Math.PI / 180;   // rad/s
    this.active = true;
  }
  update(dt, game) {
    // Hedef yoksa (oldu/ekrandan cikti) — son bilinen yone devam et
    if (!this.target || !this.target.active) {
      this.x += Math.cos(this.angle) * this.speed * dt;
      this.y += Math.sin(this.angle) * this.speed * dt;
      if (this.y < -40 || this.y > CONFIG.H + 40 || this.x < -40 || this.x > CONFIG.W + 40) this.active = false;
      return;
    }
    // Gait: hedefe don (maks turnRate ile sinirli)
    const desired = Math.atan2(this.target.y - this.y, this.target.x - this.x);
    let diff = desired - this.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const maxStep = this.maxTurn * dt;
    if (Math.abs(diff) <= maxStep) this.angle = desired;
    else this.angle += Math.sign(diff) * maxStep;
    // Ilerle
    this.x += Math.cos(this.angle) * this.speed * dt;
    this.y += Math.sin(this.angle) * this.speed * dt;
    if (this.y < -40 || this.y > CONFIG.H + 40 || this.x < -40 || this.x > CONFIG.W + 40) this.active = false;
  }
  draw(c, assets) {
    const s = CONFIG.ROCKET.size;
    c.save();
    c.translate(this.x, this.y);
    c.rotate(this.angle + Math.PI / 2);   // sprite dikey, ustu yukari
    assets.draw(c, 'rocket', -s * 0.5 / 2, -s / 2, s * 0.5, s);
    c.restore();
  }
}

/* -------------------------------------------------------------------- Enemy
   Uc tip: scout (hizli, ateşsiz), gunner (nişanlı mermi), shield (kalkan).
   Havuzdan beslenir; sıcak döngüde `new` yok. LCG ile deterministik.       */
