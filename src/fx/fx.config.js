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
  /* Round 22 — EKSIK UC ANAHTAR. FallingWreck bunlari okuyordu ama tanimli
     degillerdi: `vy = undefined` -> `vy += gravity*dt` -> NaN, yani enkaz ilk
     karede imkansiz bir koordinata ucuyordu; `while (acc >= undefined)` hep
     false oldugu icin duman izi hic dogmuyordu. Ozellik bu yuzden yazili ama
     hic calismamis durumdaydi.                                              */
  startVy: 60,         // px/s baslangic asagi itki. Yercekimi tek basina
                       // 1200 ms'de 0.5*380*1.2^2 = 274 px dusurur; 60'lik
                       // itki ile ~346 px — 800 px'lik ekranda enkaz omru
                       // dolmadan alt kenardan cikmaz, "suzuluyor" okunur.
  smokeEvery: 0.09,    // s — duman parcacigi araligi (~13 parcacik / enkaz)
  smokeLife: 0.7,      // s — parcacik omru; 0.09 ile ayni anda ~8 canli
                       // parcacik, yani incelen kisa bir kuyruk (havuz 48).
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
/* Round 21: mermi izi — koyu kontrast halesi + parlak cekirdek. YALNIZ CIZIM.
 *
 * Neden: `foreground_contrast` kapisi her mermi icin ±6 px penceresindeki EN
 * PARLAK piksel ile ±30 x ±11 bandinin MEDYANI arasindaki farki olcer (>= 60).
 * Cekirdek 'lighter' ile ciziliyor, yani hangi zemin olursa olsun tepe 255'e
 * DOYAR — tepeyi yukseltmek matematiksel olarak imkansiz. Bulut katmani
 * (alfa 0.28..0.55) parlak bir yol/kopru uzerine bindiginde bandin medyani
 * ~230'a cikiyor ve fark 25'e dusuyordu. Bu gercek bir okunurluk kusuru:
 * beyaz iz, beyaz bulutun uzerinde gozle de kayboluyor.
 *
 * Cozum arka plani KARARTMAK DEGIL, merminin kendi koyu halesini tasimasi.
 * Siyah + alfa = carpim (out = bg * (1-a)): koyu sehir uzerinde gorunmez
 * (25 -> 18), parlak bulut uzerinde guclu bir cerceve (230 -> 161). Hale
 * bandin ~%58'ini kapladigi icin medyani da asagi ceker; hale mermiyle
 * birlikte gider, sahnede kalici hicbir karartma yoktur.
 *
 * Genislikler CONFIG.BULLET.w'nin KATIDIR — cizim icin ikinci bir boyut
 * tanimi yok, carpisma ile ayni tek kaynaktan turer.                      */
Object.assign(CONFIG.FX, {
  tracer: {
    len: 22,                        // iz uzunlugu (tracer_shape: <= 22 px)
    haloW: [6.3, 4.3, 2.7, 1.3],    // hale genisligi = CONFIG.BULLET.w * kat
    haloA: [0.30, 0.30, 0.34, 0.42],// ...ve o katmanin siyah alfasi (carpim)
    glowW: 2.2,                     // yumusak additif parlama genisligi (kat)
    glowA: 0.18,                    // ...alfasi — medyani bozmayacak kadar dar
    tipR: 7,                        // uc parlamasi yaricapi (px)
    tipA: 0.35,                     // uc dis halka alfasi
  },
});
