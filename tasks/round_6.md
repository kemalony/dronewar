# Round 6 — vuruş geri bildirimi, patlamalar, düşman ayrımı

Round 5 (orkestratör tamamladı): **13 PASS / 1 FAIL**. Düşmanlar çalışıyor
(`enemy_types` hp/puan doğru, `enemy_determinism` birebir aynı), mermi kontrastı
ölçülür hâle geldi ve geçiyor. Kalan tek kırmızı öznel `vision_polish`.

## A. Düşmanlar birbirinden ayrılsın

Orkestratörün ekran görüntüsünde üç düşman tipi de benzer görünüyor: hepsi cyan
halkalı, oyuncu dronuyla da karışıyorlar. Ayrım renkten gelsin:
- `scout` — soğuk gri gövde, ince **kırmızı** kenar ışığı
- `gunner` — **turuncu** kenar ışığı, altında namlu parlaması
- `shield` — kalkan varken **mavi kabarcık**, kalkan kırılınca kabarcık söner
- Oyuncu **cyan** kalır ve tek "hâle"si olan o olsun; düşmanlarda hâle yok.
Amaç: bir bakışta kimin ne olduğu anlaşılsın.

## B. Vuruş geri bildirimi ve patlamalar

`game/` projesinde çalıştığı doğrulanmış üç katmanlı yaklaşımı kullan — flipbook DENEME,
orada başarısız oldu (kareler tutmuyor, animasyon zıplıyor):
- **Parlama:** isabet anında düşman sprite'ının önceden beyaz tint'lenmiş kopyası,
  ~90 ms, alfayla söner. `globalCompositeOperation='source-atop'` + `fillRect` KULLANMA
  — tuvalin tamamına göre çalışır ve ekrana dikdörtgen bırakır (game/'de yaşandı).
- **Patlama:** üç katman kodda canlandırılır — beyaz çekirdek parlaması (~110 ms),
  turuncu ateş topu (~260 ms, her patlamada rastgele döndürülmüş, `lighter`),
  duman (gecikmeli, zayıf, normal karışım). Ateşin sönümü **doğrusal değil**
  `(1-t)^2.8` olsun; doğrusal sönüm `lighter` altında beyaz çekirdeği griye çevirip
  patlamayı zeytin rengi bir topa dönüştürüyor.
- **Şok dalgası:** ince halka, yarıçap ≤ 34 px, ömrü ≤ 190 ms, karesel sönüm.
  Uzun ömürlü/geniş halka ekranda "alakasız daire" olarak okunuyor.
- **Kıvılcımlar:** havuzdan, renk ve alfa kovasına göre **gruplu** çizim
  (grup başına tek `beginPath` + tek `fill`). Parçacık başına `drawImage` yapma.
- Patlama başına parçacık ≤ 14, aynı anda çizilen parçacık ≤ 110.

## C. Kalkan testi

`shield_absorb`: kalkan 3 vuruş emsin, 4. vuruştan itibaren gövde hasar alsın.
3 kalkan + 3 can = 6 vuruşta ölüm, yani en fazla **5 örnek canlı** kalabilir
(6 canlı beklemek bir kaydırılmış olur). Atış aralığı 130 ms olduğu için basılı tutma
süresi bundan KISA olmalı — uzun tutmak örnek başına iki mermi çıkarır.

## Kabul

- `assets_check.py` VERDICT=PASS (32/32), satırı raporda ver
- Mevcut 14 assertion + `shield_absorb` PASS, konsol hatası 0
- `enemy_determinism` ve `determinism_2fps` bozulmayacak (patlama/parçacık yalnız çizim)
- `perf_heavy` medyan ≤ 20 ms, 50 ms üstü kare 0
- TODO/FIXME/stub yok

## Süreç

Raporu harness yazıyor. `STATE.md`'yi kısa tut. Aynı aracı aynı argümanlarla
tekrarlama, dosyaları gereksiz yeniden okuma (tur başına araç çağrısı sınırı var).
