# Android portu — mimari sözleşme

ADR-001 (render platformu) ile birlikte okunur. Alt ajanlar bu dosyadaki imzalara
bağlıdır; imza değişmesi gerekiyorsa ajan değiştirmez, `reports/requests/` altına not
bırakır ve orkestratör karar verir.

## 1. Modül haritası

Kök: `android/`. `bench-canvas` / `bench-gl` ADR'in ölçüm aracıdır; port başlayınca silinir.

| Gradle modülü | Tip | Kotlin paketi | Emülatör gerekir mi |
|---|---|---|---|
| `:rules` | java-library + kotlin-jvm | `dev.dronewar.rules` | **hayır** |
| `:core-sim` | java-library + kotlin-jvm | `dev.dronewar.sim` | **hayır** |
| `:input` | java-library + kotlin-jvm | `dev.dronewar.input` | **hayır** |
| `:harness` | java-library + kotlin-jvm | `dev.dronewar.harness` | **hayır** |
| `:assets` | android-library | `dev.dronewar.assets` | evet |
| `:render` | android-library | `dev.dronewar.render{,.canvas,.gl}` | evet |
| `:audio` | android-library | `dev.dronewar.audio` | evet |
| `:ui` | android-library | `dev.dronewar.ui` | evet |
| `:platform` | android-application | `dev.dronewar.platform` | evet |

`parity` ve `determinism` kapıları tamamen `:rules` + `:core-sim` + `:harness` üstünde,
`gradle :harness:test` ile koşar — cihaz yok, emülatör yok, classpath'te Android yok.
Bölmenin bütün amacı bu: `:core-sim` saf JVM modülü olduğu için kazara yazılan bir
`import android.*` kod incelemesi değil **derleme hatası** olur.

`:input` de saf JVM. `MotionEvent` değil, `PointerEvent(id, x, y, phase, stepIndex)`
tüketir; adaptör `:platform` içindedir. Böylece bağıl parmak takibi mantığı
(`_activePointer == null` korumaları dahil) cihazsız test edilir.

Çizim-only durum (sarsıntı, yalpalama, rotor dönüşü, bulut kayması, parlama) `:render`
içinde `(SimSnapshot, renderNanos)`'tan hesaplanır. `SimSnapshot` alanları `val`;
`:render`'ın sim durumunu değiştirmesini sağlayacak bir referansı yoktur.

## 2. Render dikişi

`:render` içinde tek arayüz. `:render.canvas` / `:render.gl` dışında hiçbir yer
`Canvas` ya da `GLES` adını anmaz.

```kotlin
enum class Blend { NORMAL, ADDITIVE }          // 'source-over' / 'lighter'

interface FrameSink {
    fun begin(backbufferW: Int, backbufferH: Int)   // 480x800 mantıksal dönüşümü kurar
    fun blend(mode: Blend)
    fun sprite(id: SpriteId, cx: Float, cy: Float, w: Float, h: Float,
               rotRad: Float, alpha: Float, whiteTint: Float)   // whiteTint 0..1 = vuruş parlaması
    fun rect(x: Float, y: Float, w: Float, h: Float, argb: Int)
    fun ring(cx: Float, cy: Float, r: Float, thickness: Float, argb: Int)
    fun glyphs(run: GlyphRun, x: Float, y: Float, argb: Int)
    fun end(): FrameStats                            // drawCalls, cpuNanos
}
```

`whiteTint` parametre olarak geçer, önceden pişirilmiş bitmap olarak değil: canvas
tarafı önbelleklenmiş `ColorMatrixColorFilter`, gl tarafı shader uniform kullanır.
Boyut başına canvas önbelleği yasağı sürüyor.

ADR sonucu tek bir ifadeyi değiştirir:
`val sink: FrameSink = if (Backend.GL) GlFrameSink(assets) else CanvasFrameSink(assets)`

`FrameStats.drawCalls` bir bütçedir — ADR ölçümünde batcher dokuya göre gruplanmayınca
aynı sahne 9 yerine 114 çağrıya çıktı ve gl canvas'tan yavaşladı.

## 3. Config sahipliği — derleme zamanında zorlanır

`CONFIG.js` ve dört `*.config.js` uzantısı, `:rules` içinde paket başına bir TOML olur:
`config/core.toml`, `units.toml`, `game.toml`, `fx.toml`, `audio.toml`.

`:rules/build.gradle.kts` içinde `compileKotlin`'e bağlı bir `generateConfig` görevi:

