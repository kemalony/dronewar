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
/* Round 22: yazilmis ama HIC CAGRILMAMIS ozelliklerin cagri noktasi sabitleri.
   YENI ust duzey anahtar (FEEDBACK) — baska paketin anahtarina yazmadigimiz
   icin kardes silme riski yok; yine de `|| {}` ile genisleterek yaziyoruz,
   boylece ileride baska bir dosya ayni anahtara eklerse ikisi de yasar. */
CONFIG.FEEDBACK = Object.assign(CONFIG.FEEDBACK || {}, {
  /* Oyuncu hasar alinca sinyal bozulmasi (FxSystem.glitch). Sarsinti
     (SHAKE.playerHitMs = 260 ms) ile ayni olayda tetiklenir; glitch biraz
     daha uzun surer ki "sinyal toparlaniyor" hissi sarsintiyi izlesin. */
  damageGlitchMs: 420,
  damageGlitchAmp: 0.85,     // 0..1 — ambient (0.5) uzerinde kalmali
  /* Surekli rotor uguldusu (Sound.hover). Seviye oyuncunun hizindan turetilir;
     Sound kendi icinde 0.6..1.0 arasina kelepceler, ayni araligi burada da
     tutuyoruz ki HUD/state ile ses ayni sayiyi gorsun. */
  hoverMin: 0.6,
  hoverMax: 1.0,
  hoverStep: 0.05,           // bu kadar degismeden ses dugumlerine dokunma
  /* Jammer govde yaricapi (carpisma). Jammer sinifinin (units) kendi `radius`
     alani YOK — CONFIG.JAMMER.radius jamming MENZILI (200 px), hitbox degil.
     Units'e hp/hit() eklenince bu deger oraya tasinmali (reports/requests). */
  jammerHitR: 28,            // ~ CONFIG.JAMMER.size (80) * 0.35
});
