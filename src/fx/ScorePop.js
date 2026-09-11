/* ScorePop — öldürülen düşmanın yerinde yükselip sönen puan yazısı (Round 18).
   YALNIZ CIZIM: sim'e dokunmaz, determinizm bozulmaz. Sıcak döngüde nesne
   tahsisi yok (havuz + yeniden kullanılan alanlar). Boyut başına canvas
   önbelleği YASAK — her karede tek fillText + tek strokeText.

   tier 0..4: renk soğuktan sıcağa ısınır (beyaz → açık sarı → turuncu →
   kırmızımsı). Kombo çarpanı yükseldikçe oyuncu ekranda görür. */
class ScorePop {
  constructor() { this.active = false; }
  spawn(x, y, text, tier) {
    this.x = x;
    this.y = y;
    this.text = text;
    const t = Math.max(0, Math.min(4, tier | 0));   // 0..4'e kilitle
    this.r = SCORE_POP_TIER[t][0];
    this.g = SCORE_POP_TIER[t][1];
    this.b = SCORE_POP_TIER[t][2];
    this.t = 0;
    this.active = true;
  }
  update(dt) {
    this.t += dt;
    if (this.t >= CONFIG.FX.scorePop.lifeMs / 1000) this.active = false;
  }
  draw(c) {
    const S = CONFIG.FX.scorePop;
    const dur = S.lifeMs / 1000;
    const t = this.t / dur;                          // 0..1
    const a = t < S.fadeStart ? 1 : 1 - (t - S.fadeStart) / (1 - S.fadeStart);
    const y = this.y - S.rise * t;                   // yukarı süzülme
    c.save();
    c.globalAlpha = a;
    c.font = `bold ${S.fontSize}px monospace`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    const col = `${this.r},${this.g},${this.b}`;
    c.strokeStyle = `rgba(0,0,0,${(a * 0.6).toFixed(3)})`;   // gölge/stroke (tek)
    c.lineWidth = 3;
    c.strokeText(this.text, this.x, y);
    c.fillStyle = `rgba(${col},${a.toFixed(3)})`;            // dolgu (tek)
    c.fillText(this.text, this.x, y);
    c.restore();
  }
}

/* tier 0..4 → RGB (soğuk → sıcak). Modül seviyesinde sabit dizi: sıcak
   döngüde yeni nesne yok, indeksle okunur. */
const SCORE_POP_TIER = [
  [255, 255, 255],   // 0 beyaz
  [255, 232, 140],   // 1 açık sarı
  [255, 170, 60],    // 2 turuncu
  [255, 110, 50],    // 3 kızıl-turuncu
  [255, 60, 50],     // 4 kırmızımsı
];
