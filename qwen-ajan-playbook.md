# Qwen Ajan Playbook — üret, düzenle, gör

Ajanların **iş yapmak** için okuyacağı dosya. Üç yetenek:

| Yetenek | Model | Fonksiyon | Süre |
|---|---|---|---|
| Görsel üretimi | Qwen-Image-2512 | `generate()` | 1024² için ~5–32 sn |
| Görsel düzenleme | Qwen-Image-Edit-2511 | `edit()` | ~30 sn |
| Görsel anlama | qwen3.6-35b-a3b-nvfp4 | `look()` / `verify()` | 0,5–2 sn |

Parametre tabloları ve düşük seviye HTTP ayrıntıları için:
`/home/synapso/ai-inference/docs/qwen-agent-kullanim.md`. Bu dosya reçetelerdir.

---

## 0. Kurulum

Tek dosyalık istemci, stdlib dışında bağımlılığı yok:

```python
import sys; sys.path.insert(0, "/home/synapso/projects")   # veya /home/synapso/ai-inference/scripts
from qwen_agent import generate, edit, look, verify, refine, health
```

İstemcinin kopyası bu klasörde: `/home/synapso/projects/qwen_agent.py`
(aslı `/home/synapso/ai-inference/scripts/qwen_agent.py`). Bu klasörde
çalışan ajanlar için `import qwen_agent` doğrudan çalışır.

Sağlık kontrolü — **her iş öncesi çalıştırın**:

```python
health()
# {'image': {'status': 'ok', 'gpu': {'locked': False, ...}},
#  'vision': ['qwen3.6-35b-a3b-nvfp4']}
```

Adresler ortam değişkeniyle ezilebilir: `QWEN_IMAGE_API`
(varsayılan `http://10.40.72.31:30437`), `QWEN_VISION_API`
(varsayılan `http://10.106.233.184:8002/v1`).

İstemci GPU meşguliyetini (`503`) kendisi yönetir: `retry_after` kadar bekleyip
4 kez yeniden dener. Ajanın ayrıca retry yazmasına gerek yok.

---

## 1. Hangi araç ne zaman

| İhtiyaç | Yap |
|---|---|
| Sıfırdan görsel | `generate(prompt, style=..., size=...)` |
| Var olan görselde değişiklik | `edit(img, "talimat")` — yeniden üretme, kompozisyon korunur |
| "Bu görselde ne var?" | `look(img, soru)` |
| "Bu görsel brief'e uyuyor mu?" | `verify(img, brief)` → JSON |
| Otomatik kalite döngüsü | `refine(prompt, brief)` |
| Renk/nesne/stil değişimi | `edit` (üretimden **çok daha** tutarlı) |
| Ölçü/oran değişimi | `generate` (edit çözünürlüğü yeniden yorumlar) |

---

## Reçete 1 — Görsel üret

```python
g = generate(
    "a wooden treasure chest with iron bands, closed lid",
    style="item",      # asset|icon|app_icon|ui|sprite|item|portrait|splash|background|comic|raw
    size="icon",       # icon|thumb|portrait|landscape|banner|splash|wide|comic|2:3
    seed=42,           # tekrarlanabilirlik için sabitleyin
    out="chest.png",
)
g["seed"]         # 42
g["prompt_sent"]  # stilin sarmaladığı GERÇEK prompt — sonucu buna göre değerlendirin
```

**Stil prompt'unuzu sarmalar.** `style="item"` gönderdiğinizde modele giden metin
sizin cümleniz değil, stil şablonuna gömülmüş halidir. Ham prompt istiyorsanız
`style="raw"`.

`steps` göndermeyin — istemci 4'te sabitler. Lightning LoRA 4 adım için
damıtılmıştır; artırmak kaliteyi yükseltmez, işi kat kat yavaşlatır.

---

## Reçete 2 — Görseli düzenle

```python
e = edit("chest.png",
         "open the lid and fill the chest with gold coins, keep everything else identical",
         out="chest_open.png")
```

Varsayılan `style="raw"`: talimat modele **olduğu gibi** gider. Bu bilinçli bir
seçim — düzenlemede stil sarmalaması talimatı bozar.

Talimat yazma kuralları:

- İngilizce yazın, tek bir değişiklik isteyin
- Her zaman `keep everything else identical` ekleyin — kompozisyon korunur
- Neyin değişeceğini adlandırın: *"change the flower color from red to bright yellow"*,
  *"replace the background with a night sky"*

Kanıt: 1024² bir ikonda *"change the flower color from red to bright yellow,
keep everything else identical"* → yalnız çiçek değişti; poz, kontur, gölge,
arka plan aynı kaldı.

