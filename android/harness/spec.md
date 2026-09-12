# :harness — spec (R1)

Ölçüm koşumu. Kapılar burada yaşar. `:harness` saf JVM modülüdür.

## Kapsam — R1

- Altın izi (`android/harness/golden/trace_player.ndjson.gz`) okur
- `:core-sim`'i izin girdi betiğiyle sürer
- Her adımda `x/y/vx/vy` değerlerini `doubleToRawLongBits` ile karşılaştırır
- İlk çatalı adım indeksi + alan adı + iki hex değerle raporlar

## Kabul kriterleri

1. **AC-1 — iz okuyucu.** Gzip'li NDJSON okunur; başlık satırı ayrı, 720 veri
   satırı ayrı. `f64:0x…` çözümü bit-bit doğru: her satır için
   `doubleToRawLongBits(decode(hex)) == java.lang.Long.parseUnsignedLong(hex, 16)`.

2. **AC-2 — betik sürücüsü.** Başlıktaki `script[]` dizisi adım indeksine göre
   uygulanır. Tick boyutu başlıktaki `tickMs`. Duvar saati kullanılmaz.

3. **AC-3 — parity raporu.** `ParityTest` 720/720 adımda 0 uyuşmazlıkla geçer.

4. **AC-4 — çatal mesajı ölçülebilir.** İz kasıtlı bozulduğunda test **düşer** ve
   mesaj bozulan adımın indeksini, alan adını ve iki hex değeri içerir. Bu, kapının
   kendisi test edilir: gate betiği izin bir adımını 1 ulp kaydırır, testin
   düştüğünü ve doğru adımı adlandırdığını görür, geri alır.

5. **AC-5 — determinism koşumu.** Aynı betik tick başına 1 ve 2 sim adımıyla
   sürülür; adım indeksi başına konumlar bit-bit aynı.

6. **AC-6 — tahsis sayacı.** `advance()` çağrısı başına ayrılan nesne sayısı
   ölçülür ve 0 olduğu doğrulanır.

## Kapsam dışı

Cihaz testi, ekran görüntüsü, vision. R1 tamamen JVM üstünde koşar.
