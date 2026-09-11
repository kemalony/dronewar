/* Scorch — kara hedefi ölünce zeminde kalan is izi (Round 17). YALNIZ CIZIM.
   Bir numarali kural — zemine civili olma (GroundUnit ile birebir ayni model):
     Alanlar `x` (ekran x) + `y0`/`spawnDist` (dogus anindaki ekran y ve
     city.dist). Ekran y'si HER KAREDE zemin kaymasindan türetilir:
       screenY = y0 + (city.dist - spawnDist)
     Kendi vy'si YOKTUR; y0/spawnDist sim icinde asla degismez. Boylece bir
     sim adiminda ΔscreenY tam olarak Δcity.dist kadardir — zeminle birebir
     ayni hizda kayar, "ucan iz" olmaz. */
class Scorch {
  constructor() { this.active = false; }
  spawn(x, y0, spawnDist) {
    this.x = x;                 // ekran x (sim sabiti)
    this.y0 = y0;               // dogus anindaki ekran y
    this.spawnDist = spawnDist; // dogus anindaki city.dist
    this.t = 0;
    this.active = true;
  }
  /* Ekran y konumu — zemin kaymasindan türetilir (cizim uzayi). */
  screenY(city) { return this.y0 + (city.dist - this.spawnDist); }
  update(dt) {
    this.t += dt;
    if (this.t >= CONFIG.FX.scorch.lifeMs / 1000) this.active = false;
  }
  draw(c, city) {
    const S = CONFIG.FX.scorch;
    const t = this.t / (S.lifeMs / 1000);   // 0..1
    const sy = this.screenY(city);
    if (sy < -40 || sy > CONFIG.H + 40) return;   // ekranda degilse cizme
    // alfa: 0.55'ten 0'a, yumusak sonum (ilk yarida belirgin, sonra sön)
    const a = S.maxAlpha * Math.pow(1 - t, 1.6);
    const r = S.r * (1 + t * 0.25);            // hafif genisleme (is yayilir)
    c.save();
    c.globalCompositeOperation = 'source-over';   // normal karisim (lighter DEGIL)
    c.translate(this.x, sy);
    c.scale(1, S.squash);                       // yatik elips (perspektif)
    const g = c.createRadialGradient(0, 0, 0, 0, 0, r);
    g.addColorStop(0, `rgba(18,14,12,${a.toFixed(3)})`);
    g.addColorStop(0.6, `rgba(18,14,12,${(a * 0.5).toFixed(3)})`);
    g.addColorStop(1, 'rgba(18,14,12,0)');        // yumusak kenar
    c.fillStyle = g;
    c.beginPath();
    c.arc(0, 0, r, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }
}

/* Kara hedefi patlamasindan geriye kalan iz: koyu, yumusak kenarli radyal
   elips. Zemine civili — GroundUnit'in y0/spawnDist modeliyle ayni mekanizma. */
