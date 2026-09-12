# tasks/pkg_android_core_sim — R1 fazı 1

## Bu turdaki TEK iş

`:core-sim` ve `:harness` modüllerini kur; web altın izinin 720 adımını sıfır bit
farkla üret.

## Bitiş tanımı

`tools/android/gate_core_sim.sh` sıfır çıkış koduyla biter:

1. `:core-sim` + `:harness` derleniyor
2. `parity`: 720/720 adım, 0 uyuşmazlık
3. `determinism`: 1 adım/tick ve 2 adım/tick bit-bit aynı
4. `no_float`: `:core-sim` bytecode'unda `Float` yok
5. `no_math`: `:core-sim` bytecode'unda `java/lang/Math` yok
6. iz 1 ulp bozulunca parity **kırmızı** yanıyor ve doğru adımı adlandırıyor

## Intent (ICM)

"Kotlin sim, web altın izini 60 ve 120 Hz'de sıfır bit farkla üretiyor."

## Kapatan kapılar

`parity`, `determinism`
