# Round 10 — pervaneler, bulutlar, silah yükseltmesi, zengin patlama

Kullanıcı geri bildirimi (beş madde). Yeni varlıklar üretildi ve manifeste işlendi
(**39 varlık**): `cloud_wisp`, `cloud_puff`, `pu_weapon`, `pu_shield`,
`boom_flash`, `boom_fire`, `boom_smoke`. Yeni varlık ÜRETME.

## 1-2. Pervaneler dönsün (oyuncu, düşmanlar VE boss)

Rotor diskleri sprite'ın içine çizili, yani sprite'ı döndüremeyiz. Rotorun
**üstüne** dönen bir efekt çiz:
- Her rotor merkezinde: iki ince yay (arc), zıt yönde, `lighter` karışımıyla,
  açı `simTimeMs`'e bağlı (yalnız çizim, sim'e dokunmaz).
- Dönüş hızı ~18 rad/s; oyuncu hızlandıkça %30'a kadar artsın.
- Rotor merkezleri sprite geometrisine göre `CONFIG` tablosunda dursun
  (sihirli sayı gömme): `drone_player` 4 köşe, `drone_scout` 4, `drone_gunner` 6,
  `drone_shield` 8, `boss_gunship` 2 büyük halka.
- Boss'un iki büyük rotor halkası da dönsün, yarıçapı büyük olduğu için daha yavaş.
- Rotorun altında çok hafif bir bulanıklık halkası (alfa ≤ 0.18) — disk hissi.

## 3. Silah yükseltmesi

Üç seviye, `CONFIG.WEAPON` tablosunda:

| Seviye | Mermi | Aralık | Desen |
|---|---|---|---|
| 1 | 1 | 130 ms | düz |
| 2 | 2 | 115 ms | ±14 px **paralel** |
| 3 | 3 | 100 ms | ±26 px paralel |

Mermiler **açılı değil paralel** olsun — açılı yelpaze `game/` projesinde kullanıcı
tarafından iki kez "yamuk mermi" diye bildirildi.

- `pu_weapon` kapsülü: düşman ölümlerinde %12 olasılıkla düşer (LCG'den, `Math.random()`
  yok), aşağı süzülür, alınınca seviye +1 (max 3). Seviye 3'te alınırsa 500 puan.
- `pu_shield`: 6 saniye hasar emen kalkan; oyuncunun etrafında ince halka.
- Oyuncu can kaybedince silah seviyesi 1 azalır (min 1).
- HUD'da `SİLAH 1..3` ve kalkan kalan süresi.

## 4. Bulutlar

`cloud_wisp` ve `cloud_puff` ile ince bir bulut katmanı:
- Şehrin **üstünde**, dronların **altında** çizilir.
- Zeminden hızlı kayar (paralaks: zemin 120, bulut ~185 px/s) — yükseklik hissi.
- Aynı anda en fazla 3 bulut, alfa 0.30-0.55 arası, yavaşça yatay sürüklenme.
- Yerleşim LCG ile deterministik; iki kare hızında birebir aynı.
- Oyun alanını boğmasın: bulut altındaki düşman hâlâ okunmalı.

## 5. Zengin patlama

`game/` projesinde doğrulanan üç katman + şok dalgası + kıvılcım. **Flipbook deneme.**
- `boom_flash` — `lighter`, 110 ms, ölçek 0.4→2.0, alfa 1→0
- `boom_fire` — `lighter`, 260 ms, ölçek 0.55→2.1, her patlamada rastgele döndürülmüş,
  alfa sönümü **`(1-t)^2.8`** (doğrusal sönüm beyaz çekirdeği griye çevirip patlamayı
  zeytin rengi bir topa döndürüyor)
- `boom_smoke` — normal karışım, 210 ms gecikmeli, 560 ms, alfa ≤ 0.16, hafif yukarı sürüklenir
- Şok dalgası: ince halka, yarıçap ≤ 34 px, ömür ≤ 190 ms, karesel sönüm
  (uzun ömürlü/geniş halka ekranda "alakasız daire" olarak okunuyor)
- Kıvılcım: patlama başına ≤ 14, renk+alfa kovasına göre **gruplu** çizim
  (grup başına tek `beginPath` + tek `fill`); parçacık başına `drawImage` YOK
- Boss ölümü: 6 patlama 500 ms içinde + kısa ekran parlaması

## Testler (mevcut 27'ye ekle)

- `rotor_spin`: iki farklı sim anında rotor açısı farklı olsun; **iki kare hızında
  aynı sim süresinde aynı açı** (yalnız çizim ama determinizmi bozmamalı).
- `weapon_levels`: seviye 2'de tek atışta 2, seviye 3'te 3 mermi; hepsi açı 0.
- `powerup_pickup`: `pu_weapon` alınca seviye artar, can kaybedince azalır.
- `clouds_deterministic`: 240 kare sonunda bulut konumları iki kare hızında birebir aynı.
- `explosion_layers`: bir patlama sırasında flash/fire/smoke katmanlarının her biri
  en az bir kare çizilir (çizim sayacı ile).
- `perf_heavy` bozulmayacak: medyan ≤ 20 ms, 50 ms üstü kare 0.

## Geri alma yasağı

- Ekran görüntüsü yolu oyunun **gerçek** çizimidir (`_drawWorldNoHud` → `_drawWorld`);
  karartma/vinyet ekleme.
- Bina sprite katmanı yok; açı hissi karo zoom+kaydırmasından gelir.
- Dokunmatik: dokun→başlat, birebir bağıl takip, otomatik ateş; `_activePointer`
  `null` başlar, korumalar `== null`; `Player.update` dokunmatik dalında `return` etme.
- Nişan çerçevesi vektör çizilir (sprite ölçeklemesi bulanıktı).
- Dronun koyu hâlesi güçlendirilmiş halde kalsın.
