# :rules — sınırlar

## Yazabileceğin dosyalar

- `android/rules/**` (kendi modülün: `build.gradle.kts`, `src/main/kotlin/**`,
  `src/test/kotlin/**`, `config/*.toml`)
- `android/settings.gradle.kts` — **yalnızca** `include(":rules")` satırını eklemek için
- `tools/android/bootstrap_rules_config.py` — TOML'ları golden dosyadan üreten tek
  seferlik bölme betiği. `tools/**` genel olarak yasak; bu dosya adlandırılmış
  istisnadır, çünkü 578 değeri elle kopyalamak yanlış sabit sokmanın en kısa yoludur
  ve bölmenin yeniden üretilebilir olması gerekir.

## Dokunamayacakların

- `src/**` — web referans uygulaması. Bir sabitin yanlış olduğunu düşünüyorsan
  DEĞİŞTİRME; `reports/requests/rules.md` dosyasına tek satır not bırak.
- `android/harness/golden/config.json` — bu senin ölçüldüğün dosya. Kendi ölçütünü
  düzenleyemezsin. Değer yanlış görünüyorsa yukarıdaki gibi not bırak.
- `android/bench-*` — ADR'in ölçüm aracı, portun parçası değil.
- `tools/**` (yukarıdaki adlandırılmış istisna dışında), `docs/**`, diğer paketler.

## Sahip olduğun config anahtarları

Web `CONFIG`'inin tamamı, kaynak dosyaya göre bölünmüş:

| TOML | web kaynağı |
|---|---|
| `config/core.toml` | `src/core/CONFIG.js` |
| `config/audio.toml` | `src/audio/audio.config.js` |
| `config/units.toml` | `src/units/units.config.js` |
| `config/game.toml` | `src/game/game.config.js` |
| `config/fx.toml` | `src/fx/fx.config.js` |

Bir anahtar hangi web dosyasında tanımlıysa o TOML'a gider. `Object.assign` ile
genişletilen anahtarlarda (`CONFIG.MUSIC`, `CONFIG.SUBDRONE`) **alanlar** iki dosyaya
bölünür; aynı noktalı anahtar iki yere yazılırsa derleme kırılır — kapı budur.

## Bağımlı olduğun imzalar

Hiçbiri. `:rules` yaprak modüldür, hiçbir şeye bağlı değildir.

## Üreteceğin imza (aşağısı sana bağlı)

```kotlin
package dev.dronewar.rules
object Config {
    object PLAYER { const val maxSpeed: Double = 400.0 /* ... */ }
    // ...
}
```

## Değişmezler

- **Sayılar `Double`.** `Float` yok. JS'in tek sayı tipi float64; `Float`'a
  yuvarlamak parity kapısını geri dönüşsüz kırar.
- **Tek kaynak.** Bir sabit bir yerde. İkinci kopya derlemeyi durdurur.
- Build'i sen çalıştırma, testleri sen koşturma. Orkestratör her turdan sonra
  derler ve ölçer.

## Çıktı

Kısa özet: ne değişti, hangi dosyalar. Rapor yazma — raporu harness üretir.
