class SmokeSystem {
  constructor(size) {
    this.pool = new Pool(size, () => new Smoke());
    this._bins = [[], [], []];   // sicak dongude new yok — bir kez ayrildi
  }
  acquire() { return this.pool.acquire(); }
  update(dt) { this.pool.forEach((s) => s.update(dt)); }
  count() { return this.pool.count(); }
  /* Gruplu cizim: alfa kovasi (3) — kova basina TEK beginPath + TEK fill.
   * Yumusak kenar (vision P2): her kova icinde icteki-disa konsantrik
   * edgePasses cizilir. Ayni pass'in daireleri TEK path'te birlesir (union),
   * yani ust uste binen parcaciklar istiflenmez; pass alfalari agirlikla
   * olceklendirildigi icin merkezdeki toplam alfa eski tepe alfa ile ayni
   * kalir. Kenarda ise alfa 1.0 -> 0.45 -> 0.17 -> 0 kademeli dusus yapar. */
  draw(c) {
    const S = CONFIG.FX.smoke;
    const bins = this._bins;
    bins[0].length = 0; bins[1].length = 0; bins[2].length = 0;
    this.pool.forEach((s) => {
      const lt = s.life / s.maxLife;         // 1 -> 0
      bins[lt > 0.66 ? 2 : lt > 0.33 ? 1 : 0].push(s);
    });
    const alphas = [0.05, 0.09, 0.14];       // duman: dusuk alfa (<= 0.16 kurali)
    const passes = S.edgePasses;
    c.save();
    for (let ai = 0; ai < 3; ai++) {
      const arr = bins[ai];
      if (!arr.length) continue;
      for (let pi = 0; pi < passes.length; pi++) {
        const P = passes[pi];
        const a = (alphas[ai] * P.w).toFixed(4);
        c.fillStyle = `rgba(${S.rgb},${a})`;
        c.beginPath();
        for (let k = 0; k < arr.length; k++) {
          const s = arr[k];
          const r = s.size * P.r;
          c.moveTo(s.x + r, s.y);
          c.arc(s.x, s.y, r, 0, Math.PI * 2);
        }
        c.fill();
      }
    }
    c.restore();
  }
  reset() { this.pool.reset(); }
}

/* Hurda duman izi havuzu — parcalik basina drawImage YOK, gruplu fill. */
