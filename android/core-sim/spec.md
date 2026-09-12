# :core-sim — spec (R1, faz 1: yalnız oyuncu)

Kotlin sim, web altın izini **sıfır bit farkla** üretecek.

`:core-sim` saf JVM modülüdür. Classpath'inde Android yoktur. Tek bağımlılığı `:rules`.

## Kapsam — R1 fazı 1

Bu turda YALNIZCA şunlar portlanır:

- `Clock` — 120 Hz akümülatör (`src/core/Clock.js`)
- `Lcg` — `Double` üzerinden (`src/core/` içindeki LCG)
- `PlayerSim` — `src/units/Player.js:91` `update()`'in **klavye dalı**: ivme,
  üstel sönüm, sınır kelepçesi
- `Sim` — cephe: `press(key)`, `release(key)`, `advance(rawMs)`, konum okuyucuları

**Kapsam dışı (sonraki turlar):** düşmanlar, mermiler, boss, powerup, dash,
sub-dron, dokunmatik dalı, FX, ses, çizim. Altın iz bunların hiçbirini içermiyor.

## Kabul kriterleri

Ölçen şey `tools/android/gate_core_sim.sh`.

1. **AC-1 — parity.** `android/harness/golden/trace_player.ndjson.gz` içindeki
   **720 adımın 720'si** için `x`, `y`, `vx`, `vy` değerleri
   `java.lang.Double.doubleToRawLongBits` ile **bit-bit eşit**. Uyuşmazlık 0.

2. **AC-2 — ilk çatal raporlanabilir.** Uyuşmazlık varsa harness; adım indeksini,
   alan adını ve **iki değeri de hex olarak** basar. Çatalı bulmak için tek koşum
   yetmelidir.

3. **AC-3 — determinism.** Aynı girdi betiği tick başına 1 sim adımıyla ve tick
   başına 2 sim adımıyla sürüldüğünde, adım indeksi başına konumlar **bit-bit
   aynı**. (Kare hızı değişir, sim adım sayısı değişmez.)

4. **AC-4 — `Float` yok.** `:core-sim` bytecode'unda `Float`/`float` tipi geçmez.
   Bytecode taramasıyla ölçülür, kod incelemesiyle değil.

5. **AC-5 — `java.lang.Math` yok.** `:core-sim` bytecode'unda `java/lang/Math`
   çağrısı geçmez; tüm matematik `java.lang.StrictMath` üzerinden. V8 ve OpenJDK
   ikisi de fdlibm kullanır ama `Math` intrinsic'tir ve son ulp'ta ayrılabilir.

6. **AC-6 — sıcak döngüde tahsis yok.** `advance()` çağrısı başına ayrılan nesne
   sayısı 0. (`:harness` içinde ölçülür.)

## Değişmezler

- Sayılar `Double`. `Float` yok.
- `Math.random()` yok — tüm rastgelelik LCG'den.
- Duvar saati yok. Sim yalnız `dt` görür.
- Çizim yok. `:core-sim` hiçbir şey çizmez ve çizim durumu tutmaz.
