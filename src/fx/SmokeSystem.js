class SmokeSystem {
  constructor(size) { this.pool = new Pool(size, () => new Smoke()); }
  acquire() { return this.pool.acquire(); }
  update(dt) { this.pool.forEach((s) => s.update(dt)); }
  count() { return this.pool.count(); }
  /* Gruplu cizim: alfa kovasi (3) — grup basina TEK beginPath + TEK fill. */
  draw(c) {
    const bins = [[], [], []];
    this.pool.forEach((s) => {
      const lt = s.life / s.maxLife;         // 1 -> 0
      bins[lt > 0.66 ? 2 : lt > 0.33 ? 1 : 0].push(s);
    });
    const alphas = [0.05, 0.09, 0.14];       // duman: dusuk alfa (<= 0.16 kurali)
    c.save();
    for (let ai = 0; ai < 3; ai++) {
      const arr = bins[ai];
      if (!arr.length) continue;
      c.fillStyle = `rgba(180,185,195,${alphas[ai]})`;
      c.beginPath();
      for (const s of arr) {
        c.moveTo(s.x + s.size, s.y);
        c.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      }
      c.fill();
    }
    c.restore();
  }
  reset() { this.pool.reset(); }
}

/* Hurda duman izi havuzu — parcalik basina drawImage YOK, gruplu fill. */
