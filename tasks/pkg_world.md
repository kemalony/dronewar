# world paketi — Round 16: LİMAN zemini (5. bölüm)

Oyuna beşinci bölüm giriyor: `city: 'port'`. İki yeni zemin karosu üretildi ve
manifest'e girdi: **`city_port`** ve **`city_port_b`** (konteyner limanı, gece,
tam tepeden; geniş boş apronlar ve düz servis yolları var — kara hedefleri oraya
oturacak). Karo A/B döngüsü zaten genel kod; senin işin 'port'u tanıtmak.

Yalnızca `src/world/` altına yaz.

## 1. `CityScroller._catalog()` — 'port' şehri
Şu an katalog döngüsü `['istanbul','paris','newyork','tokyo']` dizisi üzerinde.
`'port'` bu listeye girmeli, **ama**:
- Limanın **binası yok** (building_* varlığı yok) → `buildings: []`.
- Limanın **simge yapısı yok** → `landmark: ''`. `landmarkShown` bu bölümde hiç
  true olmamalı; simge yapı kartı bölüm kartında da gösterilmemeli.
Liste sabitini `CONFIG.STAGES`'ten türetmen en temizi (`CONFIG.STAGES.map(s => s.city)`),
böylece ileride bölüm eklendiğinde burayı kimse unutmaz.

`this['city_' + name]` kaydı **mutlaka oluşmalı** — yoksa `setCity('port')`
sessizce İstanbul'a düşer ve liman hiç görünmez. Bu turun en kritik satırı bu.

## 2. Karo A/B
`draw()` içindeki A/B mantığı zaten `city_<ad>` + `city_<ad>_b` arıyor; liman
karoları bu adlandırmaya uyuyor, ek kod gerekmez. Sadece doğrulanabilir olsun:
`tileBLoaded` durumu limanda da true olmalı (game paketi state()'te açıyor).

## 3. Bulutlar
Liman deniz kıyısı: bulut katmanı aynen çalışsın, ek iş yok.

## 4. Yapma
- Zemin karolarını kodda koyulaştırma/aydınlatma (üretimde yapıldı).
- Kara hedeflerini world paketine koyma — onlar `units` paketinde.
- `CityScroller.dist` anlamını değiştirme: kara hedefleri ekran konumunu
  `worldY - city.dist` ile hesaplayacak, yani `dist` birimi ve akışı aynen kalmalı.
