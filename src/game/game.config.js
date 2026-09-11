/* game paketi sabitleri — core/CONFIG.js'ten SONRA derlenir (AGENTS.md).
   CONFIG donmus degil; buradaki atamalar oyun baslamadan once tamamlanir. */
/* DIKKAT: `CONFIG.SUBDRONE = {...}` YAZMA — units paketi de ayni anahtari
   tanimliyor ve sonra derlenen dosya digerini komple eziyordu. Bu yasandi:
   game'in atamasi units'in `pool` anahtarini sildi, havuz 0 boyutunda olustu ve
   pu_subdrone alindiginda ekranda hicbir sey belirmedi. Paylasilan anahtarlar
   EZILMEZ, genisletilir. */
Object.assign(CONFIG.SUBDRONE, {
  max: 2,                    // ayni anda en fazla 2 aktif sub-dron
  launchSpeed: 520,          // px/s yukari
  life: 1.4,                 // s
  dropChance: 0.06,          // dusman olumunde %6 pu_subdrone (LCG)
});
/* Isisi: dash/roket/subLaunch maliyetleri CONFIG.HEAT.cost'ta (core).
   Drop olasiligi ise game paketinin sorumlulugudur. */
CONFIG.HEAT.dropChanceSubdrone = CONFIG.SUBDRONE.dropChance;
/* Round 15: cok asamali tasici boss — govde olum sekansinin sayilari.
   core/CONFIG.CARRIER'e EZMEZ, genisletir (AGENTS.md kurali). */
Object.assign(CONFIG.CARRIER, {
  deathExplosions: 8,     // govde olumunde patlama sayisi
  deathWindowMs: 600,     // ...bu sure icinde esit araliklarla
  flashMs: 350,           // kisa ekran parlamasi
});