Üç referans görselle (Edit-Plus):

```python
e = edit("karakter.png",
         "put the character from image 1 into the environment of image 2",
         extra_images=["ortam.png"])   # image, image2, image3 — en fazla 3
```

---

## Reçete 3 — Görseli anla

```python
look("chest.png", "Bu gorselde ne var? Tek cumle.")
look(["once.png", "sonra.png"], "Iki gorsel arasindaki tek farki soyle.")  # 8 görsele kadar
```

`look` düşünme modunu kapalı gönderir. **Elle HTTP çağrısı yazacaksanız
`chat_template_kwargs: {"enable_thinking": false}` göndermeyi unutmayın** —
yoksa `content` boş döner.

Model sağlam olduğu yerler: nesne/renk/stil tanıma, sayma (kör testte 5 kitabı
ve 2 gözü doğru saydı), metin okuma, iki görseli karşılaştırma.
Güvenilmez olduğu yer: **sol/sağ**. Uzamsal yön sorusu sormayın; gerekiyorsa
görseli kırpıp parça parça sorun.

---

## Reçete 4 — Denetim döngüsü (asıl kalıp)

Üretilen görseli aynı sistem içindeki 35B'ye denetletip düzelttirin:

```python
r = refine(
    prompt="a wooden treasure chest with iron bands, closed lid",
    brief="ahsap sandik, demir kusakli, KAPAGI KAPALI, izole zemin, yazi yok",
    rounds=2,
    style="item", size="icon", out="chest_final.png",
)
r["denetimler"]   # her turun JSON denetim raporu
```

`refine` şunu yapar: üret → `verify` → uymuyorsa modelin verdiği
`duzeltme_talimati` ile `edit` → tekrar denetle.

Tek başına denetim:

```python
v = verify("chest.png", "ahsap sandik, kapagi KAPALI, izole zemin")
# {'uyuyor': False, 'sorunlar': ['Kapak açık...'], 'duzeltme_talimati': 'close the lid...'}
```

**Brief'i eksiksiz yazın.** `verify` yalnızca brief'te yazanı denetler. Brief'te
olmayan bir kusuru bulmasını beklemeyin.

**`verify` fazla katı olabilir — yanlış negatif verir.** Gerçek koşu: kapalı bir
sandık, "kapağı AÇIK ve içi altın dolu" brief'iyle denetlendi; 1. tur doğru
teşhis koydu, düzeltme talimatı sandığı açıp altınla doldurdu, ama 2. tur yine
`uyuyor: False` dedi ("kapak tamamen açık değil, içi tamamen dolu değil") —
görsel brief'i açıkça karşılamasına rağmen. Bu yüzden:

- `rounds` değerini **2'de bırakın**; döngü kendiliğinden yakınsamayabilir
- Son turdaki `uyuyor: False` tek başına başarısızlık sayılmaz — `refine`
  son görseli yine de döndürür, teslim edilecek çıktı odur
- Kesin karar gerekiyorsa görseli bir insana ya da ikinci bir `look()`
  sorusuna taşıyın, aynı `verify` çağrısını tekrarlamayın

---

## Reçete 5 — Telif/IP taraması (üretimden önce zorunlu)

Qwen-Image tanınmış karakterlere kayabiliyor. Gerçek vaka: *"a friendly blue
robot holding a single red flower"* prompt'u **Doraemon** üretti — zil, cep,
yüz dahil. Ticari varlık üretiyorsanız her çıktıyı tarayın:

```python
import json
rapor = json.loads(look("varlik.png",
    "Bu gorselde taninmis, markali veya telifli bir karakter var mi? "
    'SADECE JSON: {"ip_riski": true/false, "karakter": "ad veya bos", '
    '"guven": "yuksek/orta/dusuk"}', max_tokens=200))
if rapor["ip_riski"]:
    ...  # seed değiştirip yeniden üret veya prompt'u özgünleştir
```

Doraemon örneğinde çıktı: `{"ip_riski": true, "karakter": "Doraemon",
"guven": "yuksek"}` — yakaladı.

Brief'e şartı eklerseniz `verify` de yakalar:

```python
verify(img, "mavi robot, tek kirmizi cicek, OZGUN tasarim, "
            "hicbir taninmis/markali karaktere benzemeyecek")
# uyuyor: False, sorunlar: ['Görselde tanımlı bir karakter (Doraemon) ...']
```

---

## Reçete 6 — Tutarlı varlık seti

Aynı stilde çok sayıda varlık üretirken **stili ve seed'i sabitleyin**, sadece
özneyi değiştirin:

