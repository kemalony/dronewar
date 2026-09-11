# core paketi — Round 20: koşu istatistikleri + ipucu metinleri

Yalnızca `src/core/CONFIG.js`. İki yeni blok, mevcut anahtarlara dokunma.

```js
/* Round 20: oyun sonu istatistikleri — oyuncu neyi ne kadar iyi yaptığını görsün. */
STATS: {
  storageKey: 'dronewar_best_v1',   // localStorage anahtarı (en iyi skor + rekorlar)
  rows: ['score', 'kills', 'bestCombo', 'accuracy', 'timeMs'],
},
/* Round 20: kısa ipuçları — ilk koşuda, oyun akışını kesmeden. */
TIPS: {
  showMs: 2600,        // bir ipucu ekranda bu kadar kalır
  gapMs: 1200,         // iki ipucu arası boşluk
  onlyFirstRuns: 2,    // yalnızca ilk iki koşuda gösterilir
  list: [
    'PARMAĞINI SÜRÜKLE — DRON TAKİP EDER',
    'DOKUNUNCA OTOMATİK ATEŞ',
    'KUTULARI TOPLA — SİLAH SEVİYESİ ARTAR',
    'ART ARDA VUR — SKOR ÇARPANI YÜKSELİR',
    'HASAR ALINCA ÇARPAN SIFIRLANIR',
  ],
},
```
