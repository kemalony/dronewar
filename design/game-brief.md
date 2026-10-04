# Game Brief: Drone War

**One-sentence pitch:** Gerçek şehir fotoğraflarının üstünde geçen, tek parmakla oynanan dikey kaydırmalı dron savaş oyunu — parmağını sürükle, dron taksın, gerisini otomatik ateş halleder.

## Core loop
- Parmağı ekranda sürükleyerek dronu kaçır; parmak ekrandayken otomatik ateş edersin.
- Düşman dalgalarını temizle → skor + kombo çarpanı büyür → powerup düşer (silah seviyesi, roket, kalkan, refakatçi dron, onarım).
- Bölüm kotası dolunca boss çıkar; boss ölünce sonraki şehir. 5. bölümde (liman + kara hedefleri) taşıyıcı gemi finali.
- Koşu biter → en yüksek skor saklanır, skorla kilitli yeni dronlar açılır → tekrar.

## Player goal & fail state — what "working" looks like
5 bölümü temizleyip VICTORY ekranına ulaşmak (5–12 dk'lık koşu). Can 3 (tank dronda 5); hasar alınca silah seviyesi 1'e düşer. Canlar bitince game over + rekor kaydı. "Çalışıyor" = bir koşu boyunca kontrolün adaletli geldiği hissi: ölen her oyuncu "benim hatamdı" diyebilmeli.

## MVP — what must exist to be the game
- Sabit adımlı (120 Hz) deterministik sim + göreceli dokunmatik takip + otomatik ateş
- 3 düşman tipi (scout/gunner/shield) + çarpışma + skor
- Kombo çarpanı ve can/hit feedback (parlama, patlama, sarsıntı)
- 1 şehir bölümü + bölüm sonu boss'u, menü/duraklat/oyun sonu akışı

## Out of scope — not building this
Multiplayer/PvP, açık dünya, mikro ödeme, online hesap/liderlik tablosu, fizik motoru entegrasyonu, gündüz-gece döngüsü, hikaye anlatımı (yalnız ortam teması).

## Build order
1. Sim + input (determinizm çıtası gün 1'de)
2. Düşman tipleri + çarpışma
3. Skor/kombo + akış (menü → oyun → game over)
4. Boss + bölüm geçişi
5. Cila: FX, ses, HUD okunabilirliği

---
**Who it's for / what they feel:** Tek elle, kısa oturumlu mobil shooter hayranları; "akışkan ve öngörülebilir ama affetmeyen, geri bildirimi şiddetli" hissi.

**Visual touchstones:** Gerçek gece şehir fotoğrafı üstünde neon efektli oyuncak-scale dronlar — fotoğraf-realite × arcade efekt dili.

**MVP success criteria:** 5 saniyelik kavram testi — oyuncu tek parmakla dronu kaçırdığını, ateşi kendiliğinden aktığını ve kaybetmenin kendi hatası olduğunu söyleyebilmeli.