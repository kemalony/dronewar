class Pool {
  constructor(size, factory) {
    this.items = [];
    for (let i = 0; i < size; i++) { const o = factory(); o.active = false; this.items.push(o); }
    this.exhausted = 0;
  }
  acquire() {
    for (const o of this.items) if (!o.active) { o.active = true; return o; }
    this.exhausted++; return null;
  }
  forEach(fn) { for (const o of this.items) if (o.active) fn(o); }
  count() { let n = 0; for (const o of this.items) if (o.active) n++; return n; }
  reset() { for (const o of this.items) o.active = false; this.exhausted = 0; }
}

/* ------------------------------------------------------------- FX (round 6)
   Vurus geri bildirimi + patlama. Yalnizca CIZIM katmani — sim'e dokunmaz,
   determinizm bozulmaz. Sıcak dongude nesne tahsisi yok (havuz + yeniden
   kullanilan alanlar). Boyut basina canvas onbellegi YASAK: olceklemeyi
   drawImage'in hedef boyutuna birakiriz.                               */

/* Zengin patlama (round 10): uc sprite katmani + sok dalgasi + kivilcim.
   1) boom_flash — lighter, 110 ms, olcek 0.4→2.0, alfa 1→0
   2) boom_fire  — lighter, 260 ms, olcek 0.55→2.1, rastgele dondurulmus,
      alfa sonumu (1-t)^2.8 (dogrusal sonum beyaz cekirdegi griye cevirirdi)
   3) boom_smoke — normal karisim, 210 ms gecikmeli, 560 ms, alfa <= 0.16,
      hafif yukari suruklenir
   Sprite yoksa prosedurel fallback calisir (Assets.draw).                */
