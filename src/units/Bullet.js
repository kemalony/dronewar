class Bullet {
  constructor() { this.trailX = new Float32Array(4); this.trailY = new Float32Array(4); this.trailN = 0; this.isEnemy = false; this.reset(0, 0); }
  reset(x, y, isEnemy) {
    this.x = x; this.y = y; this.isEnemy = !!isEnemy;
    const sp = isEnemy ? CONFIG.EBULLET.speed : CONFIG.BULLET.speed;
    this.vx = 0; this.vy = isEnemy ? sp : -sp;
    this.life = isEnemy ? CONFIG.EBULLET.life : CONFIG.BULLET.life;
    this.trailN = 0;
    this.flak = false;   // round 17: ucaksavar mermisi mi (omru bitince havada patlar)
  }
  update(dt) {
    // trail kaydir (en eskiyi at, sondakini yeni konuma yaz)
    for (let i = 0; i < this.trailN - 1; i++) { this.trailX[i] = this.trailX[i+1]; this.trailY[i] = this.trailY[i+1]; }
    this.trailX[this.trailN] = this.x; this.trailY[this.trailN] = this.y;
    if (this.trailN < 3) this.trailN++;
    this.x += this.vx * dt; this.y += this.vy * dt;
    this.life -= dt;
    if (this.life <= 0 || this.y < -20 || this.y > CONFIG.H + 20) this.active = false;
  }
}

/* --------------------------------------------------------------------- Rocket
   Round 12: kazanilabilir ek silah. Normal atisa EK olarak hafif gaitli.
   Hedef secimi deterministik: "en yakin aktif dusman, esitlikte en kucuk
   havuz indeksi". Donus hizi <= 180 deg/s. Isabette hasar 3.               */
