class Enemy {
  constructor() { this.reset('scout', 0, 0); }
  reset(type, x, y) {
    const E = CONFIG.ENEMIES[type];
    this.type = type;
    this.x = x; this.y = y;
    this.hp = E.hp;
    this.shieldHp = E.shieldHp || 0;
    this.speed = E.speed;
    this.score = E.score;
    this.radius = E.radius;
    this.sprite = E.sprite;
    this.fireTimer = E.fireInterval ? E.fireInterval : Infinity;
    this.hitFlash = 0;              // beyaz tint parlamasi kalan sure (s)
    /* Round 12: yeni tip durum alanlari */
    this.bombT = E.bombMs ? E.bombMs / 1000 : Infinity;   // bomber bomba sayaci (s)
    this.locked = false;             // kamikaze: kilitlendi mi
    this.lockX = x;                  // kamikaze: kilitleme anindaki oyuncu x
    this.sniperT = E.fireMs ? E.fireMs / 1000 : Infinity; // sniper atis sayaci (s)
    this.telegraphing = false;       // sniper: nişan cizgisi gorunuyor mu
    this.telegraphX = 0;             // sniper: nişan hedefi x (test kancasi)
    this._seed = (x * 31 + y * 17 + 7) >>> 0;  // LCG tohumu (deterministik)
    this.active = true;
  }
  _lcg() {
    this._seed = (Math.imul(this._seed, 1664525) + 1013904223) >>> 0;
    return this._seed / 4294967296;
  }
  update(dt, game) {
    if (this.hitFlash > 0) this.hitFlash -= dt;
    const p = game.player;
    switch (this.type) {
      case 'scout':
      case 'shield':
        this.y += this.speed * dt;
        break;
      case 'gunner':
        this.y += this.speed * dt;
        this.fireTimer -= dt;
        if (this.fireTimer <= 0 && this.y > 40 && this.y < CONFIG.H * 0.7) {
          const st = CONFIG.STAGES[game.stageIdx];
          this.fireTimer = st.gunnerFireMs / 1000;
          const b = game.ebulletPool.acquire();
          if (b) {
            const dx = p.x - this.x, dy = p.y - this.y;
            const d = Math.hypot(dx, dy) || 1;
            const sp = st.ebulletSpeed;
            b.reset(this.x, this.y + 20, true);
            b.vx = (dx / d) * sp;
            b.vy = (dy / d) * sp;
            game.sound.enemyShot();
          }
        }
        break;
      case 'bomber':
        // Yavas inis + 1800ms'de bir asagi dogru 3'lü bomba yelpazesi
        this.y += this.speed * dt;
        this.bombT -= dt;
        if (this.bombT <= 0 && this.y > 40 && this.y < CONFIG.H * 0.75) {
          this.bombT = CONFIG.ENEMIES.bomber.bombMs / 1000;
          for (let i = -1; i <= 1; i++) {
            const b = game.ebulletPool.acquire();
            if (b) {
              b.reset(this.x, this.y + 20, true);
              b.vx = i * 70;                 // hafif yatay yelpaze
              b.vy = 200;                     // mermiden yavas (200 px/s)
              b.life = 4.0;
            }
          }
          game.sound.enemyShot();
        }
        break;
      case 'kamikaze':
        if (!this.locked) {
          // Zikzak iniş: sinüs ile yatay salınım + sabit dikey hız
          this.y += this.speed * dt;
          this.x += Math.sin(this.y * 0.04) * 120 * dt;
          // Oyuncunun o anki x'ine KİLİTLEN (ekranın üst üçte birinde)
          if (this.y >= CONFIG.H / 3) {
            this.locked = true;
            this.lockX = p.x;
          }
        } else {
          // Kilitleme: lockX'e hizlanarak dal (260 -> 520 px/s)
          const targetY = p.y;
          const dx = this.lockX - this.x;
          const dy = targetY - this.y;
          const d = Math.hypot(dx, dy) || 1;
          const sp = CONFIG.ENEMIES.kamikaze.lockSpeed;
          this.x += (dx / d) * sp * dt;
          this.y += (dy / d) * sp * dt;
        }
        break;
      case 'sniper':
        // Ekranın üst üçte birinde durur, telegraflı atış
        if (this.y < CONFIG.H * 0.33) {
          this.y += 120 * dt;   // hiza ulaşana kadar in
        } else {
          this.sniperT -= dt;
          if (this.sniperT <= 0) {
            // Atış döngüsü: önce 600ms telegraf, sonra hızlı tek mermi
            if (!this.telegraphing) {
              this.telegraphing = true;
              this.telegraphX = p.x;   // oyuncunun o anki x'i
              this.sniperT = CONFIG.ENEMIES.sniper.telegraphMs / 1000;
            } else {
              this.telegraphing = false;
              this.sniperT = CONFIG.ENEMIES.sniper.fireMs / 1000;
              const b = game.ebulletPool.acquire();
              if (b) {
                const sp = CONFIG.ENEMIES.sniper.bulletSpeed;
                b.reset(this.x, this.y + 20, true);
                b.vx = 0;
                b.vy = sp;   // asagi dogru hizli tek mermi
                b.life = 2.0;
              }
              game.sound.enemyShot();
            }
          }
        }
        break;
    }
    if (this.y > CONFIG.H + 60) { this.active = false; return; }
  }
  hit() {
    if (this.shieldHp > 0) { this.shieldHp--; return false; }
    this.hp--;
    return this.hp <= 0;
  }
  draw(c, assets) {
    const s = this.radius * 2;
    c.save();
    c.translate(this.x, this.y);
    // --- yumuşak koyu hale (yalnızca çizim; sim'e dokunmaz). Oyuncu halesi
    //     deseni (Player.js): radyal gradeyan, rgba kademeleri config'ten.
    //     Neden: yeşil scout / cyan tonlu tipler parlak şehir karosu ve liman
    //     suyu üstünde kaynaşıyordu (mimo: _gnd_a ve shot_2, öncelik 4).
    //     Hale sprite'ın TAŞINA kadar geniş ve yumuşak kenarlı — "gövde
    //     çevresinde daire" hissi vermez. Kenar ışığı ayrıcadır (aşağıda).
    const HAL = CONFIG.ENEMY.halo;
    const haloR = s * HAL.radiusMul;
    const halo = c.createRadialGradient(0, 0, s * HAL.innerMul, 0, 0, haloR);
    for (let i = 0; i < HAL.pos.length; i++) halo.addColorStop(HAL.pos[i], HAL.col[i]);
    c.fillStyle = halo;
    c.beginPath(); c.arc(0, 0, haloR, 0, Math.PI * 2); c.fill();
    // --- gövde sprite'i
    assets.draw(c, this.sprite, -s/2, -s/2, s, s);
    // --- tip ayrimi: kenar isigi (halenin ustune additive vurur; oyuncudaki
    //     cyan kenar isigi deseninin dusman renkli karsiligi)
    c.globalCompositeOperation = 'lighter';
    if (this.type === 'scout') {
      // soğuk gri govde uzerine ince KIRMIZI kenar isigi
      c.strokeStyle = 'rgba(255,70,60,0.85)';
      c.lineWidth = 1.5;
      c.shadowColor = 'rgba(255,70,60,0.7)';
      c.shadowBlur = 5;
      c.beginPath(); c.arc(0, 0, s * 0.42, 0, Math.PI * 2); c.stroke();
    } else if (this.type === 'gunner') {
      // TURUNCU kenar isigi + altta namlu parlamasi
      c.strokeStyle = 'rgba(255,150,40,0.9)';
      c.lineWidth = 2;
      c.shadowColor = 'rgba(255,150,40,0.8)';
      c.shadowBlur = 6;
      c.beginPath(); c.arc(0, 0, s * 0.44, 0, Math.PI * 2); c.stroke();
      c.shadowBlur = 0;
      const mg = c.createRadialGradient(0, s * 0.32, 0, 0, s * 0.32, s * 0.2);
      mg.addColorStop(0, 'rgba(255,190,90,0.9)');
      mg.addColorStop(0.5, 'rgba(255,120,30,0.4)');
      mg.addColorStop(1, 'rgba(255,120,30,0)');
      c.fillStyle = mg;
      c.beginPath(); c.arc(0, s * 0.32, s * 0.2, 0, Math.PI * 2); c.fill();
    }
    // shield: kalkan varken MAVI KABARCIK (kalkan kirilincada soner)
    if (this.type === 'shield' && this.shieldHp > 0) {
      c.shadowBlur = 0;
      c.strokeStyle = 'rgba(90,170,255,0.7)';
      c.lineWidth = 2;
      c.beginPath(); c.arc(0, 0, s * 0.55, 0, Math.PI * 2); c.stroke();
      c.fillStyle = 'rgba(90,170,255,0.08)';
      c.fill();
    }
    // Round 12: bomber — altta bomba hazirligi parlamasi (turuncu)
    if (this.type === 'bomber') {
      c.shadowBlur = 0;
      const mg = c.createRadialGradient(0, s * 0.35, 0, 0, s * 0.35, s * 0.22);
      mg.addColorStop(0, 'rgba(255,160,40,0.85)');
      mg.addColorStop(1, 'rgba(255,100,20,0)');
      c.fillStyle = mg;
      c.beginPath(); c.arc(0, s * 0.35, s * 0.22, 0, Math.PI * 2); c.fill();
    }
    // Round 12: kamikaze — kilitlendiginde kisa KIRMIZI uyarı çizgisi (oyuncuya)
    if (this.type === 'kamikaze' && this.locked) {
      c.shadowBlur = 0;
      c.globalCompositeOperation = 'lighter';
      c.strokeStyle = 'rgba(255,60,40,0.55)';
      c.lineWidth = 1.5;
      c.setLineDash([6, 6]);
      c.beginPath();
      c.moveTo(0, s * 0.3);
      c.lineTo(this.lockX - this.x, CONFIG.H - this.y);
      c.stroke();
      c.setLineDash([]);
      c.globalCompositeOperation = 'source-over';
    }
    // Round 12: sniper — telegraf sirasinda ince KIRMIZI nişan çizgisi
    if (this.type === 'sniper' && this.telegraphing) {
      c.shadowBlur = 0;
      c.globalCompositeOperation = 'lighter';
      c.strokeStyle = 'rgba(255,50,40,0.7)';
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(0, s * 0.3);
      c.lineTo(this.telegraphX - this.x, CONFIG.H - this.y);   // ekranin altina
      c.stroke();
      c.globalCompositeOperation = 'source-over';
    }
    c.shadowBlur = 0;
    c.globalCompositeOperation = 'source-over';
    // --- vurus parlamasi: onceden beyaz tint'lenmis kopya, ~90ms, alfa ile soner
    //     (source-atop + fillRect KULLANILMAZ — tuval geneline calisir)
    if (this.hitFlash > 0) {
      const a = Math.min(1, this.hitFlash / (CONFIG.FX.hitFlashMs / 1000));
      c.globalAlpha = a;
      c.globalCompositeOperation = 'lighter';
      const w = assets.whiteTint(this.sprite);
      if (w) c.drawImage(w, -s/2, -s/2, s, s);
      c.globalAlpha = 1;
      c.globalCompositeOperation = 'source-over';
    }
    c.restore();
  }
}

/* --------------------------------------------------------------------- Boss
   Bölüm sonu boss'u (round 8). Tek slot, önceden ayrılmış; Math.random YOK —
   tüm rastgelelik LCG'den. Desenler bölüm bazlı ve birikimli:
     1: nişanlı 3'lü yelpaze | 2: + 12'li dairesel patlama
     3: + iki taraftan çapraz tarama | 4: üçü birden, aralıklar %20 kısa
   Girişte 1500 ms kapalı formda iniş, sonra y=150'de 70 px / 3 s salınım.    */
