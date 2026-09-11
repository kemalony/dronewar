class SparkSystem {
  constructor(size) {
    this.pool = new Pool(size, () => new Spark());
    this._seed = 7;
  }
  burst(x, y, n) {
    for (let i = 0; i < n; i++) {
      const s = this.pool.acquire();
      if (!s) break;
      this._seed++;
      s.spawn(x, y, this._seed);
    }
  }
  update(dt) { this.pool.forEach((s) => s.update(dt)); }
  count() { return this.pool.count(); }
  /* Gruplu cizim: renk kovasi (2) x alfa kovasi (3) = en fazla 6 grup.
     Grup basina TEK beginPath + TEK fill. Parcalik basina drawImage YOK. */
  draw(c) {
    const bins = [[], [], [], [], [], []];   // [colorBin*3 + alphaBin]
    this.pool.forEach((s) => {
      const lt = s.life / s.maxLife;         // 1 -> 0
      const abin = lt > 0.66 ? 2 : lt > 0.33 ? 1 : 0;
      bins[s.colorBin * 3 + abin].push(s);
    });
    const colors = [
      ['rgba(255,140,40,', 'rgba(255,170,60,', 'rgba(255,200,80,'],   // turuncu
      ['rgba(255,230,180,', 'rgba(255,240,200,', 'rgba(255,255,230,'], // saribeyaz
    ];
    const alphas = [0.3, 0.6, 0.95];
    c.save();
    c.globalCompositeOperation = 'lighter';
    for (let ci = 0; ci < 2; ci++) {
      for (let ai = 0; ai < 3; ai++) {
        const arr = bins[ci * 3 + ai];
        if (!arr.length) continue;
        c.fillStyle = colors[ci][ai] + alphas[ai] + ')';
        c.beginPath();
        for (const s of arr) {
          c.moveTo(s.x + s.size, s.y);
          c.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        }
        c.fill();
      }
    }
    c.restore();
  }
  reset() { this.pool.reset(); }
}

/* Patlama + sok dalgasi havuzlari (cizim katmani). */
