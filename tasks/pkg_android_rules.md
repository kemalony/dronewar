# tasks/pkg_android_rules — R0

## Bu turdaki TEK iş

`android/rules` modülünü kur: paket başına bir TOML, bunlardan `Config.kt` üreten bir
Gradle görevi, çakışan anahtarda derlemeyi kıran bir sahiplik denetimi, ve golden
dosyaya karşı bit eşitliğini doğrulayan bir JVM testi.

## Bitiş tanımı

`tools/android/gate_rules.sh` sıfır çıkış koduyla biter. Betik dört şeyi ölçer:

1. `:rules:generateConfig` yeşil
2. `:rules:test` içinde `ConfigParityTest` — 578/578 anahtar, 0 uyuşmazlık
3. sahiplik kapısı: geçici bir çift anahtar enjekte edilince derleme **kırılır**
4. kırılan derlemenin stderr'i çakışan anahtarı ve **iki dosya adını** içerir

## Intent (ICM)

"Web build'indeki her sabit Kotlin'de tam olarak bir kez var ve ikinci kez
tanımlamak derlemeyi kırıyor."

## Kapatan kapılar

`ownership`, `config_parity`
