class Jammer {
  constructor() { this.active = false; }
  reset(x, y) {
    const J = CONFIG.JAMMER;
    this.x = x; this.y = y;
    this.t = 0;                       // sim saati (s) — salinim + nabiz
    this.inRange = false;             // oyuncu menzil icinde mi (sim durumu)
    this._seed = ((x * 31 + y * 17 + 13) >>> 0);   // LCG tohumu (deterministik)
    this.active = true;
  }
  _lcg() {
    this._seed = (Math.imul(this._seed, 1664525) + 1013904223) >>> 0;
    return this._seed / 4294967296;
  }
  update(dt, game) {
    if (!this.active) return;
    const J = CONFIG.JAMMER;
    this.t += dt;
    /* Yavas inis: hoverY'ye kadar sabit hiz, sonra yatay salinim.
       Ekranin ust yarısında kalmaya calisir (hoverY ~ H*0.30). */
    const entryT = 1.2;   // s — giris inişi suresi
    if (this.t < entryT) {
      this.y = -J.size / 2 + (J.hoverY + J.size / 2) * (this.t / entryT);
      this.x = Math.max(J.swayAmp + 20, Math.min(CONFIG.W - J.swayAmp - 20, this.x));
    } else {
      const ph = ((this.t - entryT) / J.swayPeriod) * Math.PI * 2;
      this.x = CONFIG.W / 2 + Math.sin(ph) * J.swayAmp;
      this.y = J.hoverY;
    }
    /* Jamming menzili: oyuncu radius icindeyse ates araligi yavaslar.
       Bu bir SIM durumudur (inRange) — cizimden bagimsiz. */
    const p = game.player;
    const dx = p.x - this.x, dy = p.y - this.y;
    this.inRange = (dx * dx + dy * dy) <= J.radius * J.radius;
    /* Ekrandan cikarsa devre disi (yukari dogru suruklenirse). */
    if (this.y > CONFIG.H + 40 || this.x < -40 || this.x > CONFIG.W + 40) this.active = false;
  }
  draw(c, assets) {
    const J = CONFIG.JAMMER;
    const s = J.size;
    c.save();
    c.translate(this.x, this.y);
    /* Menzil halkasi: soluk, nabiz atan (yalniz cizim — sim'e dokunmaz).
       Nabiz: t'ye bagli sinus ile alfa ve yaricap hafif salinir. */
    const pulse = 0.5 + 0.5 * Math.sin(this.t * J.ringPulse);
    const ringR = J.radius * (0.92 + 0.08 * pulse);
    c.globalAlpha = 0.12 + 0.10 * pulse;
    c.strokeStyle = 'rgba(180,120,255,1)';
    c.lineWidth = 2;
    c.beginPath(); c.arc(0, 0, ringR, 0, Math.PI * 2); c.stroke();
    /* Icinde hafif dolgu (menzil okunabilir olsun) */
    c.globalAlpha = 0.04 + 0.03 * pulse;
    c.fillStyle = 'rgba(180,120,255,1)';
    c.beginPath(); c.arc(0, 0, ringR, 0, Math.PI * 2); c.fill();
    c.globalAlpha = 1;
    /* Govde sprite'i — once yuklenen gorsel, yoksa prosedurel */
    assets.draw(c, 'drone_jammer', -s / 2, -s / 2, s, s);
    /* Menzil icindeyken kenar isigi parlaklasir (oyuncuyu zayiflatiyor) */
    if (this.inRange) {
      c.globalCompositeOperation = 'lighter';
      c.strokeStyle = 'rgba(200,140,255,0.7)';
      c.lineWidth = 2;
      c.shadowColor = 'rgba(200,140,255,0.6)';
      c.shadowBlur = 8;
      c.beginPath(); c.arc(0, 0, s * 0.42, 0, Math.PI * 2); c.stroke();
      c.shadowBlur = 0;
      c.globalCompositeOperation = 'source-over';
    }
    c.restore();
  }
}

/* ---------------------------------------------------------------------- Game
   boot -> menu -> play -> pause -> gameover/victory                        */
