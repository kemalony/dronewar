# Round 11 — bulut yönü ve çeşitliliği, boss pervaneleri, şehre özel boss, karo çeşitliliği

Kullanıcı geri bildirimi (9 madde). Bu tur 1, 2, 3, 5 ve 9. maddeler; 4, 6, 7, 8
Round 12'ye. Yeni varlıklar üretildi ve manifeste işlendi — **60 varlık**.
Yeni varlık ÜRETME.

## 1. Bulutlar ters yöne kaysın (hata)

Şu an bulutlar dronla **aynı yönde** gidiyor; bu, yükseklik hissini yok ediyor.
Doğrusu: oyuncu sağa gidince bulutlar sola kaymalı ve bu kayma zeminden **daha
güçlü** olmalı (bulut daha yakın).
- zemin yatay kayma katsayısı 30 px ise bulut ~70 px olsun, **ters işaretli değil
  aynı işaretli hata var — kontrol et ve düzelt**.
- Dikey: zemin 120 px/s, bulut ~185 px/s (aşağı doğru, dron ileri uçuyor).

## 2. Bulut çeşitliliği

Altı bulut var: `cloud_a`…`cloud_f`. Havuzdan LCG ile seç, her doğuşta farklı
ölçek (0.7-1.3), farklı alfa (0.28-0.55) ve hafif yatay sürüklenme. Aynı bulut
arka arkaya iki kez seçilmesin.

## 3. Boss pervaneleri

Boss'un pervane efekti kötü görünüyor ve halkaların **içi** dönmüyor. Boss rotorları
büyük kanallı halkalar; efekt halkanın **iç çapına** otursun:
- Her boss için rotor merkezleri ve iç yarıçapları `CONFIG.BOSSES[...].rotors`
  tablosunda dursun.
- Efekt: iç yarıçapın %85'inde 3 ince yay, zıt yönde iki katman, `lighter`.
- Büyük halka daha yavaş dönsün (~10 rad/s), küçük olan hızlı.
- Halka içinde hafif bir dönen bulanıklık dolgusu (alfa ≤ 0.15) — disk hissi.

## 5. Her bölüme ayrı boss

| Bölüm | Sprite | Can |
|---|---|---|
| 1 İstanbul | `boss_gunship` | 60 |
| 2 Paris | `boss_paris` | 90 |
| 3 New York | `boss_newyork` | 120 |
| 4 Tokyo | `boss_tokyo` | 160 |

Desenler mevcut kademeli yapıda kalsın; yalnız sprite ve can bölüme göre gelsin.
Hasar karesi için sprite'ın önceden beyaz tint'lenmiş kopyası kullanılsın.

## 9. Şehir görselleri tekrar etmesin

Her şehir için ikinci karo üretildi: `city_<sehir>_b`. Dikey döngüde iki karo
**sırayla** dizilsin (A, B, A, B…) — böylece tekrar aralığı iki katına çıkar ve
aynı görüntü peş peşe gelmez. Geçiş dikişsiz olmalı (karo yükseklikleri eşit).

## Testler (mevcut 32'ye ekle)

- `cloud_parallax`: oyuncu sağa giderken bulut ofseti **sola** gitsin ve mutlak
  değeri zemin ofsetinden büyük olsun.
- `cloud_variety`: 12 bulut doğuşunda en az 4 farklı sprite kullanılsın.
- `boss_variants_sprite`: dört bölümün boss sprite'ı ve canı doğru gelsin.
- `tile_alternation`: dikey döngüde A ve B karolarının ikisi de çizilsin.
- Mevcut determinizm ve `perf_heavy` testleri bozulmayacak.

## Geri alma yasağı

- Ekran görüntüsü yolu oyunun **gerçek** çizimidir; karartma/vinyet ekleme.
- Bina sprite katmanı yok; açı hissi karo zoom+kaydırmasından gelir.
- Dokunmatik: dokun→başlat, birebir bağıl takip, otomatik ateş; `_activePointer`
  `null` başlar, korumalar `== null`; `Player.update` dokunmatik dalında `return` etme.
- Nişan çerçevesi vektör çizilir; dronun koyu hâlesi güçlendirilmiş halde kalır.
- Mermiler paralel (açılı yelpaze "yamuk mermi" olarak bildirildi).
