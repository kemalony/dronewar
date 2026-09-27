class Player {
  constructor(droneId) {
    // Round 12: dron secimi — CONFIG.DRONES tablosundan ozellikler gelir
    const D = CONFIG.DRONES.find((d) => d.id === (droneId || 'falcon')) || CONFIG.DRONES[0];
    this.droneId = D.id;
    this.sprite = D.sprite;
    this.maxSpeed = D.speed;
    this.x = CONFIG.W / 2; this.y = CONFIG.H * 0.78;
    this.vx = 0; this.vy = 0;
    this.fireTimer = 0; this.muzzle = 0; this.tilt = 0;
    this.lives = D.lives;
    this.invincible = 0;
    this._invincibleMs = D.invincibleMs || CONFIG.INVINCIBLE_MS;   // ghost: 2000ms
    this._hitboxMul = D.hitboxMul || 1;                            // tank: %15 buyuk
    /* acro-dash: sim zamanina bagli, cizimden bagimsiz. Iz noktalari sabit boyutlu
       dizi (sicak dongude new yok); trailLen kadar slot, en eski uzerine yazar. */
    const DASH = CONFIG.PLAYER.DASH;
    this.dashT = 0;            // kalan dash suresi (s)
    this.dashCd = 0;           // kalan cooldown (s)
    this._dashDirX = 0; this._dashDirY = -1;
    this._trail = [];
    for (let i = 0; i < DASH.trailLen; i++) this._trail.push({ x: 0, y: 0, a: 0 });
    /* Isisi sistemi (round 13): dash + roket + sub-launch is harcar.
       BIRINCIL ATIS IS HARCAMAZ. overheatAt'e ulasinca kilit: ates araligi
       overheatFireMul kadar yavaslar, dash kullanilamaz. recoverAt'in altina
       inince normale doner. Tek kaynak: Game._addHeat — Game.state() ve HUD
       game.heat'i okur; Player kendi degiskenini tutarsa iki gorunum ayrisir. */
    /* Sub-dronlar (round 13): 2 mini refakatci, havuzdan beslenir. */
    this.subs = new Pool(CONFIG.SUBDRONE.pool, () => new SubDrone());
    this._subSide = [1, -1];   // sag, sol — her sub-drone bir tarafa bagli
  }
  /* Mikro kacis hamlesi: 180 ms boyunca 3x hiz + dokunulmazlik. Tetikleme girdi
     paketindedir; buradan yalnizca Player tarafini calistirir. */
  /* Havuza bir sub-dron ekler (pu_subdrone alindiginda). Tek giris noktasi:
     game paketi kendi sayacini doldurmak yerine burayi cagirir. */
  addSub() {
    if (this.subs.count() >= CONFIG.SUBDRONE.max) return false;
    const s = this.subs.acquire();
    if (!s) return false;
    s.reset(this.x, this.y);
    s._side = this._subSide[this.subs.count() - 1] || 1;
    s.mode = 'gun';
    return true;
  }
  dash(dirX, dirY, game) {
    const DASH = CONFIG.PLAYER.DASH;
    if (this.dashCd > 0 || game.overheated) return false;
    /* Is harca: dash is maliyeti — tek kaynak Game.heat (state/HUD oradan okur) */
    game._addHeat(CONFIG.HEAT.cost.dash);
    const len = Math.hypot(dirX, dirY);
    if (len === 0) { dirX = 0; dirY = -1; } else { dirX /= len; dirY /= len; }
    this._dashDirX = dirX; this._dashDirY = dirY;
    this.dashT = DASH.ms / 1000;
    this.dashCd = DASH.cooldownMs / 1000;
    return true;
  }
  get dashActive() { return this.dashT > 0; }
  /* Hitbox yaricapi (tank %15 buyuk). */
  hitR() { return CONFIG.PLAYER.half * this._hitboxMul; }
  takeHit() {
    if (this.invincible > 0 || this.dashT > 0) return false;   // dash suresince dokunulmaz
    this.lives--;
    this.invincible = this._invincibleMs / 1000;
    return true;
  }
  /* Sinir kelepcesi: hitbox ekran icinde kalir, temasta o eksenin hizi sifirlanir. */
  _clamp() {
    const h = CONFIG.PLAYER.half;
    if (this.x < h) { this.x = h; if (this.vx < 0) this.vx = 0; }
    else if (this.x > CONFIG.W - h) { this.x = CONFIG.W - h; if (this.vx > 0) this.vx = 0; }
    if (this.y < h) { this.y = h; if (this.vy < 0) this.vy = 0; }
    else if (this.y > CONFIG.H - h) { this.y = CONFIG.H - h; if (this.vy > 0) this.vy = 0; }
  }
  update(dt, input, game) {
    const P = CONFIG.PLAYER;
    let { ax, ay } = input.axis();          // const idi: dokunmatik yol atama
    let hasInput = (ax !== 0 || ay !== 0);  // yapinca TypeError firlatiyordu
    /* Dokunmatik: BIREBIR bagil takip. Parmagin bastigi noktaya ucmak yerine,
       parmagin bastigindan beri kaydigi kadar dron kayar — parmak dronu
       kapatmaz ve nisan almak birebir olur (game/ projesinde dogrulanan tasarim).
       Ivme/atalet devre disi: hedefe hiz sinirli, dogrudan gidilir. */
    if (input.touchDX != null) {
      const tx = Math.max(P.half, Math.min(CONFIG.W - P.half, input.baseX + input.touchDX));
      const ty = Math.max(P.half, Math.min(CONFIG.H - P.half, input.baseY + input.touchDY));
      const dx = tx - this.x, dy = ty - this.y;
      const dist = Math.hypot(dx, dy);
      const step = P.followSpeed * dt;
      if (dist <= step || dist === 0) { this.x = tx; this.y = ty; this.vx = 0; this.vy = 0; }
      else { this.x += dx / dist * step; this.y += dy / dist * step;
             this.vx = dx / dist * P.followSpeed; this.vy = dy / dist * P.followSpeed; }
      this._clamp();
      hasInput = false;          // hareket bu dalda tamamlandi
      ax = 0; ay = 0;
    } else if (hasInput) {
      this.vx += ax * P.accel * dt;
      this.vy += ay * P.accel * dt;
    } else {
      // ustel sonum: yaromuru 0.12 s
      const f = Math.pow(0.5, dt / P.decayHalfLife);
      this.vx *= f; this.vy *= f;
      if (Math.abs(this.vx) < 0.5) this.vx = 0;
      if (Math.abs(this.vy) < 0.5) this.vy = 0;
    }
    /* Dokunmatik dalda konum zaten hesaplandi; ivme/entegrasyon adimlari
       yalnizca klavye yolunda calisir. Ilk denemede bu dal `return` ediyordu ve
       ates kodu hic calismiyordu — klavyeyle atis sayisi 0'a dustu. */
    const touchDriven = (input.touchDX != null);
    /* Dash tetikleme: input.consumeDash() tek seferlik bayragi okur.
       Is soneumu Game._simStep yapar (tek kaynak game.heat). */
    const dashDir = input.consumeDash();
    if (dashDir) this.dash(dashDir.x, dashDir.y, game);
    const DASH = CONFIG.PLAYER.DASH;
    /* acro-dash: sim zamanina bagli 3x hamle. Dash sirasinda normal hareket
       devre disi kalir; iz noktasi her adimda en eski slotun uzerine yazilir. */
    if (this.dashT > 0) {
      const dSp = this.maxSpeed * DASH.speedMul;
      this.vx = this._dashDirX * dSp; this.vy = this._dashDirY * dSp;
      this.x += this.vx * dt; this.y += this.vy * dt;
      const tr = this._trail, n = tr.length, gap = DASH.trailGap;
      for (let i = n - 1; i >= 1; i--) {
        const c = tr[i], p = tr[i - 1];
        c.x = p.x; c.y = p.y; c.a = Math.min(1, p.a + gap / (DASH.ms / 1000));
      }
      tr[0].x = this.x; tr[0].y = this.y; tr[0].a = 1;
      this.dashT -= dt;
      if (this.dashT < 0) this.dashT = 0;
    } else {
      const ms = this.maxSpeed;   // Round 12: dron bazli maks hiz
      if (!touchDriven) {
        // maks hiz
        const sp = Math.hypot(this.vx, this.vy);
        if (sp > ms) { const k = ms / sp; this.vx *= k; this.vy *= k; }
        // entegre
        this.x += this.vx * dt; this.y += this.vy * dt;
      }
    }
    if (this.dashCd > 0) this.dashCd -= dt;
    // dash bitince izi sonumle (cizim tarafinda kullanilir)
    for (const t of this._trail) {
      if (t.a > 0) { t.a -= dt / (DASH.ms / 1000); if (t.a < 0) t.a = 0; }
    }
    // hitbox ekranda kalir, temasta o eksenin hizi sifirlanir
    const h = this.hitR();
    if (this.x < h) { this.x = h; this.vx = 0; }
    if (this.x > CONFIG.W - h) { this.x = CONFIG.W - h; this.vx = 0; }
    if (this.y < h) { this.y = h; this.vy = 0; }
    if (this.y > CONFIG.H - h) { this.y = CONFIG.H - h; this.vy = 0; }
    // hafif yalpa: yatay hiza bagli ±6° (yalniz cizim)
    let targetTilt = Math.max(-1, Math.min(1, this.vx / this.maxSpeed)) * (6 * Math.PI / 180);
    if (this.dashT > 0) {
      /* Dash sirasinda govde 25° yatar (yalniz cizim) — hamle yonune dogru. */
      targetTilt = Math.atan2(this._dashDirY, this._dashDirX) * (25 / 90);   // ±25°
    }
    this.tilt += (targetTilt - this.tilt) * Math.min(1, dt * 12);
    // ates (round 10: uc seviye, PARALEL mermi — round 12: swift %15 kisa aralik)
    // Round 13: overheated iken ates araligi overheatFireMul kadar yavaslar
    this.fireTimer -= dt;
    if (input.firing() && this.fireTimer <= 0) {
      const W = CONFIG.WEAPON;
      const lv = W.levels[game.weaponLevel - 1];
      let interval = lv.interval;
      if (this.droneId === 'swift') interval *= 0.85;   // swift: %15 kisa
      if (game.overheated) interval /= CONFIG.HEAT.overheatFireMul;   // is kilidi
      /* Round 16: jammer (kara veya hava) menzilde -> ates araligi uzar.
         Tek kaynak game.fireSlowMul; Game._computeFireMods her sim adiminda
         hesaplar ve iki jammer ayni anda etkiliyse carpan bir kez uygulanir. */
      if (game.fireSlowMul && game.fireSlowMul < 1) interval /= game.fireSlowMul;
      this.fireTimer = interval;
      this.muzzle = CONFIG.FIRE.muzzleMs / 1000;
      const offsets = lv.count === 1 ? [0] :
                      lv.count === 2 ? [-lv.offset, lv.offset] :
                                        [-lv.offset, 0, lv.offset];
      for (const ox of offsets) {
        const b = game.bulletPool.acquire();
        if (b) { b.reset(this.x + ox, this.y - h); }
      }
      /* Atis sayaci Game'in tek giris noktasindan gecer: hem shotsFired hem
         kosu istatistigi (_stats.shots) orada artar. Burada dogrudan
         `game.shotsFired += ...` yazilirsa istatistik sifir kalir. */
      game.addShots(offsets.length);
      game.sound.playerShot();
    }
    if (this.muzzle > 0) this.muzzle -= dt;
    if (this.invincible > 0) this.invincible -= dt;
    /* Sub-dronlar: takip + ates */
    this.subs.forEach((s) => s.update(dt, game));
  }
  draw(ctx, assets) {
    const P = CONFIG.PLAYER;
    /* acro-dash izi: dash sirasinda ve bitiminden sonra kisa bir sure,
       govdenin arkasinda solan alfa kopyalari (yalniz cizim). */
    for (const t of this._trail) {
      if (t.a <= 0.01) continue;
      ctx.save();
      ctx.globalAlpha = t.a * 0.35;
      ctx.translate(t.x, t.y);
      ctx.rotate(this.tilt);
      const s = P.size * 1.1;
      assets.draw(ctx, this.sprite, -s/2, -s/2, s, s);
      ctx.restore();
    }
    // Round 4: tam cyan cerceg DEGIL — dronun altina yumusak radyal koyu hale
    // (sehir dokusunu bastirip silueti ayirir) + govde kenarina ince cyan
    // kenar isigi. Amaç: dron her zaman okunsun ama sahneye ait gorunsun.
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.tilt);
    // dokunulmazlik: yanip sonek (100ms periyot)
    if (this.invincible > 0 && Math.floor(this.invincible * 10) % 2 === 0) {
      ctx.globalAlpha = 0.3;
    }
    // 1) yumusak radyal koyu hale (alfa <= 0.35, yaricap ~ dron genisligi x 0.8)
    /* Hale guclendirildi: denetim turlarca "dron parlak sehir isiklarinda
       kaynasiyor" dedi ve bu dogruydu — zemin gece sehri oldugu icin bazi
       bolgeler dronun kendisinden parlak. Sehri karartmak yerine (denendi,
       sehir sahnenin yildizi) dronun altindaki koyu zemini buyutup
       koyulastiriyoruz: silüet her zeminde ayrisiyor.                        */
    const haloR = P.size * 1.05;
    const halo = ctx.createRadialGradient(0, 0, P.half * 0.35, 0, 0, haloR);
    halo.addColorStop(0, 'rgba(3,6,12,0.62)');
    halo.addColorStop(0.45, 'rgba(3,6,12,0.42)');
    halo.addColorStop(0.75, 'rgba(3,6,12,0.18)');
    halo.addColorStop(1, 'rgba(3,6,12,0)');
    ctx.fillStyle = halo;
    ctx.beginPath(); ctx.arc(0, 0, haloR, 0, Math.PI * 2); ctx.fill();
    // 2) dron sprite'i (%10 buyuk — ekranda belirgin). Round 12: secilen dron
    const s = P.size * 1.1;
    assets.draw(ctx, this.sprite, -s/2, -s/2, s, s);
    // 3) ince cyan kenar isigi (1-2 px, govde kenarina oturan parlaklik)
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(110,235,255,0.95)';
    ctx.lineWidth = 2;
    ctx.shadowColor = 'rgba(110,235,255,0.9)';
    ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.arc(0, 0, this.hitR() * 0.92, 0, Math.PI * 2); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
    // namlu alevi (her atista 60ms gorunur, parlak)
    if (this.muzzle > 0) {
      const a = this.muzzle / (CONFIG.FIRE.muzzleMs / 1000);
      ctx.save(); ctx.globalAlpha = a;
      ctx.globalCompositeOperation = 'lighter';
      assets.draw(ctx, 'muzzle_flash', this.x - 24, this.y - P.half - 30, 48, 48);
      ctx.restore();
    }
    /* Sub-dronlar: oyuncunun yaninda cizilir */
    this.subs.forEach((s) => s.draw(ctx, assets));
  }
}

/* ---------------------------------------------------------------------- Game
   boot -> menu -> play -> pause -> gameover/victory                        */
