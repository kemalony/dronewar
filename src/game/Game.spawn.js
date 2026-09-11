/* game paketi — spawn yonetimi + boss dongusu + powerup/roket/isisi.
   Round 17: Game.js'ten birebir tasinan metotlar; davranis DEGISMEDI. */
Object.assign(Game.prototype, {
  /* ---------------------------------------------------- boss dongusu (round 8) */
  _updateBoss(dt) {
    const B = CONFIG.BOSS;
    if (this.bossState === 'warn') {
      this.bossWarnT -= dt;
      if (this.bossWarnT <= 0) {
        /* Round 16: son bolum boss'u cok asamali tasici — tek kurulum yolu.
           spawnCarrier() hem forceBoss hem test kancasi icin ayni reset'i yapar.
           stageIdx === STAGES.length-1: bolum 4 (Tokyo) normal boss, bolum 5
           (Liman) tasici. Sabit sayi YOK — STAGES.length'ten turetilir. */
        if (this.stageIdx === CONFIG.STAGES.length - 1) {
          this.spawnCarrier();
        } else {
          this.boss = new Boss();
          this.boss.reset(this.stageIdx);
          this.bossState = 'active';
        }
      }
      return;
    }
    if (this.bossState === 'active') {
      if (this.carrier.active) {
        this._updateCarrier(dt);
      } else if (this.boss) {
        this.boss.update(dt, this);
      }
      return;
    }
    if (this.bossState === 'dying') {
      this.bossDeathT -= dt;
      /* Round 15: tasici govde olumu — CONFIG.CARRIER sayilari, boss_tokyo boyutu */
      const isCarrier = !this.boss && this.carrier.active;
      const cfg = isCarrier ? CONFIG.CARRIER : B;
      const cx = isCarrier ? this.carrier.x : this.boss.x;
      const cy = isCarrier ? this.carrier.y : this.boss.y;
      const spreadX = isCarrier ? 208 : 120;
      const spreadY = isCarrier ? 176 : 90;
      // patlamalar, deathWindowMs icinde esit araliklarla (LCG konum sapmasi)
      const n = cfg.deathExplosions;
      const win = cfg.deathWindowMs / 1000;
      const done = Math.min(n, Math.ceil((win - this.bossDeathT) / win * n));
      for (let i = 0; i < done; i++) {
        let s = (i * 2654435761 + 9176) >>> 0;
        const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
        this.fx.explode(cx + (rnd() - 0.5) * spreadX, cy + (rnd() - 0.5) * spreadY);
      }
      if (this.bossFlashT > 0) this.bossFlashT -= dt;
      if (this.bossDeathT <= 0) {
        this.boss = null;
        this.carrier.active = false;
        this.bossState = 'none';
        this._afterBossDeath();
      }
    }
  },
  /* Round 15: jammer ambient glitch — oyuncu herhangi bir jammer'in
     CONFIG.JAMMER.radius menziline girince hafif surekli glitch, cikinca 0.
     Yalniz cizim katmani; sim durumuna dokunmaz. */
  _updateJammerFx() {
    let inRange = false;
    this.jammerPool.forEach((j) => { if (j.active && j.inRange) inRange = true; });
    /* Round 16: kara jammer de ambient glitch'e katilir — hava jammer'i ile
       ayni etki, ikisi ayni anda menzilde gorse bile seviye bir kez uygulanir. */
    this.groundPool.forEach((g) => { if (g.active && g.type === 'jammer' && g.inRange) inRange = true; });
    this.fx.setAmbientGlitch(inRange ? CONFIG.JAMMER.glitchLevel : 0);
  },
  /* Round 16: kara hedefi spawn yonetimi — slot tabanli LCG (binalardaki
     builtUpTo mantiginin aynisi). YALNIZCA ground:true olan bolumde calisir.
     Her slot CONFIG.GROUND.spacing kadar dunya mesafesinde; slotta tip ve x
     (marginX'e saygili) LCG'den secilir. Ayni slot iki kez uretilmez.        */
  _groundLcg() {
    this._groundSeed = (Math.imul(this._groundSeed, 1664525) + 1013904223) >>> 0;
    return this._groundSeed / 4294967296;
  },
  _updateGround(dt) {
    const st = CONFIG.STAGES[this.stageIdx];
    if (!st.ground) return;   // diger dort bolumde tek bir kara hedefi bile dogmaz
    /* Bolum gecisi crossfade'i bitmeden dogurma: fadeT < 1 iken ekranda hala
       ONCEKI sehrin (Tokyo) fotografi var ve kara araci onun uzerinde duruyor
       gibi gorunuyor — kacinmak istedigimiz sey tam olarak bu. */
    if (this.city.fadeT < 1) return;
    const G = CONFIG.GROUND;
    const maxSlot = Math.floor((this.city.dist + CONFIG.H) / G.spacing);
    while (this._groundBuiltUpTo < maxSlot) {
      this._groundBuiltUpTo++;
      const slot = this._groundBuiltUpTo;
      // deterministik tohum: slot bazli (CityScroller._spawnAt ile ayni desen)
      let seed = (slot * 2654435761 + 1013904223) >>> 0;
      const rnd = () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed / 4294967296;
      };
      // tip secimi: radar / aa / jammer
      const r = rnd();
      const type = r < 0.4 ? 'radar' : r < 0.75 ? 'aa' : 'jammer';
      // x konumu: marginX'e saygili
      const m = G.marginX;
      const x = m + rnd() * (CONFIG.W - 2 * m);
      // dogus: ekranin ustunden (y0 = -80), city.dist'ten turetilir
      const y0 = -80;
      const u = this.groundPool.acquire();
      if (u) u.reset(type, x, y0, this.city.dist);
    }
  },
  /* Test kancasi: kara hedefini dogrudan dogur (bolum sartini atlamaz —
     bolum liman degilse false doner). Autotest icin. */
  spawnGround(type, x, screenY) {
    const st = CONFIG.STAGES[this.stageIdx];
    if (!st.ground) return false;
    const u = this.groundPool.acquire();
    if (!u) return false;
    /* Ucuncu arguman EKRAN y'sidir (dogus anindaki). Onceki hali mutlak bir
       dunya ekseni bekliyordu: ayni deger bolumun basinda ekranda, 300 tick
       sonra ekranin 600 px ustunde dogurdugu icin olcum "menzilde degil"
       diyordu. Ekran y'si test icin tek dogal birim. */
    u.reset(type, x != null ? x : CONFIG.W / 2, screenY, this.city.dist);
    return true;
  },
  /* Test kancasi: tum kara hedeflerini temizle. */
  /* ------------------------------------------------- skimmer (round 17)
     Limanin deniz tarafindan gelen dusmani: YALNIZCA ground:true bolumde ve
     crossfade bittikten sonra dogar (kara hedefleriyle ayni kural — gecis
     sirasinda ekranda hala onceki sehir var). Dogus LCG ile deterministik. */
  _skimLcg() {
    this._skimSeed = (Math.imul(this._skimSeed || 1, 1664525) + 1013904223) >>> 0;
    return this._skimSeed / 4294967296;
  },
  _updateSkimmers(dt) {
    const S = CONFIG.SKIMMER;
    this.skimmerPool.forEach((k) => k.update(dt, this));
    const st = CONFIG.STAGES[this.stageIdx];
    if (!st.ground || this.city.fadeT < 1) return;
    if (this.bossState !== 'none') return;    // boss varken dogmaz
    let live = 0;
    this.skimmerPool.forEach((k) => { if (k.active) live++; });
    if (live >= S.maxConcurrent) return;
    this._skimmerT -= dt;
    if (this._skimmerT > 0) return;
    this._skimmerT = S.spawnIntervalMs / 1000;
    const dir = this._skimLcg() < 0.5 ? -1 : 1;
    const y = 120 + this._skimLcg() * (CONFIG.H * 0.55);
    const k = this.skimmerPool.acquire();
    if (k) k.reset(dir, y);
  },
  /* Test kancasi: skimmer dogur — liman disinda false doner. */
  spawnSkimmer() {
    if (!CONFIG.STAGES[this.stageIdx].ground) return false;
    const k = this.skimmerPool.acquire();
    if (!k) return false;
    const dir = this._skimLcg() < 0.5 ? -1 : 1;
    k.reset(dir, 260);
    return true;
  },
  clearGround() {
    this.groundPool.reset();
    this._groundBuiltUpTo = -1;
  },
  /* Round 16: kara hedefi etki carpanlarini her sim adiminda hesapla.
     enemyFireMul: radar sagken dusman ates araligi carpani (birden fazla
     radar varsa etki bir kez uygulanir, carpan ust uste binmez).
     fireSlowMul: jammer (kara veya hava) menzildeyken oyuncu birincil ates
     araligi carpani — ikisi ayni anda etkiliyse etki bir kez uygulanir.     */
  _computeFireMods() {
    const G = CONFIG.GROUND;
    // Radar: sagken enemyFireMul
    let radarAlive = false;
    this.groundPool.forEach((g) => {
      if (g.active && g.type === 'radar') radarAlive = true;
    });
    this.enemyFireMul = radarAlive ? G.types.radar.enemyFireMul : 1;
    // Jammer: kara veya hava — menzildeyse fireSlowMul (ikisi ayni anda: bir kez)
    let jammerInRange = false;
    this.groundPool.forEach((g) => {
      if (g.active && g.type === 'jammer' && g.inRange) jammerInRange = true;
    });
    if (!jammerInRange) {
      this.jammerPool.forEach((j) => {
        if (j.active && j.inRange) jammerInRange = true;
      });
    }
    this.fireSlowMul = jammerInRange ? G.types.jammer.fireSlowMul : 1;
  },
  /* Boss öldürüldüğünde (carpismadan cagrilir). */
  _onBossKilled() {
    const isCarrier = !this.boss && this.carrier.active;
    const cfg = isCarrier ? CONFIG.CARRIER : CONFIG.BOSS;
    /* Round 18: boss puan da kombo carpaniyla eklenir (boss oldurma bir oldurmadir). */
    if (!this.bossScored) { this._addComboScore(cfg.score); this.bossScored = true; }
    this.bossState = 'dying';
    this.bossDeathT = cfg.deathWindowMs / 1000;
    this.bossFlashT = cfg.flashMs / 1000;
    // Sarsinti: boss olumunde 500 ms
    this.shakeT = CONFIG.SHAKE.bossDeathMs / 1000;
    this.shakeDur = this.shakeT;
    this.shakeAmp = CONFIG.SHAKE.bossAmp;
  },
  /* Boss ölümü sonrası: bölüm geçişi veya VICTORY. */
  _afterBossDeath() {
    if (this.stageIdx < CONFIG.STAGES.length - 1) {
      this.stageIdx++;
      this.killsThisStage = 0;
      this.landmarkTriggered = false;
      this.stageTitleT = CONFIG.STAGE_TITLE_MS / 1000;
      const next = CONFIG.STAGES[this.stageIdx];
      this.city.setCity(next.city);   // crossfade (instant=false)
      this.sound.stageChange();
    } else {
      // bölüm 4 boss'u: VICTORY (kisa gecikmeyle)
      this._newRecord = this.score > this.bestScore;
      this.bestScore = Math.max(this.bestScore, this.score);
      this.victoryT = 0.9;
      this.menuFadeT = 0;   // yumusak gecis
      this.sound.victory();
    }
  },
  /* Test kancasi: kota dolmus gibi boss uyarisini tetikle. */
  forceBoss() {
    if (this.bossState !== 'none') return;
    this.bossState = 'warn';
    this.bossWarnT = CONFIG.BOSS.warnMs / 1000;
    /* Round 18: boss girisi art arda oldurme serisini kesmesin — sureyi yenile. */
    if (this.comboCount > 0) this.comboT = CONFIG.COMBO.windowMs / 1000;
    this.sound.bossWarn();
  },
  /* Test kancasi: boss'u aninda oldur (olum sekansi baslar). */
  killBoss() {
    if (this.bossState !== 'active') return;
    if (this.carrier.active) {
      this.killCarrier();
      return;
    }
    if (!this.boss) return;
    this.boss.hp = 1;   // hit() bir kez dusursun -> 0
    const killed = this.boss.hit();
    if (killed) this._onBossKilled();
  },
  /* Test kancasi: tasici boss'un tum parcalarini ve govdesini yok eder,
     normal olum sekansini tetikler (ayri kod yolu degil — ayni _onBossKilled). */
  killCarrier() {
    if (this.bossState !== 'active' || !this.carrier.active) return;
    // Tum parcalari yok et (anten dahil — govde acilir)
    for (const id in this.carrier.parts) {
      this.carrier.parts[id].hp = 0;
      this.carrier.parts[id].alive = false;
    }
    // Govdeyi tek vurusla oldur: hitBullet ile ayni yol
    this.carrier.bodyHp = 1;
    const res = this.carrier.hitBullet(this.carrier.x, this.carrier.y, 3);
    if (res && res.type === 'bodyKilled') this._onBossKilled();
  },
  /* Round 15: cok asamali tasici boss — bolumden bagimsiz test kancasi.
     Mevcut boss/caller aktifse once devre disi birakilir. */
  spawnCarrier() {
    if (this.state !== 'play') return false;
    if (this.boss) this.boss.active = false;
    this.boss = null;
    this.bossScored = false;
    this.carrier.reset(this.stageIdx);
    this.bossState = 'active';
    return true;
  },
  /* Tasici boss sim adimi: guncelleme + parca patlama kontrolu.
     Parca dustukce o parcain saldirisi otomatik durur (units paketi
     update'te parcain alive bayragina bakar). */
  _updateCarrier(dt) {
    const C = CONFIG.CARRIER;
    this.carrier.update(dt, this);
    for (const id in this.carrier.parts) {
      const part = this.carrier.parts[id];
      if (part.alive) continue;
      if (part._exploded) continue;   // patlama zaten yapildi
      part._exploded = true;
      const off = C.partOffsets[id];
      this.fx.explode(this.carrier.x + off.x, this.carrier.y + off.y);
      this.sound.enemyDeath();
      this.shakeT = Math.max(this.shakeT, 0.2);
      this.shakeDur = this.shakeT;
      this.shakeAmp = Math.max(this.shakeAmp, 8);
    }
  },
  /* Sub-dron test kancalari (round 14): sub_drones kapisi icin.
     grantSubDrone: pu_subdrone kapsulunun ALINMA yoluyla ayni — iki kod yolu yok.
     launchSubDrones: Input.consumeSubLaunch bayragini tetikler, sim adimindaki
     _trySubLaunch calisir (is kilidi dahil). Autotest disinda da zararsiz. */
  grantSubDrone() {
    if (!this.player) return false;
    this.spawnPowerup('subdrone', this.player.x, this.player.y);
    this._updatePowerups(0);   // oyuncu uzerinde dogdu -> aninda alinir
    return true;
  },
  launchSubDrones() {
    if (this.state !== 'play') return false;
    this.input._subLaunchQueued = true;
    return true;
  },
  /* Round 18: kombo carpani — tiers/mults tablosundan turetilir.
     comboCount >= tiers[i] ise mults[i+1]. En ust tier'da maxMult.         */
  comboMult() {
    const C = CONFIG.COMBO;
    let m = C.mults[0];
    for (let i = 0; i < C.tiers.length; i++) {
      if (this.comboCount >= C.tiers[i]) m = C.mults[i + 1];
    }
    return Math.min(m, C.maxMult);
  },
  /* Kalo sure doldugunda sayaci siler. Her sim adiminda calisir; dt birikimi
     ile ilerler (deterministik). Sure bitince cagrilan oldurma yeni pencere acar. */
  _updateCombo(dt) {
    if (this.comboT > 0) {
      this.comboT -= dt;
      if (this.comboT <= 0) { this.comboT = 0; this.comboCount = 0; }
    }
  },
  /* Skor'u mevcut kombo carpaniyla ekler (boss puan dahil).               */
  _addComboScore(base) { this.score += base * this.comboMult(); },
  /* Düşman öldürüldüğünde çağrılır: kombo + kota. Kota dolunca BÖLÜM SONU
     BOSS'U tetiklenir (round 8) — bölüm geçişi artık boss ölünce olur.
     SKOR EKLEMEZ (skor _onEnemyKilled/_onSkimmerKilled'de carpanli eklenir). */
  _onKill() {
    /* Round 18: her oldurma komboyu besler + sureyi yeniler. Kara hedefi de
       kotaya sayilmaz ama bu yola girdigi icin komboyu besler. */
    this.comboCount += CONFIG.COMBO.step;
    this.comboT = CONFIG.COMBO.windowMs / 1000;
    this.killsThisStage++;
    const st = CONFIG.STAGES[this.stageIdx];
    if (this.killsThisStage >= st.quota && this.bossState === 'none') {
      this.forceBoss();   // DIKKAT uyarisi -> boss giris
    }
  },
  /* ---------------------------------------------------- spawn yonetimi */
  _lcg() {
    this._spawnSeed = (Math.imul(this._spawnSeed, 1664525) + 1013904223) >>> 0;
    return this._spawnSeed / 4294967296;
  },
  _updateSpawn(dt) {
    this._spawnTimer -= dt * 1000;
    if (this._spawnTimer > 0) return;
    const st = CONFIG.STAGES[this.stageIdx];
    // eşzamanlı düşman sınırı (round 12: altı tipin hepsi sayilir)
    const activeCount = this.scoutPool.count() + this.gunnerPool.count() + this.shieldPool.count()
                      + this.bomberPool.count() + this.kamikazePool.count() + this.sniperPool.count();
    if (activeCount >= st.maxConcurrent) {
      this._spawnTimer = 200;   // kısa bekleme, tekrar dene
      return;
    }
    // spawn aralığı bölüm çarpanıyla
    this._spawnTimer = (CONFIG.SPAWN.base + this._lcg() * CONFIG.SPAWN.variance) * st.spawnMul;
    /* Round 12: tip karisimi bolume gore.
       1: scout+gunner | 2: +kamikaze | 3: +bomber | 4: +sniper ve hepsi */
    const r = this._lcg();
    let type, pool;
    if (this.stageIdx === 0) {
      // bölüm 1: scout + gunner
      if (r < 0.6) { type = 'scout'; pool = this.scoutPool; }
      else { type = 'gunner'; pool = this.gunnerPool; }
    } else if (this.stageIdx === 1) {
      // bölüm 2: + kamikaze
      if (r < 0.45) { type = 'scout'; pool = this.scoutPool; }
      else if (r < 0.75) { type = 'gunner'; pool = this.gunnerPool; }
      else { type = 'kamikaze'; pool = this.kamikazePool; }
    } else if (this.stageIdx === 2) {
      // bölüm 3: + bomber + jammer (round 15)
      if (r < 0.33) { type = 'scout'; pool = this.scoutPool; }
      else if (r < 0.52) { type = 'gunner'; pool = this.gunnerPool; }
      else if (r < 0.70) { type = 'kamikaze'; pool = this.kamikazePool; }
      else if (r < 0.85) { type = 'bomber'; pool = this.bomberPool; }
      else { type = 'jammer'; pool = this.jammerPool; }
    } else if (this.stageIdx === 3) {
      // bölüm 4: + sniper ve hepsi (jammer dahil)
      if (r < 0.26) { type = 'scout'; pool = this.scoutPool; }
      else if (r < 0.43) { type = 'gunner'; pool = this.gunnerPool; }
      else if (r < 0.56) { type = 'kamikaze'; pool = this.kamikazePool; }
      else if (r < 0.72) { type = 'bomber'; pool = this.bomberPool; }
      else if (r < 0.85) { type = 'jammer'; pool = this.jammerPool; }
      else { type = 'sniper'; pool = this.sniperPool; }
    } else {
      /* Round 16: bolum 5 (liman) — ayni karisim, kara hedefleri ayri havuzda */
      if (r < 0.26) { type = 'scout'; pool = this.scoutPool; }
      else if (r < 0.43) { type = 'gunner'; pool = this.gunnerPool; }
      else if (r < 0.56) { type = 'kamikaze'; pool = this.kamikazePool; }
      else if (r < 0.72) { type = 'bomber'; pool = this.bomberPool; }
      else if (r < 0.85) { type = 'jammer'; pool = this.jammerPool; }
      else { type = 'sniper'; pool = this.sniperPool; }
    }
    // x konumu: kenara yakın ağırlıklı
    const rx = this._lcg();
    let x;
    if (rx < 0.35) x = 30 + this._lcg() * 100;         // sol kenar
    else if (rx > 0.65) x = CONFIG.W - 130 + this._lcg() * 100; // sağ kenar
    else x = 80 + this._lcg() * (CONFIG.W - 160);       // orta
    this._spawnEnemy(type, x, -40, pool);
  },
  _spawnEnemy(type, x, y, pool) {
    /* Round 15: jammer — kendi sinifi/havuzu; Enemy tablosu yok. */
    if (type === 'jammer') {
      const j = this.jammerPool.acquire();
      if (!j) return null;
      j.reset(x, y);
      return j;
    }
    const pools = { scout: this.scoutPool, gunner: this.gunnerPool, shield: this.shieldPool,
                    bomber: this.bomberPool, kamikaze: this.kamikazePool, sniper: this.sniperPool };
    pool = pool || pools[type] || this.scoutPool;
    const e = pool.acquire();
    if (!e) return null;
    e.reset(type, x, y);
    // bölüm hız çarpanı (sniper speed=0 oldugu icin etki etmez)
    const st = CONFIG.STAGES[this.stageIdx];
    e.speed *= st.enemySpeedMul;
    return e;
  },
  _enemiesState() {
    const out = [];
    const push = (pool) => pool.forEach((e) => out.push({
      type: e.type, x: e.x, y: e.y, hp: e.hp, shieldHp: e.shieldHp, score: e.score,
      /* Round 12: yeni tip durum alanlari */
      locked: e.locked || false,
      lockX: e.lockX != null ? e.lockX : 0,
      telegraphing: e.telegraphing || false,
      telegraphX: e.telegraphX != null ? e.telegraphX : 0,
    }));
    push(this.scoutPool); push(this.gunnerPool); push(this.shieldPool);
    push(this.bomberPool); push(this.kamikazePool); push(this.sniperPool);
    return out;
  },
  /* ---------------------------------------------------- poweruplar (round 10) */
  _puLcg() {
    this._puSeed = (Math.imul(this._puSeed, 1664525) + 1013904223) >>> 0;
    return this._puSeed / 4294967296;
  },
  /* Dusman olumunda %12 pu_weapon, %8 pu_rocket, %6 pu_subdrone, %5 pu_repair
     duser (tek LCG'den art arda — Math.random YOK). Round 18: onarim kutusu. */
  _maybeDropPowerup(x, y) {
    const r = this._puLcg();
    if (r < CONFIG.WEAPON.dropChance) {
      this.powerups.push({ type: 'weapon', x, y, active: true });
    } else if (r < CONFIG.WEAPON.dropChance + CONFIG.ROCKET.dropChance) {
      this.powerups.push({ type: 'rocket', x, y, active: true });
    } else if (r < CONFIG.WEAPON.dropChance + CONFIG.ROCKET.dropChance + CONFIG.HEAT.dropChanceSubdrone) {
      this.powerups.push({ type: 'subdrone', x, y, active: true });
    } else if (r < CONFIG.WEAPON.dropChance + CONFIG.ROCKET.dropChance + CONFIG.HEAT.dropChanceSubdrone + CONFIG.REPAIR.dropChance) {
      this.powerups.push({ type: 'repair', x, y, active: true });
    }
  },
  /* Test kancasi: powerup dogrudan yerlestir. */
  spawnPowerup(type, x, y) {
    this.powerups.push({ type, x: x != null ? x : CONFIG.W / 2, y: y != null ? y : -30, active: true });
  },
  _updatePowerups(dt) {
    const W = CONFIG.WEAPON;
    for (const p of this.powerups) {
      if (!p.active) continue;
      p.y += W.fallSpeed * dt;
      if (p.y > CONFIG.H + 30) { p.active = false; continue; }
      // pickup: oyuncu ile mesafe
      const dx = p.x - this.player.x, dy = p.y - this.player.y;
      if (dx * dx + dy * dy < 30 * 30) {
        p.active = false;
        if (p.type === 'weapon') {
          if (this.weaponLevel < W.maxLevel) this.weaponLevel++;
          else this.score += W.overMaxScore;
        } else if (p.type === 'shield') {
          this.shieldT = W.shieldMs / 1000;
        } else if (p.type === 'rocket') {
          // Round 12: roket alindi — 15 sn boyunca ek silah
          this.rocketT = CONFIG.ROCKET.durationMs / 1000;
          this.rocketFireT = 0;
        } else if (p.type === 'subdrone') {
          /* Round 13: eksik sub-dron tamamlanir (en fazla SUBDRONE.max).
             Tam kapasitede alinca kucuk bonus puan — kapsul boşa gitmesin. */
          /* Orkestrator koprusu: 'units' ajani sub-dronlari Player.subs HAVUZUNDA
             tutarken 'game' ajani ayri bir Game.subDrones SAYACI tuttu — paralel
             calismanin klasik ayrisma hatasi. Canli olan havuz (guncellenen ve
             cizilen o); sayac hicbir zaman havuzu doldurmuyordu, bu yuzden kapsul
             alininca ekranda sub-dron belirmiyordu. Tek gercek kaynak havuzdur;
             sayac ondan turetilir. */
          if (this.player && this.player.addSub && this.player.addSub()) {
            this.subDrones = this.player.subs.count();
          } else {
            this.score += 100;   // tam kapasite: kapsul bosa gitmesin
          }
        } else if (p.type === 'repair') {
          /* Round 18: onarim kutusu — can dolu degilse heal, doluyse puan.
             Kisa yesil parlamasi HUD'da gosterilir (yalniz cizim). */
          const R = CONFIG.REPAIR;
          if (this.player.lives < R.maxLives) {
            this.player.lives = Math.min(R.maxLives, this.player.lives + R.heal);
          } else {
            this.score += R.score;
          }
          this.repairFlashT = 0.6;
        }
      }
    }
    this.powerups = this.powerups.filter((p) => p.active);
  },
  _drawPowerups(c) {
    for (const p of this.powerups) {
      if (!p.active) continue;
      c.save();
      c.globalCompositeOperation = 'lighter';
      c.globalAlpha = 0.3 + 0.15 * Math.sin(this.simTimeMs * 0.008);
      const col = p.type === 'weapon' ? 'rgba(255,200,60,1)' :
                  p.type === 'rocket' ? 'rgba(255,120,40,1)' :
                  p.type === 'subdrone' ? 'rgba(120,255,170,1)' :
                  p.type === 'repair' ? 'rgba(90,230,120,1)' : 'rgba(80,180,255,1)';
      c.strokeStyle = col;
      c.lineWidth = 2;
      c.beginPath(); c.arc(p.x, p.y, 22, 0, Math.PI * 2); c.stroke();
      c.globalAlpha = 1;
      c.globalCompositeOperation = 'source-over';
      /* Round 18: onarim kutusu — manifest'te sprite YOK, prosedurel yesil hac. */
      if (p.type === 'repair') {
        c.fillStyle = '#5fe07a';
        const cx = p.x, cy = p.y, arm = 15, th = 7;
        c.fillRect(cx - th / 2, cy - arm, th, arm * 2);
        c.fillRect(cx - arm, cy - th / 2, arm * 2, th);
        c.restore();
        continue;
      }
      const spr = p.type === 'weapon' ? 'pu_weapon' :
                  p.type === 'rocket' ? 'pu_rocket' :
                  p.type === 'subdrone' ? 'pu_subdrone' : 'pu_shield';
      this.assets.draw(c, spr, p.x - 24, p.y - 24, 48, 48);
      c.restore();
    }
  },
  /* ---------------------------------------------------- roketler (round 12) */
  /* En yakin aktif dusmani sec: esitlikte en kucuk havuz indeksi (deterministik).
     Round 16: kara hedefleri de hedeflenebilir (roket onlari vurabilir). */
  _nearestEnemy() {
    const pools = [this.scoutPool, this.gunnerPool, this.shieldPool,
                   this.bomberPool, this.kamikazePool, this.sniperPool];
    let best = null, bestD = Infinity, bestIdx = Infinity;
    for (let pi = 0; pi < pools.length; pi++) {
      pools[pi].forEach((e, ei) => {
        if (!e.active) return;
        const d = Math.hypot(e.x - this.player.x, e.y - this.player.y);
        if (d < bestD || (d === bestD && pi * 100 + ei < bestIdx)) {
          bestD = d; best = e; bestIdx = pi * 100 + ei;
        }
      });
    }
    /* Kara hedefleri — ekran konumu city.dist'ten turetilir */
    this.groundPool.forEach((g, gi) => {
      if (!g.active) return;
      const sy = g.screenY(this.city);
      const d = Math.hypot(g.x - this.player.x, sy - this.player.y);
      if (d < bestD || (d === bestD && 1000 + gi < bestIdx)) {
        bestD = d; best = g; bestIdx = 1000 + gi;
      }
    });
    return best;
  },
  /* Roket atis + gait + carpisma. rocketT > 0 iken her sim adiminda calisir. */
  _updateRockets(dt) {
    const R = CONFIG.ROCKET;
    // Atis zamanlayicisi
    this.rocketFireT -= dt;
    if (this.rocketFireT <= 0) {
      const target = this._nearestEnemy();
      if (target) {
        const rk = this.rocketPool.acquire();
        if (rk) {
          rk.reset(this.player.x, this.player.y - this.player.hitR(), target);
          this.rocketFireT = R.fireMs / 1000;
          /* Round 13: her roket isisi harcar (CONFIG.HEAT.cost.rocket) */
          this._addHeat(CONFIG.HEAT.cost.rocket);
        }
      } else {
        this.rocketFireT = 0;   // hedef yoksa hemen tekrar dene
      }
    }
    // Gait + ilerleme + carpisma
    this.rocketPool.forEach((rk) => {
      if (!rk.active) return;
      rk.update(dt, this);
      // Hedef ile carpisma (hasar 3)
      if (rk.target && rk.target.active) {
        /* Round 16: kara hedefi — ekran y'si city.dist'ten turetilir, hitbox kare */
        const isGround = rk.target.type === 'radar' || rk.target.type === 'aa' || rk.target.type === 'jammer';
        let tx = rk.target.x, ty;
        if (isGround) {
          ty = rk.target.screenY(this.city);
          const hw = rk.target.w / 2 + 10, hh = rk.target.h / 2 + 10;
          const dx = rk.x - tx, dy = rk.y - ty;
          if (Math.abs(dx) <= hw && Math.abs(dy) <= hh) {
            rk.active = false;
            for (let i = 0; i < R.damage; i++) {
              if (!rk.target.active) break;
              const killed = rk.target.hit(1);
              if (killed) this._onGroundKilled(rk.target);
            }
            this.fx.explode(rk.x, rk.y);
            this.sound.enemyDeath();
          }
        } else {
          ty = rk.target.y;
          const dx = rk.x - tx, dy = rk.y - ty;
          const rr = 10 + rk.target.radius;
          if (dx * dx + dy * dy <= rr * rr) {
            rk.active = false;
            for (let i = 0; i < R.damage; i++) {
              if (!rk.target.active) break;
              const killed = rk.target.hit();
              if (killed) this._onEnemyKilled(rk.target);
            }
            this.fx.explode(rk.x, rk.y);
            this.sound.enemyDeath();
          }
        }
      }
    });
  },
  /* ---------------------------------------------------- isisi + sub-dronlar (round 13) */
  /* Isisi ekle; limit dolunca asiri sicaklik kilidi acilir.
     Dash bu metodu cagririr (Player paketi), roket/subLaunch buradan. */
  _addHeat(n) {
    const H = CONFIG.HEAT;
    this.heat = Math.min(H.max, this.heat + n);
    if (this.heat >= H.overheatAt) this.overheated = true;
  },
  /* Sub-dron firlatma: Input.consumeSubLaunch() bayragi tetikler.
     SARTLAR: en az 1 sub-dron + isisi yetiyor + kilit yok.
     Kamikaze mermi: oyuncunun ustunden yukari, 520 px/s, dusmanlari eritir. */
  _trySubLaunch() {
    const H = CONFIG.HEAT, S = CONFIG.SUBDRONE;
    if (this.subDrones <= 0 || this.overheated || this.heat > H.max - H.cost.subLaunch) {
      this.subLaunchFailT = 0.6;   // HUD'da kisa uyarı yanip sonegi
      return;
    }
    this.subDrones--;
    this._addHeat(H.cost.subLaunch);
    const p = this.player;
    const b = this.bulletPool.acquire();
    if (!b) return;
    b.reset(p.x, p.y - p.hitR());
    b.vy = -S.launchSpeed;
    b.life = S.life;
    this.sound.enemyShot();
  },
});
