# input paketi — sub-dron fırlatma girdisi

- Klavye: `E` (veya `F`) sub-dronları kamikaze olarak fırlatır.
- Dokunmatik: **iki parmakla dokunuş** fırlatır (tek parmak hareket + otomatik ateş
  olarak kalmalı, dash çift dokunuşta kalmalı).
- `Input.consumeSubLaunch()` tek seferlik bayrak döndürsün.
- Mevcut sözleşmeleri bozma: birebir bağıl takip, otomatik ateş, `_activePointer`
  `null` başlar ve korumalar `== null`.
