/* --------------------------------------------------------------------- GroundUnit
   Round 16: kara hedefleri (liman bolumu). YALNIZCA ground:true olan bolumde
   dogar; dogurmayi game paketi yapar, bu sinif davranisi yazar.

   Bir numarali kural — zemine civili olma:
     Alanlar `x` (ekran x) + `y0`/`spawnDist` (dogus anindaki ekran y ve
     city.dist). Ekran y'si HER KAREDE zemin kaymasindan türetilir:
       screenY = y0 + (city.dist - spawnDist)
     Kendi vy'si YOKTUR; y0/spawnDist sim icinde asla degismez. Boylece bir
     sim adiminda ΔscreenY tam olarak Δcity.dist kadardir — zeminle birebir
     ayni hizda kayar, "ucan bina" olmaz.                                  */
class GroundUnit {
  constructor() { this.active = false; }
  reset(type, x, y0, spawnDist) {
    const G = CONFIG.GROUND;
    const T = G.types[type];
    this.type = type;
    this.sprite = T.sprite;
    this.w = T.w; this.h = T.h;
    this.x = x;                       // ekran x (sim sabiti)
    this.y0 = y0;                     // dogus anindaki ekran y (ekranin ustunde)
    this.spawnDist = spawnDist;       // dogus anindaki city.dist
    this.hp = T.hp;
    this.score = T.score;
    this.hitFlash = 0;                // beyaz tint parlamasi kalan sure (s)
    /* aa tipi: nişanlı seri atis zamanlayicilari (dt birikimi, deterministik) */
    this.fireT = T.fireMs ? T.fireMs / 1000 : Infinity;
    this.burstLeft = 0;               // devam eden seride kalan mermi sayisi
    this.gapT = 0;                    // mermiler arasi gecikme sayaci (s)
    this._aimDX = 0; this._aimDY = 1; // seri baslangicindaki oyuncu yonu (seri boyunca sabit)
    this.inRange = false;             // jammer: oyuncu radius icinde mi (her adimda yeniden)
    this.active = true;
  }
  /* Ekran y konumu — zemin kaymasindan türetilir (cizim VE sim menzili icin). */
  screenY(city) { return this.y0 + (city.dist - this.spawnDist); }
  update(dt, game) {
    if (!this.active) return;
    if (this.hitFlash > 0) this.hitFlash -= dt;
    const G = CONFIG.GROUND;
    const p = game.player;
    const sy = this.screenY(game.city);
    switch (this.type) {
      case 'radar':
        /* Pasif — oyunun enemyFireMul etkiyi uygulamasini bekler; burada
           sadece alive bayragi dogru tutulur (hit() ile). */
        break;
      case 'aa':
        /* Nişanlı seri: oyuncu range icindeyse fireMs'de bir burst adet mermi,
           aralarinda burstGapMs. Seri boyunca yon GÜNCELLENMEZ (kacis boslugu). */
        const A = G.types.aa;
        if (this.burstLeft > 0) {
          this.gapT -= dt;
          if (this.gapT <= 0) {
            this.burstLeft--;
            this.gapT = A.burstGapMs / 1000;
            const b = game.ebulletPool.acquire();
            if (b) {
              b.reset(this.x, sy + this.h * 0.35, true);
              b.vx = this._aimDX * A.bulletSpeed;
              b.vy = this._aimDY * A.bulletSpeed;
              /* Round 17: omur mesafeye gore — mermi hedefin onunde havada
                 patlar. Sabit 4 sn ile mermi ekrandan cikiyordu ve flak hic
                 gorunmuyordu (olculdu: 0 kivilcim). */
              const pd = Math.sqrt((game.player.x - this.x) * (game.player.x - this.x) +
                                   (game.player.y - sy) * (game.player.y - sy));
              b.life = Math.max(A.flakMinS,
                       Math.min(A.flakMaxS, (pd / A.bulletSpeed) * A.flakLead));
              b.flak = true;    // omru bitince havada patlar (round 17)
            }
            game.sound.enemyShot();
          }
        } else {
          this.fireT -= dt;
          if (this.fireT <= 0) {
            const dx = p.x - this.x, dy = p.y - sy;
            const d2 = dx * dx + dy * dy;
            if (d2 <= A.range * A.range && sy > -20 && sy < CONFIG.H + 20) {
              const d = Math.sqrt(d2) || 1;
              this._aimDX = dx / d; this._aimDY = dy / d;
              this.burstLeft = A.burst;
              this.gapT = 0;          // ilk mermi hemen
              this.fireT = A.fireMs / 1000;
            } else {
              this.fireT = 100;       // menzil disinda: 100ms sonra tekrar dene
            }
          }
        }
        break;
      case 'jammer':
        /* Hava Jammer'in inRange mantiginin aynisi — her sim adiminda yeniden
           hesaplanir (Round 15'te unutulmustu, tekrarlama). Oyuncunun birincil
           ates araligini fireSlowMul ile yavaslatma etkiyi game uygular. */
        const J = G.types.jammer;
        const jdx = p.x - this.x, jdy = p.y - sy;
        this.inRange = (jdx * jdx + jdy * jdy) <= J.radius * J.radius;
        break;
    }
    /* Ekrandan cikinca devre disi: zemin asagi kaydigi icin hedef de asagi iner;
       ekran altinin belirgin sekilde altina gecince havuza geri verilir. */
    if (sy > CONFIG.H + 80) this.active = false;
  }
  /* Hasar: hp düser; 0'da alive=false, active=false, true döner (game patlama
     + skoru isler). Oyuncu govdesi kara hedefine carpMAZ — carpisma hasari yok. */
  hit(dmg) {
    if (!this.active) return false;
    this.hp -= dmg;
    this.hitFlash = CONFIG.FX.hitFlashMs / 1000;
    if (this.hp <= 0) { this.active = false; return true; }
    return false;
  }
  /* Test kancasi: state() — pozisyon hem dünya (worldY) hem ekran (screenY) uzayında. */
  state(city) {
    return {
      type: this.type,
      x: this.x,
      worldY: this.y0 + (city.dist - this.spawnDist),
      screenY: this.screenY(city),
      hp: this.hp,
      alive: this.active,
    };
  }
  draw(c, assets, city) {
    if (!this.active) return;
    const G = CONFIG.GROUND;
    const sy = this.screenY(city);
    const w = this.w, h = this.h;
    c.save();
    c.translate(this.x, sy);
    /* 1) Sert temas gölgesi: sprite silueti DEGIL — basit koyu elips,
       shadowDx/shadowDy kadar kaydirilmis. Gölgeler zeminde kalir; sprite
       onlarin uzerinden geçer gibi durur. */
    c.globalAlpha = G.shadowAlpha;
    c.fillStyle = '#000';
    c.beginPath();
    /* Golge TABANDA durur ve silüetin disina tasar; sprite'in altinda
       kalirsa temas hissi hic olusmaz (olculdu: tasma +0 px). */
    c.ellipse(G.shadowDx, h * 0.34 + G.shadowDy, w * 0.48, h * 0.17, 0, 0, Math.PI * 2);
    c.fill();
    c.globalAlpha = 1;
    /* 2) Sprite — manifest çizim boyutunda. Once yuklenen gorsel; PNG YOKSA
       (Assets'e "ground" fallback dali eklenene kadar cizim bozulmasin diye)
       burada koyu gri govde + tip rengi ile prosedurel yedek. */
    if (assets.has(this.sprite)) {
      assets.draw(c, this.sprite, -w / 2, -h / 2, w, h);
    } else {
      const col = this.type === 'radar' ? '#4a7fb5' :
                  this.type === 'aa'    ? '#b5651d' : '#8a4ab5';
      c.fillStyle = '#3a4048';
      c.fillRect(-w * 0.38, -h * 0.42, w * 0.76, h * 0.84);
      c.fillStyle = col;
      if (this.type === 'radar') {
        c.beginPath(); c.arc(0, -h * 0.18, w * 0.22, Math.PI, 0); c.fill();
      } else if (this.type === 'aa') {
        c.fillRect(-w * 0.08, -h * 0.55, w * 0.16, h * 0.3);
      } else {
        c.beginPath(); c.arc(0, -h * 0.15, w * 0.18, 0, Math.PI * 2); c.fill();
      }
    }
    /* 3) Vuruş parlaması: Assets.whiteTint yolu (source-atop + fillRect ASLA
       kullanilmiyor — tuval geneline calisir). */
    if (this.hitFlash > 0) {
      const a = Math.min(1, this.hitFlash / (CONFIG.FX.hitFlashMs / 1000));
      c.globalAlpha = a;
      c.globalCompositeOperation = 'lighter';
      const wt = assets.whiteTint(this.sprite);
      if (wt) c.drawImage(wt, -w / 2, -h / 2, w, h);
      c.globalAlpha = 1;
      c.globalCompositeOperation = 'source-over';
    }
    c.restore();
  }
}