1. Bütün TOML'ları düz noktalı anahtar haritasına açar.
2. Çakışmada **`throw GradleException("duplicate config key PLAYER.maxSpeed: units.toml ve game.toml")`** — derleme durur. Birleştirme yok, `Object.assign` yok, son yazan kazanmaz. `CONFIG.SUBDRONE` ve `CONFIG.MUSIC` regresyonlarını üreten davranış tam olarak buydu.
3. `Config.kt`'yi iç içe `object` + `const val` olarak üretir; kullanım derleyici denetimli ve inline olur.
4. `checkConfigOwnership`, her TOML'un `[owner] package = "units"` başlığını okur ve turun paketinin sahibi olmadığı bir TOML'a dokunulmuşsa başarısız olur.

Ek olarak `configParity` (JVM testi): üretilen değerleri web build'inden dökülen
`harness/golden/config.json` ile karşılaştırır. **Web kaynağını değiştirmeden bir
Kotlin sabitini değiştirmek derlemeyi kırar.** "Ölçülerek eşlenmiş" iddiasını ikinci
aydan sonra ayakta tutan şey budur.

## 4. Altın iz (parity) — en yüksek riskli kalem

Kaydeden: yeni `tools/record_trace.py`, `tools/evaluate.py` içindeki
`scenario_positions` disiplinini sürdürür — bir `tick` tam olarak bir sim adımıdır,
girdi geçişleri sim adım indeksine bağlanır, duvar saatine asla.

- Başlık: `{schemaVersion, webSha, configHash, simHz:120, seeds:{spawn,pu,ground,skim}}`
- `script[]`: `{step, event}` — `press/release/pointerDown/pointerMove/pointerUp`
- Sim adımı başına bir NDJSON satırı: oyuncu x/y; her aktif varlık `{kind, poolIdx, x, y, hp}` olarak `(kind, poolIdx)`'e göre sıralı; skor, can, kombo, bölüm, `cityDist`, boss fazı; **ve her adlandırılmış LCG akışı için çekiliş sayacı**.
- Sayılar **ham float64 hex** (`"f64:0x400921fb54442d18"`). Ondalık biçimleme kapının ölçtüğü bitleri atar. Gzip'li, `harness/golden/` altında commit'li.

### Hassasiyet tuzağı ve kararı

**`:core-sim` her yerde `Double` kullanır; `:core-sim` içinde `Float` yasaktır ve
bytecode taramasıyla zorlanır.** JS'in tek sayı tipi float64'tür ve Kotlin `Double`
`+ - * /` ile `sqrt` için onunla bit-bit örtüşür. Float32 yuvarlaması "küçük" kalmaz:
LCG'ye beslenen doğuş karşılaştırmalarını bozar, düşman bir adım erken doğar ve iz
geri dönüşsüz çatallanır. `Float` ile ±0 ulaşılamaz. `Float`'a çevrim yalnızca
`SimSnapshot → FrameSink` sınırında olur; kare bütçesi etkilenmez.

**Asıl tuzak float32 değil, transandantal fonksiyonlar.** `kotlin.math.sin/cos/pow/atan2`
`java.lang.Math.*`'e derlenir; bu intrinsic'tir ve V8'den son ulp'ta ayrılabilir. V8'in
`Math.sin`'i fdlibm'dir (`src/base/ieee754.cc`); OpenJDK'nın `StrictMath`'i de aynı
fdlibm. Dolayısıyla: **`:core-sim` `StrictMath.*` çağırmak zorundadır ve `:core-sim`
bytecode'unda herhangi bir `java/lang/Math` çağrısı derlemeyi kırar.**

### R1'de ölçülen düzeltme: StrictMath gerekli ama YETMİYOR

Yukarıdaki kural doğru ama eksikti. **V8 her transandantal için fdlibm kullanmıyor —
`Math.hypot` bunlardan biri.** V8 iki argümanı büyüğünün mutlak değerine bölüyor,
kareler toplamını Kahan telafisiyle biriktiriyor, sonra `sqrt(sum) * max` yapıyor;
fdlibm'in `__ieee754_hypot`'u başka bir yol izliyor ve sıradan girdilerde son ulp'ta
ayrılıyor.

Bu teorik değil, ölçüldü. Oyuncu izini `StrictMath.hypot` ile oynatmak **385. adımda**
çatallanıyor:

```
step 385 vy: expected 0xc078a065f2ff29a2 (-394.02488994286443)
                 got 0xc078a065f2ff29a3 (-394.0248899428645)  [bit delta 1]
```

Naif `sqrt(x*x + y*y)` ise 384. adımda çatallanıyor. İkisi de yukarı+sağ çaprazında,
hız tavanının devrede olduğu yerde.

