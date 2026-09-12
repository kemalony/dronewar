# tasks/pkg_android_harness — R1

## Bu turdaki TEK iş

Altın izi okuyup `:core-sim`'i sürecek ve bit-bit karşılaştıracak ölçüm modülünü kur.
`:harness` kapıların yaşadığı yerdir; portun her iddiası bu karşılaştırıcı kadar
sağlamdır.

## Bitiş tanımı

1. iz okuyucu: gzip'li NDJSON, `f64:0x…` çözümü bit-bit doğru
2. betik sürücüsü: olaylar **adım indeksine** göre uygulanır, duvar saatine göre değil
3. `ParityTest`: 720/720 adım, `doubleToRawLongBits` ile, 0 uyuşmazlık
4. çatal mesajı: adım indeksi + alan adı + **iki değer de hex**
5. `DeterminismTest`: 1 adım/tick ve 2 adım/tick bit-bit aynı
6. tahsis sayacı: `advance()` başına 0 nesne

## Intent (ICM)

"Çatallanan adım; adım indeksi, alan adı ve iki hex değerle raporlanıyor."

## Kapatan kapılar

`parity`, `determinism`

## Yasak

Tolerans yok. `1e-9` epsilon bu kapıyı anlamsız kılar. `android/harness/golden/`
altına yazmak yasaktır — ölçüldüğün cetveli eğemezsin.
