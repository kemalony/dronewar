# Kilo TUI: "xhigh" varyantı sıkışması — teşhis ve düzeltme planı

## Sorun
`/models` ile model seçildiğinde varyant (düşünme seviyesi) sayfası açılmıyor ve
arayüz hâlâ `xhigh` gösteriyor.

## Kök neden (kanıtlı)
1. Düşünme seviyesi modelin **variant**'ıdır; `/models` yalnızca modeli seçer,
   varyantı değiştirmez. Varyant değişimi `/variants` sayfası veya `ctrl+t`
   (`variant_cycle`) ile yapılır.
2. Modeller özel `evren` sağlayıcısında (`@ai-sdk/openai-compatible`). Bu CLI
   sürümünün varyant tablosunda `glm*` (glm-5.2 hariç), `qwen`, `kimi`,
   `deepseek-v3` gibi model adları açık sağlayıcılar için otomatik varyant
   listesinden çıkarılmış. `glm-5.3` bu yüzden **varyantsız** kalıyor
   (glm-5.2 için `high/max` istisnası var, glm-5.3 için yok).
3. Varyant listesi boş olunca `/variants` sayfası hiç açılmıyor ("No variants
   available" bilgi mesajı gösterir) ve `ctrl+t` hiçbir şey yapmaz.
4. `~/.local/state/kilo/model.json` içinde eski bir seçim olarak
   `"variant": "xhigh"` kalıcı saklanıyor (`model.code`, `model.plan` ve
   `"variant": {"evren/glm-5.3": "xhigh"}` haritası). Her açılışta geri
   yükleniyor — oturum logu da `model.variant=xhigh` gösteriyor
   (`~/.local/share/kilo/log/opencode.log`).
5. Config'e `variants` veya `reasoning_options` eklemek işe yaramaz: bu CLI
   sürümü özel sağlayıcılarda (provider id `kilo` olmayan) config `variants`'ı
   atıyor ve config şemasında `reasoning_options` alanı yok.

## Düzeltme adımları
1. **TUI'yi tamamen kapat** (tüm `kilo` süreçleri; state dosyası açıkken
   üzerine yazılabilir).
2. **`~/.local/state/kilo/model.json`** — `xhigh` kalıntısını temizle:
   - `model.code.variant` ve `model.plan.variant` alanlarını (`"variant":"xhigh"`) sil
   - en dıştaki `"variant": {"evren/glm-5.3":"xhigh"}` anahtarını tamamen sil
   - `model`, `recent`, `favorite` kalsın; dosya geçerli JSON olarak kalmalı
3. **`~/.config/kilo/kilo.jsonc`** — glm-5.3 girdisine sabit çaba ekle:
   ```jsonc
   "glm-5.3": {
     "name": "GLM 5.3",
     "reasoning": true, "tool_call": true,
     "limit": { "context": 524288, "output": 16384 },
     "options": { "reasoningEffort": "high" }
   }
   ```
   (`"high"` yerine `"low"` / `"medium"` de seçilebilir. Bu seçenek
   OpenAI-compatible istek gövdesine `reasoning_effort` olarak yazılır —
   OpenCode/Kilo'nun belgelenmiş per-model option mekanizması.)
   İstenirse aynı `options` satırı `qwen3.8-flash-next` gibi diğer varyantsız
   modellere de eklenir.
4. **TUI'yi yeniden başlat.**

## Doğrulama
- Üstbilgide/durum çubuğunda `glm-5.3` yanında `xhigh` görünmemeli.
- Yeni bir mesaj gönderdikten sonra log kontrolü:
  `grep model.variant ~/.local/share/kilo/log/opencode.log` → variant boş.
- Düşünme çıktısı, seçilen `reasoningEffort` seviyesine göre azalmalı/artmalı.

## Notlar / sınırlar
- `deepseek-v4.1-flash` ve `mimo-v2.6-pro` bu sürümde varyantlı
  (low/medium/high, deepseek-v4'e ek `max`): onlarda `/variants` ve `ctrl+t`
  çalışır. `glm-5.3` ve `qwen*` için config'den sabit seviye tek yol.
- `reasoning_effort` parametresini evren backend'i yok sayarsa seviye
  backend'in varsayılanına kalır (istemci tarafı yapabileceği bu kadar).
- glm-5.2'nin varyantlı ama glm-5.3'ün varyantsız olması CLI'daki bir tablo
  eksiği; istenirse https://github.com/Kilo-Org/kilocode/issues adresine
  bildirilebilir.
