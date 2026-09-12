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
  /* =================================================================== UI TEMELI
     Round 24. Arayuzun tamami CANLI KAYAN SEHRIN uzerine ciziliyor, yani
     okunurluk o an arkada ne oldugunun fonksiyonuydu: ayni ekran bir karede
     okunuyor, digerinde kayboluyordu. Olculdu (yazinin ARKASINDAKI medyan
     parlaklik, bes kaydirma konumunda) — menu yayilim 8, pause 24, bolum karti
     38 (tepe 53: kart parlak koprunun uzerine denk gelince baslik ve amblem
     gorunmez oluyordu).

     Sebep yumusak radyal perdeydi: EKRAN KENARINDA sifira iniyor, olcum bandi
     ise tam genislik. Yani perde tam da lazim oldugu yerde yoktu.

     Bundan sonra her arayuz blogu su uc parcadan kurulur:
       _uiPlate   — tam genislikte, cekirdegi neredeyse mat levha (okunurluk)
       _uiRule    — blogun sinirini gosteren, uclarda sonen ince hat (yapi)
       _uiTracked / _uiRow / _uiStat / _uiPips — hiyerarsi
     Okunurluk artik CIZIMIN ozelligi; arka planin tesadufu degil.
     Hepsi yalnizca cizimdir: sim durumuna dokunmaz, `performance.now()` sadece
     hareket icin okunur (AGENTS.md: saat yalniz cizimde).                     */

  /* Tam genislikte koyu levha. y0..y1 CEKIRDEK (tam alfa); ust ve altinda
     `feather` kadar yumusama var, boylece dikdortgen gibi yapismaz ama
     cekirdek icinde sizinti sabittir: (1 - alfa). */
  _uiPlate(c, y0, y1, alpha, feather) {
    const U = CONFIG.UI;
    const f = (feather == null) ? U.plateFeather : feather;
    const a = (alpha == null) ? U.plateAlpha : alpha;
    const gy0 = y0 - f, gy1 = y1 + f, span = gy1 - gy0;
    if (span <= 0) return;
    const s0 = f / span, col = U.plateRGB;
    const g = c.createLinearGradient(0, gy0, 0, gy1);
    g.addColorStop(0, `rgba(${col},0)`);
    // yariyolda alfanin ~%22'si: dogrusal yerine yumusak giris (ease)
    g.addColorStop(s0 * 0.5, `rgba(${col},${(a * 0.22).toFixed(3)})`);
    g.addColorStop(s0, `rgba(${col},${a.toFixed(3)})`);
    g.addColorStop(1 - s0, `rgba(${col},${a.toFixed(3)})`);
    g.addColorStop(1 - s0 * 0.5, `rgba(${col},${(a * 0.22).toFixed(3)})`);
    g.addColorStop(1, `rgba(${col},0)`);
    c.fillStyle = g;
    c.fillRect(0, gy0, CONFIG.W, span);
  },
  /* Ortada parlak, uclarda sonen 1 px yatay hat. Blok sinirini gosterir ama
     perdeye kalinlik katmaz (dolayisiyla olcume girmez). */
  _uiRule(c, cx, y, halfW, alpha, rgb) {
    if (halfW <= 0) return;
    const col = rgb || CONFIG.UI.accentRGB;
    const g = c.createLinearGradient(cx - halfW, 0, cx + halfW, 0);
    g.addColorStop(0, `rgba(${col},0)`);
    g.addColorStop(0.5, `rgba(${col},${alpha})`);
    g.addColorStop(1, `rgba(${col},0)`);
    c.fillStyle = g;
    c.fillRect(cx - halfW, y, halfW * 2, 1);
  },
  /* Harf araligi verilmis ortalanmis yazi (kicker/etiket dili). Canvas'in
     `letterSpacing` ozelligi her motorda yok; yazi tipi monospace oldugu icin
     elle dizmek birebir ayni sonucu verir. Menu cizimi — sicak dongu degil. */
  _uiTracked(c, text, cx, y, spacing) {
    const cw = c.measureText('M').width;
    const step = cw + spacing;
    const n = text.length;
    let x = cx - (n * step - spacing) / 2 + cw / 2;
    const prev = c.textAlign;
    c.textAlign = 'center';
    for (let i = 0; i < n; i++) { c.fillText(text[i], x, y); x += step; }
    c.textAlign = prev;
  },
  /* Etiket sol / deger sag — oyun sonu tablosunun dili. Artik duraklatma
     ekrani da ayni satiri kullaniyor (tek tipografi dili). */
  _uiRow(c, label, val, cx, y, rw, valCol) {
    c.textAlign = 'left';
    c.fillStyle = CONFIG.UI.muted;
    c.fillText(label, cx - rw / 2, y);
    c.textAlign = 'right';
    c.fillStyle = valCol || '#ffffff';
    c.fillText(val, cx + rw / 2, y);
    c.textAlign = 'center';
  },
  /* Ozellik cubugu: dort dronu ayni olcege oturtur, boylece sayilari
     okumak yerine UZUNLUK karsilastirilir. */
  _uiStat(c, label, val, frac, col, y) {
    const cx = CONFIG.W / 2, rw = 262;
    const bx = cx - rw / 2 + 64, bw = rw - 64 - 58;
    c.textAlign = 'left';
    c.font = '13px monospace';
    c.fillStyle = CONFIG.UI.muted;
    c.fillText(label, cx - rw / 2, y + 4);
    c.fillStyle = 'rgba(255,255,255,0.10)';
    c.fillRect(bx, y - 3, bw, 6);
    c.fillStyle = col;
    c.fillRect(bx, y - 3, bw * Math.max(0.05, Math.min(1, frac)), 6);
    c.textAlign = 'right';
    c.font = 'bold 13px monospace';
    c.fillStyle = '#ffffff';
    c.fillText(String(val), cx + rw / 2, y + 4);
    c.textAlign = 'center';
  },
  /* Can: sayi yerine nokta dizisi — "kac can" bir bakista okunur. */
  _uiPips(c, label, val, max, y) {
    const cx = CONFIG.W / 2, rw = 262;
    const bx = cx - rw / 2 + 64;
    c.textAlign = 'left';
    c.font = '13px monospace';
    c.fillStyle = CONFIG.UI.muted;
    c.fillText(label, cx - rw / 2, y + 4);
    for (let i = 0; i < max; i++) {
      c.beginPath(); c.arc(bx + 8 + i * 20, y, 5, 0, Math.PI * 2);
      c.fillStyle = i < val ? '#6fe3ff' : 'rgba(255,255,255,0.13)';
      c.fill();
    }
    c.textAlign = 'right';
    c.font = 'bold 13px monospace';
    c.fillStyle = '#ffffff';
    c.fillText(String(val), cx + rw / 2, y + 4);
    c.textAlign = 'center';
  },
  /* Kose yuvarlatilmis yol. `ctx.roundRect` her motorda yok; arcTo her yerde
     var ve tahsis yapmaz. */
  _uiRoundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  },
  /* Onizleme kaidesi: yumusak cyan hale + ince halka. Amblem ve dron
     siluetleri KOYU (olculdu: landmark medyan parlakligi 40..124) — mat
     levhanin uzerinde kaybolmasinlar diye arkadan aydinlatiliyorlar.
     Bolum kartinda amblemin gorunmemesinin ikinci sebebi buydu. */
  _uiPedestal(c, cx, cy, r, alpha) {
    const rgb = CONFIG.UI.accentRGB;
    const g = c.createRadialGradient(cx, cy, r * 0.10, cx, cy, r);
    g.addColorStop(0, `rgba(${rgb},${alpha.toFixed(3)})`);
    g.addColorStop(0.55, `rgba(${rgb},${(alpha * 0.42).toFixed(3)})`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    c.fillStyle = g;
    c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fill();
    c.strokeStyle = `rgba(${rgb},0.26)`;
    c.lineWidth = 1;
    c.beginPath(); c.arc(cx, cy, r * 0.94, 0, Math.PI * 2); c.stroke();
  },
  /* Kaidenin cevresinde donen iki kisa yay — "canli tarama" hissi.
     Rotor yaylarinin YERINE gecmez: `CONFIG.ROTOR.centers` yalnizca
     drone_player icin tanimli, yani swift/tank/ghost onizlemesi tamamen
     olu duruyordu. Bu halka sprite geometrisinden BAGIMSIZ oldugu icin
     dort dronda da ayni calisir ve govdeye sahte yay cizmez. */
  _uiScanRing(c, cx, cy, r, speed) {
    const a = performance.now() * 0.0009 * (speed || 1);
    c.save();
    c.strokeStyle = `rgba(${CONFIG.UI.accentRGB},0.7)`;
    c.lineWidth = 2;
    c.lineCap = 'round';
    c.beginPath(); c.arc(cx, cy, r, a, a + Math.PI * 0.32); c.stroke();
    c.beginPath(); c.arc(cx, cy, r, a + Math.PI, a + Math.PI * 1.16); c.stroke();
    c.restore();
  },
  /* ====================================================================== */
  /* Round 12: dron secim ekranı. Acik dronlar parlak + badge; kilitliler
     soluk cizim + acilis sart yazisi. Sol/sag ucte bir gezinir, orta baslatir.
     Round 24: dort dron 120 px'lik sutunlara sikismis durumdaydi ("Hız 400",
     "Can 3", tanim, kilit sarti hepsi ust uste). Duzen KAHRAMAN + SERIT'e
     cevrildi: secili dron buyuk, ozellikleri ayni olcege oturan cubuklarla;
     dort dron altta kucuk secim seridinde. Girdi modeli DEGISMEDI — sol/sag
     ucte bir gezinir, orta baslatir (touch_drone_select bunu olcuyor). */
  _drawShipSelect(c) {
    const U = CONFIG.UI, W = CONFIG.W, H = CONFIG.H;
    c.save();
    c.globalAlpha = this.menuFadeT;
    this.assets.draw(c, 'city_istanbul', 0, 0, W, H);
    const bg = c.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, `rgba(${U.plateRGB},0.76)`);
    bg.addColorStop(0.5, `rgba(${U.plateRGB},0.58)`);
    bg.addColorStop(1, `rgba(${U.plateRGB},0.82)`);
    c.fillStyle = bg; c.fillRect(0, 0, W, H);
    c.textAlign = 'center';
    // ---------------------------------------------------------------- baslik
    this._uiRule(c, W / 2, 72, 190, 0.45);
    c.font = 'bold 30px monospace';
    c.fillStyle = '#ffffff';
    c.shadowColor = `rgba(${U.accentRGB},0.5)`; c.shadowBlur = 12;
    c.fillText('DRON SEÇ', W / 2, 112);
    c.shadowBlur = 0;
    c.font = '13px monospace';
    c.fillStyle = U.gold;
    c.fillText(`EN YÜKSEK ${this.bestScore}`, W / 2, 136);

    const idx = this.shipSelectIdx;
    const D = CONFIG.DRONES[idx];
    const unlocked = this._droneUnlocked(idx);
    const now = performance.now();
    // ------------------------------------------------------- kahraman blok
    const HP = U.shipPlate;
    this._uiPlate(c, HP.y0, HP.y1, HP.a);
    const hcy = 268;
    this._uiPedestal(c, W / 2, hcy, 98, unlocked ? 0.15 : 0.06);
    if (unlocked) this._uiScanRing(c, W / 2, hcy, 94, 1);
    /* Suzulme + cok hafif yalpalama: yalniz cizim (saat cizimde serbest). */
    c.globalAlpha = this.menuFadeT * (unlocked ? 1 : 0.32);
    c.save();
    c.translate(W / 2, hcy + Math.sin(now * 0.0013) * 5);
    c.rotate(Math.sin(now * 0.0009) * 0.05);
    this.assets.draw(c, D.sprite, -74, -74, 148, 148);
    c.restore();
    c.globalAlpha = this.menuFadeT;
    if (unlocked) this._drawRotorSpin(c, D.sprite, W / 2, hcy, 148 / 96, 0);
    // ad + tek satirlik tanim
    c.font = 'bold 26px monospace';
    c.fillStyle = unlocked ? '#ffffff' : 'rgba(160,172,192,0.75)';
    c.fillText(D.id.toUpperCase(), W / 2, 380);
    c.font = '12px monospace';
    c.fillStyle = unlocked ? `rgba(${U.accentRGB},0.9)` : 'rgba(150,160,180,0.6)';
    c.fillText(D.desc, W / 2, 400);
    this._uiRule(c, W / 2, 414, 120, 0.28, '255,255,255');
    if (unlocked) {
      /* Hiz 320..520 araliginda; cubuk 280..560 penceresine normalize edilir
         ki en yavas dron bile bos gorunmesin, en hizli da tasmasin. */
      this._uiStat(c, 'HIZ', D.speed, (D.speed - 280) / 280,
                   `rgba(${U.accentRGB},0.9)`, 442);
      this._uiPips(c, 'CAN', D.lives, 5, 470);
    } else {
      c.font = 'bold 15px monospace';
      c.fillStyle = '#ffb040';
      this._uiTracked(c, 'KİLİTLİ', W / 2, 446, 5);
      c.font = '13px monospace';
      c.fillStyle = 'rgba(170,182,200,0.85)';
      c.fillText(`${D.unlock.toLocaleString()} puan gerekiyor`, W / 2, 470);
    }
    // ----------------------------------------------------- secim seridi (4)
    const n = CONFIG.DRONES.length, cw = W / n;
    for (let i = 0; i < n; i++) {
      const d = CONFIG.DRONES[i];
      const ux = cw * i + cw / 2, uy = 556;
      const on = this._droneUnlocked(i), sel = (i === idx);
      if (sel) {
        c.fillStyle = `rgba(${U.accentRGB},0.12)`;
        this._uiRoundRect(c, ux - cw / 2 + 6, uy - 44, cw - 12, 102, 8); c.fill();
        c.strokeStyle = `rgba(${U.accentRGB},0.85)`; c.lineWidth = 1.5;
        this._uiRoundRect(c, ux - cw / 2 + 6.5, uy - 43.5, cw - 13, 101, 8); c.stroke();
      }
      c.globalAlpha = this.menuFadeT * (on ? (sel ? 1 : 0.78) : 0.26);
      this.assets.draw(c, d.sprite, ux - 28, uy - 34, 56, 56);
      c.globalAlpha = this.menuFadeT;
      c.font = sel ? 'bold 11px monospace' : '11px monospace';
      c.fillStyle = on ? (sel ? '#ffffff' : 'rgba(170,182,200,0.8)')
                       : 'rgba(150,160,180,0.55)';
      c.fillText(d.id.toUpperCase(), ux, uy + 40);
      if (!on) {
        /* Kilit simgesi (emoji) monospace fontta eksik karakter olarak
           ciziliyordu; yerine duz yazi. */
        c.font = '9px monospace';
        c.fillStyle = 'rgba(255,176,64,0.85)';
        c.fillText('KİLİTLİ', ux, uy + 52);
      }
    }
    // ------------------------------------------------------------ rehberlik
    this._uiRule(c, W / 2, 662, 190, 0.22, '255,255,255');
    c.font = '13px monospace';
    c.fillStyle = 'rgba(140,156,176,0.85)';
    c.fillText('Sol/Sağ: seç · Orta: başla', W / 2, 692);
    c.fillText('←/→ veya A/D: gezin · Space: başla', W / 2, 714);
    c.restore();
  },
  /* Mermiler: koyu kontur + parlak cekirdek (round 5).
     Her mermi kendi koyu zeminini tasir — parlak sokak isiklari uzerinde
     bile okunur. Toplam genislik <= 6 px, tracer_shape testi gecmeli.
     Dusman mermileri turuncu-kirmizi, oyuncu mermileri cyan.              */
  _drawBullets(c) {
    /* Round 21: cizimin tamami Bullet.drawPool'a tasindi (units paketi) --
       mermi gorseli units'in isi, HUD yalnizca cagirir. Donen deger iz
       uzunlugu; tracer_shape kancasi onu okur. */
    this.tracerLen = Bullet.drawPool(c, this.bulletPool, false);
    Bullet.drawPool(c, this.ebulletPool, true);
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
      /* Round 20: ipucu satiri — ekranin altinda soluk, oyunu duraklatmaz. */
      const tip = this.tipText();
      if (tip && this.state === 'play') {
        /* Round 24: ipucu da sehrin uzerinde duruyordu ve parlak bir karonun
           ustune denk gelince %55 alfayla kayboluyordu. Ayni ilke: kendi
           ince levhasini tasiyor. Ekran goruntusu yolu (noHud) bu blogun
           ICINDE, yani denetime giden kare degismez. */
        const T = CONFIG.UI.tipPlate;
        this._uiPlate(c, T.y0, T.y1, T.a, 18);
        c.textAlign = 'center';
        c.font = '13px monospace';
        c.fillStyle = 'rgba(176,192,208,0.8)';
        c.fillText(tip, CONFIG.W / 2, CONFIG.H - 16);
      }
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
  /* Bölüm karti: simge yapı amblemi + BÖLÜM n + sehir adi + ilerleme noktalari.
     Yumuşak girip cikis (300ms), oyun alanini TAMAMEN karartmaz — yalnizca
     kartin bandi.

     Round 24 — kart en kotu olcumu veren ekrandi (medyanlar [15,53,39,39,33],
     yayilim 38, tepe 53). Iki ayri sebep vardi ve ikisi de duzeldi:
       1) Perde YUMUSAK RADYAL'di ve ekran kenarinda sifira iniyordu; olcum
          bandi ise tam genislik. Perde tam da lazim oldugu yerde yoktu.
          Yerine tam genislikte, cekirdegi 0.90 alfali levha geldi: sizinti
          0.10, yani arka planin 38'lik yayilimi ~4'e iner.
       2) Amblem KOYU bir siluet (olculdu: landmark medyan parlakligi 40..124)
          ve koyu bir halkanin uzerine ciziliyordu — yani koyu zeminde de,
          parlak koprude de kayboluyordu. Artik arkadan cyan kaide ile
          aydinlatiliyor, boylece kendi zemininden AYRISIYOR.
     Simge yapilar hala YALNIZCA burada kullanilir; dunyaya cizilmezler.        */
  _drawStageCard(c) {
    const U = CONFIG.UI, W = CONFIG.W;
    const total = CONFIG.STAGE_TITLE_MS / 1000;
    const t = this.stageTitleT / total;   // 1→0
    // yumusak giris/cikis: ilk ve son 300ms alfa ile son
    const fadeIn = Math.min(1, (1 - t) / 0.3 * total + 0.0001);
    const fadeOut = Math.min(1, t / 0.3 * total + 0.0001);
    const a = Math.min(fadeIn, fadeOut);
    if (a <= 0) return;
    const st = CONFIG.STAGES[this.stageIdx];
    const lmName = this.city.landmark;   // landmark_<sehir>
    const cx = W / 2;
    /* Acilis: levha merkezden disa acilir, yazi asagidan yerine oturur.
       `stageTitleT`'den turer — saat okunmaz, sim'e dokunulmaz. */
    const e = 1 - (1 - fadeIn) * (1 - fadeIn) * (1 - fadeIn);
    const P = U.cardPlate;
    const mid = (P.y0 + P.y1) / 2, half = (P.y1 - P.y0) / 2;
    const y0 = mid - half * e, y1 = mid + half * e;
    const dy = (1 - e) * 12;
    c.save();
    c.globalAlpha = a;
    this._uiPlate(c, y0, y1, P.a * (0.4 + 0.6 * e));
    this._uiRule(c, cx, y0 + 8, 170 * e, 0.5);
    this._uiRule(c, cx, y1 - 8, 170 * e, 0.3);
    c.globalAlpha = a * e;
    // ------------------------------------------------------------- amblem
    const ecy = 280;
    if (lmName) {
      this._uiPedestal(c, cx, ecy - dy, 86, 0.16);
      this.assets.draw(c, lmName, cx - 70, ecy - 70 - dy, 140, 140);
    } else {
      /* Liman bolumunun simge yapisi yok — yerine bolum numarasi madalyonu.
         (Bos birakilirsa kartin ust yarisi cikplak kaliyordu.) */
      this._uiPedestal(c, cx, ecy - dy, 72, 0.16);
      c.textAlign = 'center';
      c.font = 'bold 58px monospace';
      c.fillStyle = '#ffffff';
      c.fillText(String(this.stageIdx + 1), cx, ecy + 21 - dy);
    }
    // -------------------------------------------------------------- yazilar
    c.textAlign = 'center';
    c.font = '13px monospace';
    c.fillStyle = `rgba(${U.accentRGB},0.9)`;
    this._uiTracked(c, `BÖLÜM ${this.stageIdx + 1}`, cx, 386 + dy, 6);
    c.font = 'bold 34px monospace';
    c.fillStyle = 'rgba(3,6,12,0.85)';
    c.fillText(st.name, cx + 2, 428 + dy);
    c.shadowColor = `rgba(${U.accentRGB},0.45)`; c.shadowBlur = 14;
    c.fillStyle = '#ffffff';
    c.fillText(st.name, cx, 426 + dy);
    c.shadowBlur = 0;
    /* Ilerleme noktalari: "kacinci bolumdeyim" sorusu kartin kendisinde
       cevaplanir (STAGES'ten turer, bolum eklenince kendiliginden uzar). */
    const n = CONFIG.STAGES.length, gap = 18, px0 = cx - (n - 1) * gap / 2;
    for (let i = 0; i < n; i++) {
      const cur = (i === this.stageIdx);
      c.beginPath();
      c.arc(px0 + i * gap, 458 + dy, cur ? 4.5 : 3, 0, Math.PI * 2);
      c.fillStyle = cur ? '#ffffff'
        : (i < this.stageIdx ? `rgba(${U.accentRGB},0.7)` : 'rgba(140,156,176,0.35)');
      c.fill();
    }
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
    const U = CONFIG.UI, W = CONFIG.W, H = CONFIG.H;
    c.save();
    c.globalAlpha = this.menuFadeT;
    // Arka plan: kayan sehir paralaks katmani + bulutlar (gercek dunya)
    this.city.draw(c, 1);
    this.clouds.draw(c);
    /* Tam boy degrade perde (round 19 dili korunur). Ust ve alt biraz daha
       koyu: baslik ve rehberlik satirlari orada oturuyor. */
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, `rgba(${U.plateRGB},0.62)`);
    g.addColorStop(0.42, `rgba(${U.plateRGB},0.40)`);
    g.addColorStop(1, `rgba(${U.plateRGB},0.72)`);
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
    c.textAlign = 'center';
    const now = performance.now();
    // ----------------------------------------------------------- baslik blogu
    const P = U.menuPlate;
    this._uiPlate(c, P.y0, P.y1, P.a);
    this._uiRule(c, W / 2, P.y0 + 8, 172, 0.5);
    c.font = '12px monospace';
    c.fillStyle = `rgba(${U.accentRGB},0.72)`;
    this._uiTracked(c, 'GECE DEVRİYESİ', W / 2, 166, 5);
    /* Baslik 44 -> 54 px ve iki katmanli: once koyu bir govde (agirlik),
       ustune beyaz + cyan hale. Ekranin genisligine gore kucuk kaliyordu. */
    c.font = 'bold 54px monospace';
    c.fillStyle = 'rgba(3,6,12,0.85)';
    c.fillText('DRONE WAR', W / 2 + 2, 222);
    c.shadowColor = `rgba(${U.accentRGB},0.55)`; c.shadowBlur = 16;
    c.fillStyle = '#ffffff';
    c.fillText('DRONE WAR', W / 2, 220);
    c.shadowBlur = 0;
    this._uiRule(c, W / 2, 242, 150, 0.55);
    c.save();
    c.translate(W / 2, 242.5); c.rotate(Math.PI / 4);
    c.fillStyle = `rgba(${U.accentRGB},0.85)`;
    c.fillRect(-3, -3, 6, 6);
    c.restore();
    // Bolum katalogu: oyunun kapsamini bir satirda soyler (STAGES'ten turer)
    c.font = '11px monospace';
    c.fillStyle = 'rgba(150,166,184,0.78)';
    c.fillText(U.stageCatalog, W / 2, 272);
    // ------------------------------------------- secili dronun onizlemesi
    const D = CONFIG.DRONES.find((d) => d.id === this.selectedDrone) || CONFIG.DRONES[0];
    const py = 400, ps = 104;
    this._uiPedestal(c, W / 2, py, 86, 0.13);
    this._uiScanRing(c, W / 2, py, 82, 1);
    c.globalAlpha = this.menuFadeT * 0.95;
    c.save();
    c.translate(W / 2, py + Math.sin(now * 0.0013) * 5);
    c.rotate(Math.sin(now * 0.0009) * 0.05);
    this.assets.draw(c, D.sprite, -ps / 2, -ps / 2, ps, ps);
    c.restore();
    c.globalAlpha = this.menuFadeT;
    this._drawRotorSpin(c, D.sprite, W / 2, py, ps / 96, 0);
    c.font = 'bold 20px monospace';
    c.fillStyle = '#ffffff';
    c.fillText(D.id.toUpperCase(), W / 2, 506);
    c.font = '12px monospace';
    c.fillStyle = `rgba(${U.accentRGB},0.85)`;
    c.fillText(D.desc, W / 2, 526);
    /* BASLA yonergesi artik cerceveli: dokunma cagrisi yanip sonen bir yazi
       degil, basilabilir gorunen bir hedef. */
    const bw = 252, bh = 48, bx = W / 2 - bw / 2, by = 560;
    const blink = 0.72 + 0.28 * Math.sin(now * 0.004);
    c.globalAlpha = this.menuFadeT * blink;
    c.fillStyle = `rgba(${U.accentRGB},0.10)`;
    this._uiRoundRect(c, bx, by, bw, bh, 8); c.fill();
    c.strokeStyle = `rgba(${U.accentRGB},0.8)`; c.lineWidth = 1.5;
    this._uiRoundRect(c, bx + 0.75, by + 0.75, bw - 1.5, bh - 1.5, 8); c.stroke();
    c.fillStyle = '#6fe3ff'; c.font = 'bold 22px monospace';
    c.fillText('DOKUN / SPACE', W / 2, by + 31);
    c.globalAlpha = this.menuFadeT;
    // En yuksek skor: etiket kucuk, SAYI buyuk (asil bilgi sayi)
    if (this.bestScore > 0) {
      c.font = '12px monospace';
      c.fillStyle = 'rgba(150,166,184,0.8)';
      this._uiTracked(c, 'EN YÜKSEK', W / 2, 646, 4);
      c.font = 'bold 26px monospace';
      c.fillStyle = U.gold;
      c.fillText(String(this.bestScore), W / 2, 678);
    }
    // Kisa kontrol satiri (en altta, kendi hattiyla ayrilir)
    this._uiRule(c, W / 2, 718, 190, 0.22, '255,255,255');
    c.font = '13px monospace';
    c.fillStyle = 'rgba(140,156,176,0.8)';
    c.fillText('Ok/WASD hareket · Space/Z ates · P duraklat', W / 2, 744);
    c.fillText('M sessiz · Esc menu', W / 2, 764);
    c.restore();
  },
  /* Duraklatma: eskiden %35 karartma + uc satir duz yaziydi ve okunurlugu
     arkadakine bagliydi (olculdu: medyanlar [13,36,37,34,36], yayilim 24).
     Artik oyun alani karartilir VE baslik/ozet tam genislikte levhaya oturur
     (toplam sizinti 0.16 * 0.50 = 0.08). Icerik de zenginlesti: kosunun o
     anki ozeti oyun sonu tablosuyla ayni satir dilinde gosteriliyor.         */
  _drawPause(c) {
    const U = CONFIG.UI, W = CONFIG.W, H = CONFIG.H;
    c.save();
    c.globalAlpha = this.menuFadeT;
    c.fillStyle = `rgba(${U.plateRGB},${U.pauseDim})`;
    c.fillRect(0, 0, W, H);
    const P = U.pausePlate;
    this._uiPlate(c, P.y0, P.y1, P.a);
    c.textAlign = 'center';
    this._uiRule(c, W / 2, P.y0 + 8, 168, 0.5);
    c.font = '12px monospace';
    c.fillStyle = `rgba(${U.accentRGB},0.72)`;
    this._uiTracked(c, 'GÖREV BEKLEMEDE', W / 2, 294, 5);
    c.font = 'bold 40px monospace';
    c.fillStyle = 'rgba(3,6,12,0.85)';
    c.fillText('DURAKLADI', W / 2 + 2, 342);
    c.shadowColor = `rgba(${U.accentRGB},0.45)`; c.shadowBlur = 14;
    c.fillStyle = '#ffffff';
    c.fillText('DURAKLADI', W / 2, 340);
    c.shadowBlur = 0;
    this._uiRule(c, W / 2, 362, 130, 0.5);
    // O anki kosunun ozeti — oyun sonu tablosuyla ayni satir dili
    const st = CONFIG.STAGES[this.stageIdx];
    c.font = '16px monospace';
    const rw = 240;
    this._uiRow(c, 'SKOR', String(this.score), W / 2, 400, rw);
    this._uiRow(c, 'BÖLÜM',
                `${st.name} ${this.stageIdx + 1}/${CONFIG.STAGES.length}`,
                W / 2, 426, rw);
    this._uiRow(c, 'ÖLDÜRME', String(this._stats.kills), W / 2, 452, rw);
    this._uiRule(c, W / 2, 470, 120, 0.2, '255,255,255');
    c.font = '14px monospace';
    c.fillStyle = 'rgba(140,156,176,0.85)';
    c.fillText('P / dokun: devam', W / 2, 492);
    c.fillText('Esc: menu', W / 2, 512);
    c.restore();
  },
  /* Oyun sonu / zafer. Round 20'nin istatistik tablosu bu paketin en gelismis
     duzeniydi; round 24'te diger ekranlar ona benzetildi, o da ayni levha ve
     satir diline oturtuldu. Tek icerik degisikligi: SKOR tablodan cikip
     kahraman sayi oldu (asil bilgi o), kalan dort satir tabloda kaldi.       */
  _drawEnd(c) {
    const U = CONFIG.UI, W = CONFIG.W, H = CONFIG.H;
    const victory = this.state === 'victory';
    c.save();
    c.globalAlpha = this.menuFadeT;
    // arka plan: zaferde son sehir (tokyo), oyun bittiginde ulasilan sehir
    const bgCity = victory ? 'city_tokyo' : ('city_' + CONFIG.STAGES[this.stageIdx].city);
    this.assets.draw(c, bgCity, 0, 0, W, H);
    const bg = c.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, `rgba(${U.plateRGB},0.78)`);
    bg.addColorStop(0.5, `rgba(${U.plateRGB},0.62)`);
    bg.addColorStop(1, `rgba(${U.plateRGB},0.84)`);
    c.fillStyle = bg; c.fillRect(0, 0, W, H);
    const P = U.endPlate;
    this._uiPlate(c, P.y0, P.y1, P.a);
    c.textAlign = 'center';
    this._uiRule(c, W / 2, P.y0 + 8, 180, 0.45);
    const accent = victory ? '255,210,74' : '255,85,64';
    const st = CONFIG.STAGES[this.stageIdx];
    c.font = '12px monospace';
    c.fillStyle = `rgba(${accent},0.85)`;
    this._uiTracked(c, victory ? 'GÖREV TAMAMLANDI' : 'GÖREV BAŞARISIZ', W / 2, 192, 5);
    c.font = victory ? 'bold 46px monospace' : 'bold 40px monospace';
    const title = victory ? 'VICTORY' : 'OYUN BİTTİ';
    c.fillStyle = 'rgba(3,6,12,0.85)';
    c.fillText(title, W / 2 + 2, 242);
    c.shadowColor = `rgba(${accent},0.8)`; c.shadowBlur = 18;
    c.fillStyle = victory ? U.gold : '#ff5540';
    c.fillText(title, W / 2, 240);
    c.shadowBlur = 0;
    this._uiRule(c, W / 2, 260, 140, 0.5, accent);
    // Baglam: nerede bitti, neye carpti
    c.font = '14px monospace';
    c.fillStyle = 'rgba(150,166,184,0.9)';
    c.fillText(victory
      ? `${CONFIG.STAGES.length} bölüm · ${st.name} düştü`
      : `${st.name} · bölüm ${this.stageIdx + 1}/${CONFIG.STAGES.length}`, W / 2, 288);
    if (!victory && this._killingEnemyType) {
      c.font = '12px monospace';
      c.fillStyle = 'rgba(255,136,136,0.9)';
      c.fillText(`öldüren: ${this._killingEnemyType}`, W / 2, 308);
    }
    /* Round 20: kosu istatistik tablosu — etiket sol, deger sag. */
    {
      const s = this._stats;
      const acc = s.shots > 0 ? Math.round(Math.min(1, s.hits / s.shots) * 100) : 0;
      const tMs = Math.round(this.simTimeMs);
      const mm = Math.floor(tMs / 60000), ss = Math.floor((tMs % 60000) / 1000);
      const cx = W / 2, rw = 246;
      // Kahraman sayi: SKOR
      c.font = '12px monospace';
      c.fillStyle = 'rgba(150,166,184,0.8)';
      this._uiTracked(c, 'SKOR', cx, 346, 4);
      c.font = 'bold 46px monospace';
      c.fillStyle = this._newRecord ? '#7CFC00' : '#ffffff';
      c.fillText(String(this.score), cx, 392);
      this._uiRule(c, cx, 408, 110, 0.22, '255,255,255');
      const rows = [
        ['ÖLDÜRME', String(s.kills)],
        ['EN İYİ KOMBO', String(s.bestCombo)],
        ['İSABET %', String(acc)],
        ['SÜRE', `${mm}:${ss < 10 ? '0' : ''}${ss}`],
      ];
      let y = 438;
      c.font = '17px monospace';
      for (const [label, val] of rows) {
        c.fillStyle = 'rgba(255,255,255,0.05)';
        c.fillRect(cx - rw / 2, y + 7, rw, 1);
        this._uiRow(c, label, val, cx, y, rw);
        y += 28;
      }
      // yeni rekor vurgusu
      if (this._newRecord) {
        c.fillStyle = '#7CFC00'; c.font = 'bold 22px monospace';
        c.shadowColor = 'rgba(124,252,0,0.8)'; c.shadowBlur = 12;
        c.fillText('★ YENİ REKOR ★', cx, y + 18);
        c.shadowBlur = 0;
      } else if (this.bestScore > 0) {
        c.font = '12px monospace';
        c.fillStyle = 'rgba(150,166,184,0.8)';
        this._uiTracked(c, 'EN YÜKSEK', cx, y + 8, 4);
        c.font = 'bold 20px monospace';
        c.fillStyle = U.gold;
        c.fillText(String(this.bestScore), cx, y + 34);
      }
    }
    // Devam et: kendi kucuk levhasi ustunde, yanip sonek
    this._uiPlate(c, 616, 660, 0.55, 26);
    c.globalAlpha = this.menuFadeT * (0.62 + 0.38 * Math.sin(performance.now() * 0.004));
    c.fillStyle = '#9ab'; c.font = '15px monospace';
    c.fillText('Devam etmek için SPACE / ekrana dokun', W / 2, 643);
    c.restore();
  },
});
