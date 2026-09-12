# :core-sim — sınırlar

## Yazabileceğin dosyalar

- `android/core-sim/**`
- `android/settings.gradle.kts` — **yalnızca** `include(":core-sim")` eklemek için

## Dokunamayacakların

- `src/**` — web referansı. Portlarken OKU, değiştirme.
- `android/harness/golden/**` — ölçüldüğün dosyalar. **Altın izi düzenlemek
  yasaktır.** İz yanlış görünüyorsa `reports/requests/core-sim.md` dosyasına tek
  satır not bırak.
- `android/rules/**` — R0'da dondu. Eksik bir sabit varsa not bırak, ekleme.
- `android/harness/**` (golden dışı) — paralel çalışan başka ajanın.
- `tools/**`, `docs/**`, `android/bench-*`.

## Sahip olduğun config anahtarları

Hiçbiri. Sabitler `:rules`'ta yaşar; sen `dev.dronewar.rules.Config` üzerinden
**okursun**. Yeni sabit tanımlama — tek kaynak kuralı.

## Bağımlı olduğun imzalar

```kotlin
dev.dronewar.rules.Config          // R0'da dondu, salt okunur
```

## Üreteceğin imza

```kotlin
package dev.dronewar.sim

class Sim(seed: Int = 0) {
    fun press(key: Key)
    fun release(key: Key)
    /** Bir rawDt kadar ilerletir; koşan sim adım sayısını döner. */
    fun advance(rawMs: Double): Int
    val playerX: Double
    val playerY: Double
    val playerVx: Double
    val playerVy: Double
    val steps: Long
}
enum class Key { LEFT, RIGHT, UP, DOWN }
```

İmzayı genişletebilirsin; daraltamazsın — `:harness` buna bağlı.

## Değişmezler

- `Double` her yerde. `Float` bytecode'da bile geçmeyecek.
- `StrictMath.*`, `Math.*` değil. `kotlin.math.*` `java.lang.Math`'e derlenir —
  kullanma.
- Sıcak döngüde `new` yok.

## Çıktı

Kısa özet: ne değişti, hangi dosyalar.
