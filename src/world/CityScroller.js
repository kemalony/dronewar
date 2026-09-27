class CityScroller {
  constructor(assets) {
    this.assets = assets;
    this.city = 'istanbul';
    this.prevCity = null;           // crossfade: onceki sehir (null = yok)
    this.fadeT = 1;                 // 0..1 (1 = tam yeni sehir)
    this.buildings = [];            // bu sehir icin building_* adlari
    this.prevBuildings = [];        // onceki sehir binalari (crossfade)
    this.landmark = '';
    this._catalog();
    this.dist = 0;                  // toplam kaydirma mesafesi (px)
    this.smoothX = 0;               // soneumlu oyuncu x (-1..1)
    this.builtUpTo = -1;            // son uretilen slot (slot = floor(dist/SPACING))
    this.lastLandmarkSlot = -9999;
    this.buildingsList = [];        // ekrandaki bina instanslari
    this.prevBuildingsList = [];    // onceki sehir binalari (crossfade)
    this.landmarkShown = false;     // bu bölümde simge yapı geçti mi
    this.landmarkY = 0;             // simge yapının taban y konumu (dist uzayında)
  }
  _catalog() {
    const b = [], l = {};
    for (const s of this.assets.manifest.sprites) {
      if (s.kind === 'building') b.push(s.name);
      else if (s.kind === 'landmark') l[s.name] = true;
    }
    // Bolum listesi CONFIG.STAGES'ten turetilir; yeni bolum eklendiginde
    // katalog otomatik genisler (round 16: 'port' liman — binasi ve simge
    // yapisi yok, bu iki alan bos kalir).
    const cities = CONFIG.STAGES.map((s) => s.city);
    for (const city of cities) {
      const names = b.filter((n) => n.includes('_' + city + '_'));
      const lm = Object.keys(l).find((n) => n.includes(city));
      this['city_' + city] = { buildings: names, landmark: lm || '' };
    }
  }
  setCity(name, instant) {
    if (instant) {
      this.prevCity = null;
      this.fadeT = 1;
      this.prevBuildings = [];
      this.prevBuildingsList = [];
    } else if (this.city !== name) {
      // crossfade: onceki sehir kaybolurken yeni sehir belirir
      this.prevCity = this.city;
      this.prevBuildings = this.buildings.slice();
      this.prevBuildingsList = this.buildingsList.slice();
      this.fadeT = 0;
    }
    this.city = name;
    const c = this['city_' + name] || this.city_istanbul;
    this.buildings = c.buildings;
    this.landmark = c.landmark;
    this.dist = 0;
    this.smoothX = 0;
    this.builtUpTo = -1;
    this.lastLandmarkSlot = -9999;
    this.buildingsList = [];
    this.landmarkShown = false;
    this.landmarkY = 0;
  }
  /* Bir sim adiminda ilerletir. playerNx: oyuncu x normalizasyonu (-1..1). */
  update(dt, playerNx) {
    const P = CONFIG.PARALLAX;
    this.dist += CONFIG.SCROLL.speed * dt;
    // kritik sonumlu yaklasim: h = 1 - exp(-k*dt) (adim boyutundan bagimsiz)
    const h = 1 - Math.exp(-P.smooth * dt);
    this.smoothX += (playerNx - this.smoothX) * h;
    // crossfade ilerletme
    if (this.fadeT < 1) {
      this.fadeT = Math.min(1, this.fadeT + dt * 1000 / CONFIG.CROSSFADE_MS);
      if (this.fadeT >= 1) {
        this.prevCity = null;
        this.prevBuildingsList = [];
      }
    }
    this._ensureBuilt();
  }
  /* Simge yapı artık SAHNEDE CIZILMEZ — bölüm kartında amblem olarak
     kullanilir (round 8). "Uçuşan binalar" duzeltmesinde bina sprite katmani
     sahneden kaldirildi; landmark da o katmandaydi ve gorunmuyordu. Dunyaya
     geri koymak ayni sorunu yaratir (tepeden cekilmis fotografin uzerine egik
     acidan cizilmis sprite havada durur). Bu metot artik yalnizca flag'i
     ayarlar; kart, Game tarafinda stageTitleT ile tetiklenir.               */
  triggerLandmark() {
    if (this.landmarkShown || !this.landmark) return;
    this.landmarkShown = true;
  }
  /* NOT: bina katmani CIZILMEZ — "ucusan binalar" duzeltmesinde cizim
     sahneden kaldirildi. Bu uretim yalnizca buildingsOnScreen test kancasini
     (Game.state -> tools/evaluate.py) besler; sim/carpisma okumaz. */
  _ensureBuilt() {
    const SPACING = 260;                       // bina araligi (px)
    const H = CONFIG.H;
    const maxSlot = Math.floor((this.dist + H) / SPACING);
    if (this.builtUpTo >= maxSlot) return;     // yeni slot yok -> tarama yok
    while (this.builtUpTo < maxSlot) {
      this.builtUpTo++;
      this._spawnAt(this.builtUpTo, SPACING);
    }
    // ekrandan coktan cikmis binasi at (yalnızca spawn olan adımda)
    const minY = this.dist - H;                // y < minY -> ekranin ustunde
    this.buildingsList = this.buildingsList.filter((b) => b.y > minY - 400);
  }
  _spawnAt(slot, spacing) {
    // LCG: her slot icin deterministik tohum (Math.random YOK)
    let seed = (slot * 2654435761 + 1013904223) >>> 0;
    const rnd = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const baseY = slot * spacing;              // bina tabaninin kaydirilmis y'si
    const idx = this.buildings.length ? Math.floor(rnd() * this.buildings.length) : 0;
    const name = this.buildings[idx];
    // Cizim olcegi manifest boyutunun 0.45-0.65'i araliginda (round 4):
    // binalar sahneye oturur, ekranin uctunu kaplamaz.
    const P = CONFIG.PARALLAX;
    const sc = P.buildingScaleMin + rnd() * (P.buildingScaleMax - P.buildingScaleMin);
    const s = this.assets.manifest.sprites.find((m) => m.name === name);
    const bw = s ? Math.round(s.width * sc) : Math.round(130 * sc);
    const x = 20 + rnd() * (CONFIG.W - 40 - bw);
    this.buildingsList.push({ name, x, y: baseY, w: bw, scale: sc });
  }
  /* Sehir cizimi — "ucusan binalar" duzeltmesi.
   *
   * Once zeminin uzerine ayri bina sprite'lari cizilirdi. Kullanicinin sorusu
   * hakliydi: Bogaz'in ortasinda duran bir bina cikiyordu. Iki sebep vardi —
   * (1) bina katmani zeminden HIZLI kayiyordu (170 vs 120 px/s), yani gercekten
   * havada suzuluyorlardi; (2) zemin tam tepeden cekilmis ortografik bir hava
   * goruntusu, bina sprite'lari ise egik acidan cizilmisti; iki farkli
   * projeksiyon yan yana durunca goz onlari sahneye ait saymiyor. Ustelik
   * fotograf zaten kendi binalarini iceriyor, ustune bina koymak cakisma demek.
   *
   * Cozum: bina sprite'lari sahneden kaldirildi. Aci hissi sehir KAROSUNUN
   * kendisinden geliyor — karo hafifce buyutulup (zoom) oyuncunun yatay
   * konumuna gore ters yonde kaydiriliyor. Fotograftaki gercek yuksek binalar
   * goruntunun icinde oldugu icin tum kare birlikte kayinca "aci degisti" diye
   * okunuyor ve hicbir sey havada durmuyor. Simge yapilar da dunyadan cikarildi;
   * bolum basligi kartinda amblem olarak kullaniliyorlar (UI, dunya degil).      */
  draw(c, alpha) {
    const P = CONFIG.PARALLAX;
    const H = CONFIG.H;
    const W = CONFIG.W;
    const sy = this.dist % H;
    const zoom = P.tileZoom;                 // karo ekrandan biraz buyuk cizilir
    const zw = W * zoom, zh = H * zoom;
    const padX = (zw - W) / 2, padY = (zh - H) / 2;
    // oyuncu saga gidince goruntu sola kayar: aci degismis gibi
    const shift = -this.smoothX * P.cityShift;
    /* Karo A/B sirali dongusu (round 11): her sehir icin iki karo vardir
       (city_<sehir> ve city_<sehir>_b). Dikey dongude ikisi SIRAYLA dizilir
       (A, B, A, B...) — tekrar araligi iki katina cikar, ayni goruntu pes
       pese gelmez. Karo yukseklikleri esittir (800 px), gecis dikissizdir. */
    const drawCity = (name, a) => {
      if (a <= 0) return;
      const tileA = 'city_' + name;
      const tileB = 'city_' + name + '_b';
      const hasB = this.assets.has(tileB) || !!this.assets.fallback[tileB];
      const T = hasB ? H * 2 : H;        // dongu periyodu (px)
      const off = ((this.dist % T) + T) % T;
      c.save();
      c.globalAlpha = a;
      const x = -padX + shift;
      for (let k = -1; k <= 2; k++) {
        const base = off + k * T;
        for (let i = 0; i < 2; i++) {
          const yTop = base + i * H;
          if (yTop > H || yTop + H < 0) continue;
          let tName = i === 0 ? tileA : tileB;
          if (!hasB) tName = tileA;      // fallback: _b yoksa tek karoyla devam
          this.assets.draw(c, tName, x, yTop - padY, zw, zh);
        }
      }
      c.restore();
    };
    if (this.fadeT < 1 && this.prevCity) drawCity(this.prevCity, 1 - this.fadeT);
    drawCity(this.city, this.fadeT < 1 ? this.fadeT : 1);
  }
  /* Test kancasi: su an ekranda cizilen bina sayisi (landmark dahil degil). */
  onScreenCount() {
    const H = CONFIG.H;
    let n = 0;
    for (const b of (this.buildingsList || [])) {
      if (b.landmark) continue;
      const y = b.y - this.dist;
      if (y > -200 && y < H + 200) n++;
    }
    return n;
  }
  /* Test kancasi: bina katmani yatay ofseti (parallaks). */
  layerOffset() { return -this.smoothX * CONFIG.PARALLAX.buildingShift; }
}

/* --------------------------------------------------------------- CloudLayer
   Bulut katmani (round 10+11): sehir UZERINDE, dronlar ALTINDA cizilir.
   Dikey: zeminden hizli kayar (185 px/s vs 120) — yukseklik hissi.
   Yatay: oyuncunun x konumuna TERS yonde ve zeminden DAHA GUCLU kayar
   (hShift 70 vs cityShift 30) — bulut daha yakin oldugu icin parallaks
   buyuktur; oyuncu saga gidince bulut SOLA kayar (round 11 duzeltmesi).
   Cekit: cloud_a..cloud_f havuzundan LCG ile secim; arka arkaya AYNI
   cekit tekrarlanmaz; her dogustaki olcek/alfa farklidir.
   Yerlesim LCG ile DETERMINISTIK: iki kare hizinda birebir ayni konum.     */
