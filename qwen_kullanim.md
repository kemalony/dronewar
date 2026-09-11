# Qwen Modelleri — Ajan Kullanım Kılavuzu

Hedef kitle: bu sunucuda (`exp1gpusrv01p`, node-1, H200 NVL 143 GB) çalışan otonom
ajanlar. Kapsam: **qwen3.6-35b-a3b-nvfp4** (metin + görsel anlama),
**Qwen-Image-2512** (görsel üretimi), **Qwen-Image-Edit-2511** (görsel düzenleme).

Bu dokümandaki tüm uç noktalar ve örnekler 2026-09-07'de canlı olarak test edildi.

---

## 0. Hızlı referans

| Yetenek | Model adı (API) | Adres | Protokol |
|---|---|---|---|
| Metin + görsel anlama | `qwen3.6-35b-a3b-nvfp4` | `http://10.106.233.184:8002/v1` | OpenAI chat |
| Görsel üretimi | `qwen-image-2512` | `http://localhost:30437/v1` | OpenAI images |
| Görsel düzenleme | `qwen-image-edit-plus` | `http://localhost:30437/v1` | OpenAI images |

Ek olarak `qwen3-vl-4b-instruct` → `http://10.104.68.116:8003/v1` (hafif VL, 16K
bağlam). Büyük iş için 35B'yi, ucuz/hızlı sınıflandırma için 4B'yi kullanın.

