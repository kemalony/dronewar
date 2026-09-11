/* fx paketinin kendi sabitleri — CONFIG'i genisletir.
 *
 * Neden ayri dosya: src/core/CONFIG.js yalnizca core ajaninindir. Ilk paralel
 * dalgada fx ajani `CONFIG.FX.wreck`'e ihtiyac duydu ama core'a yazamadigi icin
 * deger tanimsiz kaldi ve oyun `Cannot read properties of undefined (reading
 * 'pool')` ile aciliste coktu. Paket-yerel config bu sinifi tamamen kaldirir.
 * build_order.json icinde core/CONFIG.js'ten SONRA siralanir.               */
CONFIG.FX.wreck = {
  pool: 12,            // ayni anda dusen enkaz sayisi
  smokePool: 48,       // enkaz arkasindaki duman parcaciklari
  lifeMs: 1200,        // dusus suresi, sonunda kucuk patlama
  gravity: 380,        // px/s^2
  spinMax: 3,          // rad/s (isaret ve buyukluk LCG'den)
  driftMax: 90,        // px/s yatay savrulma
};
/* Glitch tavani: anlik hasar glitch'i + ambient seviye toplanirken asilamasi
   gereken maksimum genlik. Hasar glitch'i tek basina tam genligini (1) korur;
   tavan yalnizca ikisi ayni anda gorsede ekranin donmesini onler. */
Object.assign(CONFIG.FX, { glitchMaxCap: 1 });
/* Round 17: zemin izi (scorch) + ucaksavar patlamasi (flak). YALNIZ CIZIM. */
Object.assign(CONFIG.FX, {
  scorch: {
    pool: 8,          // ayni anda zeminde kalan is izi sayisi
    lifeMs: 3000,     // iz omru (~3 sn), alfa 0.55'ten 0'a soner
    maxAlpha: 0.55,   // baslangic alfa
    r: 26,            // taban yaricap (px) — hafif genislerken cizilir
    squash: 0.42,     // yatik elips oranı (perspektif)
  },
  flak: {
    flashMs: 90,     // kisa parlama omru (lighter)
    flashR: 16,      // parlama yaricapi (px)
    sparks: 7,       // 6-8 kivilcim (LCG ile 6..8 arasi secilir)
  },
});
/* Round 18: skor baloncuğu — öldürülen düşmanın yerinde yükselip sönen puan
   yazısı. YALNIZ CIZIM. tier 0..4 rengi soğuktan sıcağa ısıtır. */
Object.assign(CONFIG.FX, {
  scorePop: {
    pool: 12,        // ayni anda ekranda kalan baloncuk sayisi
    lifeMs: 900,     // omur (~900 ms)
    rise: 26,        // yukari suzulme mesafesi (px)
    fadeStart: 0.7,  // son %30'da alfa 1→0
    fontSize: 15,    // bold monospace punto
  },
});