```python
VARLIKLAR = ["iron sword", "wooden shield", "health potion", "leather boots"]
SEED = 1000

for i, ad in enumerate(VARLIKLAR):
    g = generate(ad, style="icon", size="icon", seed=SEED + i,
                 out=f"assets/{ad.replace(' ', '_')}.png")
    v = verify(g["png"], f"{ad}, tek nesne, izole duz zemin, yazi yok")
    if v.get("uyuyor") is False:
        g = edit(g["png"], v["duzeltme_talimati"],
                 out=f"assets/{ad.replace(' ', '_')}.png")
```

GPU tek kuyruktadır — bu döngüyü **paralel çalıştırmayın**, sıralı bırakın.
Paralel istek yalnızca kuyrukta bekler, hız kazandırmaz.

Motor-hazır çıktı için stil seçimi: `icon` (envanter), `sprite` (karakter,
keylenebilir zemin), `ui` (yazısız buton/panel), `item` (stüdyo render).

---

## Reçete 7 — Uzun işler (bloklamadan)

Çok sayıda görsel veya meşgul GPU'da HTTP zaman aşımına takılmayın:

```python
import json, urllib.request, time
req = urllib.request.Request(
    "http://10.40.72.31:30437/v1/images/generations",
    json.dumps({"prompt": "...", "style": "splash", "background": True}).encode(),
    {"Content-Type": "application/json"})
job = json.load(urllib.request.urlopen(req))["job_id"]

while True:
    with urllib.request.urlopen(
            f"http://10.40.72.31:30437/api/images/jobs/{job}") as r:
        s = json.load(r)
    if s["status"] in ("completed", "error"):
        break
    time.sleep(3)
```

Zaman aşımına düşseniz bile iş sunucuda tamamlanır ve galeriye yazılır:
`GET /api/gallery?limit=20` ile bulun. Kayıp sanmayın.

---

## Python kullanmayan ajanlar

```bash
# üret
curl -s http://10.40.72.31:30437/v1/images/generations \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"a wooden treasure chest","style":"item","size":"icon",
       "steps":4,"seed":42,"response_format":"url"}'

# düzenle
curl -s http://10.40.72.31:30437/v1/images/edits \
  -F "prompt=open the lid, keep everything else identical" \
  -F "image=@chest.png" -F "style=raw" -F "response_format=url"

# gör  (image_url data: URL olmalı; dosya yolu çalışmaz)
curl -s http://10.106.233.184:8002/v1/chat/completions \
  -H 'Content-Type: application/json' -d @istek.json
```

`istek.json` iskeleti:

```json
{"model":"qwen3.6-35b-a3b-nvfp4",
 "messages":[{"role":"user","content":[
   {"type":"image_url","image_url":{"url":"data:image/png;base64,<B64>"}},
   {"type":"text","text":"Bu gorselde ne var?"}]}],
 "max_tokens":1024,
 "chat_template_kwargs":{"enable_thinking":false}}
```

---

## Zorunlu kurallar

1. İş öncesi `health()` — GPU kilitliyse veya `waiters` yüksekse bekleyin.
2. Görü çağrılarında **daima** `enable_thinking: false`.
3. Düzenlemede **daima** `style="raw"` ve *"keep everything else identical"*.
4. `steps`'i 4'te bırakın.
5. Ticari varlıkta **her çıktıyı IP taramasından geçirin** (Reçete 5).
6. Seed'i loglayın — `result["seed"]` olmadan çıktıyı yeniden üretemezsiniz.
7. GPU işlerini paralelleştirmeyin; tek kuyruk var.
8. Sonucu `prompt_sent` alanına göre değerlendirin, kendi prompt'unuza göre değil.
9. Sol/sağ sorularında 35B'ye güvenmeyin.
10. Sayı kritikse (kaç nesne, kaç kenar) üretimi `verify` ile saydırın —
    Qwen-Image sayıları tutturamaz ("dört kitap" istendi, beş çizdi).

---

## Sınırlar

| | |
|---|---|
| Görsel boyutu | 256–2048 px, 8'in katı |
| Tek istekte görsel | `n` ≤ 4 |
| Düzenlemede referans | 3 görsel |
| Görü girdisi | 8 görsel, 131K token bağlam |
| Eşzamanlı görü isteği | 4 (fazlası kuyrukta) |
| Sunucu iş bütçesi | 1800 sn |
| GPU | tek kuyruk; üretim/düzenleme/video sırayla |

*Doğrulama: 2026-09-07 — üretim, düzenleme, görü, denetim döngüsü ve IP taraması
canlı çalıştırıldı.*
