class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.scale = 1;                       // arka bellek olcegi (1..2)
    this.frameTimes = [];                 // son 40 kare sure (ms)
    this.lastChange = 0;                  // son ornek degisikligi (perf.now)
    this.drawCalls = 0; this.saveCalls = 0;
    this.resize();
  }
  resize() {
    const dpr = window.devicePixelRatio || 1;
    const cssW = this.canvas.clientWidth || CONFIG.W;
    const cssH = this.canvas.clientHeight || CONFIG.H;
    // arka bellek = min(css*dpr, ic cozunurluk * olcek)
    const target = Math.min(cssW * dpr, CONFIG.W * this.scale);
    const ratio = CONFIG.H / CONFIG.W;
    this.bw = Math.round(target);
    this.bh = Math.round(target * ratio);
    if (this.canvas.width !== this.bw) this.canvas.width = this.bw;
    if (this.canvas.height !== this.bh) this.canvas.height = this.bh;
    this.ctx.imageSmoothingEnabled = true;   // piksel-art DEGIL
    this.ctx.imageSmoothingQuality = 'high';
  }
  recordFrame(ms) {
    this.frameTimes.push(ms);
    if (this.frameTimes.length > CONFIG.RES.windowFrames) this.frameTimes.shift();
    const now = performance.now();
    if (now - this.lastChange < CONFIG.RES.changeInterval * 1000) return;
    if (this.frameTimes.length < CONFIG.RES.windowFrames) return;
    const med = this._median(this.frameTimes);
    if (med > CONFIG.RES.dropBelow && this.scale > CONFIG.RES.minScale) {
      this.scale = Math.max(CONFIG.RES.minScale, this.scale - 0.25);
      this.lastChange = now; this.resize();
    } else if (med < CONFIG.RES.raiseAbove && this.scale < CONFIG.RES.maxScale) {
      this.scale = Math.min(CONFIG.RES.maxScale, this.scale + 0.25);
      this.lastChange = now; this.resize();
    }
  }
  _median(a) {
    const s = a.slice().sort((x, y) => x - y);
    const m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m-1] + s[m]) / 2;
  }
  begin() {
    this.drawCalls = 0; this.saveCalls = 0;
    const c = this.ctx;
    c.setTransform(this.bw / CONFIG.W, 0, 0, this.bh / CONFIG.H, 0, 0);
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = 1;
    c.fillStyle = '#05070d'; c.fillRect(0, 0, CONFIG.W, CONFIG.H);
  }
  save() { this.ctx.save(); this.saveCalls++; }
  restore() { this.ctx.restore(); }
  debugOverlay(state) {
    if (!CONFIG.DEBUG) return;
    const c = this.ctx;
    c.save();
    c.font = '12px monospace'; c.fillStyle = '#7CFC00';
    const fps = state.fps ? (1000 / state.fps).toFixed(0) : '-';
    c.fillText(`FPS ${fps}  frame ${state.frameMs.toFixed(2)}ms`, 8, 16);
    c.fillText(`scale ${this.scale.toFixed(2)}  draw ${this.drawCalls}  save ${this.saveCalls}`, 8, 30);
    c.fillText(`bullets ${state.bulletsActive}/${CONFIG.FIRE.pool}  heap ok`, 8, 44);
    if (state.enemies) c.fillText(`enemies ${state.enemies.length}  score ${state.score}`, 8, 58);
    // hitbox
    if (state.player) {
      const p = state.player;
      c.strokeStyle = '#ff0'; c.lineWidth = 1;
      c.strokeRect(p.x - CONFIG.PLAYER.half, p.y - CONFIG.PLAYER.half,
                   CONFIG.PLAYER.size, CONFIG.PLAYER.size);
    }
    c.restore();
  }
}

/* --------------------------------------------------------------------- Pool
   Sıcak dongude `new` yok. Tushenme yoksa reuse.                          */
