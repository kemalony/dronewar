class Input {
  constructor(game) {
    this.game = game;
    this.keys = new Set();
    this.touchX = null; this.touchY = null;
    this.touchDX = null; this.touchDY = null;
    this.baseX = 0; this.baseY = 0;
    /* _activePointer hic baslatilmamisti (undefined). Asagidaki korumalar
       `=== null` ile yaziliydi ve undefined'i yakalamiyordu: parmak basili
       olmadan gelen tek bir pointermove bile _originX'i undefined okuyup
       touchDX'i NaN yapiyor, oyuncu konumu NaN'a dusuyor ve cizim
       createRadialGradient'te patliyordu. */
    this._activePointer = null;
    this._originX = 0; this._originY = 0;
    /* Dash: tek seferlik bayrak + yön. consumeDash() okuyup sıfırlar. */
    this._dashQueued = false;
    this._dashDirX = 0; this._dashDirY = -1; // varsayılan: yukarı
    this._lastTouchTime = 0;
    this._lastSlideX = 0; this._lastSlideY = 0;
    /* Sub-dron firlatma: tek seferlik bayrak + ikinci parmak takibi */
    this._subLaunchQueued = false;
    this._secondPointerId = null;
    this._bind();
  }
  _bind() {
    const down = (e) => {
      if (e.repeat) return;
      const k = this._map(e.code);
      if (k) { this.keys.add(k); e.preventDefault(); }
      // Ilk tus basisinda sesi ac (mobilde sart)
      this.game.sound.unlock();
      if (k === 'pause') this.game.togglePause();
      if (k === 'menu')  this.game.toMenu();
      if (k === 'mute')  this.game.sound.toggleMute();
      /* Round 12: Q ile elle silah degistirme */
      if (k === 'switch') this.game.switchWeapon();
      /* Dash: Shift veya K — yön mevcut hareket yönü, yoksa yukarı */
      if (k === 'dash') this._queueDashFromAxis();
      /* Sub-dron firlatma: E veya F */
      if (k === 'sublaunch') this._subLaunchQueued = true;
    };
    const up = (e) => { const k = this._map(e.code); if (k) this.keys.delete(k); };
    addEventListener('keydown', down);
    addEventListener('keyup', up);
    const cv = this.game.canvas;
    /* Dokunmatikte oyun OYNANAMIYORDU: menude yalnizca "SPACE" yaziyordu, ekrana
       dokunmak hicbir sey yapmiyordu ve ates icin tus yoktu. Uc sey eklendi:
       dokunus oyunu baslatir/yeniden baslatir, parmak ekranda oldugu surece ates
       acilir, hareket birebir bagil takiple olur.                                */
    cv.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.game.sound.unlock();
      const st = this.game.state;
      /* Round 12: dron secim ekraninda dokunmatik bolgeler —
         sol ucte bir: sola, orta: baslat, sag ucte bir: saga.
         Durum 'shipselect' KALMALI, oyun baslamamali (orta disinda). */
      if (st === 'shipselect') {
        const p = this._canvasPos(e);
        const third = CONFIG.W / 3;
        if (p.x < third) this.game.shipSelectLeft();
        else if (p.x > CONFIG.W - third) this.game.shipSelectRight();
        else this.game.confirmShipSelect();   // orta: baslat
        return;
      }
      if (st === 'menu' || st === 'gameover' || st === 'victory') { this.game.toShipSelect(); return; }
      if (st === 'pause') { this.game.togglePause(); return; }
      /* İki parmakla dokunus: sub-dron firlatma. Birincil parmak zaten ekrandaysa
         ve ikinci parmak da basiliyorsa, dash degil sub-launch tetikle. */
      if (this._activePointer != null && this._secondPointerId == null) {
        this._secondPointerId = e.pointerId;
        this._subLaunchQueued = true;
        return;
      }
      /* Çift dokunuş dash: 300 ms içinde ikinci dokunuş */
      const now = performance.now();
      if (now - this._lastTouchTime < 300) {
        this._queueDashFromSlide();
        this._lastTouchTime = 0; // üçüncü dokunuş tetiklemesin
      } else {
        this._lastTouchTime = now;
      }
      this._beginTouch(e);
    }, { passive: false });
    cv.addEventListener('pointermove', (e) => {
      if (this._activePointer == null) return;
      e.preventDefault();
      this._moveTouch(e);
    }, { passive: false });
    const endTouch = (e) => {
      /* Ikinci parmak kalktiysa sadece onu temizle; birincil devam etsin */
      if (this._secondPointerId != null && e.pointerId === this._secondPointerId) {
        this._secondPointerId = null;
        return;
      }
      this.releaseTouch();
    };
    addEventListener('pointerup', endTouch);
    addEventListener('pointercancel', endTouch);
  }
  _map(code) {
    switch (code) {
      case 'ArrowLeft': case 'KeyA': return 'left';
      case 'ArrowRight': case 'KeyD': return 'right';
      case 'ArrowUp': case 'KeyW': return 'up';
      case 'ArrowDown': case 'KeyS': return 'down';
      case 'Space': case 'KeyZ': return 'fire';
      case 'ShiftLeft': case 'ShiftRight': case 'KeyK': return 'dash';
      case 'KeyP': return 'pause';
      case 'KeyM': return 'mute';
      case 'KeyQ': return 'switch';   // Round 12: elle silah degistirme
      case 'KeyE': case 'KeyF': return 'sublaunch';
      case 'Escape': return 'menu';
    }
    return null;
  }
  _canvasPos(e) {
    const r = this.game.canvas.getBoundingClientRect();
    const scale = CONFIG.W / (r.width || CONFIG.W);
    return { x: (e.clientX - r.left) * scale, y: (e.clientY - r.top) * scale };
  }
  _beginTouch(e) {
    this._activePointer = e.pointerId;
    const p = this._canvasPos(e);
    this._originX = p.x; this._originY = p.y;
    this.touchDX = 0; this.touchDY = 0;
    const pl = this.game.player;
    this.baseX = pl ? pl.x : CONFIG.W / 2;   // dokunus anindaki dron konumu
    this.baseY = pl ? pl.y : CONFIG.H - 140;
    this.keys.add('fire');                   // parmak ekranda: otomatik ates
  }
  _moveTouch(e) {
    const p = this._canvasPos(e);
    this.touchDX = p.x - this._originX;
    this.touchDY = p.y - this._originY;
    /* Son kayma yönünü dash için sakla */
    this._lastSlideX = this.touchDX;
    this._lastSlideY = this.touchDY;
  }
  /* Autotest / programatik giris — klavye ile ayni noktaya yazar. */
  setKey(name, on) { if (on) this.keys.add(name); else this.keys.delete(name); }
  /* Autotest kancasi GERCEK yolu kullanir: kanca ile sahaya cikan kod ayrisirsa
     harness farki goremez (game/ projesinde tam bu yasandi). */
  touchStart(x, y) {
    this._activePointer = -1;
    this._originX = x; this._originY = y;
    this.touchDX = 0; this.touchDY = 0;
    const pl = this.game.player;
    this.baseX = pl ? pl.x : CONFIG.W / 2;
    this.baseY = pl ? pl.y : CONFIG.H - 140;
    this.keys.add('fire');
  }
  touchMove(x, y) {
    if (this._activePointer == null) this.touchStart(x, y);
    this.touchDX = x - this._originX; this.touchDY = y - this._originY;
    this._lastSlideX = this.touchDX;
    this._lastSlideY = this.touchDY;
  }
  releaseTouch() {
    this.touchX = null; this.touchY = null;
    this.touchDX = null; this.touchDY = null;
    this._activePointer = null;
    this._secondPointerId = null;
    this._lastSlideX = 0; this._lastSlideY = 0;
    this.keys.delete('fire');
  }
  axis() {
    let ax = 0, ay = 0;
    if (this.keys.has('left'))  ax -= 1;
    if (this.keys.has('right')) ax += 1;
    if (this.keys.has('up'))    ay -= 1;
    if (this.keys.has('down'))  ay += 1;
    if (ax && ay) { const inv = 1 / Math.SQRT2; ax *= inv; ay *= inv; } // carpaz normalize
    return { ax, ay };
  }
  firing() { return this.keys.has('fire'); }
  /* Dash: tek seferlik bayrak + yön. Player her sim adımında okur;
     tüketilirse false döner. Yön normalize edilmiş birim vektördür. */
  consumeDash() {
    if (!this._dashQueued) return null;
    this._dashQueued = false;
    return { x: this._dashDirX, y: this._dashDirY };
  }
  _queueDashFromAxis() {
    const a = this.axis();
    const len = Math.hypot(a.ax, a.ay);
    if (len > 0) {
      this._dashDirX = a.ax / len;
      this._dashDirY = a.ay / len;
    } else {
      this._dashDirX = 0; this._dashDirY = -1; // yukarı
    }
    this._dashQueued = true;
  }
  _queueDashFromSlide() {
    const len = Math.hypot(this._lastSlideX, this._lastSlideY);
    if (len > 4) { // anlamlı kayma yoksa varsayılan yön
      this._dashDirX = this._lastSlideX / len;
      this._dashDirY = this._lastSlideY / len;
    } else {
      this._dashDirX = 0; this._dashDirY = -1;
    }
    this._dashQueued = true;
  }
  /* Sub-dron firlatma: tek seferlik bayrak. Player her sim adiminda okur;
     tuketilirse false doner. */
  consumeSubLaunch() {
    if (!this._subLaunchQueued) return false;
    this._subLaunchQueued = false;
    return true;
  }
}

/* ------------------------------------------------------------------- Assets
   Her cizim yolu ONCE yuklenen gorseli, yoksa prosedurel yedeğini kullanir.
   PNG'ler new Image() ile yuklenir; onerror -> prosedurel yedek.           */
