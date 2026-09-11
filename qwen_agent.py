"""Qwen üçlüsü için tek dosyalık ajan istemcisi.

Üretim  : Qwen-Image-2512        -> generate()
Düzenleme: Qwen-Image-Edit-2511  -> edit()
Görü    : qwen3.6-35b-a3b-nvfp4  -> look() / verify()

Bağımlılık yok (yalnız stdlib). Kullanım:
    from qwen_agent import generate, edit, look, verify, refine
"""

from __future__ import annotations

import base64
import json
import os
import time
import urllib.error
import urllib.request

IMAGE_API = os.environ.get("QWEN_IMAGE_API", "http://10.40.72.31:30437")
VISION_API = os.environ.get("QWEN_VISION_API", "http://10.106.233.184:8002/v1")
VISION_MODEL = os.environ.get("QWEN_VISION_MODEL", "qwen3.6-35b-a3b-nvfp4")

TIMEOUT = 600
RETRIES = 4


class QwenError(RuntimeError):
    pass


def _post(url: str, payload: dict, headers: dict | None = None, timeout: int = TIMEOUT) -> dict:
    """GPU meşgulse (503) retry_after kadar bekleyip yeniden dener."""
    head = {"Content-Type": "application/json", **(headers or {})}
    for attempt in range(RETRIES):
        req = urllib.request.Request(url, json.dumps(payload).encode(), head)
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", "replace")
            if e.code == 503 and attempt < RETRIES - 1:
                wait = 20
                try:
                    wait = int(json.loads(body)["error"].get("retry_after", 20))
                except Exception:
                    pass
                time.sleep(wait)
                continue
            raise QwenError(f"HTTP {e.code}: {body[:400]}") from None
    raise QwenError("GPU meşgul, tüm denemeler tükendi")


# ---------------------------------------------------------------- üretim

def generate(
    prompt: str,
    *,
    style: str = "asset",
    size: str = "icon",
    seed: int | None = None,
    n: int = 1,
    negative_prompt: str = "",
    out: str | None = None,
) -> dict:
    """Metinden görsel üretir. Dönen dict: {'png': bytes, 'seed': int, 'prompt_sent': str}."""
    payload = {
        "prompt": prompt,
        "model": "qwen-image-2512",
        "style": style,
        "size": size,
        "steps": 4,
        "n": n,
        "response_format": "b64_json",
    }
    if seed is not None:
        payload["seed"] = seed
    if negative_prompt:
        payload["negative_prompt"] = negative_prompt

    d = _post(f"{IMAGE_API}/v1/images/generations", payload)
    item = d["data"][0]
    png = base64.b64decode(item["b64_json"])
    if out:
        with open(out, "wb") as f:
            f.write(png)
    return {
        "png": png,
        "path": out,
        "seed": item["seed"],
        "prompt_sent": item["revised_prompt"],
        "size": d["size"],
        "gallery_id": item.get("gallery_id"),
        "all": d["data"],
    }


# ------------------------------------------------------------- düzenleme

def edit(
    image: bytes | str,
    instruction: str,
    *,
    style: str = "raw",
    size: str | None = None,
    seed: int | None = None,
    extra_images: list[bytes | str] | None = None,
    out: str | None = None,
) -> dict:
    """Var olan görseli düzenler. style='raw' talimatı olduğu gibi gönderir."""
    payload = {
        "prompt": instruction,
        "model": "qwen-image-edit-plus",
        "image": _as_b64(image),
        "style": style,
        "steps": 4,
        "response_format": "b64_json",
    }
    for i, extra in enumerate(extra_images or [], start=2):
        if i > 3:
            raise ValueError("En fazla 3 referans görsel (image, image2, image3)")
        payload[f"image{i}"] = _as_b64(extra)
    if size:
        payload["size"] = size
    if seed is not None:
        payload["seed"] = seed

    d = _post(f"{IMAGE_API}/v1/images/edits", payload)
    item = d["data"][0]
    png = base64.b64decode(item["b64_json"])
    if out:
        with open(out, "wb") as f:
            f.write(png)
    return {
        "png": png,
        "path": out,
        "seed": item["seed"],
        "prompt_sent": item["revised_prompt"],
        "size": d["size"],
        "gallery_id": item.get("gallery_id"),
    }


# ------------------------------------------------------------------ görü

def look(images: bytes | str | list, question: str, *, max_tokens: int = 1024) -> str:
    """Görsel(ler) hakkında serbest soru sorar. En fazla 8 görsel."""
    items = images if isinstance(images, list) else [images]
    if len(items) > 8:
        raise ValueError("En fazla 8 görsel")
    content = [
        {"type": "image_url",
         "image_url": {"url": "data:image/png;base64," + _as_b64(im)}}
        for im in items
    ]
    content.append({"type": "text", "text": question})
    d = _post(
        f"{VISION_API}/chat/completions",
        {
            "model": VISION_MODEL,
            "messages": [{"role": "user", "content": content}],
            "max_tokens": max_tokens,
            # Zorunlu: thinking açık kalırsa content boş döner.
            "chat_template_kwargs": {"enable_thinking": False},
        },
    )
    return (d["choices"][0]["message"]["content"] or "").strip()


def verify(image: bytes | str, brief: str) -> dict:
    """Görselin brief'e uyup uymadığını JSON olarak denetler."""
    answer = look(
        image,
        "Bu görseli su sarta gore denetle: \"" + brief + "\"\n"
        "SADECE su JSON'u don, baska hicbir sey yazma:\n"
        '{"uyuyor": true/false, "sorunlar": ["..."], "duzeltme_talimati": "..."}\n'
        "duzeltme_talimati: goruntu duzenleyiciye verilecek tek cumlelik "
        "İngilizce talimat; uyuyorsa bos birak.",
        max_tokens=600,
    )
    text = answer.strip()
    if text.startswith("```"):
        text = text.split("```")[1].removeprefix("json").strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return {"uyuyor": None, "sorunlar": ["JSON ayrıştırılamadı"], "ham": answer}


# --------------------------------------------------------------- döngü

def refine(prompt: str, brief: str | None = None, *, rounds: int = 2, out: str | None = None,
           **gen_kwargs) -> dict:
    """Üret -> 35B ile denetle -> düzelt. Brief verilmezse prompt kullanılır."""
    brief = brief or prompt
    result = generate(prompt, **gen_kwargs)
    log = []
    for _ in range(rounds):
        check = verify(result["png"], brief)
        log.append(check)
        if check.get("uyuyor") is not False:
            break
        fix = (check.get("duzeltme_talimati") or "").strip()
        if not fix:
            break
        result = edit(result["png"], fix)
    if out:
        with open(out, "wb") as f:
            f.write(result["png"])
        result["path"] = out
    result["denetimler"] = log
    return result


# --------------------------------------------------------------- yardımcı

def _as_b64(image: bytes | str) -> str:
    if isinstance(image, bytes):
        return base64.b64encode(image).decode()
    if image.startswith("data:") or len(image) > 512:
        return image.split(",", 1)[-1]
    with open(image, "rb") as f:
        return base64.b64encode(f.read()).decode()


def health() -> dict:
    with urllib.request.urlopen(f"{IMAGE_API}/health", timeout=10) as r:
        img = json.load(r)
    with urllib.request.urlopen(f"{VISION_API}/models", timeout=10) as r:
        vis = [m["id"] for m in json.load(r)["data"]]
    return {"image": img, "vision": vis}


if __name__ == "__main__":
    print(json.dumps(health(), ensure_ascii=False, indent=2))
