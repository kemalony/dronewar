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
  /* Round 22: enkaz tohumu icin ADLI LCG akisi. Her olumde yeni bir LCG
     kurulmaz (o zaman ayni konumda olen iki dron ayni sekilde savrulurdu ve
     akis kare hizina gore kayabilirdi); tek akis sirayla ilerler.
     Math.random YASAK — determinizm sozlesmesi.                            */
  _wreckLcg() {
    this._wreckSeed = (Math.imul(this._wreckSeed, 1664525) + 1013904223) >>> 0;
    return this._wreckSeed;
  },
  _onEnemyKilled(e) {
    e.active = false;
    this._addComboScore(e.score);
    this._scorePop(e.x, e.y, e.score);
    this._onKill();
    /* Round 22: olum geri bildirimi UC KATMANLI patlamadir (round 6: flash +
       fire + smoke); enkaz onun yerine gecmez, USTUNE gelir. Patlama olum
       ANINDA calar, govde donerek suzulur, omru dolunca bir kez daha patlar.
       Ilk yazimda patlamayi yalnizca "enkaz havuzu dolu" daline koymustum:
       normal olum tek kivilcima dustu ve explosion_layers kapisi (uc katmanin
       da cizilmesi) kirmiziya dondu — vurusun tokati da kayboldu.
       Havuz basincı ARTMAZ: olum basina patlama sayisi round 21'deki gibi bir
       tanedir, ayrica kivilcim vurusu (fx.hit) EKLENMEZ — explode zaten
       CONFIG.FX.sparksPerExplosion kadar kivilcim atar.                     */
    this.fx.explode(e.x, e.y);
    /* Enkaz havuzu (12 slot) doluysa geri bildirim yine TAM: patlama calisti,
       yalnizca dusen govde eksik kalir — sessiz olum yok. */
    this.fx.spawnWreck(e.x, e.y, e.sprite, this._wreckLcg());
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
      /* Round 22: JAMMER — havuz taramasinda hic yoktu, yani dron olumsuzdu.
         Oyuncu mermisi artik hasar verir; can bitince normal olum yolundan
         (skor + kota + kombo + enkaz) duser.                                */
      {
        let jHit = false;
        this.jammerPool.forEach((j) => {
          if (jHit || !j.active) return;
          const r = this._jammerHitR(j) + BR;
          const dx = b.x - j.x, dy = b.y - j.y;
          if (dx * dx + dy * dy <= r * r) {
            b.active = false;
            this._stats.hits++;   // Round 20: isabet sayaci
            jHit = true;
            this._hitJammer(j, b.x, b.y);
          }
        });
        if (jHit) return;
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
        this._damagePlayer('düşman mermisi');
      }
    });
  },
  /* Round 22: oyuncu hasarinin TEK yolu. Once bu blok yalnizca dusman mermisi
     carpismasinin icinde gomuluydu; disaridan (test kancasi, baska bir hasar
     kaynagi) ayni sonuclari uretmenin yolu yoktu. Sinyal bozulmasi (glitch)
     de burada tetiklenir — sarsinti + ses vardi ama glitch hic cagrilmiyordu.
     Donus: gercekten hasar alindi mi (dokunulmazlik/dash sirasinda false).  */
  _damagePlayer(cause) {
    if (!this.player.takeHit()) return false;
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
    /* Round 22: sinyal bozulmasi — kamera sarsintisi FIZIKSEL darbeyi anlatir,
       glitch YAYINDA olan bozulmayi. Ambient (jammer) glitch'ten daha guclu ve
       uzun; FxSystem ikisini toplayip glitchMaxCap'te kirpar. Yalniz cizim. */
    this.fx.glitch(CONFIG.FEEDBACK.damageGlitchMs, CONFIG.FEEDBACK.damageGlitchAmp);
    this.sound.hit();
    if (this.player.lives <= 0) {
      /* Round 20: bitis TEK yoldan (_gameOver) — rekor orada kalicilasir. */
      this._gameOver(cause || 'düşman');
    }
    return true;
  },
  /* ----------------------------------------------- Round 22: jammer hasari */
  /* Jammer'in govde yaricapi. CONFIG.JAMMER.radius jamming MENZILIDIR (200 px),
     hitbox degil — onunla carpisma yazilsa ekranin dortte birine dokunan mermi
     jammer'i vururdu. Units'e hitbox/hp gelirse buradaki yedek dusurulmeli. */
  _jammerHitR(j) {
    if (j && typeof j.hitR === 'function') return j.hitR();
    return CONFIG.FEEDBACK.jammerHitR;
  },
  /* Bir mermilik hasar. Jammer sinifinda (units) hp/hit() YOK; can burada,
     CONFIG.JAMMER.hp'den (core, 4) tembel olarak baslatilir. Units'e hit()
     eklenince bu dal kendiliginden ona devreder (reports/requests/game.md). */
  _hitJammer(j, x, y) {
    let killed;
    if (typeof j.hit === 'function') {
      killed = j.hit(1);
    } else {
      if (typeof j.hp !== 'number') j.hp = CONFIG.JAMMER.hp;
      j.hp--;
      killed = j.hp <= 0;
    }
    if (killed) { this._onJammerKilled(j); return true; }
    /* Beyaz tint parlamasi YOK: Jammer.draw hitFlash okumuyor (units). Okumayan
       bir alani doldurmak tam da bu turun temizledigi olu yazim olurdu. */
    this.fx.hit(x != null ? x : j.x, y != null ? y : j.y);
    this.sound.hit();
    return false;
  },
  /* Jammer olumu: hava dusmani — kotaya SAYILIR, komboyu besler, enkaz birakir.
     `_jammersKilled` YALNIZCA burada artar: ekrandan cikip devre disi kalan
     jammer dusurulmus sayilmaz, yoksa kapi olumsuz bir dronu yesil gosterirdi. */
  _onJammerKilled(j) {
    j.active = false;
    this._jammersKilled++;
    const score = CONFIG.JAMMER.score;
    this._addComboScore(score);
    this._scorePop(j.x, j.y, score);
    this._onKill();
    /* Diger hava olumleriyle ayni: once uc katmanli patlama, ustune enkaz. */
    this.fx.explode(j.x, j.y);
    this.fx.spawnWreck(j.x, j.y, 'drone_jammer', this._wreckLcg());
    this._maybeDropPowerup(j.x, j.y);
    this.sound.enemyDeath();
    this.hitstopT = Math.max(this.hitstopT, CONFIG.HITSTOP.enemyMs / 1000);
    /* Menzildeki jammer dustu: ambient glitch bir sonraki sim adiminda
       _updateJammerFx tarafindan zaten kapatilir — burada elle sifirlanmaz. */
  },
  /* ------------------------------------------- Round 22: autotest kancalari */
  /* Hepsi NORMAL yollardan gecer: kanca kendi olum/hasar kodunu yazmaz.     */
  /* En yakin aktif dusmani (alti hava tipi) oldurur. Canini bitirmek icin
     e.hit() tekrar tekrar cagrilir — kalkanli dron da boylece duser.        */
  killNearestEnemy() {
    let best = null, bestD = Infinity;
    for (const pool of [this.scoutPool, this.gunnerPool, this.shieldPool,
                        this.bomberPool, this.kamikazePool, this.sniperPool]) {
      pool.forEach((e) => {
        const dx = e.x - this.player.x, dy = e.y - this.player.y;
        const d = dx * dx + dy * dy;
        if (d < bestD) { bestD = d; best = e; }
      });
    }
    if (!best) return false;
    for (let i = 0; i < 64; i++) {
      if (best.hit()) { this._onEnemyKilled(best); return true; }
    }
    return false;
  },
  /* Oyuncuya bir hasar uygular (normal hasar yolu). Dokunulmazlik/dash
     sirasinda false doner — kanca bunu DELMEZ, gercek oyundaki kural gecerli. */
  damagePlayer() { return this._damagePlayer('düşman'); },
  /* En yakin jammer'a bir mermilik hasar uygular. */
  killNearestJammer() {
    let best = null, bestD = Infinity;
    this.jammerPool.forEach((j) => {
      const dx = j.x - this.player.x, dy = j.y - this.player.y;
      const d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = j; }
    });
    if (!best) return false;
    return this._hitJammer(best, best.x, best.y);
  },
});
