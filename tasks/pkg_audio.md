# audio paketi — Round 19: prosedürel müzik katmanı

Oyunun müziği yok. `Sound` sınıfına katmanlı, prosedürel bir müzik motoru ekle
(`src/audio/Sound.js` içinde veya `src/audio/Music.js` olarak — ikisi de audio
paketinde). Varlık dosyası YOK, her şey WebAudio ile üretilir.

## Tasarım
- `CONFIG.MUSIC` sabitlerini kullan. Dört katman: `bass` (kare/üçgen nabız),
  `pulse` (kısa perküsif tık), `arp` (arpej), `lead` (uzun, süzülen ton).
- **Yoğunluk 0..1**: `intensity` yükseldikçe katmanlar sırayla açılır
  (0.25 → yalnız bass; 0.55 → +pulse +arp; 1.0 → hepsi). Geçiş `rampMs` ile
  yumuşak (`gain.linearRampToValueAtTime`) — ani açma/kapama yok.
- `music.start()`, `music.stop()`, `music.setIntensity(v)`, `music.state()`.
  `state()` → `{ playing, intensity, layers: <açık katman sayısı> }`.
- Zamanlama `AudioContext.currentTime` üzerinden ileri planlama (lookahead ~200 ms);
  `setInterval` ile nota kuyruğu. Sim'e ASLA dokunma — müzik determinizmi etkilemez.

## Kurallar (mevcut tasarım, bozma)
- `muted` bayrağına saygı: sessize alınca müzik de susar, `playing` false olur.
- Autotest'te `AudioContext` suspended kalır: tüm çağrılar **sessizce no-op**
  olmalı ve hiçbir koşulda exception atmamalı. `audio_no_throw` kapısı bunu ölçüyor
  ve bu turda müzik çağrıları da o kapıya girecek.
- Müzik seviyesi efektlerin önüne geçmemeli (`CONFIG.MUSIC.gain`).
