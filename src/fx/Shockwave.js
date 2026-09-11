class Shockwave {
  constructor() { this.active = false; }
  spawn(x, y) { this.x = x; this.y = y; this.t = 0; this.active = true; }
  update(dt) { this.t += dt; if (this.t >= CONFIG.FX.shockMs / 1000) this.active = false; }
  draw(c) {
    const F = CONFIG.FX;
    const t = this.t / (F.shockMs / 1000);   // 0..1
    const r = 6 + t * (F.shockMaxR - 6);     // 6 -> 34 px
    const a = (1 - t) * (1 - t);             // karesel sonum
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.strokeStyle = `rgba(255,230,180,${(0.7 * a).toFixed(3)})`;
    c.lineWidth = 2;
    c.beginPath(); c.arc(this.x, this.y, r, 0, Math.PI * 2); c.stroke();
    c.restore();
  }
}

/* Kivilcim: havuzdan, renk ve alfa kovasina gore GRUPLU cizim.
   Parcalik basina drawImage YAPMAZ — grup basina tek beginPath + tek fill.
   Renk kovasi: turuncu / saribeyaz. Alfa kovasi: 3 kova (yuksek/orta/dusuk). */
