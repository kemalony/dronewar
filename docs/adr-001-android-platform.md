# ADR-001 — Android render platformu

- **Durum:** kabul edildi (KOŞULLU — fiziksel cihaz onayı bekliyor, bkz. "Açık risk")
- **Tarih:** 2026-09-12
- **Karar:** Kotlin + OpenGL ES 2.0 (SurfaceView + elle kurulan EGL bağlamı)
- **Karar sırası (plandan):** dokunma gecikmesi → kare bütçesi → APK boyutu

## Bağlam

Çalışan web sürümü referans uygulamadır. Amaç onu yeniden hayal etmek değil, ölçülerek
eşlenmiş bir native sürüm çıkarmak. Plan üç seçenek öngörüyordu; üçüncüsü ölçülmeden
elendi:

| Seçenek | Sonuç |
|---|---|
| Kotlin + SurfaceView / Canvas 2D | ölçüldü |
| Kotlin + OpenGL ES (ES 2.0, elle EGL) | ölçüldü, **seçildi** |
| WebView / Capacitor sarmalayıcı | **ölçülmedi** — ürün kararıyla elendi: "native android game olsun" |

## Ölçüm yöntemi

İki aday da aynı sahneyi çizer: 54 düşman + 96 mermi (iki katmanlı tracer) + 64 kıvılcım
+ 3 şehir paralaks katmanı + oyuncu + 2 patlama + her dronda 4 rotor yayı. Toplam ~540
dörtgen. Sim `android/bench-core/Scene.kt` içinde paylaşılır: 120 Hz sabit adım, LCG,
havuz yok-tahsis. İki aday da aynı döngü şeklini kullanır (SurfaceView + kendi render
thread'i), böylece aradaki tek fark çizim API'sidir.

Kare başına **iki saat** tutulur, çünkü farklı sorulara cevap verirler:

- `cpu_ms` — sim + bütün çizim komutlarının kuyruğa verilmesi, present çağrısından
  ÖNCE durdurulur. Planın "sıcak kare ≤ 2 ms" bütçesi budur. vsync ile kırpılmaz.
- `frame_ms` — kare başlangıçları arası duvar saati. Uygulama yetiştiği sürece
  tazeleme aralığına oturur; yetişemediğinde sıçrar.

Dokunma gecikmesi `MotionEvent.getEventTime()`'dan, o parmak konumunu taşıyan karenin
present'i bitene kadar ölçülür. Panel→uygulama gecikmesi üç adayda da aynıdır ve
bilerek ölçümün dışında bırakılmıştır.

Koşum: Pixel 3a API 34 arm64 emülatörü, `-gpu host`. Aday başına 900 kare × 3 tekrar,
aşağıdaki sayılar **medyan**. İlk 30 kare (doku yükleme / shader derleme gürültüsü)
yüzdeliklerin dışında. Dokunma girdisi her koşuma aynı betikle sürülür
(`adb shell input swipe`, sabit koordinat ve süre).

### Ölçüm aracı önce kırmızı gösterildi

Planın en pahalı dersi: bir kapı ilk kez yeşil yanıyorsa, özelliği kapatıp kapının
kırmızı yandığını gör. `--ez nodraw true` ile çizim kapatılıp döngü ve sim aynen
bırakıldığında:

| koşum | cpu_p50_ms |
|---|---|
| canvas, çizim açık | 0.92 |
| canvas, `nodraw=true` | **0.05** |

`cpu_ms` gerçekten çizimi ölçüyor. Bu adım atlansaydı aşağıdaki tablo dekor olurdu.

## Ölçülen sayılar

3 tekrarın medyanı, 900 kare/koşum:

| ölçüt | canvas | gl | kazanan |
|---|---:|---:|---|
| `cpu_p50_ms` | 0.92 | **0.32** | gl |
| `cpu_p95_ms` | 1.90 | **0.72** | gl |
| `cpu_p99_ms` | 3.14 | **1.28** | gl |
| `cold_cpu_ms` (ilk kare çizim maliyeti) | 73.16 | **3.68** | gl |
| `touch_p50_ms` | 14.07 | **10.10** | gl |
| `touch_p95_ms` | 29.16 | **27.13** | gl |
| `launch_total_ms` (`am start -W`) | 566 | **350** | gl |
| `first_frame_ms` (süreç başlangıcı → ilk kare) | 535.80 | **525.79** | gl |
| `fps` | **55.45** | 50.88 | canvas |
| `dropped_frames` (>20 ms) | **87** | 161 | canvas |
| çizim çağrısı / kare | — | 9 | — |
| APK release | 3.17 MB | 3.18 MB | berabere |
| APK release, sprite yükü hariç | 0.03 MB | 0.03 MB | berabere |

Ham koşumlar `reports/android/raw/`, medyanlar `reports/android/adr-001-medians.json`.

## Karar

**OpenGL ES 2.0.** Plan karar sırasını dayatıyor:

1. **Dokunma gecikmesi** — gl kazanır (p50 10.10 ms / 14.07 ms). 60 Hz'de bu ~0.6 kare
   ile ~0.84 kare demek; ikisi de `touch_latency` bütçesinin (≤2 kare) içinde, ama
   sıra ilk ölçüte göre kesiliyor.
2. **Kare bütçesi** — gl kazanır ve arada 3 kat var. `cpu_p95` 0.72 ms'ye karşı 1.90 ms;
   plan "sıcak kare ≤ 2 ms" istiyor ve canvas bu bütçeyi p95'te zaten dolduruyor,
   üstelik bu sahne henüz boss'suz, yer birimsiz ve müziksiz. gl'de 1.28 ms'lik p99
   ile büyümeye yer var; canvas'ta 3.14 ms ile yok.
3. **APK boyutu** — berabere (30 KB fark). Ayırt etmiyor, karara girmiyor.

`cold_cpu_ms` farkı (73 ms'ye karşı 4 ms) yanıltıcı okunmamalı: canvas dokuları ilk
çizimde tembel yüklerken gl'de `loadTextures()` döngüden önce koşuyor. İki sürüm de
gerçekte bir yükleme ekranının arkasına alınır. Karara sokulmadı.

## Açık risk — bu ADR koşullu

`fps` ve `dropped_frames` sütunları diğer her şeyle **çelişiyor**: gl kare başına üç
kat az CPU harcıyor ama daha çok kare düşürüyor. Bunun tek makul açıklaması emülatörün
present yolu — macOS'ta `-gpu host` GL'i Metal'e çeviriyor ve `eglSwapBuffers` orada
stall ediyor. `cpu_ms` bu çeviriden etkilenmez, `fps` doğrudan etkilenir.

Bu yüzden:

- **Karar `cpu_ms` ve `touch_*` üzerine kuruludur** — emülatör çevirisinden bağımsız
  olan iki ölçüt bunlar.
- **`fps` / `dropped_frames` bu donanımda kanıt sayılmaz.**
- **Yapılacak:** aynı harness fiziksel bir Android cihazda koşulacak. Orada gl'in
  `dropped_frames` değeri canvas'ınkine eşit ya da altında çıkarsa ADR kesinleşir.
  Üstünde çıkarsa bu ADR yeniden açılır. `tools/android/bench.sh` cihaz farkı
  gözetmez; `adb devices` ne gösteriyorsa onda koşar.

Ölçüm emülatörde yapıldığı için mutlak sayılar cihaz performansı değildir; karara
giren şey adaylar **arası** oran.

## Sonuçlar

- `render` paketi tek bir `FrameSink` arayüzünün arkasına alınır; bu ADR tersine
  dönerse değişen tek satır `:platform` içindeki `val sink: FrameSink = ...` olur.
- Çizim çağrısı sayısı bir bütçedir. Batcher dokuya göre gruplanmazsa aynı sahne 114
  çağrıya çıkıyor ve gl **canvas'tan yavaş** oluyor (ilk ölçümde `cpu_p50` 1.93 ms).
  Gövdeler dokuya göre gruplanıp rotorlar tek geçişte çizilince 9 çağrıya indi.
  `render` paketi bir `draw_calls` kapısı taşımalı.
- `android/bench-core/Lcg.kt` **kopyalanmamalıdır**: 24 bitlik mantis ile `Float`
  döndürüyor, web'i birebir üretemez. `core-sim` LCG'si `Double` üzerinden yazılacak.

## Ölçümü tekrarlamak

```sh
./tools/android/bench_assets.sh          # sprite yükünü assets/ içinden hazırlar
cd android && gradle :bench-canvas:assembleDebug :bench-gl:assembleDebug
adb install -r -g bench-canvas/build/outputs/apk/debug/bench-canvas-debug.apk
adb install -r -g bench-gl/build/outputs/apk/debug/bench-gl-debug.apk
cd .. && ./tools/android/bench.sh gl 900 false
./tools/android/bench.sh canvas 400 true   # ölçüm aracının kırmızı koşumu
```