Kural şu hâlini alıyor: **`:core-sim` içindeki her matematik çağrısı
`dev.dronewar.sim.JsMath` üzerinden geçer.** `JsMath` JS semantiğinin tek tanım yeri;
çoğu fonksiyonda `StrictMath`'e devreder, ayrıldığı yerlerde (`hypot`) V8'in
algoritmasını uygular. Yeni bir `Math.*` çağrısı portlanırken önce `JsMath`'e eklenir,
doğrudan çağrılmaz.

**Kapının sınırı — bunu bilerek taşıyoruz.** `no_math` bytecode taraması yalnızca
`java/lang/Math` çağrılarını yakalar; "`StrictMath` çağrılmış ama V8 orada fdlibm
kullanmıyor" durumunu **yakalayamaz**. Onu yalnızca altın iz yakalar. Yani her yeni
transandantal için tek güvence, o kodu kapsayan bir iz kaydetmektir. Kapsanmayan bir
`JsMath` fonksiyonu, kapı yeşilken sessizce yanlış olabilir.

LCG portu: `Math.imul(s,1664525)+1013904223 >>> 0` → `Int` üzerinde
`s = s * 1664525 + 1013904223` (sarma birebir aynı), sonra
`(s.toLong() and 0xFFFFFFFFL).toDouble() / 4294967296.0`.
`android/bench-core/Lcg.kt` şu an 24 bit mantisli `Float` döndürüyor — **web'i
üretemez, `:core-sim`'e kopyalanmayacak.**

Replay: `:harness` `Sim.step()`'i sürer, `doubleToRawLongBits` eşitliğiyle karşılaştırır,
ilk uyuşmazlıkta adım indeksini, alan adını, iki hex değeri ve her RNG akışının son 8
çekilişini basar. `parity` = ≥7200 adımda 0 uyuşmazlık (iz A: bölüm 1 + boss,
iz B: liman + taşıyıcı).

## 5. hit_rects — tek tanım

Dikdörtgen `:rules` içindeki tabloda yaşar, başka hiçbir yerde:

```kotlin
object Hit { fun aabb(kind: EntityKind, x: Double, y: Double, out: RectD) }
```

`:core-sim` çarpışmada bunu çağırır. `:render` sprite'ı aynı tablonun `spriteScale`'i
ile ölçeklenmiş `Hit.aabb(...)` olarak çizer; hata ayıklama katmanı `Hit.aabb`'yi
birebir çizer. `:input` / `:ui` HUD öğelerini aynı tablodan `Hit.rect(UiElement)` ile
sınar. Zorlama yapısaldır: **`SimSnapshot` yalnızca `kind, x, y` açar — üzerinde `w`,
`h`, `radius`, `hitPad` alanı yoktur**, dolayısıyla `:render` içinde ikinci bir tanımın
kurulacağı malzeme yoktur ve denemek derleme hatasıdır. Arkasında her tip için
`drawRect(kind) == hitRect(kind).inflate(pad)` iddia eden bir JVM testi ve bir köşe
dokunuşu enstrümante testi durur.

## 6. Tur sırası

| Tur | Paketler (paralellik) | Intent cümlesi | Kapatan kapı |
|---|---|---|---|
| R0 | `:rules` — **seri, 1 ajan** | "Web build'indeki her sabit Kotlin'de tam olarak bir kez var ve ikinci kez tanımlamak derlemeyi kırıyor." | `ownership`, `config_parity` |
| R1 | `:core-sim` — **seri** ‖ `:harness`, `:assets` paralel | sim: "Kotlin sim, web altın izini 60 ve 120 Hz'de sıfır bit farkla üretiyor." harness: "Çatallanan adım; adım indeksi, alan adı ve iki hex değerle raporlanıyor." | `parity`, `determinism` |
| R2 | `:render`, `:input`, `:audio` — **3 ajan paralel** | render: "54 düşman + mermi sahnesi sıcak ≤2 ms, soğuk ≤16 ms çiziliyor; her dronda pervane dönüyor, gövde çevresinde daire yok, manevrada ±22° eğim var." | `frame_budget`, `visuals`, `touch_latency`, `hit_rects` |
| R3 | `:ui` — **seri** | "Her menü/HUD durumu erişilebilir ve her öğenin dokunma dikdörtgeni çizim dikdörtgenine eşit." | `hud_states`, UI `hit_rects` |
| R4 | `:platform` — **seri** | "Arka plandan dönünce sim duraklamış, ses susmuş, kayıt bozulmamış." | `lifecycle`, cihazda `touch_latency` (5" ve 7") |