Görsel API'ye **başka bir makineden** erişen ajanlar `localhost:30437` yerine
`http://10.40.72.31:30437` kullansın (node-1'in NodePort adresi). vLLM
ClusterIP'leri yalnızca küme ağı içinden erişilebilir.

### LiteLLM ağ geçidi (opsiyonel)

İki ağ geçidi de **çalışıyor**: `http://10.40.72.31:30400` (`inference/litellm`,
12 model) ve `http://10.110.199.128:4000` (`ai-inference/litellm-proxy`, 6 model).
İkisi de `qwen3.6-35b-a3b-nvfp4`'ü yönlendirir; uçtan uca doğrulandı.

Kimlik doğrulama **yalnızca master key** ile yapılır — geçit pod'undaki
`LITELLM_MASTER_KEY` ortam değişkeni. Sanal anahtar (virtual key)
üretimi için veritabanı gerekir; kurulumda DB **bilinçli olarak yok**, bu yüzden:

- anahtarsız istek → `401 Authentication Error`
- yanlış anahtar → `400 No connected db.` (sanal anahtarı DB'de arar, bulamaz)

`400 No connected db.` **bozuk servis anlamına gelmez** — yanlış anahtar
demektir. `config.yaml` içindeki `api_key: sk-local` değeri geçidin değil,
geçidin arkasındaki vLLM'in anahtarıdır; istemci olarak onu göndermeyin.

Ajanlar için sadelik açısından doğrudan vLLM adresleri yeterlidir; geçit
merkezî loglama, Prometheus metrikleri ve model takma adları gerektiğinde
tercih edilir. Not: `inference` geçidinin listesindeki `qwen3-vl-8b*`
yönlendirmeleri ayakta olmayan bir arka uca gider (§5).

Sağlık kontrolü (ajanlar iş başlamadan bunu çalıştırsın):

```bash
curl -sf -m 5 http://10.106.233.184:8002/v1/models >/dev/null && echo "35b OK"
curl -sf -m 5 http://localhost:30437/health | grep -q '"status":"ok"' && echo "image OK"
```

`/health` çıktısı GPU kuyruğunun anlık durumunu da verir:

```json
{"status":"ok","gpu":{"locked":false,"family":"image","waiters":0,"depth":0}}
```

---

## 1. qwen3.6-35b-a3b-nvfp4 — metin + görsel anlama

vLLM üzerinde OpenAI uyumlu. Kimlik doğrulama yok (küme içi ClusterIP).

- **Adres:** `http://10.106.233.184:8002/v1` (servis: `vllm-qwen36-a3b-nvfp4.ai-inference`)
- **Bağlam:** 131 072 token
- **Görsel:** istek başına en fazla **8 görsel**, 1 video
- **Eşzamanlılık:** `--max-num-seqs=4` — 4'ten fazla paralel istek kuyruğa girer
- **Araç çağırma:** açık (`qwen3_xml` parser)
- **Düşünme (thinking):** modelde açık gelir; sunucu tarafında varsayılan
  kapatılmamıştır → **her istekte açıkça kapatın**, yoksa `content` boş döner

### Kritik tuzak: thinking

`max_tokens` küçükken düşünme modu bütçeyi yer ve `content: null` alırsınız.
Ajanlar her zaman şunu göndersin:

```json
"chat_template_kwargs": {"enable_thinking": false}
```

Doğrulanmış davranış: `max_tokens=30`, thinking açık → `content: None`,
30 token harcandı. Aynı istek `enable_thinking=false` ile → `content: " Kirmizi"`,
4 token.

### Metin örneği

```bash
curl -s http://10.106.233.184:8002/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "qwen3.6-35b-a3b-nvfp4",
    "messages": [{"role":"user","content":"Bu JSON şemasını doğrula: ..."}],
    "max_tokens": 2048,
    "temperature": 0.7,
    "chat_template_kwargs": {"enable_thinking": false}
  }'
```

### Görsel örneği (Python)

```python
import base64, json, urllib.request

def ask_image(path, question, url="http://10.106.233.184:8002/v1/chat/completions"):
    b64 = base64.b64encode(open(path, "rb").read()).decode()
    body = {
        "model": "qwen3.6-35b-a3b-nvfp4",
        "messages": [{"role": "user", "content": [
            {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{b64}"}},
            {"type": "text", "text": question},
        ]}],
        "max_tokens": 1024,
        "chat_template_kwargs": {"enable_thinking": False},
    }
    req = urllib.request.Request(url, json.dumps(body).encode(),
                                 {"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=180) as r:
        return json.load(r)["choices"][0]["message"]["content"]
```

Görsel `data:` URL'i olarak gömülür; dosya yolu veya `file://` **çalışmaz**.
Birden fazla görsel için `content` listesine 8 taneye kadar `image_url` ekleyin.

### Zincirleme kalıp: üret → denetle → düzelt

35B'nin en değerli kullanımı üretilen görseli kendisinin denetlemesidir:

1. `/v1/images/generations` ile görsel üret, `response_format: "b64_json"` al
2. Aynı base64'ü 35B'ye ver, "brief'e uyuyor mu, neyi düzelt" diye sor
3. Cevabı `/v1/images/edits` prompt'una geçir

---

## 2. Qwen-Image-2512 — görsel üretimi

FastAPI (`Synapso Görsel Üretici` v1.1.0) → ComfyUI → Qwen-Image-2512 FP8 +
4-adım Lightning LoRA. Kimlik doğrulama yok.

- **Adres:** `http://localhost:30437` (küme içinden `sd-simple-ui.inference:30437`)
- **Model adı:** `qwen-image-2512` — takma adlar: `qwen-image`, `qwen_image`, `qwen_image_2512`
- **Ölçülen süre:** 512×512 / 4 adım → **~2,3 sn**

### POST `/v1/images/generations`

| Alan | Tip | Varsayılan | Not |
|---|---|---|---|
| `prompt` | string | — | zorunlu, 1–4000 karakter |
| `model` | string | `qwen-image-2512` | |
| `style` | string | `asset` | prompt'u sarmalar — §4'e bakın |
| `size` | string | stilden gelir | takma ad veya `"1024x1024"` |
| `width`/`height` | int | — | 256–2048, 8'in katına yuvarlanır |
| `n` | int | 1 | 1–4; seed her görselde +1 artar |
| `steps` | int | 4 | 1–50; **4'te bırakın** (Lightning LoRA) |
| `seed` | int | rastgele | `-1` = rastgele |
| `cfg` | float | otomatik | 1–20 — §4'e bakın |
| `negative_prompt` | string | `""` | stilin negatifine eklenir |
| `response_format` | string | `b64_json` | veya `url` |
| `sampler` / `scheduler` | string | `euler` / `simple` | |
| `background` | bool | false | true → 202 + `job_id` |

```bash
curl -s http://localhost:30437/v1/images/generations \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"a red apple","style":"icon","size":"thumb",
       "steps":4,"seed":42,"response_format":"url"}'
```

Yanıt:

```json
{"created":1788801888,
 "data":[{"revised_prompt":"A game inventory icon of a red apple. ...",
          "seed":42,
          "gallery_id":"L2dhbGxlcnkvaW1hZ2VzLzIwMjYwOTA3XzE3MjQ0OF9iNWEzZTI3NS5wbmc",
          "url":"http://localhost:30437/api/gallery/<id>/image"}],
 "size":"512x512","style":"icon","model":"qwen-image-2512","cfg":2.0,
 "negative_prompt":"text, letters, words, watermark, ..."}
```

`revised_prompt` modele **gerçekten giden** metindir; `cfg` ve
`negative_prompt` sunucunun seçtiği değerlerdir. Ajanlar sonucu değerlendirirken
kendi prompt'unu değil `revised_prompt`'u okusun.

### Stiller

`GET /v1/images/styles` canlı listeyi verir. Her stil hem bir prompt şablonu hem
bir negatif prompt hem de bir varsayılan boyut taşır:

| id | Amaç | Varsayılan boyut |
|---|---|---|
| `asset` | izole, motor-hazır genel varlık (varsayılan) | 1024×1024 |
| `icon` | envanter ikonu | 1024×1024 |
| `app_icon` | mobil/masaüstü uygulama ikonu | 1024×1024 |
| `ui` | buton/panel/HUD, yazısız | 1024×1024 |
| `sprite` | karakter/yaratık, keylenebilir zemin | 1024×1024 |
| `item` | stüdyo ışığında 3D eşya | 1024×1024 |
| `portrait` | büst/yüz, dikey | 768×1024 |
| `splash` | yatay kapak | 1280×720 |
| `background` | ortam/menü arka planı | 1280×720 |
| `comic` | dikey çizgi roman paneli | 1024×1448 |
| `raw` | **prompt olduğu gibi gider** | 1024×1024 |

Takma adlar: `inventory`/`game_icon`/`item_icon` → `icon`, `app` → `app_icon`,
`character`/`prop` → `sprite`, `cover` → `splash`.

### Boyut takma adları

`icon`/`square`/`1:1` = 1024×1024 · `thumb` = 512×512 · `portrait`/`3:4` = 768×1024 ·
`landscape`/`4:3` = 1024×768 · `banner`/`2:1` = 1536×768 ·
`splash`/`16:9`/`wide` = 1280×720 · `comic`/`panel` = 1024×1448 · `2:3` = 1024×1536

### Asenkron mod

Uzun işlerde (`n>1`, büyük boyut, meşgul GPU) HTTP zaman aşımından kaçınmak için:

```bash
JOB=$(curl -s http://localhost:30437/v1/images/generations \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"blue cube","style":"icon","background":true}' \
  | python3 -c 'import json,sys;print(json.load(sys.stdin)["job_id"])')

curl -s "http://localhost:30437/api/images/jobs/$JOB"
# {"status":"queued"|"completed"|"error", "result":{...}, "error":"...", "retry_after":20}
```

`status` `completed` olana kadar 2–3 sn aralıkla yoklayın.

### Galeri

- `GET /api/gallery?limit=&offset=` — üretilen tüm görseller (şu an 1428 kayıt)
- `GET /api/gallery/{id}/image` — tam boy PNG
- `GET /api/gallery/{id}/thumb` — küçük resim

`id` base64url'dur ve `=` dolgusu içerebilir; kabuğa yazarken **tırnak içine
alın**, dolguyu kırpmayın (kırpılırsa 404 alırsınız).

---

## 3. Qwen-Image-Edit-2511 — görsel düzenleme

Aynı FastAPI, `qwen_image_edit_2511_fp8mixed` UNET + Edit-Lightning LoRA.

- **Model adı:** `qwen-image-edit-plus` — takma adlar: `qwen-image-edit`,
  `qwen-image-edit-2511`, `qwen_image_edit`, `qwen_image_edit_plus`, `qwen_image_edit_2511`
- **Referans görsel:** 1 zorunlu + 2 opsiyonel (**toplam 3**, "Plus" özelliği)
- **Ölçülen süre:** 512×512 / 4 adım → **~32 sn** (model takası dahil; art arda
  düzenlemelerde daha hızlı)

### POST `/v1/images/edits` — multipart

```bash
curl -s http://localhost:30437/v1/images/edits \
  -F "prompt=make the apple green" \
  -F "image=@apple.png" \
  -F "style=raw" \
  -F "size=thumb" \
  -F "response_format=url"
```

Alanlar: `prompt`, `image`, `image2`, `image3`, `model`, `style`, `size`,
`width`, `height`, `n`, `steps`, `seed`, `cfg`, `negative_prompt`,
`response_format`, `background`.

### POST `/v1/images/edits` — JSON

```json
{
  "prompt": "arka planı gece sahnesiyle değiştir",
  "image": "data:image/png;base64,iVBORw0...",
  "image2": "iVBORw0...",
  "style": "raw",
  "size": "landscape",
  "response_format": "b64_json"
}
```

`image*` alanları ham base64 veya `data:` URL kabul eder.

### Kritik tuzak: düzenlemede `style`

`style` varsayılanı burada da `asset`'tir ve düzenleme talimatınızı varlık
şablonuna sarar. Gerçek test çıktısı:

```
prompt:         "make the apple green"
revised_prompt: "A game or application visual asset: make the apple green.
                 Isolated subject, clean silhouette, ..."
```

Bu istemediğiniz bir yeniden çerçeveleme. **Düzenlemelerde `"style": "raw"`
gönderin**; talimat modele olduğu gibi gider. Stil sarmalamasını bilerek
istiyorsanız (ör. bir varlığı yeniden stillendirmek) `asset` bırakın.

---

## 4. Ortak tuzaklar

**GPU tek kuyrukta.** Görsel üretimi, düzenleme ve video tek bir kilidi paylaşır.
Kilit meşgulse `503` + `retry_after` (varsayılan 20 sn) dönebilir; kuyrukta en
fazla 64 bekleyen olur. Ajanlar `503`'ü hata saymasın — `retry_after` kadar
bekleyip tekrar denesin. Üretim↔düzenleme aynı `image` ailesindedir, aralarında
geçiş ucuzdur; video ailesine geçiş modelin GPU'dan boşaltılmasını gerektirir.

**`cfg` ile `negative_prompt` etkileşimi.** Lightning LoRA CFG 1.0'da eğitilmiştir
ve CFG 1.0'da negatif koşullandırma **tamamen yok sayılır**. Sunucu bunu telafi
eder: `steps<=8` + boş olmayan negatif → CFG otomatik **2.0**; negatif boşsa 1.0;
`steps>8` → 4.0. `cfg`'yi elle gönderirseniz bu koruma devre dışı kalır — negatif
prompt kullanırken CFG'yi 1.0'a sabitlemeyin, sessizce etkisiz kalır.

**`steps` artırmak işe yaramaz.** Lightning LoRA 4 adım için damıtılmıştır.
`steps>8` LoRA'yı devre dışı bırakır, CFG 4.0'a çıkar ve iş kat kat yavaşlar.
Kalite için adım değil prompt ve stil ayarlayın.

**Model adı doğrulanır.** Listedeki takma adların dışında bir ad `400
Desteklenmeyen model` döner. Aynısı stil için geçerli: `400 Desteklenmeyen stil`.

**`n` ve seed.** `n=2, seed=42` → görseller 42 ve 43 tohumlarını kullanır. Bir
sonucu birebir yeniden üretmek için yanıttaki `data[i].seed` değerini kullanın.

**Pod IP'leri değişir.** Doküman ClusterIP adreslerini verir (`10.106.233.184`
gibi) — bunlar pod yeniden başlasa da sabittir. Pod IP'lerine
(`192.168.186.x`) sabitlemeyin. Küme içinden çalışan ajanlar DNS adını tercih
etsin: `vllm-qwen36-a3b-nvfp4.ai-inference.svc.cluster.local:8002`.

**Zaman aşımı bütçesi.** ComfyUI tarafı bir işi 1800 sn'ye kadar bekler. İstemci
zaman aşımınız bundan kısaysa iş sunucuda sürmeye devam eder ve sonuç galeriye
düşer — kayıp sanmayın, `GET /api/gallery` ile bulun. Uzun işlerde
`background: true` kullanmak daha temizdir.

---

## 5. Kaynaklar ve durum

| Bileşen | Konum |
|---|---|
| Görsel API kaynak kodu | `/DATA/sd-simple-ui-app/` (`server.py`, `qwen_workflow.py`, `qwen_client.py`) |
| ComfyUI | `http://localhost:30788` (pod `comfyui-ltx`, `inference` ns) |
| Qwen-Image UNET | `/DATA/comfyui/models/diffusion_models/qwen_image_2512_fp8_e4m3fn.safetensors` |
| Qwen-Image-Edit UNET | `/DATA/comfyui/models/diffusion_models/qwen_image_edit_2511_fp8mixed.safetensors` |
| Text encoder / VAE | `qwen_2.5_vl_7b_fp8_scaled.safetensors` / `qwen_image_vae.safetensors` |
| 35B ağırlıkları | `/DATA/models/Qwen3.6-35B-A3B-NVFP4` |
| Kurulum notu | `/DATA/sd-simple-ui-app/docs/qwen-image-api-setup.md` |

**Ayakta olmayanlar:** `Qwen3-VL-8B-Instruct-FP8` (ağırlıklar
`/DATA/models/Qwen3-VL-8B-Instruct-FP8` altında ama servis edilmiyor — servis
`vllm-qwen3-vl-8b` endpoint'siz), `Qwen3-VL-235B-A22B-Instruct-AWQ` (sadece
diskte). LiteLLM geçitlerindeki `qwen3-vl-8b` / `qwen3-vl-8b-instruct`
takma adları bu ayakta olmayan arka uca işaret eder — çağırmayın.

*Son doğrulama: 2026-09-07.*
