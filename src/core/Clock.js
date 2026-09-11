class Clock {
  constructor(hz) { this.step = 1 / hz; this.acc = 0; }
  /* Bir rawDt kadar sim ilerletir. Geri donen deger: cizim icin alpha (0..1).
     Autotest'te her cagri tam sayi adim isledigi icin alpha her zaman 0 olur. */
  advance(rawDtMs) {
    let dt = Math.min(rawDtMs / 1000, CONFIG.MAX_DT);
    this.acc += dt;
    let n = 0;
    while (this.acc >= this.step - 1e-9) { this.acc -= this.step; n++; }
    return { steps: n, alpha: this.acc / this.step };
  }
}

/* ------------------------------------------------------------------- Input
   Klavye (oklar/WASD, Space/Z ates, P duraklat, Esc menu) + dokunmatik
   (birebir parmak takibi). e.repeat yok sayilir. Autotest kancasi ayni
   giris noktalarini (setKey / touchMove) cagirmali.                        */
