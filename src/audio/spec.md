# audio — Ses

Dosyalar: Sound.js

Sorumluluk: prosedürel WebAudio; dosya yok.

Sözleşmeler:
- `AudioContext` askıdayken hiçbir çağrı hata fırlatmaz (`audio_no_throw` testi).
- İlk kullanıcı jestinde açılır (mobilde şart). `M` sessize alır.
- Aynı anda çok ses varsa toplam kazanç sınırlanır (aktif ses sayacı).
- Ses üretimi simülasyonu ETKİLEMEZ; determinizm testleri bozulmamalı.
