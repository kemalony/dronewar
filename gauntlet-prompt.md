# DRONE WAR — otonom yapım döngüsü

Şehirlerin üzerinde geçen, dikey kaydırmalı bir dron savaşı oyunu. Tek `index.html`
(HTML + CSS + JS gömülü), çerçeve yok, CDN yok. İç çözünürlük 480×800.

Bu doküman `~/projects/game` içinde 19 tur boyunca öğrenilenlerin üzerine yazıldı;
oradaki hataları tekrar etme.

---

## 0. Çalışma biçimi

Turları orkestratör (ana oturum) yönetir. Her tur:
1. Orkestratör `tasks/round_N.md` yazar ve turu başlatır.
2. Sen o görevi uygularsın, `reports/round_N.md` yazarsın, `STATE.md`'yi güncellersin.
3. Orkestratör sonucu **kendi ölçümleriyle** doğrular.

`STATE.md` 60 satırı geçmez ve turlar arası tek hafızadır. `STATE.md`'de bir
**"Orkestratör notları — geri alma"** bölümü olur; oradaki hiçbir düzeltmeyi geri alma.

Tek tur çalış, sonra dur. Rapor yazmadan bitirme.

---

## 1. Oyunun tanımı

- Oyuncu bir savaş dronu, şehrin üzerinde uçuyor, düşman dronlarla çarpışıyor.
- **Yerde hedef yok.** Şehir dekordur; sivil yapıya ateş etme, hasar mekaniği yok.
  Çatışma tamamen dron-dron.
- Dört bölüm, sırayla: **İstanbul → Paris → New York → Tokyo**. Her bölümün kendi
  zemini, binaları, bir kez geçen simge yapısı ve bölüm sonu boss'u var.

## 2. Görsel kimlik — bu oyunun ayırt edici özelliği

Piksel-art DEĞİL: varlıklar detaylı render tarzında üretildi. Buna uygun çiz:
`imageSmoothingEnabled = true`, tam sayı hizalama zorlamak yok.

**Parallaks yalpalaması (bu oyunun imzası).** Şehir üç katman:
1. zemin karosu (`city_<sehir>`) — dikey kayar,
2. binalar (`building_<sehir>_<n>`) — seyrek yerleştirilmiş, zeminden hızlı kayar,
3. bir kez geçen simge yapı (`landmark_<sehir>`).

Oyuncunun ekrandaki yatay konumu katmanları **ters yönde** kaydırır: bina ne kadar
büyük/yakınsa o kadar çok. Böylece dron yana gidince binalar eğilir ve kamera açısı
değişiyormuş gibi görünür. Kayma yumuşatılmış olmalı (ani zıplama yok).
Ek olarak: hızlı yana giderken sahne 1-2° karşı yöne yatar; boss girişinde sahne
%8 büyür (alçalma hissi), boss ölünce geri döner.

**Okunabilirlik her şeyin önünde:** ekrandaki en parlak nesneler dronlar, mermiler ve
patlamalar olmalı. Binalar oyun alanını boğmamalı — ekranda aynı anda en fazla 5-6 bina.

## 3. Varlıklar

`assets/manifest.json` hazır (32 varlık). Her girdide `width`/`height` **çizim** boyutu,
`source` ise dosyanın gerçek çözünürlüğü — varlıklar bilerek 2× saklanıyor.

- Yeni varlık gerekirse orkestratöre bildir, üretimi o yapar. Kendin
  `tools/gen_*.py` çalıştırma.
- Her çizim yolu **önce yüklenen görseli**, yoksa prosedürel yedeği kullanır — asla tersi.
- `assets/` silinince oyun tam çalışmalı (her şeyin prosedürel yedeği olacak).

## 4. Mimari

`Clock`, `Input`, `Assets`, `Renderer`, `Pool<T>`, `Player`, `Bullet`, `Enemy`, `Boss`,
`CityScroller`, `Game` (boot → menu → play → pause → gameover/victory).
Tüm sabitler tek bir `CONFIG` nesnesinde. `?debug=1` FPS, kare süresi, varlık sayıları,
`drawImage`/`save` sayaçları ve hitbox'ları gösterir.

Sabit adımlı sim (120 Hz akümülatör) + interpolasyonlu çizim. `dt = min(rawDt, 1/30)`.
Determinizm şart: aynı girdi, iki farklı kare hızında **birebir aynı** pozisyon.

## 5. Kontrol

