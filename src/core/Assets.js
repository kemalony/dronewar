class Assets {
  constructor(manifest) {
    this.manifest = manifest;
    this.img = {};        // name -> HTMLImageElement (yuklendiyse)
    this.fallback = {};   // name -> offscreen canvas (prosedurel)
    this._whiteCache = {}; // name -> beyaz tint'lenmis offscreen canvas
    this.n_png = 0; this.n_proc = 0;
    this._loadAll();
  }
  _loadAll() {
    for (const s of this.manifest.sprites) {
      const im = new Image();
      im.onload = () => { this.img[s.name] = im; this.n_png++; this._report(); };
      im.onerror = () => { this.fallback[s.name] = this._makeFallback(s); this.n_proc++; this._report(); };
      im.src = 'assets/' + s.file;
    }
  }
  _report() {
    console.log(`ready (${this.n_png} PNG, ${this.n_proc} procedural)`);
  }
  get(name) { return this.img[name] || null; }
  has(name) { return !!this.img[name]; }
  draw(ctx, name, x, y, w, h) {
    const im = this.img[name];
    if (im) { ctx.drawImage(im, x, y, w, h); return; }
    const fb = this.fallback[name];
    if (fb) ctx.drawImage(fb, x, y, w, h);
  }
  /* Beyaz tint'lenmis kopya (vurus parlamasi icin). source-atop + fillRect
     KULLANILMAZ — tuval geneline calisir ve ekrana dikdortgen birakir.
     Sprite'in kendi boyutunda offscreen canvas'a cizilir, alpha korunur. */
  whiteTint(name) {
    let w = this._whiteCache[name];
    if (w) return w;
    const src = this.img[name] || this.fallback[name];
    if (!src) return null;
    const sw = src.width || 64, sh = src.height || 64;
    const c = document.createElement('canvas');
    c.width = sw; c.height = sh;
    const g = c.getContext('2d');
    g.drawImage(src, 0, 0, sw, sh);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, sw, sh);
    this._whiteCache[name] = w = c;
    return w;
  }
  /* ---------------------------------------------------------- prosedurel */
  _makeFallback(s) {
    const c = document.createElement('canvas');
    c.width = s.width; c.height = s.height;
    const g = c.getContext('2d');
    const K = s.kind;
    /* Round 12: roket — ince dikey fitil + parlak uc (fx degil, ayri yol) */
    if (s.name === 'rocket') { this._fbRocket(g, s); return c; }
    if (K === 'tile') this._fbCity(g, s);
    else if (K === 'building') this._fbBuilding(g, s);
    else if (K === 'landmark') this._fbLandmark(g, s);
    else if (K === 'unit' || K === 'boss') this._fbDrone(g, s);
    else if (K === 'fx') this._fbFx(g, s);
    else if (K === 'ui') this._fbUi(g, s);
    return c;
  }
  /* Roket prosedurel yedeği: ince turuncu fitil, beyaz uc. */
  _fbRocket(g, s) {
    const w = s.width, h = s.height;
    g.clearRect(0, 0, w, h);
    // fitil govdesi
    g.fillStyle = '#c8502a';
    g.fillRect(w * 0.35, h * 0.25, w * 0.3, h * 0.65);
    // uc (parlak)
    g.fillStyle = '#ffd24a';
    g.beginPath();
    g.moveTo(w / 2, 0); g.lineTo(w * 0.7, h * 0.28); g.lineTo(w * 0.3, h * 0.28);
    g.closePath(); g.fill();
    // kuyruk alevi
    g.fillStyle = 'rgba(255,180,60,0.8)';
    g.beginPath();
    g.moveTo(w * 0.4, h * 0.9); g.lineTo(w / 2, h); g.lineTo(w * 0.6, h * 0.9);
    g.closePath(); g.fill();
  }
  _fbCity(g, s) {
    const w = s.width, h = s.height;
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, '#1a2340'); grd.addColorStop(1, '#0c1120');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    // bina siluetleri (deterministik tohum)
    let seed = 7;
    const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    g.fillStyle = '#141b30';
    for (let i = 0; i < 26; i++) {
      const bw = 20 + rnd() * 40, bh = 60 + rnd() * 200;
      const bx = rnd() * w, by = rnd() * (h - bh);
      g.fillRect(bx, by, bw, bh);
      // pencereler
      g.fillStyle = 'rgba(255,210,120,0.25)';
      for (let wy = by + 6; wy < by + bh - 6; wy += 12)
        for (let wx = bx + 4; wx < bx + bw - 4; wx += 10)
          if (rnd() > 0.5) g.fillRect(wx, wy, 3, 4);
      g.fillStyle = '#141b30';
    }
  }
  _fbBuilding(g, s) {
    const w = s.width, h = s.height;
    const grd = g.createLinearGradient(0, 0, w, 0);
    grd.addColorStop(0, '#2a3550'); grd.addColorStop(1, '#1a2238');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,200,110,0.3)';
    for (let y = 8; y < h - 8; y += 14)
      for (let x = 6; x < w - 6; x += 12)
        if ((x * 7 + y * 13) % 5 > 1) g.fillRect(x, y, 4, 5);
  }
  _fbLandmark(g, s) {
    const w = s.width, h = s.height;
    g.fillStyle = '#3a4560';
    g.beginPath();
    g.moveTo(w/2, 0); g.lineTo(w, h); g.lineTo(0, h); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,220,140,0.4)';
    for (let y = h*0.3; y < h; y += 16) g.fillRect(w*0.2, y, w*0.6, 3);
  }
  _fbDrone(g, s) {
    const w = s.width, h = s.height;
    g.clearRect(0, 0, w, h);
    const cx = w/2, cy = h/2;
    // gorv
    g.fillStyle = '#5a6a8a';
    g.beginPath(); g.ellipse(cx, cy, w*0.22, h*0.16, 0, 0, Math.PI*2); g.fill();
    // rotor kollar
    g.strokeStyle = '#7a8aaa'; g.lineWidth = Math.max(3, w*0.05);
    for (const [dx, dy] of [[-1,-1],[1,-1],[-1,1],[1,1]]) {
      g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx+dx*w*0.32, cy+dy*h*0.32); g.stroke();
    }
    // rotor diskleri
    g.fillStyle = 'rgba(180,200,230,0.5)';
    for (const [dx, dy] of [[-1,-1],[1,-1],[-1,1],[1,1]]) {
      g.beginPath(); g.arc(cx+dx*w*0.32, cy+dy*h*0.32, w*0.14, 0, Math.PI*2); g.fill();
    }
    // kamera/gun
    g.fillStyle = '#ff5555'; g.beginPath(); g.arc(cx, cy+h*0.1, w*0.06, 0, Math.PI*2); g.fill();
  }
  _fbFx(g, s) {
    const w = s.width, h = s.height;
    g.clearRect(0, 0, w, h);
    const grd = g.createRadialGradient(w/2, h/2, 2, w/2, h/2, w/2);
    grd.addColorStop(0, 'rgba(255,240,180,0.95)');
    grd.addColorStop(0.4, 'rgba(255,170,60,0.7)');
    grd.addColorStop(1, 'rgba(255,120,20,0)');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
  }
  _fbUi(g, s) {
    const w = s.width, h = s.height;
    g.clearRect(0, 0, w, h);
    g.strokeStyle = '#6fe3ff'; g.lineWidth = 3;
    g.beginPath(); g.arc(w/2, h/2, w*0.35, 0, Math.PI*2); g.stroke();
    g.beginPath();
    g.moveTo(w/2, 4); g.lineTo(w/2, h*0.25);
    g.moveTo(w/2, h-4); g.lineTo(w/2, h*0.75);
    g.moveTo(4, h/2); g.lineTo(w*0.25, h/2);
    g.moveTo(w-4, h/2); g.lineTo(w*0.75, h/2);
    g.stroke();
  }
}

/* -------------------------------------------------------------------- Sound
   Prosedurel WebAudio. Dosya yok. AudioContext askiyken hic hata firlatmaz.
   Ilk kullanici dokunusu/tusunda acilir (mobilde sart). M ile sessize alma.
   Ses uretimi simulasyonu ETKILEMEZ — determinizm testleri aynen gecmeli.    */
