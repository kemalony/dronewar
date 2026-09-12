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
/* Round 24: arayuz (menu / dron secimi / duraklat / bolum karti / oyun sonu).
   YENI ust duzey anahtar (UI); yine de `|| {}` ile genisletiliyor.

   NEDEN LEVHA, NEDEN BU SAYILAR
   Arayuz canli kayan sehrin uzerine ciziliyor, yani okunurluk o an arkada ne
   oldugunun fonksiyonuydu. Olculdu (2026-09-12, yazinin ARKASINDAKI medyan
   parlaklik, bes kaydirma konumunda):
       menu       [32, 39, 34, 36, 40]  yayilim  8   <- degrade perde is goruyor
       pause      [13, 36, 37, 34, 36]  yayilim 24
       stagecard  [15, 53, 39, 39, 33]  yayilim 38   tepe 53  <- en kotusu
   Kart parlak koprunun uzerine denk gelince baslik ve amblem kayboluyordu:
   yumusak radyal perde EKRANIN KENARINDA sifira iniyor, olcum bandi ise TAM
   GENISLIK. Yani perde tam da lazim oldugu yerde yoktu.

   Cozum tek bir ilkeye baglandi: her arayuz blogu tam genislikte, cekirdegi
   neredeyse mat bir LEVHA uzerine cizilir; yalnizca ust/alt kenarlari yumusar.
   Sizinti = (1 - alfa). Ornek: alfa 0.90'da arka planin 38'lik yayilimi
   0.10 * 38 ~ 4'e, tepe degeri 6.3 + 0.10*B'ye iner. Alfalar buradan secildi:
       kart   0.90 -> sizinti 0.10 (dunyanin uzerine dogrudan cizilir)
       pause  0.84 x 0.50 karartma -> toplam sizinti 0.08
       menu   0.74 x degrade perde  -> toplam sizinti ~0.14 (zaten 8 veriyordu)
   Levhayi inceltmek istersen sizintiyi hesapla: yayilim ~ sizinti * (arka plan
   yayilimi). Kartta arka plan yayilimi 38 olculdu, yani sizinti 0.30'u gecerse
   yayilim 12 esigini asar. */
CONFIG.UI = Object.assign(CONFIG.UI || {}, {
  plateRGB: '4,7,14',        // levha rengi (gece mavisi-siyah)
  accentRGB: '110,235,255',  // cyan vurgu — oyunun mermi/HUD dili
  gold: '#ffd24a',
  muted: 'rgba(150,166,184,0.9)',
  plateFeather: 46,          // levhanin ust/alt yumusama payi (px)
  plateAlpha: 0.86,          // varsayilan cekirdek alfasi
  /* Bloklarin dikey yerlesimi: y0/y1 CEKIRDEK (tam alfa) araligidir.
     Olcum bantlari: menu 180-260, pause 300-380, kart 340-420 — her biri
     kendi cekirdeginin ICINDE kalmali, yoksa kenar yumusamasi olcume girer. */
  menuPlate:  { y0: 128, y1: 300, a: 0.74 },
  shipPlate:  { y0: 170, y1: 482, a: 0.72 },
  pausePlate: { y0: 252, y1: 516, a: 0.84 },
  cardPlate:  { y0: 188, y1: 492, a: 0.90 },
  endPlate:   { y0: 160, y1: 580, a: 0.68 },
  pauseDim: 0.50,            // duraklatmada oyun alaninin karartmasi
  tipPlate: { y0: 770, y1: 792, a: 0.55 },   // oyun ici ipucu satiri
});
/* Menude gosterilen bolum katalogu — STAGES'ten TURETILIR ki bolum eklenince
   kendiliginden guncellensin (elle yazilan liste bir kez bayatladi). */
CONFIG.UI.stageCatalog = CONFIG.STAGES.map((s) => s.name).join(' · ');
