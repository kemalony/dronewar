/* ----------------------------------------------------------------------- Skimmer
   Round 17: limanin deniz tarafindan gelen dusmani. Diger dusmanlar yukaridan
   iner; skimmer YANDAN girer ve ekrani yatay geçer — liman bolumunun kendi
   silueti. Enemy sinifi sismesin diye ayri sinif.

   Determinizm: Math.random() yok; salinim fazi dt birikimiyle tasinir, dogus
   tarafi/ y konumu game paketindeki LCG'den gelir.
   Sprite: mevcut `drone_scout` kullanilir (yeni varlik uretilmedi) — yatay
   giden govde, yon bayragina gore aynalanir.                                */
class Skimmer {
  constructor() { this.active = false; }
  reset(dir, y) {
    const S = CONFIG.SKIMMER;
    this.dir = dir;                       // -1: sagdan sola, +1: soldan saga
    this.baseY = y;
    this.y = y;
    this.x = dir > 0 ? -S.w : CONFIG.W + S.w;
    this.hp = S.hp;
    this.score = S.score;
    this.radius = S.radius;
    this.phase = 0;                       // salinim fazi (s) — dt birikimi
    this.fired = false;                   // bandda BIR KEZ ates acar
    this.burstLeft = 0;
    this.gapT = 0;
    this.hitFlash = 0;
    this.active = true;
  }
  update(dt, game) {
    if (!this.active) return;
    const S = CONFIG.SKIMMER;
    this.x += this.dir * S.speed * dt;
    this.phase += dt;
    this.y = this.baseY + Math.sin(this.phase * S.waveHz * Math.PI * 2) * S.waveAmp;
    if (this.hitFlash > 0) this.hitFlash -= dt;
    /* Oyuncunun yatay bandina girince BIR KEZ uclu seri: kacis bosluğu kalsin
       diye yon seri basinda sabitlenir (AA ile ayni tasarim). */
    const p = game.player;
    if (!this.fired && p && Math.abs(p.y - this.y) < S.bandY) {
      this.fired = true;
      this.burstLeft = S.burst;
      this.gapT = 0;
    }
    if (this.burstLeft > 0) {
      this.gapT -= dt;
      if (this.gapT <= 0) {
        const dx = p ? p.x - this.x : 0, dy = p ? p.y - this.y : 1;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        const b = game.ebulletPool.acquire();
        if (b) {
          b.reset(this.x, this.y, true);
          b.vx = (dx / d) * S.bulletSpeed;
          b.vy = (dy / d) * S.bulletSpeed;
          b.life = 4.0;
        }
        game.sound.enemyShot();
        this.burstLeft--;
        this.gapT = S.burstGapMs / 1000;
      }
    }
    // karsi kenardan cikinca havuza iade
    if (this.dir > 0 ? this.x > CONFIG.W + S.w : this.x < -S.w) this.active = false;
  }
  hit(dmg) {
    if (!this.active) return false;
    this.hp -= dmg;
    this.hitFlash = CONFIG.FX.hitFlashMs / 1000;
    if (this.hp <= 0) { this.active = false; return true; }
    return false;
  }
  draw(c, assets) {
    if (!this.active) return;
    const S = CONFIG.SKIMMER;
    c.save();
    c.translate(this.x, this.y);
    /* Yatay ucus: govde gidis yonune 90° cevrilir, yon bayragina gore aynalanir. */
    c.rotate(this.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    const w = S.h, h = S.w;            // dondurulmus cerceve
    if (assets.has('drone_scout')) {
      assets.draw(c, 'drone_scout', -w / 2, -h / 2, w, h);
    } else {
      c.fillStyle = '#7a5a8c';
      c.fillRect(-w * 0.3, -h * 0.42, w * 0.6, h * 0.84);
      c.fillStyle = '#d8e6ff';
      c.fillRect(-w * 0.12, -h * 0.5, w * 0.24, h * 0.2);
    }
    if (this.hitFlash > 0) {
      c.globalAlpha = Math.min(1, this.hitFlash / (CONFIG.FX.hitFlashMs / 1000));
      c.globalCompositeOperation = 'lighter';
      const wt = assets.whiteTint('drone_scout');
      if (wt) c.drawImage(wt, -w / 2, -h / 2, w, h);
      c.globalAlpha = 1;
      c.globalCompositeOperation = 'source-over';
    }
    c.restore();
  }
  state() { return { x: this.x, y: this.y, dir: this.dir, hp: this.hp }; }
}
