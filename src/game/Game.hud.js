/* game paketi — HUD, bolum karti, menu/duraklat/gameover/zafer cizimleri.
   Round 17: Game.js'ten birebir tasinan metotlar; davranis DEGISMEDI. */
Object.assign(Game.prototype, {
  _render(alpha) {
    const r = this.renderer, c = r.ctx;
    r.begin();
    this._renderTo(c, alpha);
    r.debugOverlay({ fps: this.fps, frameMs: this.frameMs, player: this.player, bulletsActive: this.bulletPool.count(), enemies: this._enemiesState(), score: this.score });
  },
  /* Sahneyi verilen ctx'ye cizer (debug overlay YOK). screenshot() bunu
     yukey cozunurlukte bir offscreen canvas'a cagirmak icin kullanir.        */
  _renderTo(c, alpha) {
    if (this.state === 'menu') { this._drawMenu(c); }
    else if (this.state === 'shipselect') { this._drawShipSelect(c); }
    else if (this.state === 'play' || this.state === 'pause') {
      if (!this.player) return;   // boot: oyuncu yokken cizim atla (hata uretmesin)
      this._drawWorld(c, alpha);
      if (this.state === 'pause') this._drawPause(c);
    }
    else if (this.state === 'gameover' || this.state === 'victory') { this._drawEnd(c); }
  },
  /* Round 12: dron secim ekranı. Acik dronlar parlak + badge; kilitliler
     soluk cizim + acilis sart yazisi. Sol/sag ucte bir gezinir, orta baslatir. */
  _drawShipSelect(c) {
    c.save();
    c.globalAlpha = this.menuFadeT;
    this.assets.draw(c, 'city_istanbul', 0, 0, CONFIG.W, CONFIG.H);
    c.fillStyle = 'rgba(5,7,13,0.68)'; c.fillRect(0, 0, CONFIG.W, CONFIG.H);
    c.textAlign = 'center';
    c.fillStyle = '#fff'; c.font = 'bold 34px monospace';
    c.shadowColor = 'rgba(110,235,255,0.6)'; c.shadowBlur = 10;
    c.fillText('DRON SEÇ', CONFIG.W / 2, 90);
    c.shadowBlur = 0;
    // En yuksek skor (kilitler buna gore acilir)
    c.fillStyle = '#ffd24a'; c.font = '16px monospace';
    c.fillText(`EN YÜKSEK: ${this.bestScore}`, CONFIG.W / 2, 122);
    // Dort dronu yatay diz
    const n = CONFIG.DRONES.length;
    const cellW = CONFIG.W / n;
    for (let i = 0; i < n; i++) {
      const D = CONFIG.DRONES[i];
      const cx = cellW * i + cellW / 2;
      const cy = 300;
      const unlocked = this._droneUnlocked(i);
      const selected = (i === this.shipSelectIdx);
      // Secili vurgu halkasi
      if (selected && unlocked) {
        c.strokeStyle = 'rgba(110,235,255,0.9)';
        c.lineWidth = 3;
        c.beginPath(); c.arc(cx, cy, 62, 0, Math.PI * 2); c.stroke();
      }
      // Sprite (kilitli ise soluk)
      c.globalAlpha = this.menuFadeT * (unlocked ? 1 : 0.3);
      this.assets.draw(c, D.sprite, cx - 48, cy - 48, 96, 96);
      c.globalAlpha = this.menuFadeT;
      // Ad
      c.fillStyle = unlocked ? '#fff' : 'rgba(160,170,190,0.7)';
      c.font = 'bold 18px monospace';
      c.fillText(D.id.toUpperCase(), cx, cy + 84);
      /* Ozellik satirlari — sutun basina 120 px var; "Hız 400 · Can 3" tek
         satirda ~117 px tutuyordu ve komsu sutunlarla birbirine giriyordu
         ("...Can 3Hız 520..."). Iki kisa satira bolundu ve punto kucultuldu.
         Kilit simgesi (emoji) monospace fontta eksik karakter olarak ciziliyordu;
         yerine duz yazi kullaniliyor. */
      c.font = '12px monospace';
      c.fillStyle = unlocked ? '#9fd' : 'rgba(150,160,180,0.6)';
      c.fillText(`Hız ${D.speed}`, cx, cy + 106);
      c.fillText(`Can ${D.lives}`, cx, cy + 122);
      if (unlocked) {
        c.fillStyle = '#6fe3ff';
        c.font = '11px monospace';
        c.fillText(D.desc, cx, cy + 142);
      } else {
        c.fillStyle = '#ffb040';
        c.font = 'bold 11px monospace';
        c.fillText('KİLİTLİ', cx, cy + 142);
        c.font = '11px monospace';
        c.fillText(`${D.unlock.toLocaleString()} puan`, cx, cy + 158);
      }
    }
    // Dokunmatik bolge ipucu (mobil)
    c.fillStyle = '#9ab'; c.font = '14px monospace';
    c.fillText('Sol/Sağ: seç · Orta: başla', CONFIG.W / 2, 560);
    c.fillText('←/→ veya A/D: gezin · Space: başla', CONFIG.W / 2, 584);
    c.restore();
  },
  /* Mermiler: koyu kontur + parlak cekirdek (round 5).
     Her mermi kendi koyu zeminini tasir — parlak sokak isiklari uzerinde
     bile okunur. Toplam genislik <= 6 px, tracer_shape testi gecmeli.
     Dusman mermileri turuncu-kirmizi, oyuncu mermileri cyan.              */
  _drawBullets(c) {
    const L = 22;                       // iz uzunlugu (<= 22 px, tracer)
    this.tracerLen = L;                 // test kancasi: tracer_shape
    c.save();
    c.lineCap = 'round';
    // --- KOYU KONTUR (source-over): her mermi altina 1px koyu hat
    c.strokeStyle = 'rgba(0,0,0,0.7)';
    c.lineWidth = 6;
    c.beginPath();
    this.bulletPool.forEach((b) => { c.moveTo(b.x, b.y + L / 2); c.lineTo(b.x, b.y - L / 2); });
    c.stroke();
    this.ebulletPool.forEach((b) => { c.moveTo(b.x, b.y - L / 2); c.lineTo(b.x, b.y + L / 2); });
    c.stroke();
    // --- KOYU IZ (trail): merminin arkasinda ~10px koyu, hizla sonen iz
    c.globalAlpha = 0.4;
    c.strokeStyle = 'rgba(0,0,0,0.7)';
    c.lineWidth = 4;
    c.beginPath();
    this.bulletPool.forEach((b) => {
      if (b.trailN >= 2) { c.moveTo(b.trailX[0], b.trailY[0]); c.lineTo(b.x, b.y); }
    });
    c.stroke();
    this.ebulletPool.forEach((b) => {
      if (b.trailN >= 2) { c.moveTo(b.trailX[0], b.trailY[0]); c.lineTo(b.x, b.y); }
    });
    c.stroke();
    c.globalAlpha = 1;
    // --- PARLAK CEKIRDEK (lighter)
    c.globalCompositeOperation = 'lighter';
    // oyuncu mermisi: cyan
    c.strokeStyle = 'rgba(90,230,255,0.85)';
    c.lineWidth = 4;
    c.beginPath();
    this.bulletPool.forEach((b) => { c.moveTo(b.x, b.y + L / 2); c.lineTo(b.x, b.y - L / 2); });
    c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.95)';
    c.lineWidth = 2;
    c.beginPath();
    this.bulletPool.forEach((b) => { c.moveTo(b.x, b.y + L / 2); c.lineTo(b.x, b.y - L / 2); });
    c.stroke();
    // dusman mermisi: turuncu-kirmizi
    c.strokeStyle = 'rgba(255,100,40,0.85)';
    c.lineWidth = 4;
    c.beginPath();
    this.ebulletPool.forEach((b) => { c.moveTo(b.x, b.y - L / 2); c.lineTo(b.x, b.y + L / 2); });
    c.stroke();
    c.strokeStyle = 'rgba(255,220,180,0.95)';
    c.lineWidth = 2;
    c.beginPath();
    this.ebulletPool.forEach((b) => { c.moveTo(b.x, b.y - L / 2); c.lineTo(b.x, b.y + L / 2); });
    c.stroke();
    // uc glow (oyuncu mermisi)
    this.bulletPool.forEach((b) => {
      const g = c.createRadialGradient(b.x, b.y - L / 2, 0, b.x, b.y - L / 2, 7);
      g.addColorStop(0, 'rgba(255,255,255,0.95)');
      g.addColorStop(0.5, 'rgba(90,230,255,0.4)');
      g.addColorStop(1, 'rgba(90,230,255,0)');
      c.fillStyle = g;
      c.beginPath(); c.arc(b.x, b.y - L / 2, 7, 0, Math.PI * 2); c.fill();
    });
    // uc glow (dusman mermisi)
    this.ebulletPool.forEach((b) => {
      const g = c.createRadialGradient(b.x, b.y + L / 2, 0, b.x, b.y + L / 2, 7);
      g.addColorStop(0, 'rgba(255,220,180,0.95)');
      g.addColorStop(0.5, 'rgba(255,100,40,0.4)');
      g.addColorStop(1, 'rgba(255,100,40,0)');
      c.fillStyle = g;
      c.beginPath(); c.arc(b.x, b.y + L / 2, 7, 0, Math.PI * 2); c.fill();
    });
    c.restore();
  },
  /* Rotor tozu (round 9): oyuncunun altinda rotor_wash sprite'i.
     Hiza gore hafif doner ve seffafalir — irtifa hissi verir. Yalniz cizim. */
  _drawRotorWash(c) {
    const p = this.player;
    const speed = Math.hypot(p.vx, p.vy);
    if (speed < 20) return;   // dururken gorunmez
    const alpha = Math.min(0.4, speed / CONFIG.PLAYER.maxSpeed * 0.4);
    const rot = performance.now() * 0.003 * (speed / CONFIG.PLAYER.maxSpeed);
    c.save();
    c.globalAlpha = alpha;
    c.translate(p.x, p.y + 18);
    c.rotate(rot);
    this.assets.draw(c, 'rotor_wash', -48, -48, 96, 96);
    c.restore();
  },
  /* Nisan cercevesi (round 9): en yakin dusmanin uzerinde hud_target.
     Yalniz cizim — sim'e dokunmaz. */
  _drawTargetReticle(c) {
    let nearest = null, minDist = Infinity;
    /* Round 12: alti tipin hepsi */
    for (const pool of [this.scoutPool, this.gunnerPool, this.shieldPool,
                        this.bomberPool, this.kamikazePool, this.sniperPool]) {
      pool.forEach((e) => {
        if (!e.active) return;
        const d = Math.hypot(e.x - this.player.x, e.y - this.player.y);
        if (d < minDist && e.y > 0 && e.y < CONFIG.H) { minDist = d; nearest = e; }
      });
    }
    if (this.bossState === 'active' && this.boss) {
      const d = Math.hypot(this.boss.x - this.player.x, this.boss.y - this.player.y);
      if (d < minDist) { minDist = d; nearest = this.boss; }
    }
    /* Round 15: tasici boss — govde yaricapi 60 (hitBullet ile ayni) */
    if (this.bossState === 'active' && this.carrier.active) {
      const d = Math.hypot(this.carrier.x - this.player.x, this.carrier.y - this.player.y);
      if (d < minDist) { minDist = d; nearest = { x: this.carrier.x, y: this.carrier.y, radius: 60 }; }
    }
    if (!nearest) return;
    const s = nearest.radius || 30;
    const size = Math.max(48, s * 1.4);
    /* Sprite'i olceklenmis halde %70 alfayla basmak silik ve bulanik duruyordu
       (denetimin tek gercek blocking notu buydu). Cerceve artik VEKTOR ciziliyor:
       once koyu kontur, ustune parlak cyan kose isaretleri. Kendi koyu zeminini
       tasidigi icin hem gece isiklarinda hem koyu suda okunuyor, olceklendiginde
       de bulaniklasmiyor. */
    const h = size / 2, arm = size * 0.28;
    const corners = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
    c.save();
    c.lineCap = 'round';
    for (const pass of [{ w: 5, col: 'rgba(0,0,0,0.65)' },
                        { w: 2, col: 'rgba(120,240,255,0.95)' }]) {
      c.lineWidth = pass.w;
      c.strokeStyle = pass.col;
      c.beginPath();
      for (const [sx, sy] of corners) {
        const px = nearest.x + sx * h, py = nearest.y + sy * h;
        c.moveTo(px, py - sy * arm); c.lineTo(px, py);
        c.lineTo(px - sx * arm, py);
      }
      c.stroke();
    }
    c.restore();
  },
  /* Dusman dronlar: sprite + kalkan kabagigi (round 5) */
  _drawEnemies(c) {
    /* Round 12: alti tipin hepsi + round 15: jammer dronlari */
    for (const pool of [this.scoutPool, this.gunnerPool, this.shieldPool,
                        this.bomberPool, this.kamikazePool, this.sniperPool]) {
      pool.forEach((e) => e.draw(c, this.assets));
    }
    this.jammerPool.forEach((j) => j.draw(c, this.assets));
  },
  /* Round 12: roketler — en parlak katman (mermilerle ayni seviye). */
  _drawRockets(c) {
    this.rocketPool.forEach((rk) => { if (rk.active) rk.draw(c, this.assets); });
  },
  /* Rotor spin efekti (round 10): her rotor merkezinde iki ince yay, zit yonde,
     lighter karisim. Aci simTimeMs'e bagli (yalniz cizim, sim'e dokunmaz).
     Oyuncu hizlandikca %30'a kadar hiza artis. Boss halkalari daha yavas.   */
  _drawRotorSpin(c, spriteName, cx, cy, scale, speedFactor) {
    const R = CONFIG.ROTOR;
    const centers = R.centers[spriteName];
    if (!centers) return;
    const radius = (R.radii[spriteName] || 20) * scale;
    const ang = (this.simTimeMs / 1000) * R.speed * (1 + R.speedBoost * speedFactor);
    c.save();
    c.translate(cx, cy);
    // bulaniklik halkasi (alfa <= 0.18) — disk hissi
    c.globalAlpha = R.blurAlpha;
    c.fillStyle = 'rgba(180,200,230,1)';
    for (const [ox, oy] of centers) {
      c.beginPath(); c.arc(ox * scale, oy * scale, radius * 0.7, 0, Math.PI * 2); c.fill();
    }
    // donen yaylar (lighter, iki adet zit yonde)
    c.globalCompositeOperation = 'lighter';
    c.globalAlpha = 0.6;
    c.strokeStyle = 'rgba(200,220,255,1)';
    c.lineWidth = 1.5;
    for (const [ox, oy] of centers) {
      const px = ox * scale, py = oy * scale;
      c.beginPath(); c.arc(px, py, radius, ang, ang + Math.PI * 0.6); c.stroke();
      c.beginPath(); c.arc(px, py, radius, -ang + Math.PI, -ang + Math.PI * 1.6); c.stroke();
    }
    c.restore();
  },
  /* Boss rotor halkalari (round 11): efekt halkanin IC capina oturur.
     Her boss icin CONFIG.ROTOR.bossRotors[sprite] tablosu: merkezler +
     ic yaricaplar + donus hizi (buyuk halka ~10 rad/s, kucuk hizli).
     Efekt: ic yaricabin %85'inde 3 ince yay, zit yonde iki katman, lighter.
     Halka icinde hafif donen bulaniklik dolgusu (alfa <= 0.15) — disk hissi. */
  _drawBossRotors(c, spriteName, cx, cy, scale) {
    const rotors = CONFIG.ROTOR.bossRotors[spriteName];
    if (!rotors) return;
    const t = this.simTimeMs / 1000;
    c.save();
    c.translate(cx, cy);
    for (const r of rotors) {
      const px = r.x * scale, py = r.y * scale;
      const R = r.innerR * 0.85 * scale;   // ic capin %85'i
      const ang = t * r.speed;
      // donen bulaniklik dolgusu: disk hissi (alfa <= 0.15)
      c.globalCompositeOperation = 'source-over';
      c.globalAlpha = 0.13;
      c.fillStyle = 'rgba(170,195,235,1)';
      c.beginPath(); c.arc(px, py, R, 0, Math.PI * 2); c.fill();
      // 3 ince yay, zit yonde iki katman (lighter)
      c.globalCompositeOperation = 'lighter';
      c.globalAlpha = 0.55;
      c.strokeStyle = 'rgba(205,225,255,1)';
      c.lineWidth = 1.5;
      for (let i = 0; i < 3; i++) {
        const a0 = ang + (i / 3) * Math.PI * 2;
        c.beginPath(); c.arc(px, py, R, a0, a0 + Math.PI * 0.42); c.stroke();
        const b0 = -ang * 1.15 + (i / 3) * Math.PI * 2 + Math.PI / 3;
        c.beginPath(); c.arc(px, py, R * 0.82, b0, b0 + Math.PI * 0.34); c.stroke();
      }
    }
    c.restore();
  },
  _drawWorld(c, alpha, noHud) {
    // hizli yana giderken sahne 1-2° karsi yone yatar (yalniz cizim)
    const P = CONFIG.PARALLAX;
    const lean = -(this.player.vx / CONFIG.PLAYER.maxSpeed) * (P.leanMaxDeg * Math.PI / 180);
    c.save();
    c.translate(CONFIG.W / 2, CONFIG.H / 2);
    c.rotate(lean);
    c.translate(-CONFIG.W / 2, -CONFIG.H / 2);
    // Ekran sarsinti (round 9): yalniz cizim donusumu, sim'e dokunmaz
    if (this.shakeT > 0 && this.shakeDur > 0) {
      const t = this.shakeT / this.shakeDur;   // 1 -> 0
      const decay = t * t;                     // karesel sonum
      const ang = performance.now() * 0.04;
      const sx = Math.sin(ang * 7.3) * this.shakeAmp * decay;
      const sy = Math.cos(ang * 5.1) * this.shakeAmp * decay;
      c.translate(sx, sy);
    }
    // sehir paralaks katmani (zemin + binalar)
    this.city.draw(c, alpha);
    /* Round 16: kara hedefleri — sehir zemininin HEMEN USTUNDE, bulut ve
       tum hava birimlerinin ALTINDA. Ekran goruntusu yolunda da gorunur. */
    /* Crossfade sirasinda cizilmez: onceki sehrin uzerinde kara araci gorunmesin. */
    if (this.city.fadeT >= 1) this.groundPool.forEach((g) => g.draw(c, this.assets, this.city));
    /* Round 17: skimmer — hava birimi, dusmanlarla ayni katman. */
    this.skimmerPool.forEach((k) => k.draw(c, this.assets));
    // bulut katmani (round 10): sehir UZERINDE, dronlar ALTINDA
    this.clouds.draw(c);
    // boss (dusmanlarla ayni katman, mermilerin altinda)
    if (this.bossState === 'active' && this.boss) {
      this.boss.draw(c, this.assets);
      // boss rotor halkalari (round 11): ic capina oturan efekt, bolum bazli sprite
      const bs = CONFIG.BOSS.size / 208;   // manifest 208 -> cizim olcegi
      this._drawBossRotors(c, this.boss.sprite, this.boss.x, this.boss.y, bs);
    }
    /* Round 15: tasici boss — kendi draw'i parcalari da cizer */
    if (this.bossState === 'active' && this.carrier.active) {
      this.carrier.draw(c, this.assets);
    }
    // dusman dronlar (mermilerin altinda, oyuncunun ustunde)
    this._drawEnemies(c);
    // dusman rotor spin (round 10) — round 12: alti tipin hepsi
    for (const pool of [this.scoutPool, this.gunnerPool, this.shieldPool,
                        this.bomberPool, this.kamikazePool, this.sniperPool]) {
      pool.forEach((e) => {
        if (!e.active) return;
        const s = e.radius * 2;
        const sc = s / 64;   // sprite ornek olcegi (scout 64 taban)
        this._drawRotorSpin(c, e.sprite, e.x, e.y, sc, 0);
      });
    }
    // poweruplar (round 10+12): pu_weapon / pu_shield / pu_rocket
    this._drawPowerups(c);
    // mermiler: en parlak katman
    this._drawBullets(c);
    // Round 12: roketler (en parlak katman)
    this._drawRockets(c);
    // FX: patlama + sok dalgasi + kivilcim (en parlak katman)
    this.fx.draw(c, this.assets, this.city);   // city: zemine civili is izleri icin
    // Rotor tozu (round 9): oyuncunun altinda, hiza gore doner + seffafalir
    this._drawRotorWash(c);
    // oyuncu
    this.player.draw(c, this.assets);
    // oyuncu rotor spin (round 10)
    {
      const P = CONFIG.PLAYER;
      const s = P.size * 1.1 / 96;   // cizim olcegi (manifest 96)
      const speedF = Math.min(1, Math.hypot(this.player.vx, this.player.vy) / P.maxSpeed);
      c.save();
      c.translate(this.player.x, this.player.y);
      c.rotate(this.player.tilt);
      this._drawRotorSpin(c, 'drone_player', 0, 0, s, speedF);
      c.restore();
    }
    // Nisan cercevesi (round 9): en yakin dusmanin uzerinde (yalniz cizim)
    this._drawTargetReticle(c);
    c.restore();
    /* noHud: vision/ekran-goruntusu yolu icin. HUD metni (SKOR, SİLAH) ve
       bolum karti ekrana bindirilir; vision modeli bunlari "beklenmeyen
       yazı" diye kusur sayip blocking veriyordu. Oyunun GERCEK cizimi
       degismez — yalnizca denetime giden karede UI katmani atlanir. */
    if (!noHud) {
      // oyun HUD'u (teknik sayaclar DEGIL — onlar debugOverlay'de)
      this._drawHud(c);
      // boss can cubugu (ustte)
      if (this.bossState === 'active' && this.boss) this._drawBossBar(c);
      // DIKKAT uyarisi (boss girisinden once, yanip sonek)
      if (this.bossState === 'warn') this._drawWarn(c);
      // bölüm karti: amblem + ad (round 8), oyun alanini karartmadan
      if (this.stageTitleT > 0) this._drawStageCard(c);
    }
    // boss olum ekran parlamasi (kisa)
    if (this.bossFlashT > 0) {
      const a = Math.min(1, this.bossFlashT / (CONFIG.BOSS.flashMs / 1000)) * 0.5;
      c.save();
      c.globalCompositeOperation = 'lighter';
      c.fillStyle = `rgba(255,240,200,${a.toFixed(3)})`;
      c.fillRect(0, 0, CONFIG.W, CONFIG.H);
      c.restore();
    }
  },
  /* Boss can cubugu: ustte, tam genislikte ince bar.
     Round 15: tasici boss govde kilitliyken (anten dururken) dolu gorunur —
     govde hasar almadigi icin "can" gosterilmez; acilinca bodyHp/maxBodyHp. */
  _drawBossBar(c) {
    const w = CONFIG.W - 40, h = 8;
    const x = 20, y = 14;
    let frac;
    if (this.carrier.active) {
      const C = CONFIG.CARRIER;
      frac = this.carrier.bodyVulnerable
        ? Math.max(0, this.carrier.bodyHp / C.bodyHp) : 1;
    } else {
      frac = Math.max(0, this.boss.hp / this.boss.maxHp);
    }
    c.save();
    c.fillStyle = 'rgba(0,0,0,0.5)';
    c.fillRect(x - 2, y - 2, w + 4, h + 4);
    c.fillStyle = 'rgba(120,20,20,0.8)';
    c.fillRect(x, y, w, h);
    c.fillStyle = '#ff5540';
    c.fillRect(x, y, w * frac, h);
    c.strokeStyle = 'rgba(255,120,90,0.7)';
    c.lineWidth = 1;
    c.strokeRect(x - 0.5, y - 0.5, w + 1, h + 1);
    c.restore();
  },
  /* DIKKAT uyarisi: yanip sonek (250ms periyot), boss girisinden once. */
  _drawWarn(c) {
    const B = CONFIG.BOSS;
    const t = this.bossWarnT / (B.warnMs / 1000);   // 1→0
    const blink = (Math.floor(this.bossWarnT * 4) % 2 === 0) ? 1 : 0.35;
    const a = Math.min(1, t * 3) * blink;
    c.save();
    c.globalAlpha = a;
    c.textAlign = 'center';
    c.font = 'bold 40px monospace';
    c.fillStyle = '#ff4030';
    c.shadowColor = 'rgba(255,40,20,0.9)';
    c.shadowBlur = 16;
    c.fillText('DIKKAT', CONFIG.W / 2, CONFIG.H * 0.42);
    c.font = 'bold 16px monospace';
    c.fillStyle = '#ffb0a0';
    c.shadowBlur = 6;
    c.fillText('BOSS YAKLAŞIYOR', CONFIG.W / 2, CONFIG.H * 0.42 + 28);
    c.restore();
  },
  /* Bölüm karti: ortada simge yapı amblemi (128px), altinda BÖLÜM n + sehir adi,
     ince bir cizgi. Yumuşak girip cikis (300ms), oyun alanini karartmaz.        */
  _drawStageCard(c) {
    const total = CONFIG.STAGE_TITLE_MS / 1000;
    const t = this.stageTitleT / total;   // 1→0
    // yumusak giris/cikis: ilk ve son 300ms alfa ile son
    const fadeIn = Math.min(1, (1 - t) / 0.3 * total + 0.0001);
    const fadeOut = Math.min(1, t / 0.3 * total + 0.0001);
    const a = Math.min(fadeIn, fadeOut);
    if (a <= 0) return;
    const st = CONFIG.STAGES[this.stageIdx];
    const lmName = this.city.landmark;   // landmark_<sehir>
    const cx = CONFIG.W / 2, cy = CONFIG.H * 0.34;
    c.save();
    c.globalAlpha = a;
    /* Kartin arkasina yumusak koyu panel: amblem ve yazi dort sehrin de
       parlak gece dokusunda okunsun. Panelsiz halde kart, gecis aninda
       yariseffafken sehre yapistirilmis gibi duruyordu. */
    const pw = 260, ph = 250;
    const pg = c.createRadialGradient(cx, cy + 40, 20, cx, cy + 40, pw * 0.75);
    pg.addColorStop(0, 'rgba(4,7,14,0.78)');
    pg.addColorStop(0.6, 'rgba(4,7,14,0.55)');
    pg.addColorStop(1, 'rgba(4,7,14,0)');
    c.fillStyle = pg;
    c.fillRect(cx - pw, cy - ph * 0.6, pw * 2, ph * 1.6);
    c.globalAlpha = a;
    // amblem (128px) — hafif koyu halka ile okunur
    if (lmName) {
      c.globalAlpha = a * 0.25;
      c.fillStyle = '#05070d';
      c.beginPath(); c.arc(cx, cy, 74, 0, Math.PI * 2); c.fill();
      c.globalAlpha = a;
      this.assets.draw(c, lmName, cx - 64, cy - 64, 128, 128);
    }
    // ince cizgi
    c.strokeStyle = 'rgba(255,255,255,0.5)';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(cx - 90, cy + 84); c.lineTo(cx + 90, cy + 84);
    c.stroke();
    // BÖLÜM n + sehir adi
    c.textAlign = 'center';
    c.font = 'bold 20px monospace';
    c.fillStyle = 'rgba(160,220,255,0.95)';
    c.fillText(`BÖLÜM ${this.stageIdx + 1}`, cx, cy + 112);
    c.font = 'bold 30px monospace';
    c.fillStyle = '#ffffff';
    c.shadowColor = 'rgba(0,0,0,0.8)';
    c.shadowBlur = 10;
    c.fillText(st.name, cx, cy + 146);
    c.restore();
  },
  /* screenshot() icin: sehir paralaks arka plani + dron + mermiler.
     Vision "dron ve mermiler arka plandan net ayriliyor mu" diye soracagi
     icin GERCEK sehir arka plani korunur (karartilmaz). Hafif vinyet kenarlari
     karanlastirir ki parlayan binalar on plani boğmasin.                  */
  /* Vision/ekran goruntusu yolu artik OYUNUN GERCEK cizimini kullanir.
   *
   * Burada eskiden sahneye %72 siyah ortu + vinyet basiliyordu; oyunda boyle bir
   * karartma YOK. Yani denetime giden kare oyuncunun gordugu kare degildi ve
   * "on plan kontrasti" kapisi sahte bir goruntu uzerinde olculuyordu. Testi
   * memnun etmek icin goruntuyu karartmak, sorunu cozmek degil gizlemektir.     */
  _drawWorldNoHud(c, alpha) {
    // HUD/boss-bar/uari/bolum-karti katmani atlanir (noHud=true).
    // Oyunun GERCEK cizimi aynen korunur — yalnizca UI overlay'i yok.
    this._drawWorld(c, alpha, true);
  },
  _drawHud(c) {
    c.save();
    c.textAlign = 'left';
    c.font = 'bold 22px monospace';
    c.fillStyle = 'rgba(0,0,0,0.35)';
    c.fillText(`SKOR ${this.score}`, 14, 32);
    c.fillStyle = '#ffffff';
    c.fillText(`SKOR ${this.score}`, 12, 30);
    // can: drone_player kucultulmus ikonu ile (round 5)
    const lives = this.player.lives;
    for (let i = 0; i < CONFIG.PLAYER_LIVES; i++) {
      const lx = 14 + i * 28, ly = 42;
      if (i < lives) {
        this.assets.draw(c, 'drone_player', lx, ly, 24, 24);
      } else {
        c.globalAlpha = 0.25;
        this.assets.draw(c, 'drone_player', lx, ly, 24, 24);
        c.globalAlpha = 1;
      }
    }
    // SİLAH seviyesi (round 10). Round 12: hasarda yanip soner (kirmizi)
    c.font = 'bold 16px monospace';
    c.fillStyle = 'rgba(0,0,0,0.35)';
    c.fillText(`SİLAH ${this.weaponLevel}`, 14, 78);
    let wcol = this.weaponLevel >= 3 ? '#ffd24a' : '#6fe3ff';
    if (this.weaponFlashT > 0 && Math.floor(this.weaponFlashT * 8) % 2 === 0) wcol = '#ff5040';
    c.fillStyle = wcol;
    c.fillText(`SİLAH ${this.weaponLevel}`, 12, 76);
    // Kalkan kalan sure (round 10)
    if (this.shieldT > 0) {
      const s = Math.ceil(this.shieldT);
      c.fillStyle = 'rgba(0,0,0,0.35)';
      c.fillText(`KALKAN ${s}s`, 14, 98);
      c.fillStyle = '#50b4ff';
      c.fillText(`KALKAN ${s}s`, 12, 96);
    }
    /* Round 12: roket kalan sure (HUD'da gorunur) */
    if (this.rocketT > 0) {
      const s = Math.ceil(this.rocketT);
      c.fillStyle = 'rgba(0,0,0,0.35)';
      c.fillText(`ROKET ${s}s`, 14, 118);
      c.fillStyle = '#ff8040';
      c.fillText(`ROKET ${s}s`, 12, 116);
    }
    /* Round 13: TEK isisi cubugu — skorun altinda ince bar. AyrI batarya/
       muhimmat gosterici YOK (tek kaynak ilkesi). Asiri sicaklikta kirmizi
       yanip soner; subLaunch basarisizsa kisa uyarı. */
    const H = CONFIG.HEAT;
    const hbW = 170, hbH = 5, hbX = 12, hbY = 38;
    c.fillStyle = 'rgba(0,0,0,0.45)';
    c.fillRect(hbX - 1, hbY - 1, hbW + 2, hbH + 2);
    let hcol = this.heat < 50 ? '#5fd4e8' : this.heat < 85 ? '#ffd24a' : '#ff5540';
    if (this.overheated && Math.floor(this.simTimeMs * 0.012) % 2 === 0) hcol = '#ff2010';
    c.fillStyle = hcol;
    c.fillRect(hbX, hbY, hbW * Math.min(1, this.heat / H.max), hbH);
    // Sub-dron durumu: iki kucuk ikon (sub_drone sprite'i, 16 px)
    for (let i = 0; i < CONFIG.SUBDRONE.max; i++) {
      const sx = 12 + i * 20, sy = 47;
      if (i < this.subDrones) {
        this.assets.draw(c, 'sub_drone', sx, sy, 16, 16);
      } else {
        c.globalAlpha = 0.22;
        this.assets.draw(c, 'sub_drone', sx, sy, 16, 16);
        c.globalAlpha = 1;
      }
    }
    // Is yetmezse kisa uyarı (yanıp söner)
    if (this.subLaunchFailT > 0 && Math.floor(this.subLaunchFailT * 10) % 2 === 0) {
      c.font = 'bold 11px monospace';
      c.fillStyle = '#ff5040';
      c.fillText('ISI YETMİYOR', 12, 74);
    }
    /* Round 16: liman bolumu — jammer menzildeyken glitch/uyari dili.
       Yeni panel acilmaz; mevcut uyarı satirina eklenir. */
    if (CONFIG.STAGES[this.stageIdx].ground && this.fireSlowMul < 1) {
      const blink = Math.floor(this.simTimeMs * 0.008) % 2 === 0;
      if (blink) {
        c.font = 'bold 11px monospace';
        c.fillStyle = '#c080ff';
        c.fillText('JAMMER MENZİLİ', 12, 138);
      }
    }
    /* Round 18: kombo carpani — sag ustte kisa rozet + kalan sure cubugu.
       Ekran kalabaliklasmasin diye tek satirlik kompakt bir blok; yeni panel yok. */
    if (this.comboCount > 0) {
      const m = this.comboMult();
      const C = CONFIG.COMBO;
      const bx = CONFIG.W - 78, by = 14, bw = 64, bh = 5;
      // rozet metni (x2 gibi)
      c.textAlign = 'right';
      c.font = 'bold 20px monospace';
      c.fillStyle = 'rgba(0,0,0,0.4)';
      c.fillText(`x${m}`, CONFIG.W - 12, 30);
      c.fillStyle = m >= 4 ? '#ffd24a' : m >= 2 ? '#6fe3ff' : '#ffffff';
      c.fillText(`x${m}`, CONFIG.W - 14, 28);
      // kalan sure cubugu (ince)
      const frac = Math.max(0, Math.min(1, this.comboT / (C.windowMs / 1000)));
      c.fillStyle = 'rgba(0,0,0,0.45)';
      c.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
      c.fillStyle = m >= 4 ? '#ffd24a' : m >= 2 ? '#6fe3ff' : '#9fd';
      c.fillRect(bx, by, bw * frac, bh);
    }
    /* Round 18: onarim kutusu alininca kisa yesil parlamasi (yalniz cizim). */
    if (this.repairFlashT > 0) {
      const a = Math.min(1, this.repairFlashT / 0.6) * 0.22;
      c.globalCompositeOperation = 'lighter';
      c.fillStyle = `rgba(90,230,120,${a.toFixed(3)})`;
      c.fillRect(0, 0, CONFIG.W, CONFIG.H);
      c.globalCompositeOperation = 'source-over';
    }
    c.restore();
  },
  /* Round 19: menu cilasi — arkadaki oyun dunyasi kaymaya devam eder
     (sim'de dist ilerler), ustune koyu degrade perde + secili dronun
     donen rotorlarla kucuk onizlemesi. Sade kalir: ayni baslik, en iyi
     skor ve "DOKUN / SPACE" yonergesi. */
  _drawMenu(c) {
    c.save();
    c.globalAlpha = this.menuFadeT;
    // Arka plan: kayan sehir paralaks katmani + bulutlar (gercek dunya)
    this.city.draw(c, 1);
    this.clouds.draw(c);
    // Koyu degrade perde (alfa <= 0.55) — yazilar okunsun
    const g = c.createLinearGradient(0, 0, 0, CONFIG.H);
    g.addColorStop(0, 'rgba(5,7,13,0.55)');
    g.addColorStop(0.5, 'rgba(5,7,13,0.42)');
    g.addColorStop(1, 'rgba(5,7,13,0.55)');
    c.fillStyle = g;
    c.fillRect(0, 0, CONFIG.W, CONFIG.H);
    c.textAlign = 'center';
    // Oyun adi
    c.fillStyle = '#fff'; c.font = 'bold 44px monospace';
    c.shadowColor = 'rgba(110,235,255,0.6)'; c.shadowBlur = 12;
    c.fillText('DRONE WAR', CONFIG.W/2, 250);
    c.shadowBlur = 0;
    // Secili dronun kucuk onizlemesi — donen rotorlarla (yalniz cizim)
    const D = CONFIG.DRONES.find((d) => d.id === this.selectedDrone) || CONFIG.DRONES[0];
    const px = CONFIG.W/2, py = 350, ps = 72;
    c.globalAlpha = this.menuFadeT * 0.9;
    this.assets.draw(c, D.sprite, px - ps/2, py - ps/2, ps, ps);
    c.globalAlpha = this.menuFadeT;
    this._drawRotorSpin(c, D.sprite, px, py, ps / 96, 0);
    // BAŞLA yonergesi (yanip sonek)
    const blink = 0.7 + 0.3 * Math.sin(performance.now() * 0.004);
    c.globalAlpha = this.menuFadeT * blink;
    c.fillStyle = '#6fe3ff'; c.font = 'bold 26px monospace';
    c.fillText('DOKUN / SPACE', CONFIG.W/2, 440);
    c.globalAlpha = this.menuFadeT;
    // En yuksek skor
    if (this.bestScore > 0) {
      c.fillStyle = '#ffd24a'; c.font = '16px monospace';
      c.fillText(`EN YÜKSEK: ${this.bestScore}`, CONFIG.W/2, 480);
    }
    // Kisa kontrol satiri
    c.fillStyle = '#9ab'; c.font = '14px monospace';
    c.fillText('Ok/WASD hareket · Space/Z ates · P duraklat', CONFIG.W/2, 530);
    c.fillText('M sessiz · Esc menu', CONFIG.W/2, 552);
    c.restore();
  },
  _drawPause(c) {
    c.save();
    c.globalAlpha = this.menuFadeT;
    // Oyun alani %35 karartilir
    c.fillStyle = 'rgba(5,7,13,0.35)'; c.fillRect(0, 0, CONFIG.W, CONFIG.H);
    c.textAlign = 'center';
    c.fillStyle = '#fff'; c.font = 'bold 36px monospace';
    c.shadowColor = 'rgba(0,0,0,0.8)'; c.shadowBlur = 8;
    c.fillText('DURAKLADI', CONFIG.W/2, CONFIG.H * 0.42);
    c.shadowBlur = 0;
    // Kontroller
    c.fillStyle = '#9ab'; c.font = '15px monospace';
    c.fillText('P / dokun: devam', CONFIG.W/2, CONFIG.H * 0.42 + 40);
    c.fillText('Esc: menu', CONFIG.W/2, CONFIG.H * 0.42 + 64);
    c.restore();
  },
  _drawEnd(c) {
    const victory = this.state === 'victory';
    c.save();
    c.globalAlpha = this.menuFadeT;
    // arka plan: zaferde son sehir (tokyo), oyun bittiginde ulasilan sehir
    const bgCity = victory ? 'city_tokyo' : ('city_' + CONFIG.STAGES[this.stageIdx].city);
    this.assets.draw(c, bgCity, 0, 0, CONFIG.W, CONFIG.H);
    c.fillStyle = 'rgba(5,7,13,0.72)'; c.fillRect(0, 0, CONFIG.W, CONFIG.H);
    c.textAlign = 'center';
    if (victory) {
      c.fillStyle = '#ffd24a'; c.font = 'bold 44px monospace';
      c.shadowColor = 'rgba(255,200,60,0.8)'; c.shadowBlur = 18;
      c.fillText('VICTORY', CONFIG.W / 2, 300);
      c.shadowBlur = 0;
      c.fillStyle = '#fff'; c.font = '20px monospace';
      c.fillText(`Skor: ${this.score}`, CONFIG.W / 2, 360);
      const m = Math.floor(this.playTime / 60), s = Math.floor(this.playTime % 60);
      c.fillText(`Süre: ${m}:${s < 10 ? '0' : ''}${s}`, CONFIG.W / 2, 392);
      // yeni rekor vurgusu
      if (this._newRecord) {
        c.fillStyle = '#7CFC00'; c.font = 'bold 22px monospace';
        c.shadowColor = 'rgba(124,252,0,0.8)'; c.shadowBlur = 12;
        c.fillText('★ YENİ REKOR ★', CONFIG.W / 2, 440);
        c.shadowBlur = 0;
      }
    } else {
      c.fillStyle = '#ff5540'; c.font = 'bold 36px monospace';
      c.shadowColor = 'rgba(255,60,40,0.6)'; c.shadowBlur = 10;
      c.fillText('OYUN BİTTİ', CONFIG.W / 2, 300);
      c.shadowBlur = 0;
      c.fillStyle = '#fff'; c.font = '20px monospace';
      c.fillText(`Skor: ${this.score}`, CONFIG.W / 2, 360);
      // En yuksek skor
      if (this.bestScore > 0) {
        c.fillStyle = '#ffd24a'; c.font = '16px monospace';
        c.fillText(`En Yüksek: ${this.bestScore}`, CONFIG.W / 2, 392);
      }
      // Ulasilan bolum/sehir
      const st = CONFIG.STAGES[this.stageIdx];
      c.fillStyle = '#9ab'; c.font = '16px monospace';
      c.fillText(`Bölüm: ${st.name} (${this.stageIdx + 1}/${CONFIG.STAGES.length})`, CONFIG.W / 2, 424);
      // Olduren dusman tipi
      if (this._killingEnemyType) {
        c.fillStyle = '#f88'; c.font = '14px monospace';
        c.fillText(`Öldüren: ${this._killingEnemyType}`, CONFIG.W / 2, 452);
      }
    }
    // Devam et
    c.globalAlpha = this.menuFadeT * (0.6 + 0.4 * Math.sin(performance.now() * 0.004));
    c.fillStyle = '#9ab'; c.font = '15px monospace';
    c.fillText('Devam etmek için SPACE / ekrana dokun', CONFIG.W / 2, 520);
    c.restore();
  },
});
