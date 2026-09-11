# Round 2 — Round 1'in açıkları: determinizm, görünmeyen dronlar/mermiler, HUD

Round 1 raporsuz bitti (qwen döngü koruması durdurdu). `index.html` ve `tools/evaluate.py`
yazılmıştı; orkestratör testleri kendisi koşturdu: **6 PASS / 2 FAIL**.

## Orkestratörün ölçümü — başlangıç noktan bu

Geçenler: `assets_used` 32/32, konsol hatası 0, sınır ihlali 0, ateş sayısı 38/5sn,
havuz tükenmesi yok, `perf_heavy` medyan 0.30 ms.

Kalanlar:

1. **`determinism_2fps` FAIL** — iki kare hızı arasında **101. karede 191.1 px** fark.
   En kritik madde. Sim'de kare hızına bağlı bir şey var: interpolasyon değerinin
   simülasyona geri beslenmesi, `dt`'nin doğrudan konuma uygulanması, ya da
   `Math.random()`/`performance.now()` kullanımı. Sim tamamen sabit adımlı olmalı;
   `alpha` yalnızca çizimde kullanılmalı.

2. **Dronlar ve mermiler EKRANDA GÖRÜNMÜYOR** (vision, 5 karenin 4'ünde):
   > "sahnede dronlar ve mermiler gorunmemektedir"
   > "mermilerin sayisi 47/96 gosteriliyor ancak mermiler gorunmuyor"
   Sayaçlar artıyor demek ki sim çalışıyor — sorun çizimde. Oyuncu dronu ekranın
   köşesinde "simge gibi" duruyor, oyun alanına girmiyor.
   Çiz: oyuncu dronu (alt orta, `drone_player`), mermiler (`muzzle_flash` ile),
   ve bu turda **düşman dronu yok** — Round 5'in işi, erken yazma.

3. **HUD ham teknik metin.** `?debug=1` panelinde kalması gerekenler (FPS, draw, save)
   oyun ekranına karışmış. Ayır: oyun HUD'u (skor, can) ayrı ve okunur olacak;
   teknik sayaçlar yalnız `?debug=1` altında görünecek.

## Orkestratörün yaptığı düzeltmeler — geri alma

- **Şehir karoları yeniden üretildi**, ortalama parlaklık 34 → **62**. 34 fazla karanlıktı,
  vision 3 veriyordu; şimdi 7-9. Karoları tekrar koyulaştırma; ön plan kontrastını
  dronları parlak çizerek sağla, şehri karartarak değil.
- **`tools/evaluate.py`'nin vision denetimi artık GEREKÇE istiyor** (sadece sayı değil).
  Bu sayede yukarıdaki bulgular ortaya çıktı. Bu davranışı koru.

## Kabul

- `python3 tools/assets_check.py` → `VERDICT=PASS` (32/32), satırı raporda ver
- `determinism_2fps` dahil **8/8 assertion PASS**
- Vision: her karede `polish_score >= 8`, `blocking = 0`, ve notlarda "dron görünmüyor"
  ya da "mermi görünmüyor" benzeri bir şikayet KALMAYACAK
- `assets/` silinince prosedürel çizimle çalışır
- TODO/FIXME/stub yok

## Not

Aynı aracı aynı argümanlarla üst üste çağırma — Round 1 bu yüzden yarıda kesildi.
Bir şey işe yaramıyorsa yaklaşımı değiştir, tekrarlama.