- Klavye: oklar/WASD, Space/Z ateş, P duraklat, Esc menü. `e.repeat` yok sayılır.
- Dokunmatik: **birebir parmak takibi** — parmağın kaydığı kadar dron kayar
  (`game/`'de doğrulanmış tasarım), coarse cihazlarda otomatik ateş.
  Gerçek pointer yolu ile autotest kancası **aynı giriş noktasını** çağırmalı.

## 6. Performans — bunlar pazarlık konusu değil

`game/` bu duvara defalarca çarptı, hazır cevaplarla başla:

- **Uyarlanabilir çözünürlük.** Arka bellek `min(css × dpr, iç çözünürlük × ölçek)`;
  ölçek son 40 karenin medyanına göre 1× ile 2× arasında oynar (medyan > 20 ms → düş,
  < 17.2 ms → çık, saniyede en fazla bir değişiklik). Eşikler kare ARALIĞI olduğu için
  60 Hz'de taban 16.7 ms — "hızlı" eşiğini bunun altına koyma.
- **Boyut başına canvas önbelleği YASAK.** Büyüyen bir efektin her karesi yeni bir
  canvas doğurur; bu tahsis fırtınası nadir 50-80 ms'lik karelerin sebebiydi.
  Ölçeklemeyi `drawImage`'in hedef boyutuna bırak.
- **Parçacıklar gruplu çizilir.** Renk ve alfa kovasına göre grupla, grup başına tek
  `beginPath` + tek `fill`. Parçacık başına `drawImage` yapma.
- Aynı karışım modundaki nesneleri tek `save`/`restore` bloğunda çiz.
- Çizim yolunda kare başına nesne tahsisi yok (yeniden kullanılan tamponlar).
- Vuruş parlaması: sprite'ın **önceden beyaz tint'lenmiş kopyası**. `source-atop` +
  `fillRect` kullanma — tuvalin tamamına göre çalışır ve ekrana dikdörtgen bırakır.

## 7. Test koşumu — `tools/evaluate.py`

Playwright ile `index.html?debug=1&autotest=1`, 16.67 ms ve 6.94 ms adımlarında.
`autotest=1` `window.__game` üzerinden `tick`, `press`, `release`, `state` ve test
kancalarını açar. Assertion'lar:

- iki kare hızında pozisyon farkı 0.0000 px, sınır ihlali 0, konsol hatası 0
- havuz tükenmesi yok, heap artışı yok
- `assets_used`: `file://` altında yüklenen PNG sayısı = manifest girdisi sayısı.
  **0 PNG = tur başarısız.** Bu kapı `tools/assets_check.py` ile turdan önce de koşar.
- `parallax_lean`: oyuncu sağa/sola gittiğinde bina katmanının ofseti ters yönde
  değişir ve iki kare hızında aynı olur
- `perf_heavy`: boss + ≥ 20 düşman + sürekli ateş, **gerçek rAF** ile 300 kare;
  medyan ≤ 20 ms, 50 ms üstü kare 0. Tek JS görevinde tick çevirerek ölçme —
  öyle ölçünce tarayıcı rasterizasyonu sahte sıçrama gösterir.
- Vision denetimi: her tur 5+ kare, `polish_score >= 8`, blocking 0.

**Testin kendisinden şüphelen.** `game/`'de takılan iki assertion'ın ikisi de testin
hatasıydı (ateş aralığından uzun basılı tutma, bir kaydırılmış beklenti). Bir test
turlar boyunca aynı sonucu veriyorsa önce testi denetle.

## 8. Yol haritası

| Tur | Kapsam |
|---|---|
| 1-2 | Motor, dt döngüsü, girdi, dron ataleti, mermiler, varlık yükleme, test koşumu |
| 3-4 | Şehir kaydırıcı: üç katman + parallaks yalpalaması + bölüm geçişi |
| 5-6 | Düşman tipleri (3), spawn yönetimi, çarpışma, parçacık, patlama, skor + HUD |
| 7-8 | Boss (fazlar), füze/ikincil silah, zorluk eğrisi |
| 9-10 | Ses (WebAudio, prosedürel), sarsıntı, hit-stop, menüler, duraklatma, game over |
| 11+ | Yalnızca değerlendirici bulgularıyla cila |

Sonraki turun özelliğini erken yazma. Tamamlanmamış kod, TODO, stub bırakma.

## 9. Bitiş

Yol haritası bittikten **sonra** üst üste üç temiz tur geçince `STATE.md` içine tek
başına `DONE_ALL` satırını yaz. Bu kelimeyi başka hiçbir yerde geçirme — prose içinde
geçirmek döngüyü erken durdurur (bu `game/`'de yaşandı).
