# game — Oyun akışı

Dosyalar: Game.js

Sorumluluk: durum makinesi, spawn yönetimi, çarpışma, skor, HUD, menüler,
bölüm ilerlemesi, boss akışı.

NOT: Bu paket 1400 satırın üzerinde ve bölünmeye adaydır. Bölme yaparken
`src/build_order.json` güncellenmeli ve her yeni dosya tek bir sorumluluk almalı
(öneri: `Game.core.js`, `Game.spawn.js`, `Game.collide.js`, `Game.hud.js`,
`Game.menus.js` — prototip genişletme ile).

Sözleşmeler:
- Durum akışı: boot → menu → shipselect → play → pause → gameover/victory.
- Bölüm kotaları ve zorluk çarpanları `CONFIG.STAGES` tablosundadır.
- Hit-stop autotest altında devre dışıdır (determinizm testleri bozulmasın).
- `state()` harness'in tek penceresidir; yeni bir davranış eklediğinde onu
  `state()` üzerinden ölçülebilir yap.
