class CloudLayer {
  constructor(assets) {
    this.assets = assets;
    this.clouds = [];           // ekrandaki bulut instanslari
    this.dist = 0;              // toplam kaydirma mesafesi (px)
    this.builtUpTo = -1;        // son uretilen slot
    this.smoothX = 0;           // soneumlu oyuncu x (-1..1)
    this._seedBase = 9173;      // LCG taban tohumu
    this._lastSprite = '';      // arka arkaya ayni cekit yasak
    this._catalog = ['cloud_a', 'cloud_b', 'cloud_c', 'cloud_d', 'cloud_e', 'cloud_f'];
  }
  reset() {
    this.clouds = [];
    this.dist = 0;
    this.builtUpTo = -1;
    this.smoothX = 0;
    this._lastSprite = '';
  }
  update(dt, playerNx) {
    const C = CONFIG.CLOUDS;
    this.dist += C.speed * dt;
    // yatay soneum: kritik sonumlu yaklasim (adim boyutundan bagimsiz)
    const h = 1 - Math.exp(-C.smooth * dt);
    this.smoothX += (playerNx - this.smoothX) * h;
    const H = CONFIG.H;
    const SP = C.spacing;
    const maxSlot = Math.floor((this.dist + H + 200) / SP);
    while (this.builtUpTo < maxSlot) {
      this.builtUpTo++;
      this._spawnAt(this.builtUpTo);
    }
    // ekrandan coktan cikmis bulutu at
    const minY = this.dist - H - 200;
    this.clouds = this.clouds.filter((c) => c.baseY > minY);
  }
  _spawnAt(slot) {
    // LCG: her slot icin deterministik tohum (Math.random YOK)
    let seed = ((slot * 2654435761 + this._seedBase) >>> 0);
    const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    const C = CONFIG.CLOUDS;
    const baseY = slot * C.spacing;
    const x = 40 + rnd() * (CONFIG.W - 120);
    // cekit secimi: arka arkaya ayni cekit yasak (LCG ile deterministik)
    let idx = Math.floor(rnd() * this._catalog.length);
    if (this._catalog[idx] === this._lastSprite) {
      idx = (idx + 1 + Math.floor(rnd() * (this._catalog.length - 1))) % this._catalog.length;
    }
    const sprite = this._catalog[idx];
    this._lastSprite = sprite;
    const alpha = C.alphaMin + rnd() * (C.alphaMax - C.alphaMin);
    const scale = C.scaleMin + rnd() * (C.scaleMax - C.scaleMin);   // 0.7..1.3
    const driftPhase = rnd() * Math.PI * 2;
    this.clouds.push({ baseY, x, sprite, alpha, scale, driftPhase });
  }
  /* Test kancasi: yatay parallaks ofseti (px). Oyuncu saga -> NEGATIF (sola). */
  layerOffset() { return -this.smoothX * CONFIG.CLOUDS.hShift; }
  draw(c) {
    const C = CONFIG.CLOUDS;
    const H = CONFIG.H;
    const shift = this.layerOffset();
    for (const cl of this.clouds) {
      const y = cl.baseY - this.dist;
      if (y < -160 || y > H + 160) continue;
      // yatay suruklenme (dist'e bagli — sim adimindan bagimsiz, deterministik)
      const drift = Math.sin(cl.driftPhase + (this.dist / (C.driftPeriod * C.speed)) * Math.PI * 2) * C.driftAmp;
      const s = this.assets.manifest.sprites.find((m) => m.name === cl.sprite);
      const w = (s ? s.width : 200) * cl.scale;
      const h = (s ? s.height : 140) * cl.scale;
      c.save();
      c.globalAlpha = cl.alpha;
      this.assets.draw(c, cl.sprite, cl.x + drift + shift - w / 2, y - h / 2, w, h);
      c.restore();
    }
  }
  /* Test kancasi: su an ekranda olan bulut konumlari (determinizm). */
  onScreenPositions() {
    const H = CONFIG.H;
    const shift = this.layerOffset();
    const out = [];
    for (const cl of this.clouds) {
      const y = cl.baseY - this.dist;
      if (y > -160 && y < H + 160) out.push([Math.round((cl.x + shift) * 100) / 100, Math.round(y * 100) / 100]);
    }
    return out;
  }
  /* Test kancasi: son N dogustaki cekit listesi (cloud_variety).
     Ekran disinda kalanlar da dahil — slot 0'dan builtUpTo'ya tek geciste
     LCG ile yeniden uretir (deterministik, _spawnAt ile birebir ayni siralar). */
  spawnedSprites(n) {
    const out = [];
    let last = '';
    for (let s = 0; s <= this.builtUpTo; s++) {
      let seed = ((s * 2654435761 + this._seedBase) >>> 0);
      const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
      rnd();   // x konumu
      let idx = Math.floor(rnd() * this._catalog.length);
      if (this._catalog[idx] === last) {
        idx = (idx + 1 + Math.floor(rnd() * (this._catalog.length - 1))) % this._catalog.length;
      }
      last = this._catalog[idx];
      out.push(last);
    }
    return out.slice(-n);
  }
}

/* -------------------------------------------------------------------- Bullet
   Oyuncu mermisi (yukari) ve dusman mermisi (asagi) ayni sinifta.
   Trail: son N konum — koyu iz icin. Sıcak dongude array tahsisi yok.     */
