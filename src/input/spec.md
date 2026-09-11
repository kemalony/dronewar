# input — Girdi

Dosyalar: Input.js

Sorumluluk: klavye ve dokunmatik.

Sözleşmeler:
- Dokunmatik birebir BAĞIL takiptir: parmağın bastığından beri kaydığı kadar dron
  kayar. Parmağın bastığı noktaya uçma modeline DÖNME.
- Menü/game over/zafer durumunda dokunuş oyunu başlatır; duraklamada devam ettirir.
- Parmak ekranda olduğu sürece `fire` basılıdır (otomatik ateş).
- Autotest kancaları (`touchStart/touchMove/releaseTouch`) GERÇEK giriş noktalarını
  çağırır; mantığı kopyalama — kanca ile sahaya çıkan kod ayrışırsa harness farkı göremez.
