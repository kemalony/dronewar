# :harness — sınırlar

## Yazabileceğin dosyalar

- `android/harness/src/**`, `android/harness/build.gradle.kts`
- `android/settings.gradle.kts` — **yalnızca** `include(":harness")` eklemek için

## Dokunamayacakların

- **`android/harness/golden/**` — ASLA.** Bu klasör ölçünün kendisidir. Altın izi
  ya da golden config'i düzenlemek, ölçüldüğün cetveli eğmektir. Yanlış görünen bir
  değer varsa `reports/requests/harness.md` dosyasına tek satır not bırak.
- `android/core-sim/**` — paralel çalışan başka ajanın. `Sim` imzasını OKU, yazma.
- `android/rules/**`, `src/**`, `tools/**`, `docs/**`, `android/bench-*`.

## Bağımlı olduğun imzalar

```kotlin
dev.dronewar.sim.Sim               // :core-sim, AGENTS.md'sinde donduruldu
dev.dronewar.sim.Key
dev.dronewar.rules.Config
```

`Sim` henüz derlenmiyorsa imzaya göre yaz; orkestratör turu birlikte ölçer.

## Değişmezler

- `Double`. Karşılaştırma `doubleToRawLongBits` ile — `==` ile değil, tolerans ile
  hiç değil. `1e-9` toleransı bu kapıyı anlamsız kılar.
- Çatal mesajı hex içermeli. Ondalık basmak, kapının bulunması için var olduğu
  bilgiyi atar.

## Çıktı

Kısa özet: ne değişti, hangi dosyalar.
