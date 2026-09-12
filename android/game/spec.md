# :game — spec (oynanabilir dikey dilim)

Emülatörde parmakla oynanan, gerçek varlıkları ve gerçek oyuncu fiziğini kullanan
çalışır bir bölüm. Amaç tam port değil; **elle tutulur oynanabilirlik**.

Renderer ADR-001'in kazananı: OpenGL ES 2.0, `bench-gl`'in kanıtlanmış
`SpriteBatch` + EGL döngüsü temel alınır.

## Kabul kriterleri

Ölçen şey `tools/android/gate_game.sh`.

1. **AC-1 — açılıyor.** `am start -W` soğuk açılış `TotalTime <= 1500 ms`.
   Sıfır `pageerror` karşılığı: logcat'te `AndroidRuntime` FATAL yok.

2. **AC-2 — oynanabilir döngü.** Dokun → oyun başlar. Parmak sürüklendiğinde dron
   birebir bağıl takip eder. Parmak ekrandayken otomatik ateş eder. Bunların hepsi
   `state()` benzeri bir hata ayıklama çıktısıyla **ölçülebilir** olmalı:
   `shotsFired > 0`, `playerX` parmakla değişiyor.

3. **AC-3 — düşman ve çarpışma.** Düşmanlar üstten doğar, aşağı iner. Mermi
   düşmana değince düşman ölür, patlama çıkar, skor artar. Düşman gövdesi oyuncuya
   değince can azalır. Ölçülebilir: 10 saniyelik otomatik koşumda
   `kills > 0 && score > 0`.

4. **AC-4 — can ve oyun sonu.** Can 3'ten başlar, sıfırlanınca oyun sonu ekranı;
   dokununca yeniden başlar. Ölçülebilir: can zorla sıfırlanınca `mode == "over"`.

5. **AC-5 — kare bütçesi.** Ekranda >=20 düşman + mermi varken sıcak kare
   `cpu_p95 <= 2.0 ms`, düşen kare oranı <= %5. `bench-core/Metrics` ile ölçülür.

6. **AC-6 — tek kaynak.** Oynanış sabitleri `:rules`'tan (`Config`) okunur.
   Oyuncu fiziği `:core-sim`'den gelir — uygulamada ikinci bir oyuncu
   entegratörü YOK. Bytecode/kaynak taramasıyla ölçülür: `game` modülünde
   `maxSpeed`, `accel`, `decayHalfLife` gibi sayısal sabit tanımı geçmez.

## Kapsam dışı (sonraki turlar)

Boss, bölüm geçişi, şehir crossfade, powerup çeşitliliği, ses, müzik, menü cilası,
dron seçimi, kara birimleri, kombo. Bunlar portun ilerleyen turlarında gelir.

## Bilinen borç (yazılı, gizli değil)

`:core-sim`'e eklenecek dokunmatik dalının altın izi yok — ölçülmüş eşlenik
değil. Klavye dalı 720/720 bit-bit korunuyor ve `gate_core_sim.sh` bunu
sürüyor. Dokunmatik izi R2'de kaydedilecek.

## Kapsam içi ama basitleştirilmiş

Düşman yapay zekası: scout/gunner/shield üç tip, düz iniş + yatay salınım.
Parity kapısı bunları **kapsamıyor** — bu dilim henüz ölçülmüş eşlenik değil,
oynanabilirlik gösterimi. Bu, spec'te bilinçli ve yazılı bir borçtur.
