#!/usr/bin/env python3
"""index.html -> Artifact'e yuklenebilir tek dosya.

Ham varliklar 30 MB; Artifact siniri 16 MB ve base64 %33 sisiriyor. Yayin paketi
icin varliklar kucultulur:
  - alfasi olmayanlar (sehir zeminleri) -> JPEG, cizim boyutunun 1.5 kati
  - alfali sprite'lar -> PNG, cizim boyutunun 1.5 kati
Kaynak dosyalara DOKUNULMAZ; kucultme yalnizca pakete girer.

Ayrica game/ projesinde ogrenilen iki sey burada da gecerli:
  - Yayinlanan sayfanin CSP'si gomulu `data:` gorsellerini engelliyor, o yuzden
    base64 -> Blob -> createImageBitmap -> canvas yolu kullanilir.
  - Sayfa kendi teshisini gosterir (SPRITE n/m), yoksa sessiz basarisizlik fark edilmez.
"""
import base64
import io
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "index.html"
ASSETS = ROOT / "assets"
OUT = ROOT / "build" / "artifact.html"
# Varlik turune gore olcek: 60 varliga cikinca tek bir 1.5 kat paketi 22.9 MB
# yapiyordu, Artifact siniri 16 MB. Zemin karolari ekranda tam boy cizildigi icin
# 1.0 kat yeterli (JPEG, alfa yok); sprite'lar yakindan gorulduğu icin 1.3;
# bulutlar yumusak oldugu icin 0.85 kat farkedilmiyor.
# Round 18: 11.9 MB paket Artifact'e yuklenirken okuma/dogrulama adimi ag
# hatasiyla dusuyordu. Sinir 16 MB olsa da BUYUK paket guvenilir yuklenmiyor;
# olcekler ve JPEG kalitesi bir kademe dusuruldu (~7 MB).
SCALE_BY_KIND = {"tile": 0.85, "building": 0.8, "landmark": 1.0, "fx": 0.8,
                 "unit": 1.1, "boss": 1.0, "ui": 1.1, "item": 1.1, "ground": 1.1}
SCALE = 1.1          # tabloda olmayan turler icin
JPEG_Q = 62

from PIL import Image

html = SRC.read_text(encoding="utf-8")
style_m = re.search(r"<style>(.*?)</style>", html, re.S)
body_m = re.search(r"<body[^>]*>(.*)</body>", html, re.S)
if not (style_m and body_m):
    raise SystemExit("index.html beklenen yapida degil")

manifest = json.loads((ASSETS / "manifest.json").read_text())

images = {}
raw_total = 0
for entry in manifest["sprites"]:
    p = ASSETS / entry["file"]
    if not p.exists():
        print("EKSIK:", entry["file"])
        continue
    raw_total += p.stat().st_size
    im = Image.open(p)
    sc = SCALE_BY_KIND.get(entry.get("kind", ""), SCALE)
    tw = max(1, int(entry["width"] * sc))
    th = max(1, int(entry["height"] * sc))
    if im.width > tw or im.height > th:
        im = im.resize((tw, th), Image.LANCZOS)
    buf = io.BytesIO()
    has_alpha = im.mode in ("RGBA", "LA") and im.getchannel("A").getextrema()[0] < 255
    if has_alpha:
        im.convert("RGBA").save(buf, "PNG", optimize=True)
        mime = "image/png"
    else:
        im.convert("RGB").save(buf, "JPEG", quality=JPEG_Q, optimize=True)
        mime = "image/jpeg"
    images[pathlib.Path(entry["file"]).name] = {
        "d": base64.b64encode(buf.getvalue()).decode(), "t": mime,
    }

shim = """
<script>
(function () {
  const IMAGES = __IMAGES__;
  const total = Object.keys(IMAGES).length;
  let ok = 0, bad = 0;
  const paint = () => {
    const el = document.getElementById("sprite-status");
    if (!el) return;
    el.textContent = "SPRITE " + ok + "/" + total + (bad ? "  (" + bad + " basarisiz)" : "");
    el.style.color = (bad || ok < total) ? "#e8734a" : "#7f93c8";
  };
  const toBlob = (b64, type) => {
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type });
  };
  /* Yayinlanan sayfanin CSP'si `data:` gorsellerini engelliyor: img yolu hic
     kullanilmaz, base64 Blob'a cevrilip createImageBitmap ile canvas'a cizilir. */
  function makeImage() {
    const c = document.createElement("canvas");
    c.width = 1; c.height = 1;
    let nw = 0, nh = 0, done = false, srcVal = "";
    Object.defineProperty(c, "naturalWidth",  { get: () => nw });
    Object.defineProperty(c, "naturalHeight", { get: () => nh });
    Object.defineProperty(c, "complete",      { get: () => done });
    const finish = (type) => {
      done = true; paint();
      const h = type === "load" ? c.onload : c.onerror;
      if (typeof h === "function") h.call(c, new Event(type));
      c.dispatchEvent(new Event(type));
    };
    Object.defineProperty(c, "src", {
      get: () => srcVal,
      set(v) {
        srcVal = String(v);
        const m = srcVal.match(/([^/\\\\?#]+\\.(?:png|jpg|jpeg))(?:[?#].*)?$/i);
        const rec = m && IMAGES[m[1]];
        if (!rec) { bad++; finish("error"); return; }
        createImageBitmap(toBlob(rec.d, rec.t)).then((bmp) => {
          c.width = bmp.width; c.height = bmp.height;
          c.getContext("2d").drawImage(bmp, 0, 0);
          nw = bmp.width; nh = bmp.height;
          ok++; finish("load");
        }).catch(() => { bad++; finish("error"); });
      },
    });
    return c;
  }
  window.Image = makeImage;
  const realFetch = window.fetch ? window.fetch.bind(window) : null;
  window.fetch = function (input, init) {
    const url = String(typeof input === "string" ? input : (input && input.url) || "");
    if (/\\.(png|jpe?g|json)(?:[?#].*)?$/i.test(url))
      return Promise.resolve(new Response("", { status: 200 }));
    return realFetch ? realFetch(input, init) : Promise.reject(new Error("offline"));
  };
  addEventListener("DOMContentLoaded", () => {
    const el = document.createElement("p");
    el.id = "sprite-status";
    el.textContent = "SPRITE 0/" + total;
    document.body.appendChild(el);
    paint();
    setInterval(paint, 1000);
  });
})();
</script>
"""
shim = shim.replace("__IMAGES__", json.dumps(images))

extra_css = """
html, body { touch-action: none; overscroll-behavior: none; }
#sprite-status {
  position: fixed; left: 0; right: 0; top: 6px; text-align: center;
  font: 11px/1 "Courier New", monospace; letter-spacing: .12em;
  color: #7f93c8; pointer-events: none; margin: 0; z-index: 50;
}
"""

out = (f"<title>Drone War</title>\n<style>{style_m.group(1)}\n{extra_css}</style>\n"
       f"{shim}\n{body_m.group(1)}\n")
OUT.parent.mkdir(exist_ok=True)
OUT.write_text(out, encoding="utf-8")
kb = OUT.stat().st_size / 1024
print(f"{OUT}  {kb/1024:.1f} MB  ({len(images)} varlik gomuldu, ham {raw_total/1024/1024:.0f} MB)")
