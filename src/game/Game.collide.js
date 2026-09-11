/* game paketi — carpisma cozumleri + hasar/skor sonuclari.
   Round 17: Game.js'ten birebir tasinan metotlar; davranis DEGISMEDI. */
Object.assign(Game.prototype, {
  /* Round 18: skor baloncugu — kazanilan puan olum yerinde yukselir. Renk
     kombo tier'ina gore isinir, boylece carpanin ise yaradigi EKRANDA gorunur. */
  _scorePop(x, y, base) {
    const C = CONFIG.COMBO;
    const m = this.comboMult();
    const tier = Math.max(0, C.mults.indexOf(m));
    this.fx.scorePop(x, y, '+' + (base * m), tier);
  },
  /* Dusman oldurme (roket/mermi ortak): skor + kota + patlama + powerup.
     Round 18: SKOR KOMBO CARPANIYLA eklenir (once carpanli skor, sonra _onKill
     sayaci besler — Boylece bu oldurma kendi katkisiyla artan carpani GORMEZ). */
  _onEnemyKilled(e) {
    e.active = false;
    this._addComboScore(e.score);
    this._scorePop(e.x, e.y, e.score);
    this._onKill();
    this.fx.explode(e.x, e.y);
    this._maybeDropPowerup(e.x, e.y);
    this.sound.enemyDeath();
    this.hitstopT = Math.max(this.hitstopT, CONFIG.HITSTOP.enemyMs / 1000);
  },
  /* Round 16: kara hedefi oldurme — skor + patlama + ses.
     KOTAYA SAYILMAZ (kota hava dusmanlariyla dolar). Powerup DUSMEZ.
     Round 18: komboyu BESLER (oldurma oldurmadir) ama kotaya girmez. */
  _onGroundKilled(g) {
    g.active = false;
    this._addComboScore(g.score);
    /* Komboyu besle ama kotayi doldurma: _onKill'deki killsThisStage++ atilir. */
    this.comboCount += CONFIG.COMBO.step;
    this.comboT = CONFIG.COMBO.windowMs / 1000;
    const sy = g.screenY(this.city);
    this._scorePop(g.x, sy, g.score);
    this.fx.explode(g.x, sy);
    /* Round 17: zeminde kalan is izi — zemine civili (y0/spawnDist modeli). */
    this.fx.spawnScorch(g.x, sy, this.city.dist);
    this.sound.groundDeath ? this.sound.groundDeath() : this.sound.enemyDeath();
  },
  /* Round 17: skimmer olumu — hava dusmani, bolum kotasina SAYILIR.
     Round 18: skor carpanli eklenir (once skor, sonra _onKill). */
  _onSkimmerKilled(k) {
    k.active = false;
    this._addComboScore(k.score);
    this._scorePop(k.x, k.y, k.score);
    this.fx.explode(k.x, k.y);
    this.sound.enemyDeath();
    this._onKill();
  },
  /* ---------------------------------------------------- carpisma */
  _collidePlayerBullets() {
    const BR = 3;   // oyuncu mermisi yaricapi
    this.bulletPool.forEach((b) => {
      if (!b.active) return;
      /* Round 15: tasici boss carpismasi — parcalar -> govde (units paketi). */
      if (this.bossState === 'active' && this.carrier.active) {
        const res = this.carrier.hitBullet(b.x, b.y, BR);
        if (res) {
          b.active = false;
          this._stats.hits++;   // Round 20: isabet sayaci
          if (res.type === 'bodyKilled') {
            this._onBossKilled();
            this.sound.enemyDeath();
            this.hitstopT = Math.max(this.hitstopT, CONFIG.HITSTOP.bossMs / 1000);
          } else {
            this.fx.hit(b.x, b.y);
            this.sound.hit();
          }
          return;
        }
      }
      // boss carpismasi (yalnizca aktifken) — once dusmanlara bakilir
      if (this.bossState === 'active' && this.boss) {
        const dx = b.x - this.boss.x, dy = b.y - this.boss.y;
        const rr = BR + CONFIG.BOSS.radius;
        if (dx * dx + dy * dy <= rr * rr) {
          b.active = false;
          this._stats.hits++;   // Round 20: isabet sayaci
          const killed = this.boss.hit();
          if (killed) {
            this._onBossKilled();
            this.sound.enemyDeath();
            this.hitstopT = Math.max(this.hitstopT, CONFIG.HITSTOP.bossMs / 1000);
          } else {
            this.fx.hit(b.x, b.y);
            this.sound.hit();
          }
          return;
        }
      }
      /* Round 16: kara hedefleri — oyuncu mermisi hasar verir; kotaya SAYILMAZ.
         Oyuncu govdesi kara hedefiyle carpismaz (cagirmak yok). */
      {
        let gHit = false;
        this.groundPool.forEach((g) => {
          if (gHit || !g.active) return;
          const G = CONFIG.GROUND;
          const sy = g.screenY(this.city);
          const hw = g.w / 2 - G.hitPad, hh = g.h / 2 - G.hitPad;
          if (b.x >= g.x - hw && b.x <= g.x + hw &&
              b.y >= sy - hh && b.y <= sy + hh) {
            b.active = false;
            this._stats.hits++;   // Round 20: kara hedefine isabet
            const killed = g.hit(1);
            if (killed) this._onGroundKilled(g);
            else { this.fx.hit(b.x, b.y); this.sound.groundHit ? this.sound.groundHit() : this.sound.hit(); }
            gHit = true;
          }
        });
        if (gHit) return;
      }
      /* Round 17: skimmer — oyuncu mermisi hasar verir, olunce kotaya sayilir. */
      {
        let kHit = false;
        this.skimmerPool.forEach((k) => {
          if (kHit || !k.active) return;
          const dx = b.x - k.x, dy = b.y - k.y;
          if (dx * dx + dy * dy <= (k.radius + BR) * (k.radius + BR)) {
            b.active = false;
            this._stats.hits++;   // Round 20: isabet sayaci
            kHit = true;
            if (k.hit(1)) this._onSkimmerKilled(k);
            else { this.fx.hit(b.x, b.y); this.sound.hit(); }
          }
        });
        if (kHit) return;
      }
      /* Round 12: alti tipin hepsi (scout/gunner/shield/bomber/kamikaze/sniper) */
      for (const pool of [this.scoutPool, this.gunnerPool, this.shieldPool,
                          this.bomberPool, this.kamikazePool, this.sniperPool]) {
        let hit = false;
        pool.forEach((e) => {
          if (hit || !e.active) return;
          const dx = b.x - e.x, dy = b.y - e.y;
          const rr = BR + e.radius;
          if (dx * dx + dy * dy <= rr * rr) {
            b.active = false;
            this._stats.hits++;   // Round 20: isabet sayaci
            const killed = e.hit();
            if (killed) {
              this._onEnemyKilled(e);   // skor + kota + patlama + powerup
            } else {
              e.hitFlash = CONFIG.FX.hitFlashMs / 1000;  // beyaz tint parlamasi
              this.fx.hit(b.x, b.y);           // kucuk kivilcim vurusu
              this.sound.hit();
            }
            hit = true;
          }
        });
        if (hit) break;
      }
    });
  },
  _collideEnemyBullets() {
    const ER = 5;   // dusman mermisi yaricapi
    const PR = 16;  // oyuncu yaricapi
    if (this.player.invincible > 0) return;
    this.ebulletPool.forEach((b) => {
      if (!b.active) return;
      const dx = b.x - this.player.x, dy = b.y - this.player.y;
      const rr = ER + PR;
      if (dx * dx + dy * dy <= rr * rr) {
        b.active = false;
        // Kalkan aktifse hasari em (round 10)
        if (this.shieldT > 0) {
          this.fx.hit(b.x, b.y);
          return;
        }
        if (this.player.takeHit()) {
          /* Round 18: oyuncu hasar alinca kombo ANINDA sifirlanir. */
          this.comboCount = 0; this.comboT = 0;
          /* Round 12: silah seviyesi DOGRUDAN 1'e dustur (kademeli degil) +
             roket suresi sifirlanir + HUD'da SİLAH 1 yanip soner. */
          this.weaponLevel = 1;
          this.rocketT = 0;
          this.weaponFlashT = CONFIG.WEAPON.resetFlashMs / 1000;
          /* Round 13: bir sub-dron kaybedilir (gövde hasarıyla birlikte). */
          if (this.subDrones > 0) this.subDrones--;
          // Sarsinti: oyuncu hasar alinca 260 ms
          this.shakeT = CONFIG.SHAKE.playerHitMs / 1000;
          this.shakeDur = this.shakeT;
          this.shakeAmp = CONFIG.SHAKE.playerAmp;
          this.sound.hit();
          if (this.player.lives <= 0) {
            this._killingEnemyType = 'düşman mermisi';
            this._newRecord = this.score > this.bestScore;
            this.bestScore = Math.max(this.bestScore, this.score);
            this._savePersist();   // Round 20: kalici rekor (try/catch icinde)
            this.menuFadeT = 0;   // yumusak gecis
            this.state = 'gameover';
          }
        }
      }
    });
  },
});
