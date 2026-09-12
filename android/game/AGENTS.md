# :game — sınırlar

## Yazabileceğin dosyalar

- `android/game/**`
- `android/settings.gradle.kts` — **yalnızca** `include(":game")` eklemek için

## Dokunamayacakların

- `android/core-sim/**`, `android/rules/**`, `android/harness/**` — R0/R1'de dondu.
  `Sim` ve `Config` imzalarını OKU, değiştirme. Eksik bir şey varsa
  `reports/requests/game.md` dosyasına tek satır not bırak.
- `android/harness/golden/**` — ölçüm cetveli. ASLA.
- `src/**` — web referansı. Davranış portlarken OKU.
- `android/bench-*` — ADR ölçüm aracı. **`SpriteBatch.kt` ve `GlRenderView.kt`'yi
  KOPYALAYABİLİRSİN** (başlangıç noktan olsun diye), ama bench modüllerini
  DEĞİŞTİRME.
- `tools/**`, `docs/**`, `assets/**`.

## Sahip olduğun config anahtarları

Hiçbiri. Sabitler `:rules`'ta. `Config.PLAYER.maxSpeed` gibi okursun.
**Yeni oynanış sabiti tanımlama** — gerekiyorsa `reports/requests/game.md`'ye yaz.

## Bağımlı olduğun imzalar

```kotlin
dev.dronewar.rules.Config            // R0, salt okunur
dev.dronewar.sim.Sim                 // R1: press/release/advance/playerX/playerY
dev.dronewar.sim.Key
dev.dronewar.bench.Metrics           // kare/dokunma ölçümü (bench-core)
```

### Dokunmatik: `:core-sim`'i genişletmene İZİN VAR (tek istisna)

`Sim` şu an yalnız klavye dalını biliyor. Birebir parmak takibi sim davranışıdır,
uygulamanın işi değil — uygulamaya koyarsan katmanlar bozulur. Bu yüzden
`:core-sim`'e **ekleme yapabilirsin**:

```kotlin
fun touchMove(x: Double, y: Double)   // parmak konumu, 480x800 iç koordinatta
fun touchRelease()
```

Portlayacağın şey `src/units/Player.js:99-110` dokunmatik dalı. Dikkat: o dal
ivme/atalet KULLANMAZ — hedefe `followSpeed * dt` ile doğrudan gider ve
`_clamp()` uygular. Yani klavye entegratörünün kopyası değil, ayrı bir kip.

**Değişmez şart:** `tools/android/gate_core_sim.sh` yeşil kalacak. Klavye dalının
davranışını değiştirirsen 720 adımlık altın iz çatallanır ve kapı seni yakalar.
Kapıyı çalıştırma (orkestratörün işi), ama klavye yoluna dokunma.

**Bilinen borç:** bu dokunmatik dalının kendi altın izi HENÜZ YOK, yani ölçülmüş
eşlenik değil. R2'de dokunmatik iz kaydedilip kapatılacak. `JsMath` kuralı burada
da geçerli: `Math.hypot` V8'de fdlibm DEĞİL, `JsMath.hypot` kullan.

## Değişmezler

- **Çizim ve sim ayrı.** Sarsıntı, rotor dönüşü, parlama yalnız çizimdir.
- **Sıcak döngüde `new` yok.** Havuzlar önceden ayrılır.
- **Çizim çağrısı bütçesi:** sahne başına <= 15. Batcher dokuya göre gruplanmazsa
  ADR ölçümünde 114'e çıkmıştı ve GL canvas'tan yavaşlamıştı.
- Varlıklar `android/game/src/main/assets/sprites/` altında hazır — **yeni varlık
  ÜRETME**, listedeki 15 sprite ile çalış.
- Çizim yolu önce yüklenen görseli kullanır, yoksa prosedürel yedek.

## Çıktı

Kısa özet: ne değişti, hangi dosyalar. Rapor yazma.
