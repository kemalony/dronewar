# core — Motor çekirdeği

Dosyalar: CONFIG.js, MANIFEST.js, Clock.js, Pool.js, Assets.js, Renderer.js

Sorumluluk: tüm sabitler, gömülü manifest, sabit adımlı saat, nesne havuzu,
varlık yükleme (PNG + prosedürel yedek) ve tuval/ölçekleme.

Sözleşmeler:
- `CONFIG` tek gerçek kaynaktır; başka paket sihirli sayı yazmaz, buraya ekler.
- `MANIFEST` `index.html` içine GÖMÜLÜDÜR ve `assets/manifest.json` ile birebir
  aynı olmalıdır. `fetch` etme — `file://` altında bloklanır ve oyun sessizce
  prosedürel çizime düşer (bu hata sekiz tur boyunca fark edilmedi).
- `Renderer` uyarlanabilir çözünürlük yönetir: arka bellek `min(css*dpr, iç*ölçek)`,
  ölçek son karelerin medyanına göre 1x-2x arası oynar. Eşikler kare ARALIĞI
  olduğu için 60 Hz'de taban 16.7 ms; "hızlı" eşiğini bunun altına koyma.
- `Pool.acquire()` boşsa `null` döner ve `exhausted` artar; çağıran kontrol eder.
