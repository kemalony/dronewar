# akıl yürütme
curl -N "https://evren-llmapi.ssyz.org.tr/v1/chat/completions" \
  -H "Authorization: Bearer $EVREN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek-v4.1-flash",
    "messages": [{"role": "user", "content": "Algoritmanın karmaşıklığını ve adımlarını açıkla."}],
    "max_tokens": 4096,
    "stream": true,
    "stream_options": {"include_usage": true}
  }'

  # tools

  {
  "model": "glm-5.3",
  "messages": [{"role": "user", "content": "Ankara hava durumu nedir?"}],
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "get_weather",
        "description": "Şehir için anlık hava durumunu döner",
        "parameters": {
          "type": "object",
          "properties": {
            "city": {"type": "string", "description": "Şehir adı"}
          },
          "required": ["city"]
        }
      }
    }
  ],
  "tool_choice": "auto"
}

# görsel

curl -s "https://evren-llmapi.ssyz.org.tr/v1/chat/completions" \
  -H "Authorization: Bearer $EVREN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemma-4-31b",
    "messages": [
      {
        "role": "user",
        "content": [
          {"type": "text", "text": "Bu görseldeki nesneleri ve metinleri listele."},
          {
            "type": "image_url",
            "image_url": {"url": "data:image/jpeg;base64,/9j/4AAQSkZJRg..."}
          }
        ]
      }
    ],
    "max_tokens": 1024
  }'

  # belge ocr

  curl -s "https://evren-llmapi.ssyz.org.tr/v1/ocr" \
  -H "Authorization: Bearer $EVREN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "dots-ocr",
    "image": "data:image/png;base64,iVBORw0KGgo..."
  }'

  # ASR

  curl -s "https://evren-llmapi.ssyz.org.tr/v1/audio/transcriptions" \
  -H "Authorization: Bearer $EVREN_API_KEY" \
  -F "file=@ses_kaydi.wav" \
  -F "model=qwen3-asr-1.7b" \
  -F "response_format=srt"