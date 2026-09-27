class Bullet {
  constructor() { this.trailX = new Float32Array(4); this.trailY = new Float32Array(4); this.trailN = 0; this.isEnemy = false; this.reset(0, 0); }
  reset(x, y, isEnemy) {
    this.x = x; this.y = y; this.isEnemy = !!isEnemy;
    const sp = isEnemy ? CONFIG.EBULLET.speed : CONFIG.BULLET.speed;
    this.vx = 0; this.vy = isEnemy ? sp : -sp;
    this.life = isEnemy ? CONFIG.EBULLET.life : CONFIG.BULLET.life;
    this.trailN = 0;
    this.flak = false;   // round 17: ucaksavar mermisi mi (omru bitince havada patlar)
  }
  update(dt) {
    // trail kaydir (en eskiyi at, sondakini yeni konuma yaz)
    for (let i = 0; i < this.trailN - 1; i++) { this.trailX[i] = this.trailX[i+1]; this.trailY[i] = this.trailY[i+1]; }
    this.trailX[this.trailN] = this.x; this.trailY[this.trailN] = this.y;
    if (this.trailN < 3) this.trailN++;
    this.x += this.vx * dt; this.y += this.vy * dt;
    this.life -= dt;
    if (this.life <= 0 || this.y < -20 || this.y > CONFIG.H + 20) this.active = false;
  }
}

/* ------------------------------------------------------- mermi cizimi (r21)
   Bir havuzun TAMAMINI tek gecişte cizer. Cagrilma yeri: Game._drawBullets.
   Donen deger iz uzunlugu (L) — cagiran `this.tracerLen` kancasina yazar.

    Katman sirasi (hepsi renk+alfa kovasina gore gruplu, sicak dongude tahsis
    YOK — eski kodun mermi basina createRadialGradient'i kaldirildi):
      1) koyu kontrast halesi  — KAPSUL: 6 kademe round-cap cizgi (r27)
      2) koyu iz (trail)       — merminin arkasinda kisa sonen hat
      3) yumusak additif parlama + cyan/beyaz cekirdek  ('lighter')
      4) uc parlamasi          — iki additif yay (gradyan yok)

    Neden hale: `foreground_contrast` tepe - medyan olcer; 'lighter' cekirdek
    her zeminde 255'e doyar, yani tepe yukseltilemez. Parlak bulut bandin
    medyanini ~230'a cikarinca fark 25'e duser (beyaz iz beyaz bulutta gercekten
    kaybolur). Siyah + alfa carpimsaldir: koyu sehirde gorunmez, parlak zeminde
    mermiye kendi cercevesini verir ve bandin medyanini asagi ceker. Arka plan
    karartilmaz — hale mermiye aittir ve mermiyle birlikte hareket eder.

    Neden kapsul (Round 27): dikdortgen fillRect'in keskin koseleri vision
    denetiminde u kez "harmanlanmamis siyah dikdortgen" olarak bildirildi.
    Kademeler artik lineCap='round' cizgi — uc formu tracer uzunluguyla
    uyumlu kapsul, yatayda 6 ince kademe kenar bandini eritir. Genislikler
    ve birikimli tepe karanlik (~0.83) eski desenle ayni buyuklukte;
    kapinin 60 esigine ayni marjla hizmet eder.

    Cizim/sim ayrimi: burada sim durumu OKUNUR, hicbiri yazilmaz; carpisma
    dikdortgeni degismez (genislikler CONFIG.BULLET.w'nin katidir).          */
Bullet.drawPool = function (c, pool, isEnemy) {
  const T = CONFIG.FX.tracer;
  const H = CONFIG.BULLET.halo;
  const L = T.len, half = L * 0.5;
  const bw = CONFIG.BULLET.w;          // tek boyut kaynagi (carpisma ile ayni)
  const TAU = Math.PI * 2;
  const tipDy = isEnemy ? half : -half;   // iz ucu: dusman asagi, oyuncu yukari
  const outer = isEnemy ? 'rgba(255,100,40,0.85)' : 'rgba(90,230,255,0.85)';
  const inner = isEnemy ? 'rgba(255,220,180,0.95)' : 'rgba(255,255,255,0.95)';
  c.save();
  // --- 1) KOYU KONTRAST HALESI (source-over siyah = carpim)
  // Kapsul: her kademe round-cap cizgi, kademe basina tek stroke (gruplu).
  // Ucler yuvarlanir, yataydaki 6 ince alfa kademesi kenar bantlanmasini eritir.
  c.lineCap = 'round';
  c.strokeStyle = '#000';
  for (let i = 0; i < H.widths.length; i++) {
    c.globalAlpha = H.alphas[i];
    c.lineWidth = bw * H.widths[i];
    c.beginPath();
    pool.forEach((b) => { c.moveTo(b.x, b.y + half); c.lineTo(b.x, b.y - half); });
    c.stroke();
  }
  // --- 2) KOYU IZ: merminin arkasinda hizla sonen kisa hat
  c.lineCap = 'round';
  c.globalAlpha = 0.28;
  c.strokeStyle = '#000';
  c.lineWidth = bw * 0.7;
  c.beginPath();
  pool.forEach((b) => {
    if (b.trailN >= 2) { c.moveTo(b.trailX[0], b.trailY[0]); c.lineTo(b.x, b.y); }
  });
  c.stroke();
  // --- 3) PARLAK CEKIRDEK (lighter)
  c.globalCompositeOperation = 'lighter';
  // yumusak parlama: dar tutulur, yoksa bandin medyanini kendisi yukseltir
  c.globalAlpha = T.glowA;
  c.strokeStyle = outer;
  c.lineWidth = bw * T.glowW;
  c.beginPath();
  pool.forEach((b) => { c.moveTo(b.x, b.y + half); c.lineTo(b.x, b.y - half); });
  c.stroke();
  c.globalAlpha = 1;
  c.strokeStyle = outer;
  c.lineWidth = bw * 0.7;
  c.beginPath();
  pool.forEach((b) => { c.moveTo(b.x, b.y + half); c.lineTo(b.x, b.y - half); });
  c.stroke();
  c.strokeStyle = inner;
  c.lineWidth = bw / 3;
  c.beginPath();
  pool.forEach((b) => { c.moveTo(b.x, b.y + half); c.lineTo(b.x, b.y - half); });
  c.stroke();
  // --- 4) UC PARLAMASI: iki additif yay (mermi basina gradyan YOK)
  c.globalAlpha = T.tipA;
  c.fillStyle = outer;
  c.beginPath();
  pool.forEach((b) => {
    const y = b.y + tipDy;
    c.moveTo(b.x + T.tipR, y); c.arc(b.x, y, T.tipR, 0, TAU);
  });
  c.fill();
  c.globalAlpha = 0.9;
  c.fillStyle = inner;
  const rIn = T.tipR * 0.45;
  c.beginPath();
  pool.forEach((b) => {
    const y = b.y + tipDy;
    c.moveTo(b.x + rIn, y); c.arc(b.x, y, rIn, 0, TAU);
  });
  c.fill();
  c.restore();
  return L;
};

/* --------------------------------------------------------------------- Rocket
   Round 12: kazanilabilir ek silah. Normal atisa EK olarak hafif gaitli.
   Hedef secimi deterministik: "en yakin aktif dusman, esitlikte en kucuk
   havuz indeksi". Donus hizi <= 180 deg/s. Isabette hasar 3.               */
