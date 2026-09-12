# :rules — spec

Web build'indeki her sabit, Kotlin tarafında **tam olarak bir kez** var olacak; ikinci
kez tanımlamak derlemeyi kıracak.

`:rules` saf JVM modülüdür (`java-library` + `kotlin-jvm`). Classpath'inde Android
yoktur; `import android.*` derleme hatasıdır.

## Kabul kriterleri

Hepsi ölçülebilir. Ölçen şey `tools/android/gate_rules.sh`.

1. **AC-1 — kapsama.** `gradle :rules:generateConfig` üretilen `Config.kt` içinde,
   `android/harness/golden/config.json` dosyasındaki **578 anahtarın 578'i** için bir
   değer bulunur. Eksik anahtar sayısı 0.

2. **AC-2 — bit eşitliği (`config_parity`).** `gradle :rules:test` içindeki
   `ConfigParityTest`, her sayısal anahtar için
   `java.lang.Double.doubleToRawLongBits(kotlinValue)` ile golden dosyadaki
   `f64:0x…` değerinin **bit-bit eşit** olduğunu doğrular. Uyuşmazlık sayısı 0.
   String ve boolean anahtarlar birebir karşılaştırılır.

3. **AC-3 — sahiplik kapısı kırmızı yanar (`ownership`).** Aynı noktalı anahtar iki
   farklı TOML dosyasında tanımlandığında `gradle :rules:generateConfig`
   **sıfırdan farklı çıkış koduyla** biter ve stderr, çakışan anahtar adını ve
   **her iki dosya adını** içerir. Bu, kapının kendisi test edilir: gate betiği
   geçici bir çift anahtar enjekte eder, derlemenin kırıldığını görür, geri alır.
   Derleme kırılmazsa kapı başarısızdır.

4. **AC-4 — sahiplik başlığı.** Her TOML dosyası `[owner] package = "<paket>"`
   başlığı taşır. Başlıksız TOML `generateConfig`'i kırar.

5. **AC-5 — üretilen kod derlenir ve inline'dır.** `Config.kt` iç içe `object` +
   `const val` üretir; `gradle :rules:compileKotlin` yeşil.

6. **AC-6 — üretilen dosya commit edilmez.** `Config.kt` `build/generated/` altına
   yazılır ve `.gitignore` kapsamındadır. Kaynak TOML'lardır.

## Kapsam dışı

- Davranış yok: `:rules` yalnızca veri taşır. Sim adımı, çizim, çarpışma yok.
- `Hit.aabb` tablosu R0'a dahil **değildir**; R2'de `hit_rects` kapısıyla gelir.
- `EntityKind` gibi enum'lar R1'de `:core-sim` sözleşmesiyle birlikte gelir.
