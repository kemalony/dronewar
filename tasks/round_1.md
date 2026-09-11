# Round 1 — motor, girdi, dron, mermiler, varlık yükleme, test koşumu

Yol haritası tur 1-2 kapsamı. Sonraki turların özelliğini yazma.

## Yapılacaklar

1. **`index.html`** — tek dosya, iç çözünürlük 480×800, CSS ile pencereye sığdırılmış,
   koyu bir çerçeve. `CONFIG` en üstte, tüm sabitler orada.
2. **Sınıflar:** `Clock` (120 Hz akümülatör + interpolasyon), `Input`, `Assets`,
   `Renderer`, `Pool`, `Player`, `Bullet`, `Game` (boot → menu → play → pause → gameover).
3. **Dron uçuşu** — helikopter hissi, uçak değil:
   - maks hız 400 px/s, ivme 2200 px/s², girdi yokken yarı ömrü 0.12 s üstel sönüm
     (dron biraz "kayar", bu bilinçli)
   - çapraz normalize, hitbox ekran içinde kalır, temasta o eksenin hızı sıfırlanır
   - hafif yalpa: yatay hıza bağlı ±6° görsel eğim (yalnız çizim)
4. **Ateş:** Space/Z, 130 ms aralık, mermi 850 px/s yukarı, havuz 96, sıcak döngüde `new` yok.
   Namlu ucunda `muzzle_flash` 60 ms.
5. **Varlık yükleme:** manifest `index.html` içine `const MANIFEST` olarak GÖMÜLÜ olacak
   (`fetch` etme — `file://` altında bloklanır ve oyun sessizce prosedürel yedeğe düşer;
   bu `game/`'de yedi tur boyunca fark edilmedi). PNG'ler `new Image()` ile yüklenir,
   `onerror` → prosedürel yedek. `assets/manifest.json` ile gömülü kopya birebir aynı olmalı.
6. **Çizim:** şimdilik sadece `city_istanbul` zemini dikey kayıyor + oyuncu dronu +
   mermiler + namlu alevi. Binalar ve parallaks Round 3'te.
7. **`tools/evaluate.py`** — bölüm 7'deki koşum: iki kare hızı, determinizm, sınır,
   ateş sayısı, havuz, konsol, `assets_used`, `no_fetch_failures`; 5 ekran görüntüsü +
   vision denetimi.
8. **Uyarlanabilir çözünürlük** bölüm 6'daki gibi bu turda kurulsun (sonradan eklemek zor).

## Kabul

- `python3 tools/assets_check.py` → `VERDICT=PASS`, satırı raporda ver
- Tüm assertion'lar iki kare hızında PASS, konsol hatası 0
- `assets/` silinince oyun prosedürel çizimle çalışır
- Vision: her karede `polish_score >= 8`, blocking 0
- TODO/FIXME/stub yok
