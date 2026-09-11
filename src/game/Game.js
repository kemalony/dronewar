class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new Renderer(canvas);
    this.assets = new Assets(MANIFEST);
    this.clock = new Clock(CONFIG.SIM_HZ);
    this.input = new Input(this);
    this.bulletPool = new Pool(CONFIG.FIRE.pool, () => new Bullet());
    this.ebulletPool = new Pool(CONFIG.ENEMY_BULLET_POOL, () => new Bullet());
    this.scoutPool = new Pool(16, () => new Enemy());
    this.gunnerPool = new Pool(8, () => new Enemy());
    this.shieldPool = new Pool(8, () => new Enemy());
    /* Round 12: uc yeni dusman tipi — kendi havuzlari (sicak dongude `new` yok) */
    this.bomberPool = new Pool(8, () => new Enemy());
    this.kamikazePool = new Pool(10, () => new Enemy());
    this.sniperPool = new Pool(4, () => new Enemy());
    /* Round 15: jammer dronu — kendi havuzu (CONFIG.JAMMER.pool).
       Ates etmez; menzildeyken oyuncuyu zayiflatir + ambient glitch tetikler. */
    this.jammerPool = new Pool(CONFIG.JAMMER.pool, () => new Jammer());
    /* Round 16: kara hedefleri — YALNIZCA ground:true olan bolumde dogar. */
    this.groundPool = new Pool(CONFIG.GROUND.pool, () => new GroundUnit());
    /* Round 17: skimmer — limanin yandan giren dusmani (units paketi). */
    this.skimmerPool = new Pool(CONFIG.SKIMMER.pool, () => new Skimmer());
    this._skimmerT = 0;          // dogus sayaci (s)
    this._skimSeed = 0;          // skimmer dogusu icin ayri LCG tohumu
    this._groundBuiltUpTo = -1;   // son uretilen slot (slot tabanli LCG)
    this._groundSeed = 42;        // kara hedefi LCG tohumu (deterministik)
    /* Round 12: roket havuzu (kendi havuzu, 8) */
    this.rocketPool = new Pool(CONFIG.ROCKET.pool, () => new Rocket());
    this.player = new Player('falcon');
    this.city = new CityScroller(this.assets);   // sehir paralaks katmani
    this.clouds = new CloudLayer(this.assets);   // bulut katmani (round 10)
    this.fx = new FxSystem();                    // vurus geri bildirimi + zengin patlama (round 10)
    this.sound = new Sound();                    // prosedurel WebAudio (round 9)
    this.state = 'boot';
    this.scrollY = 0;
    this.shotsFired = 0;
    this.score = 0;
    this.hp = 1;               // 0..1 (boss turunde hasarla dolacak)
    this.fps = 0; this.frameMs = 0;
    this._lastTime = 0;
    this._raf = null;
    this._autotest = CONFIG.AUTOTEST;
    // spawn yonetimi (LCG — Math.random YOK)
    this._spawnSeed = 42;
    this._spawnTimer = 0;
    // bölüm ilerlemesi (round 7)
    this.stageIdx = 0;
    this.killsThisStage = 0;
    this.stageTitleT = 0;      // bölüm kartı kalan süre (s) — amblem + ad (round 8)
    this.landmarkTriggered = false;
    // boss döngüsü (round 8): warn -> active -> dying
    this.boss = null;                  // Boss nesnesi (aktifken)
    this.bossState = 'none';           // none | warn | active | dying
    this.bossWarnT = 0;                // DIKKAT uyarısı kalan süre (s)
    this.bossDeathT = 0;               // ölüm patlamaları kalan süre (s)
    this.bossFlashT = 0;               // ekran parlaması kalan süre (s)
    this.bossScored = false;           // skor bir kez eklensin
    /* Round 15: cok asamali tasici boss (bolum 4 / Tokyo). Tek nesne,
       onceden ayrilir — sicak dongude `new` yok. */
    this.carrier = new Carrier();
    this.victoryT = 0;                 // zafer gecikmesi (bölüm 4 boss'u)
    this.playTime = 0;                 // toplam oyun süresi (s) — VICTORY için
    this.simTimeMs = 0;                // toplam sim suresi (ms) — rotor acisi (yalniz cizim)
    this.bestScore = 0;               // yeni rekor vurgusu
    this._newRecord = false;
    /* Round 20: kalici rekor + kosu istatistikleri + ipuclari.
       localStorage erisimi ASLA try/catch disinda degil (file:// / gizli
       sekme exception atabilir) — _loadPersist/_savePersist. */
    this._persistAvailable = false;   // localStorage okunabilir mi
    this._runCount = 0;               // toplam baslatilan kosu (ipucu kapi)
    this._stats = { kills: 0, bestCombo: 0, shots: 0, hits: 0 };
    this._tipT = 0;                   // kalan sure (s): >0 ekranda, <0 bosluk
    this._tipIndex = 0;
    const p = this._loadPersist();
    this.bestScore = p.best;
    this._runCount = p.runs;
    // silah yukseltmesi + poweruplar (round 10)
    this.weaponLevel = 1;             // 1..3
    this.shieldT = 0;                 // kalkan kalan sure (s)
    this.powerups = [];               // ekrandaki powerup nesneleri
    this._puSeed = 7;                 // LCG tohumu (powerup drop/yerlesim)
    /* Round 12: roket + silah sifirlanma yanip sonegi + dron secimi */
    this.rocketT = 0;                 // roket kalan sure (s)
    this.rocketFireT = 0;             // roket atis sayaci (s)
    this.weaponFlashT = 0;            // SİLAH 1 yanip sonek kalan sure (s)
    this.selectedDrone = 'falcon';    // secili dron id
    this.shipSelectIdx = 0;           // dron secim ekranindaki indeks
    /* Round 13: isisi + sub-dronlar (CONFIG.HEAT / CONFIG.SUBDRONE — game.config.js) */
    this.heat = 0;                    // 0..HEAT.max
    this.overheated = false;          // kilit: recoverAt'a inene kadar dash/roket/sub yok
    this.subDrones = 0;               // aktif sub-dron sayisi (0..SUBDRONE.max)
    this.subLaunchFailT = 0;          // is yetmezse HUD uyarisi kalan sure (s)
    /* Round 16: kara hedefi etki carpanlari — her sim adiminda _computeFireMods
       ile yeniden hesaplanir. enemyFireMul: radar sagken dusman ates araligi
       carpani. fireSlowMul: jammer menzildeyken oyuncu birincil ates araligi
       carpani (hava jammer'i ile ayni etki, ikisi ayni anda etkiliyse bir kez). */
    this.enemyFireMul = 1;
    this.fireSlowMul = 1;
    /* Round 18: kombo carpani — art arda oldurmeler skor'u carpilir.
       comboT her oldurmada yenilenir, sifira inince sayac silinir. Oyuncu
       hasar alinca aninda sifirlanir. Zamanlayici dt birikimiyle ilerler
       (_updateCombo) — deterministik, Math.random YOK. */
    this.comboCount = 0;        // art arda oldurma sayisi
    this.comboT = 0;            // kalan sure (s); windowMs/1000'den baslar
    this.repairFlashT = 0;      // onarim kutusu alininca kisa yesil parlamasi (yalniz cizim)
    // Sarsinti + hit-stop (round 9) — yalniz cizim, sim'e dokunmaz
    this.shakeT = 0;                  // kalan sarsinti suresi (s)
    this.shakeDur = 0;                // toplam sarsinti suresi (s)
    this.shakeAmp = 0;                // maksimum kayma (px)
    this.hitstopT = 0;                // kalan hit-stop suresi (s)
    this._killingEnemyType = '';      // game over: olduren dusman tipi
    // Menu yumusak gecis (round 9)
    this.menuFadeT = 1;               // 1 = tam gorunur, 0 = gecis ortasinda
    this._expose();
  }
  _expose() {
    if (!this._autotest) return;
    window.__game = {
      game: this,
      renderer: this.renderer,
      tick: (ms) => this._tickOnce(ms),
      press: (k) => this.input.setKey(k, true),
      release: (k) => this.input.setKey(k, false),
      touchMove: (x, y) => this.input.touchMove(x, y),
      releaseTouch: () => this.input.releaseTouch(),
      startGame: () => this.startGame(),
      togglePause: () => this.togglePause(),
      toMenu: () => this.toMenu(),
      state: () => ({
        mode: this.state,
        player: { x: this.player.x, y: this.player.y, vx: this.player.vx, vy: this.player.vy, lives: this.player.lives, invincible: this.player.invincible },
        bullets: this.bulletPool.count(),
        ebullets: this.ebulletPool.count(),
        shotsFired: this.shotsFired,
        poolExhausted: this.bulletPool.exhausted + this.ebulletPool.exhausted,
        score: this.score,
        scrollY: this.scrollY,
        resScale: this.renderer.scale,
        drawCalls: this.renderer.drawCalls,
        saveCalls: this.renderer.saveCalls,
        assetsUsed: this.assets.n_png,
        assetsProcedural: this.assets.n_proc,
        manifestCount: this.assets.manifest.sprites.length,
        // paralaks test kancalari (round 3)
        cityOffset: this.city.layerOffset(),
        buildingsOnScreen: this.city.onScreenCount(),
        smoothX: this.city.smoothX,
        // tracer test kancasi (round 4): cizilen mermi iz uzunlugu (px)
        tracerLen: this.tracerLen || 0,
        // dusman test kancalari (round 5)
        enemies: this._enemiesState(),
        // FX test kancalari (round 6)
        sparksActive: this.fx.sparks.count(),
        explosionsActive: this.fx.explosions.count(),
        shockwavesActive: this.fx.shockwaves.count(),
        // bölüm ilerlemesi (round 7)
        stage: this.stageIdx,
        city: this.city.city,
        kills: this.killsThisStage,
        quota: CONFIG.STAGES[this.stageIdx].quota,
        landmarkShown: this.city.landmarkShown,
        crossfadeT: this.city.fadeT,
        // boss dongusu (round 8)
        bossState: this.bossState,
        bossHp: this.boss ? this.boss.hp : 0,
        bossMaxHp: this.boss ? this.boss.maxHp : 0,
        bossPhase: this.boss ? this.boss.phase : 0,
        bossX: this.boss ? this.boss.x : 0,
        bossY: this.boss ? this.boss.y : 0,
        bossActive: this.bossState === 'active' && !!this.boss,
        playTime: this.playTime,
        newRecord: this._newRecord,
        // round 9: ses + sarsinti + hit-stop + menu
        muted: this.sound.muted,
        soundActive: this.sound._active,
        shakeT: this.shakeT,
        hitstopT: this.hitstopT,
        menuFadeT: this.menuFadeT,
        bestScore: this.bestScore,
        killingType: this._killingEnemyType,
        // round 10: rotor + silah + bulut + patlama
        simTimeMs: this.simTimeMs,
        weaponLevel: this.weaponLevel,
        shieldT: this.shieldT,
        powerups: this.powerups.filter((p) => p.active).map((p) => ({ type: p.type, x: p.x, y: p.y })),
        cloudsOnScreen: this.clouds.onScreenPositions(),
        cloudCount: this.clouds.onScreenPositions().length,
        /* Round 12: roket + silah yanip sonegi + dron secimi */
        rocketT: this.rocketT,
        weaponFlashT: this.weaponFlashT,
        selectedDrone: this.selectedDrone,
        shipSelectIdx: this.shipSelectIdx,
        droneUnlocked: CONFIG.DRONES.map((d, i) => d.unlock <= this.bestScore),
        rocketsActive: this.rocketPool.count(),
        /* Round 13: isisi + sub-dronlar */
        /* Orkestrator notu: yeni ozellikler state() uzerinden OLCULEBILIR olmali;
           aksi halde harness onlari goremez ve testler yesil gorunurken ozellik
           bozuk kalabilir. subs/dash bu dalgada eksikti, eklendi. */
        heat: this.heat,
        overheated: this.overheated,
        subs: this.player ? {
          count: this.player.subs ? this.player.subs.count() : 0,
          mode: this.player.subsMode || 'gun',
        } : { count: 0, mode: 'gun' },
        dash: this.player ? {
          active: (this.player.dashT || 0) > 0,
          cooldownMs: Math.round((this.player.dashCd || 0) * 1000),
        } : { active: false, cooldownMs: 0 },
        subDrones: this.player && this.player.subs ? this.player.subs.count() : 0,
        subLaunchFailT: this.subLaunchFailT,
        // round 11: bulut yatay parallaks + boss sprite + karo A/B
        cloudOffset: this.clouds.layerOffset(),
        cloudSprites: this.clouds.spawnedSprites(12),
        bossSprite: this.boss ? this.boss.sprite : '',
        /* Round 15: jammer — sahnede aktif mi + oyuncu menzilde mi */
        jammer: (function() {
          let active = false, inRange = false;
          this.jammerPool.forEach((j) => {
            if (!j.active) return;
            active = true;
            if (j.inRange) inRange = true;
          });
          return { active, inRange };
        }).call(this),
        /* Round 15: tasici boss — parca canlari + govde kilit durumu.
           Antenden once bodyVulnerable=false (govde hasar almaz). */
        carrier: this.carrier && this.carrier.active ? this.carrier.state() : null,
        cityTileA: 'city_' + this.city.city,
        cityTileB: 'city_' + this.city.city + '_b',
        tileBLoaded: this.assets.has('city_' + this.city.city + '_b') || !!this.assets.fallback['city_' + this.city.city + '_b'],
        explosionLayers: (function() {
          const F = CONFIG.FX;
          let flash = 0, fire = 0, smoke = 0;
          this.fx.explosions.forEach((e) => {
            if (e.t / (F.flashMs / 1000) < 1) flash++;
            if (e.t / (F.fireMs / 1000) < 1) fire++;
            if ((e.t - F.smokeDelay) / (F.smokeMs / 1000) > 0 && (e.t - F.smokeDelay) / (F.smokeMs / 1000) < 1) smoke++;
          });
          return { flash, fire, smoke };
        }).call(this),
        /* Round 16: kara hedefleri — liman bolumu + etki carpanlari */
        ground: (function() {
          const units = [];
          let radarAlive = false, jammerInRange = false;
          this.groundPool.forEach((g) => {
            if (!g.active) return;
            /* worldY = zemine cakili SABIT koordinat (y0 - spawnDist). Onceki hali
               screenY ile ayni degeri veriyordu; o zaman "dunya konumu degismedi"
               olcumu anlamsizdi ve kare-kare eslestirme icin kimlik anahtari yoktu. */
            units.push({ type: g.type, x: g.x, worldY: g.y0 - g.spawnDist, screenY: g.screenY(this.city), hp: g.hp });
            if (g.type === 'radar') radarAlive = true;
            if (g.type === 'jammer' && g.inRange) jammerInRange = true;
          });
          if (!jammerInRange) {
            this.jammerPool.forEach((j) => { if (j.active && j.inRange) jammerInRange = true; });
          }
          return { count: units.length, units, radarAlive, jammerInRange, enemyFireMul: this.enemyFireMul };
        }).call(this),
        /* Round 17: skimmer + zemin izi (scorch) — olculebilirlik zorunlu. */
        skimmers: (function() {
          const out = [];
          this.skimmerPool.forEach((k) => { if (k.active) out.push(k.state()); });
          return out;
        }).call(this),
        scorches: (function() {
          const out = [];
          this.fx.scorches.forEach((sc) => {
            if (sc.active) out.push({ x: sc.x, y: sc.screenY(this.city) });
          });
          return out;
        }).call(this),
        stageCount: CONFIG.STAGES.length,
        cityDist: this.city.dist,
        /* Round 18: kombo carpani — harness'in penceresi (count/mult/t). */
        combo: { count: this.comboCount, mult: this.comboMult(), t: this.comboT },
        scorePops: (function() {
          let n = 0;
          this.fx.scorePops.forEach((sp) => { if (sp.active) n++; });
          return n;
        }).call(this),
        repairFlashT: this.repairFlashT,
        /* Round 19: muzik durumu — audio paketi motoru yazdikca state() doner. */
        music: this.sound.music ? this.sound.music.state() : null,
        /* Round 20: kosu istatistikleri + kalici rekor + ipucu */
        stats: (function() {
          const s = this._stats;
          return {
            kills: s.kills, bestCombo: s.bestCombo, shots: s.shots, hits: s.hits,
            accuracy: s.shots > 0 ? Math.min(1, s.hits / s.shots) : 0,
            timeMs: Math.round(this.simTimeMs),
          };
        }).call(this),
        persist: { available: this._persistAvailable, best: this.bestScore },
        tip: { text: this.tipText(), index: this._tipIndex },
      }),
      spawnEnemy: (type, x, y) => this._spawnEnemy(type, x != null ? x : CONFIG.W / 2, y != null ? y : -40),
      spawnPowerup: (type, x, y) => this.spawnPowerup(type, x, y),
      forceKills: (n) => { for (let i = 0; i < n; i++) this._onKill(); },
      /* Round 18: komboyu n oldurmeye ayarla (skor EKLEMEZ — test kancasi). */
      forceCombo: (n) => { this.comboCount = n; this.comboT = CONFIG.COMBO.windowMs / 1000; },
      forceBoss: () => this.forceBoss(),
      killBoss: () => this.killBoss(),
      killCarrier: () => this.killCarrier(),
      /* Round 15: tasici boss'u bolumden bagimsiz baslat (autotest kancasi). */
      spawnCarrier: () => this.spawnCarrier(),
      /* Round 16: kara hedefi test kancalari */
      spawnGround: (type, x, screenY) => this.spawnGround(type, x, screenY),
      /* Round 17: skimmer test kancasi — liman disinda false doner. */
      spawnSkimmer: () => this.spawnSkimmer(),
      clearGround: () => this.clearGround(),
      /* Round 14: sub-dron test kancalari (sub_drones kapisi) */
      grantSubDrone: () => this.grantSubDrone(),
      launchSubDrones: () => this.launchSubDrones(),
      /* Round 12: dron secimi + silah degistirme kancalari */
      toShipSelect: () => this.toShipSelect(),
      shipSelectLeft: () => this.shipSelectLeft(),
      shipSelectRight: () => this.shipSelectRight(),
      confirmShipSelect: () => this.confirmShipSelect(),
      switchWeapon: () => this.switchWeapon(),
      screenshot: () => {
        // file:// altinda toDataURL calismayabilir (taint). Vision denetimi icin
        // SADECE oyun dunyasi cizilir: sehir + dron + mermiler. HUD/debug YOK.
        // Basariya ulasamazsa null doner; evaluate.py page.screenshot kullanir.
        try {
          const r = this.renderer;
          r.begin();
          this._drawWorldNoHud(r.ctx, 0);
          return r.canvas.toDataURL('image/png');
        } catch (e) { return null; }
      },
    };
  }
  stop() { if (this._raf) cancelAnimationFrame(this._raf); this._raf = null; }
  start() {
    this.state = 'menu';
    /* Muzik acilistan itibaren calar (menu yogunlugunda). Tarayici ilk
       kullanici hareketine kadar AudioContext'i askida tutar; motor bunu
       zaten kontrol ediyor, burada yalniz calma niyeti kuruluyor. */
    this._startMusic();
    this._lastTime = performance.now();
    if (this._autotest) return;   // otostest'te rAF yok, tick() kullanilir
    const loop = (t) => {
      this._raf = requestAnimationFrame(loop);
      const raw = t - this._lastTime; this._lastTime = t;
      this._frame(raw);
    };
    this._raf = requestAnimationFrame(loop);
  }
  /* Autotest: rAF yerine dogrudan cagirilir. */
  _tickOnce(ms) {
    // Hit-stop: sim duraklatir ama cizim devam eder (autotest'te devre disi)
    if (this.hitstopT > 0 && !CONFIG.AUTOTEST) {
      this.hitstopT -= ms / 1000;
      this._render(0);
      return;
    }
    const { steps } = this.clock.advance(ms);
    for (let i = 0; i < steps; i++) this._simStep(this.clock.step);
    this._render(0);
  }
  _frame(rawMs) {
    const t0 = performance.now();
    // Hit-stop: sim duraklatir ama cizim devam eder
    if (this.hitstopT > 0 && !CONFIG.AUTOTEST) {
      this.hitstopT -= rawMs / 1000;
      this._render(0);
      this.frameMs = performance.now() - t0;
      this.fps = this.frameMs;
      return;
    }
    const { steps, alpha } = this.clock.advance(rawMs);
    for (let i = 0; i < steps; i++) this._simStep(this.clock.step);
    this._render(alpha);
    this.frameMs = performance.now() - t0;
    this.fps = this.frameMs;
    this.renderer.recordFrame(this.frameMs);
  }
  _simStep(dt) {
    // Sarsinti soneum (tum durumlarda ilerler — cizim katmani)
    if (this.shakeT > 0) this.shakeT -= dt;
    // Menu yumusak gecis
    if (this.menuFadeT < 1) this.menuFadeT = Math.min(1, this.menuFadeT + dt * 1000 / CONFIG.MENU_FADE_MS);
    if (this.state === 'play') {
      this.playTime += dt;
      this.simTimeMs += dt * 1000;
      // kalkan soneum (round 10)
      if (this.shieldT > 0) this.shieldT -= dt;
      /* Round 12: roket sure + silah yanip sonegi */
      if (this.rocketT > 0) {
        this.rocketT -= dt;
        this._updateRockets(dt);   // roket atis + gait + carpisma
      }
      if (this.weaponFlashT > 0) this.weaponFlashT -= dt;
      /* Round 18: onarim parlamasi soneumu (yalniz cizim) + kombo zamanlayicisi */
      if (this.repairFlashT > 0) this.repairFlashT -= dt;
      this._updateCombo(dt);
      /* Round 20: ipucu sirasi — sim adiminda, girdiye/cizime dokunmaz */
      this._updateTip(dt);
      /* Round 13: isisi — dash/roket/subLaunch harcar, sure ile sogur.
         Asiri sicaklikta kilit: recoverAt'a inene kadar yeni harcama yok. */
      const H = CONFIG.HEAT;
      this.heat = Math.max(0, this.heat - H.cooldownPerSec * dt);
      if (this.overheated && this.heat <= H.recoverAt) this.overheated = false;
      if (this.subLaunchFailT > 0) this.subLaunchFailT -= dt;
      // Sub-dron firlatma girdisi (Input.consumeSubLaunch bayragi)
      if (this.input.consumeSubLaunch()) this._trySubLaunch();
      this.player.update(dt, this.input, this);
      this.bulletPool.forEach((b) => b.update(dt));
      /* Round 17: omru biten ucaksavar mermisi EKRAN ICINDE patlar (flak).
         Ekrandan cikarak olenler patlamaz — hava patlamasi hissi bozulmasin. */
      this.ebulletPool.forEach((b) => {
        const wasFlak = b.active && b.flak;
        const px = b.x, py = b.y;
        b.update(dt);
        if (wasFlak && !b.active && py > -20 && py < CONFIG.H + 20 && px > -20 && px < CONFIG.W + 20) {
          this.fx.flak(px, py);
          if (this.sound.flak) this.sound.flak();
        }
      });
      // dusmanlar (boss aktifken yeni dusman DOGMAZ — kota doldu)
      this.scoutPool.forEach((e) => e.update(dt, this));
      this.gunnerPool.forEach((e) => e.update(dt, this));
      this.shieldPool.forEach((e) => e.update(dt, this));
      /* Round 12: uc yeni tip */
      this.bomberPool.forEach((e) => e.update(dt, this));
      this.kamikazePool.forEach((e) => e.update(dt, this));
      this.sniperPool.forEach((e) => e.update(dt, this));
      /* Round 15: jammer dronlari — menzil durumu update'te guncellenir */
      this.jammerPool.forEach((j) => j.update(dt, this));
      this._updateJammerFx();
      /* Round 16: kara hedefleri — slot tabanli LCG spawn + update.
         YALNIZCA ground:true olan bolumde dogar (liman). */
      this._updateGround(dt);
      this.groundPool.forEach((g) => g.update(dt, this));
      /* Round 17: skimmer dogusu + guncelleme (yalniz liman, crossfade sonrasi) */
      this._updateSkimmers(dt);
      this._computeFireMods();
      // boss dongusu: warn -> active -> dying (round 8)
      this._updateBoss(dt);
      // spawn yonetimi (yalnizca boss yokken)
      if (this.bossState === 'none') this._updateSpawn(dt);
      // powerup guncelleme (round 10): asagi suzuleme + pickup
      this._updatePowerups(dt);
      // carpisma: oyuncu mermisi vs dusman + boss
      this._collidePlayerBullets();
      // carpisma: dusman mermisi vs oyuncu
      this._collideEnemyBullets();
      // FX (cizim katmani — sim'e dokunmaz, determinizm bozulmaz)
      this.fx.update(dt);
      // sehir paralaks katmani: oyuncu x normalizasyonu (-1..1) ile ilerler
      const nx = (this.player.x / CONFIG.W) * 2 - 1;
      this.city.update(dt, nx);
      // bulut katmani (round 10+11): yatay parallaks ayni nx ile
      this.clouds.update(dt, nx);
      // bölüm karti soneum (amblem + ad)
      if (this.stageTitleT > 0) this.stageTitleT -= dt;
      // simge yapı: kotanın yarısında bir kez gec (flag; artik sahnede cizilmez)
      const st = CONFIG.STAGES[this.stageIdx];
      if (!this.landmarkTriggered && this.killsThisStage >= Math.floor(st.quota / 2)) {
        this.landmarkTriggered = true;
        this.city.triggerLandmark();
      }
      // zafer gecikmesi (bölüm 4 boss'u ölünce)
      if (this.victoryT > 0) {
        this.victoryT -= dt;
        if (this.victoryT <= 0) this.state = 'victory';
      }
    }
    /* Round 19: menüde oyun dünyası kaymaya devam etsin (şehir + bulut).
       Yalnizca dist ilerler — bina/parallaks durumu degismez, sim'e dokunmaz. */
    if (this.state === 'menu') {
      this.city.dist += CONFIG.SCROLL.speed * dt;
      this.clouds.dist += CONFIG.CLOUDS.speed * dt;
    }
    /* Round 19: müzik yogunlugunu duruma bagla (audio paketi motoru yazar).
       Zamanlama sim'den BAGIMSIZ: buradan sadece hedef yogunluk verilir. */
    this._syncMusic();
  }
  /* Hedef yogunlugu: boss uyarisi/aktifken boss, oyun play, menu/duraklama/
     gameover/victory menu seviyesi. Duraklamada muzik DURMAZ — menu seviyesine iner. */
  _musicIntensity() {
    const I = CONFIG.MUSIC.intensity;
    if (this.bossState === 'warn' || this.bossState === 'active') return I.boss;
    switch (this.state) {
      case 'play':      return I.play;
      case 'victory':   return I.victory;
      default:          return I.menu;   // menu, shipselect, pause, gameover
    }
  }
  _syncMusic() {
    const m = this.sound.music;
    if (!m) return;
    if (typeof m.setIntensity === 'function') m.setIntensity(this._musicIntensity());
    else if (m.level !== undefined) m.level = this._musicIntensity();
  }
  /* ------------------------------------------------ Round 20: kalici rekor */
  /* localStorage erisimi her zaman try/catch icinde: file:// ve gizli sekmede
     exception atabilir; oyun bu yuzden ASLA cokmemeli. Erisilemiyorsa
     bellekteki degerle devam edilir (_persistAvailable=false).            */
  _loadPersist() {
    let best = 0, runs = 0;
    try {
      const raw = window.localStorage.getItem(CONFIG.STATS.storageKey);
      if (raw) {
        const o = JSON.parse(raw);
        if (typeof o.best === 'number' && isFinite(o.best)) best = Math.max(0, o.best);
        if (typeof o.runs === 'number' && isFinite(o.runs)) runs = Math.max(0, o.runs);
      }
      this._persistAvailable = true;
    } catch (e) { this._persistAvailable = false; }
    return { best, runs };
  }
  _savePersist() {
    try {
      window.localStorage.setItem(CONFIG.STATS.storageKey,
        JSON.stringify({ best: this.bestScore, runs: this._runCount }));
    } catch (e) { /* bellek icindeki deger gecerli kalmaya devam eder */ }
  }
  /* Ipuclu sirasi: sim adiminda ilerler (dt birikimi), cizim/girdiye dokunmaz.
     Yalnizca ilk CONFIG.TIPS.onlyFirstRuns kosuda calisir.                */
  _updateTip(dt) {
    const T = CONFIG.TIPS;
    if (!T || !T.list || !T.list.length) return;
    if (this._runCount >= T.onlyFirstRuns) return;
    if (this._tipT > 0) { this._tipT -= dt; return; }
    if (this._tipIndex < T.list.length) {
      this._tipT = T.showMs / 1000;
      this._tipIndex++;
    } else {
      this._tipT = -T.gapMs / 1000;   // bosluk: sonraki ipucuna kadar bekle
    }
  }
  tipText() {
    const T = CONFIG.TIPS;
    if (this._tipT <= 0 || !T || !T.list) return '';
    return T.list[this._tipIndex - 1] || '';
  }
  /* ------------------------------------------------------------- durumlar */
  /* Round 12: elle silah degistirme — sahip olunan seviyeler arasinda gecis.
     Q tusu / HUD rozetine dokunma ile cagrilir. Secim state()'te gorunur.   */
  switchWeapon() {
    if (this.state !== 'play') return;
    // Mevcut seviyeden bir sonrakine gec (max'ta 1'e don)
    this.weaponLevel = (this.weaponLevel >= CONFIG.WEAPON.maxLevel) ? 1 : this.weaponLevel + 1;
  }
  togglePause() {
    if (this.state === 'play') { this.menuFadeT = 0; this.state = 'pause'; }
    else if (this.state === 'pause') { this.menuFadeT = 0; this.state = 'play'; }
  }
  toMenu() {
    this._startMusic();
    if (this.state === 'play' || this.state === 'pause' || this.state === 'gameover' || this.state === 'victory') {
      this.menuFadeT = 0;
      this.state = 'menu';
      /* Round 19: muzik durmaz — menu yogunluguna iner. */
      this._syncMusic();
    }
  }
  /* ---------------------------------------------------- dron secimi (round 12) */
  /* Menu -> dron secim ekranina gec. Kilitler bestScore'a gore acilir. */
  toShipSelect() {
    this.menuFadeT = 0;
    this.state = 'shipselect';
    // En son secili acik dronu indeksle (kilitli ise falcon)
    const idx = CONFIG.DRONES.findIndex((d) => d.id === this.selectedDrone && d.unlock <= this.bestScore);
    this.shipSelectIdx = idx >= 0 ? idx : 0;
  }
  _droneUnlocked(i) { return CONFIG.DRONES[i].unlock <= this.bestScore; }
  shipSelectLeft() {
    if (this.state !== 'shipselect') return;
    let i = this.shipSelectIdx;
    for (let n = 0; n < CONFIG.DRONES.length; n++) {
      i = (i - 1 + CONFIG.DRONES.length) % CONFIG.DRONES.length;
      if (this._droneUnlocked(i)) break;
    }
    this.shipSelectIdx = i;
  }
  shipSelectRight() {
    if (this.state !== 'shipselect') return;
    let i = this.shipSelectIdx;
    for (let n = 0; n < CONFIG.DRONES.length; n++) {
      i = (i + 1) % CONFIG.DRONES.length;
      if (this._droneUnlocked(i)) break;
    }
    this.shipSelectIdx = i;
  }
  confirmShipSelect() {
    if (this.state !== 'shipselect') return;
    const D = CONFIG.DRONES[this.shipSelectIdx];
    if (!this._droneUnlocked(this.shipSelectIdx)) return;   // kilitli: secilemez
    this.selectedDrone = D.id;
    this.startGame();
  }
  /* Round 19: muzik MENUDE de calar (yogunluk menu seviyesinde). Yalniz
     startGame'de baslatilinca menu sessiz kaliyordu — olculdu: playing=false. */
  _startMusic() {
    const m = this.sound && this.sound.music;
    if (m && typeof m.start === 'function' && !m.state().playing) m.start();
  }
  startGame() {
    this.menuFadeT = 0;   // yumusak gecis
    this.state = 'play';
    this._startMusic();
    /* Round 12: secilen dronla oyuncu olustur (tank silah 2 ile baslar) */
    const D = CONFIG.DRONES.find((d) => d.id === this.selectedDrone) || CONFIG.DRONES[0];
    this.player = new Player(this.selectedDrone);
    this.bulletPool.reset();
    this.ebulletPool.reset();
    this.scoutPool.reset();
    this.gunnerPool.reset();
    this.shieldPool.reset();
    this.bomberPool.reset();
    this.kamikazePool.reset();
    this.sniperPool.reset();
    this.jammerPool.reset();
    /* Round 16: kara hedefleri sifirlari */
    this.groundPool.reset();
    this.skimmerPool.reset();
    this._skimmerT = 0;
    this._skimSeed = 0;
    this._groundBuiltUpTo = -1;
    this._groundSeed = 42;
    this.enemyFireMul = 1;
    this.fireSlowMul = 1;
    this.rocketPool.reset();
    this.fx.reset();
    this.clock.acc = 0;   // temiz baslangic: bir onceki oturumun kalan acc'i sim'i kaydirmasin
    this.city.setCity('istanbul', true);   // paralaks katmanini sifirla (instant, crossfade yok)
    this.shotsFired = 0; this.score = 0; this.scrollY = 0; this.hp = 1;
    this.simTimeMs = 0;
    this.weaponLevel = D.startWeapon || 1;   // tank: 2 baslar
    this.shieldT = 0;
    this.powerups = [];
    this._puSeed = 7;
    /* Round 12: roket + silah yanip sonegi sifirlari */
    this.rocketT = 0; this.rocketFireT = 0; this.weaponFlashT = 0;
    /* Round 13: isisi + sub-dronlar */
    this.heat = 0; this.overheated = false;
    this.subDrones = 0; this.subLaunchFailT = 0;
    /* Round 18: kombo + onarim parlamasi sifirlari */
    this.comboCount = 0; this.comboT = 0; this.repairFlashT = 0;
    this.clouds.reset();
    this._spawnSeed = 42;
    this._spawnTimer = 0;
    // bölüm ilerlemesi (round 7)
    this.stageIdx = 0;
    this.killsThisStage = 0;
    this.stageTitleT = CONFIG.STAGE_TITLE_MS / 1000;   // ilk bölüm karti
    this.landmarkTriggered = false;
    // boss dongusu sifirlari (round 8)
    this.boss = null;
    this.bossState = 'none';
    this.bossWarnT = 0;
    this.bossDeathT = 0;
    this.bossFlashT = 0;
    this.bossScored = false;
    /* Round 15: tasici boss sifirlari (parca _exploded bayraklari dahil) */
    this.carrier.active = false;
    for (const id in this.carrier.parts) this.carrier.parts[id]._exploded = false;
    this.victoryT = 0;
    this.playTime = 0;
    this._newRecord = false;
    /* Round 20: kosu istatistikleri + ipucu sifirlari */
    this._stats.kills = 0; this._stats.bestCombo = 0;
    this._stats.shots = 0; this._stats.hits = 0;
    this._tipT = CONFIG.TIPS.showMs / 1000;   // ilk kosuda hemen basla
    this._tipIndex = 0;
    this._runCount++;
    this._savePersist();
    // Sarsinti + hit-stop sifirlari (round 9)
    this.shakeT = 0; this.shakeDur = 0; this.shakeAmp = 0;
    this.hitstopT = 0;
    this._killingEnemyType = '';
  }
}

