class Carrier {
  constructor() { this.active = false; }
  reset(stageIdx) {
    const C = CONFIG.CARRIER;
    this.stageIdx = stageIdx;
    this.x = CONFIG.W / 2;
    this.y = -100;                  // üstten girecek
    this.t = 0;                      // sim saati (s) — giriş + salınım
    this.bodyHp = C.bodyHp;
    this.maxBodyHp = C.bodyHp;
    this.hitFlash = 0;               // gövde vuruş parlaması kalan süre (s)
    /* Parçalar: her biri kendi can'ı, sprite'ı ve konum ofsetiyle.
       Sıra: pylonL, pylonR -> bay -> antenna -> body. */
    this.parts = {};
    for (const id of ['pylonL', 'pylonR', 'bay', 'antenna']) {
      const P = C.parts[id];
      this.parts[id] = { hp: P.hp, maxHp: P.hp, alive: true, hitFlash: 0 };
    }
    /* Atış zamanlayıcıları (sim zamanına bağlı — performance.now YOK) */
    this.pylonFireT = C.pylonFireMs / 1000;
    this.bayLaunchT = C.bayLaunchMs / 1000;
    this._seed = (1000 + stageIdx * 7919) >>> 0;   // LCG tohumu
    this.active = true;
  }
  _lcg() {
    this._seed = (Math.imul(this._seed, 1664525) + 1013904223) >>> 0;
    return this._seed / 4294967296;
  }
  /* Gövde ancak anten düştükten sonra hasar alır. */
  get bodyVulnerable() { return !this.parts.antenna.alive; }
  /* state().carrier için: { parts: {id: hp}, bodyVulnerable } */
  state() {
    const parts = {};
    for (const id in this.parts) parts[id] = this.parts[id].hp;
    return { parts, bodyVulnerable: this.bodyVulnerable };
  }
  update(dt, game) {
    if (!this.active) return;
    const C = CONFIG.CARRIER;
    this.t += dt;
    if (this.hitFlash > 0) this.hitFlash -= dt;
    /* Giriş inişi: üstten hoverY'ye sabit hız */
    const entryT = C.entryMs / 1000;
    if (this.t < entryT) {
      this.y = -100 + (C.hoverY + 100) * (this.t / entryT);
      this.x = CONFIG.W / 2;
      return;
    }
    /* Salınım: y=hoverY'de sabit, x = merkez ± swayAmp */
    const ph = ((this.t - entryT) / C.swayPeriod) * Math.PI * 2;
    this.x = CONFIG.W / 2 + Math.sin(ph) * C.swayAmp;
    this.y = C.hoverY;
    /* --- Parça saldırıları (yalnızca canlı parçalar ateş eder) --- */
    const p = game.player;
    /* Pilon top ateşi: nişanlı 3'lü yelpaze (her iki pilon ayrı zamanlayıcıda) */
    if (this.parts.pylonL.alive || this.parts.pylonR.alive) {
      this.pylonFireT -= dt;
      if (this.pylonFireT <= 0) {
        this.pylonFireT = C.pylonFireMs / 1000;
        this._firePylons(game, p);
      }
    }
    /* Kargo kapağı: düşman dronu fırlatır */
    if (this.parts.bay.alive) {
      this.bayLaunchT -= dt;
      if (this.bayLaunchT <= 0) {
        this.bayLaunchT = C.bayLaunchMs / 1000;
        this._launchDrone(game);
      }
    }
    /* Anten jammer alanı: oyuncu menzildeyken atış aralığı yavaşlar.
       Bu bir SIM etkisidir — Player.update fireTimer hesaplamasında okunur. */
    const dx = p.x - this.x, dy = p.y - this.y;
    this.inJamRange = this.parts.antenna.alive &&
      (dx * dx + dy * dy) <= C.antennaJamRadius * C.antennaJamRadius;
  }
  /* Pilon top ateşi: her canlı pilondan nişanlı 3'lü yelpaze. */
  _firePylons(game, player) {
    const C = CONFIG.CARRIER;
    const off = C.partOffsets;
    for (const id of ['pylonL', 'pylonR']) {
      if (!this.parts[id].alive) continue;
      const px = this.x + off[id].x, py = this.y + off[id].y;
      const dx = player.x - px, dy = player.y - py;
      const base = Math.atan2(dy, dx);
      for (let i = -1; i <= 1; i++) {
        const a = base + i * (18 * Math.PI / 180);
        this._emit(game, px, py + 20, Math.cos(a) * C.bulletSpeed, Math.sin(a) * C.bulletSpeed);
      }
    }
    game.sound.bossShot();
  }
  /* Kargo kapağı: en yakın aktif düşmana doğru düşman dronu fırlatır.
     Havuzdan scout tipi düşman alınır; yoksa ekrandan aşağı mermi. */
  _launchDrone(game) {
    const C = CONFIG.CARRIER;
    const off = C.partOffsets.bay;
    const bx = this.x + off.x, by = this.y + off.y;
    /* Düşman havuzundan scout al (varsa) */
    const pools = [game.scoutPool, game.gunnerPool, game.kamikazePool];
    let launched = false;
    for (const pool of pools) {
      if (pool.count() >= pool.items.length) continue;   // dolu
      const e = pool.acquire();
      if (!e) continue;
      e.reset('scout', bx, by);
      e.speed = 200;   // yavaş iniş
      launched = true;
      break;
    }
    if (!launched) {
      /* Havuz doluysa: aşağıya 3'lü bomba yelpazesi (yedek saldırı) */
      for (let i = -1; i <= 1; i++) {
        this._emit(game, bx, by + 20, i * 80, 220);
      }
    }
    game.sound.enemyShot();
  }
  _emit(game, x, y, vx, vy) {
    const b = game.ebulletPool.acquire();
    if (!b) return;
    b.reset(x, y, true);
    b.vx = vx; b.vy = vy;
  }
  /* Mermi çarpışması: önce parçalara, sonra gövdeye.
     Geri döndürülen değer: 'part' | 'body' | null */
  hitBullet(bx, by, br) {
    const C = CONFIG.CARRIER;
    /* Önce parçaları dene (konuma en yakın olan) */
    let bestPart = null, bestD = Infinity;
    for (const id in this.parts) {
      const part = this.parts[id];
      if (!part.alive) continue;
      const off = C.partOffsets[id];
      const px = this.x + off.x, py = this.y + off.y;
      const P = C.parts[id];
      const hw = P.w / 2 + br, hh = P.h / 2 + br;
      const dx = bx - px, dy = by - py;
      if (Math.abs(dx) <= hw && Math.abs(dy) <= hh) {
        const d = dx * dx + dy * dy;
        if (d < bestD) { bestD = d; bestPart = id; }
      }
    }
    if (bestPart) {
      const part = this.parts[bestPart];
      part.hp--;
      part.hitFlash = CONFIG.FX.hitFlashMs / 1000;
      if (part.hp <= 0) {
        part.alive = false;
        /* Düşen parça patlar ve o parçanın saldırısı durur */
        const off = C.partOffsets[bestPart];
        return { type: 'part', id: bestPart, x: this.x + off.x, y: this.y + off.y };
      }
      return { type: 'hit', id: bestPart };
    }
    /* Gövde: yalnızca anten düştükten sonra hasar alır */
    if (this.bodyVulnerable) {
      const rr = 60 + br;   // gövde hitbox yarıçapı
      const dx = bx - this.x, dy = by - this.y;
      if (dx * dx + dy * dy <= rr * rr) {
        this.bodyHp--;
        this.hitFlash = CONFIG.FX.hitFlashMs / 1000;
        if (this.bodyHp <= 0) return { type: 'bodyKilled' };
        return { type: 'bodyHit' };
      }
    }
    return null;
  }
  draw(c, assets) {
    const C = CONFIG.CARRIER;
    c.save();
    c.translate(this.x, this.y);
    /* Gövde: boss_tokyo sprite'ı (ana gövde). Anten düştükten sonra
       hasar görme efekti: hafif titreme (yalnız çizim). */
    const bodyW = 208, bodyH = 176;
    const shake = this.bodyVulnerable ? (this.hitFlash > 0 ? 2 : 0) : 0;
    const sx = shake ? (this._lcg() - 0.5) * 4 : 0;
    const sy = shake ? (this._lcg() - 0.5) * 4 : 0;
    assets.draw(c, 'boss_tokyo', -bodyW / 2 + sx, -bodyH / 2 + sy, bodyW, bodyH);
    /* Gövde vuruş parlaması */
    if (this.hitFlash > 0) {
      const a = Math.min(1, this.hitFlash / (CONFIG.FX.hitFlashMs / 1000));
      c.globalAlpha = a;
      c.globalCompositeOperation = 'lighter';
      const w = assets.whiteTint('boss_tokyo');
      if (w) c.drawImage(w, -bodyW / 2, -bodyH / 2, bodyW, bodyH);
      c.globalAlpha = 1;
      c.globalCompositeOperation = 'source-over';
    }
    /* Parçalar: her biri kendi sprite'ı + konum ofsetiyle */
    for (const id in this.parts) {
      const part = this.parts[id];
      if (!part.alive) continue;
      const off = C.partOffsets[id];
      const P = C.parts[id];
      c.save();
      c.translate(off.x, off.y);
      assets.draw(c, P.sprite, -P.w / 2, -P.h / 2, P.w, P.h);
      /* Parça vuruş parlaması */
      if (part.hitFlash > 0) {
        const a = Math.min(1, part.hitFlash / (CONFIG.FX.hitFlashMs / 1000));
        c.globalAlpha = a;
        c.globalCompositeOperation = 'lighter';
        const w = assets.whiteTint(P.sprite);
        if (w) c.drawImage(w, -P.w / 2, -P.h / 2, P.w, P.h);
        c.globalAlpha = 1;
        c.globalCompositeOperation = 'source-over';
      }
      /* Can göstergesi: ince bar (parça üstünde) */
      const frac = part.hp / part.maxHp;
      if (frac < 1) {
        c.fillStyle = 'rgba(0,0,0,0.5)';
        c.fillRect(-P.w / 2, -P.h / 2 - 8, P.w, 4);
        c.fillStyle = '#ff5540';
        c.fillRect(-P.w / 2, -P.h / 2 - 8, P.w * frac, 4);
      }
      c.restore();
    }
    /* Anten jammer alanı: soluk nabız halkası (yalnız çizim) */
    if (this.parts.antenna.alive) {
      const pulse = 0.5 + 0.5 * Math.sin(this.t * 1.2);
      const r = C.antennaJamRadius * (0.92 + 0.08 * pulse);
      c.globalAlpha = 0.08 + 0.06 * pulse;
      c.strokeStyle = 'rgba(180,120,255,1)';
      c.lineWidth = 2;
      c.beginPath(); c.arc(0, C.partOffsets.antenna.y, r, 0, Math.PI * 2); c.stroke();
      c.globalAlpha = 1;
    }
    c.restore();
  }
}

/* ---------------------------------------------------------------------- Game
   boot -> menu -> play -> pause -> gameover/victory                        */
