class Smoke {
  constructor() { this.active = false; }
  spawn(x, y, life) {
    this.x = x; this.y = y;
    this.life = life;
    this.maxLife = life;
    this.size = 5;                        // sabit boyut (deterministik)
    this.vy = -18;                        // hafif yukari suruklenme
    this.active = true;
  }
  update(dt) {
    this.y += this.vy * dt;
    this.life -= dt;
    if (this.life <= 0) this.active = false;
  }
}

/* Hurda duman izi parcacigi: gruplu cizimde alfa kovasina gore tek fill. */
