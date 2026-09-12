# tasks/pkg_android_game — oynanabilir dikey dilim

## Bu turdaki TEK iş

Emülatörde parmakla oynanan bir bölüm çıkar: dokun-başlat, birebir parmak takibi,
otomatik ateş, düşman doğuşu, çarpışma, patlama, skor, can, oyun sonu.

## Bitiş tanımı

`tools/android/gate_game.sh` sıfır çıkış koduyla biter (AC-1..AC-6).

## Intent (ICM)

"Emülatörde parmağımla oynadığımda dron parmağı birebir takip ediyor, ateş ediyor,
düşman öldürüyor ve skor artıyor — sıcak kare 2 ms altında."

## Kapatan kapılar

`game_playable`, `frame_budget`