/* ------------------------------------------------------------------- boot */
(function main() {
  const params = new URLSearchParams(location.search);
  CONFIG.DEBUG = params.get('debug') === '1';
  CONFIG.AUTOTEST = params.get('autotest') === '1';
  const canvas = document.getElementById('game');
  // pencereye sigdir: 480x800 oranini koru
  function fit() {
    const ww = innerWidth, wh = innerHeight;
    const s = Math.min(ww / CONFIG.W, wh / CONFIG.H);
    canvas.style.width = (CONFIG.W * s) + 'px';
    canvas.style.height = (CONFIG.H * s) + 'px';
  }
  fit(); addEventListener('resize', fit);
  const game = new Game(canvas);
  /* Round 12: klavye akisi — Space: menu->secim, secim->oyun.
     Ok/WASD + Q: dron secim ekraninda gezinme/silah degistirme. */
  addEventListener('keydown', (e) => {
    if (e.repeat) return;
    const st = game.state;
    if (st === 'menu' && e.code === 'Space') { game.toShipSelect(); }
    else if (st === 'shipselect') {
      if (e.code === 'Space' || e.code === 'Enter') game.confirmShipSelect();
      else if (e.code === 'ArrowLeft' || e.code === 'KeyA') game.shipSelectLeft();
      else if (e.code === 'ArrowRight' || e.code === 'KeyD') game.shipSelectRight();
    }
  });
  /* Autotest: boot'ta oyuncu olustur ki cizim/hata uretmesin; startGame()
     secilen dronla yeniden olusturur (sim sifirlari orada). */
  if (CONFIG.AUTOTEST) game.player = new Player(game.selectedDrone);
  game.start();
})();