Seri olmalarının sebebi: her seviyenin arayüzü bir sonrakinin sözleşmesi
(`rules → core-sim → {render, input, audio} → ui → platform`). Tek arayüze aynı anda
yazan iki ajan, `CONFIG.SUBDRONE` ezme hatasının Kotlin'de tekrarıdır. R2'nin üçü
gerçekten bağımsız: yalnızca `SimSnapshot` (R1'de donar) ve `:rules` tablolarını
(R0'da donar) paylaşırlar, ortak dosyaya dokunmazlar. `:harness` ve `:assets` R1 ile
paralel koşabilir; ikisi de sim içine bakmaz.

## 6b. Alt ajana bağlam verme (ICM'in C'si)

Plan "ajan repoyu keşfe ÇIKMAZ; bağlamı sen dar ve eksiksiz verirsin" diyor. Uygulanan
biçim: orkestratör prompt'a kaynak kodu **yapıştırmaz**, ama okunacak yeri `dosya:satır`
ve kapsam notuyla daraltır ("`src/units/Player.js:91` `update()` — yalnızca klavye
dalı"). Sebep, kod yapıştırmanın iki maliyeti olması: kopyalarken bozma riski, ve
ajanın kodun çevresindeki yorumları görememesi — bu repoda o yorumlar bedeli ödenmiş
hataların kaydı (`STATE.md` "Geri Alma", `game.config.js` başlığı).

Sınır şu: ajan **dosya arayarak** keşfe çıkmaz. Okuyacağı dosyaların listesi
`AGENTS.md` ve görev dosyasında adlandırılmıştır; liste dışına çıkmak için
`reports/requests/` üzerinden sorması gerekir.

## 6c. Referansın kendisi yeşil değil (2026-09-12'de ölçüldü)

Devir planı "referans uygulama web sürümü, **115/115 kapı yeşil**" diyor ve ADR-001
o cümlenin üstüne yazıldı. **Ölçüldü, doğru değil.** `tools/evaluate.py` bu makinede
(sistem Chrome'u, `PW_CHANNEL=chrome`) üst üste üç koşumda:

```
EVALUATE: 65 PASS, 4 FAIL / 69
  FAIL: foreground_contrast   en_zayif_mermi_kontrasti=25 (esik >=60)
  FAIL: run_stats             atis=0
  FAIL: stats_reset_per_run   atis=0
  FAIL: persist_best          rekor=0
  (+ vision_polish: VISION_API LAN adresi bu makineden ulasilamiyor)
```

İlk koşumda `foreground_contrast` 145 (PASS) çıktı; sonraki iki koşum 25, 25.
Aykırı olan ilk koşumdu (10 mermi örneklendi, diğerlerinde 11) — kapı gürültülü
değil, HEAD kırmızı.

`reports/` içinde `round_20.md` **yok**. Son commit ("Round 20: koşu istatistikleri,
kalıcı rekor, ipuçları + ölçüm kapıları") ölçüm koşturulmadan atılmış ve kırmızı
olanların üçü tam olarak o turun eklediği özellikler.

**Port için anlamı:** `parity` kapısı web ne yapıyorsa onu üretir — hatalarıyla
birlikte. `atis=0` portlanırsa isabet oranı, kombo ve rekor da yanlış portlanır.
Sıra şu olmalı: önce web'deki kırmızılar düzeltilir, sonra o davranışın altın izi
kaydedilir. Kırmızı bir davranışın izini kaydetmek, hatayı sözleşmeye çevirir.

Ölçümü tekrarlamak: `PW_CHANNEL=chrome .venv-mac/bin/python tools/evaluate.py`

## 7. En büyük üç risk

1. **İz çatallanıyor ve sebebi bulunamıyor.** *(R1'de gerçekleşti ve önlem işe yaradı:
   `Math.hypot` çatalı tek koşumda 385. adıma, `vy` alanına, tek bite indi.)*
   Önlem: StrictMath zorunluluğu bytecode taramasıyla; her iz satırında akış başına RNG çekiliş sayacı, böylece çatal tek koşumda tek fonksiyona indirgenir; ve varlıklar var olmadan önce 600 adımlık yalnız-oyuncu izini yeşile almak.
2. **Double hassasiyetli sim 2 ms sıcak kareyi tutturamıyor.** Önlem: struct-of-arrays `DoubleArray` havuzları (`bench-core/Scene.kt` bu deseni zaten kullanıyor), sıcak döngüde sıfır tahsis, ve `:harness` içinde 54 düşmanda adım başına ≤0.4 ms dayatan yalnız-sim JVM ölçümü — **R1'de**, ortada suçlanacak bir render katmanı yokken.
3. **Biri bir kapıyı yeşile çevirmek için Kotlin sabitini oynatıyor** ve port sessizce aynı oyun olmaktan çıkıyor. Önlem: commit'li `golden/config.json`'a karşı `configParity`; yalnız-Kotlin sabit değişikliği derlemeyi kırar ve düzeltmeyi `src/`'ye zorlar, orada da web kapıları yeniden ölçer.
