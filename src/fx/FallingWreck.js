class FallingWreck {
  constructor() { this.active = false; }
  spawn(x, y, sprite, seed) {
    // LCG ile deterministik donme + savrulma (Math.random YOK)
    let s = (seed * 2654435761 + 1013904223) >>> 0;
    const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
    const W = CONFIG.FX.wreck;
    this.x = x; this.y = y;
    this.sprite = sprite;
    this.t = 0;
    this.ang = 0;
    this.av = (rnd() - 0.5) * 2 * W.spinMax;        // ±3 rad/s
    this.vx = (rnd() - 0.5) * 2 * W.driftMax;        // hafif yatay savrulma (px/s)
    this.vy = W.startVy;                             // baslangicta hafif asagi itki
    this.size = 48;                                  // cizim boyutu (manifest taban ~64)
    this._smokeAcc = 0;                              // duman izi biriktirici (s)
    this.active = true;
  }
  update(dt, fx) {
    const W = CONFIG.FX.wreck;
    this.t += dt;
    if (this.t >= W.lifeMs / 1000) {
      // omur dolunca kucuk patlama ile yok ol (once aktiflik false — havuzdan
      // yeni nesne alinirken bu slot serbesttir)
      this.active = false;
      fx.explode(this.x, this.y);
      return;
    }
    this.vy += W.gravity * dt;                       // yercekimi ~380 px/s^2
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.ang += this.av * dt;                        // kirilan pervane: donerek suzulur
    // arkasinda incelen duman izi (parcacik havuzu — gruplu cizim)
    this._smokeAcc += dt;
    // smokeEvery > 0 sarti: sabit 0/undefined olursa `while` ya hic donmez
    // (ozellik sessizce olur — Round 15'te tam bu oldu) ya da sonsuz doner.
    while (W.smokeEvery > 0 && this._smokeAcc >= W.smokeEvery) {
      this._smokeAcc -= W.smokeEvery;
      const p = fx.smoke.acquire();
      if (!p) break;
      p.spawn(this.x + Math.sin(this.ang) * 10, this.y - 14, W.smokeLife);
    }
  }
  draw(c, assets) {
    const W = CONFIG.FX.wreck;
    const t = this.t / (W.lifeMs / 1000);            // 0..1
    const a = Math.min(1, (1 - t) * 2);              // son yarida sol
    c.save();
    c.globalAlpha = a;
    c.translate(this.x, this.y);
    c.rotate(this.ang);
    assets.draw(c, this.sprite, -this.size / 2, -this.size / 2, this.size, this.size);
    c.restore();
  }
}

/* Dusen hurda: vurulan dron aninda patlayip yok olmaz — pervanesi kirilip
   donerek asagi suzulen, arkasinda duman izi birakan ceset. Omuru dolunca
   kucuk patlama ile yok olur. Aci/hiz LCG'den (determinizm).               */
