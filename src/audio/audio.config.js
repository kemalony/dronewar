/* src/audio/audio.config.js — round 19: prosedurel muzik katmani sabitleri. */
/* DIKKAT: `Object.assign(CONFIG, { MUSIC: {...} })` yazilirsa core paketinin
   ayni turda ekledigi MUSIC.intensity/bpm anahtarlari EZILIR ve oyun ilk sim
   adiminda coker (olculdu: TypeError, `intensity.play` undefined). Paylasilan
   anahtar EZILMEZ, GENISLETILIR. */
Object.assign(CONFIG.MUSIC, {
    gain: 0.28,            // toplam muzik kazanci (efektlerin onune gecmez)
    layerGainMul: 1.0,     // katman genligi carpani
    rootHz: 110,           // A2 — taban perde
    scale: [0, 3, 7, 10],  // dorik yari tonlar (karanlik, sehir uzeri hissi)
    stepMs: 125,           // bir sekil adimi (16 adim = 2 sn cember)
    lookaheadMs: 200,      // ileri planlama penceresi
    tickMs: 80,            // setInterval araligi (< lookahead)
    rampMs: 400,           // katman acma/kapama yumusak gecisi
    thresholds: [0.25, 0.55, 0.55, 1.0],  // bass,pulse,arp,lead acilis yogunlugu
    bassWave: 'triangle', bassDur: 0.22, bassVol: 0.5,
    pulseWave: 'sine',    pulseHz: 180, pulseDur: 0.05, pulseVol: 0.4,
    arpWave: 'square',    arpDur: 0.16,  arpVol: 0.22,
    leadWave: 'sine',     leadDur: 0.55, leadVol: 0.28,
});
