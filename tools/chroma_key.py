#!/usr/bin/env python3
"""Saglam chroma key: sabit #FF00FF yerine gercek arka plan rengini olcer.

Neden gerekti: Qwen-Image "solid pure magenta background (#FF00FF)" istense de arka plani
#3F0692 / #A400D5 gibi mor tonlarinda boyayabiliyor. Sabit ±24 tolerans bu durumda hicbir
pikseli silmiyor ve sprite ekrana mor kutuyla geliyor.

Yontem:
  1. Kenar serididen (border ring) medyan renk = anahtar renk.
  2. Yalnizca KENARDAN baslayan tasma-doldurma (flood fill) ile arka plani sil — sprite'in
     icindeki ayni renk tonlari korunur.
  3. 1 px kenar asindirma + yari saydam sacak temizligi.

Kullanim: chroma_key.py assets/*.png     (yerinde yazar, ozet basar)
"""
import sys
from collections import deque

from PIL import Image

TOL = 62          # anahtar renge Oklid uzakligi (0-441 araligi)
EDGE_TOL = 96     # asindirma sirasinda "sacak" sayilan gevsek tolerans


def key_color(px, w, h):
    """Anahtar rengi: once kenar seridinin medyani.

    Kenar medyani, ozne kadraji doldurdugunda yaniltir — Paris cati katmaninda
    boşluklar magenta oldugu halde kenar pikselleri bina oldugu icin anahtar
    "beyaz" olculdu ve arka plan hic silinmedi. Bu yuzden kenar medyani canli
    magenta degilse, tum karedeki EN SIK renge bakariz; o da canli magentaysa
    onu kullaniriz.
    """
    ring = []
    for x in range(w):
        ring += [px[x, 0][:3], px[x, h - 1][:3]]
    for y in range(h):
        ring += [px[0, y][:3], px[w - 1, y][:3]]
    ring.sort(key=lambda c: (c[0], c[1], c[2]))
    edge = ring[len(ring) // 2]
    if edge[0] > 200 and edge[1] < 70 and edge[2] > 150:
        return edge

    from collections import Counter
    step = max(1, min(w, h) // 200)          # buyuk karelerde ornekleyerek say
    counts = Counter()
    for x in range(0, w, step):
        for y in range(0, h, step):
            r, g, b = px[x, y][:3]
            counts[(r // 8 * 8, g // 8 * 8, b // 8 * 8)] += 1
    for (r, g, b), _ in counts.most_common(6):
        if r > 200 and g < 70 and b > 150:
            return (r, g, b)
    return edge


def dist(a, b):
    return ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2) ** 0.5


def process(path, aggressive=False):
    im = Image.open(path).convert("RGBA")
    w, h = im.size
    px = im.load()
    key = key_color(px, w, h)

    seen = [[False] * h for _ in range(w)]
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            q.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            q.append((x, y))

    removed = 0
    while q:
        x, y = q.popleft()
        if x < 0 or y < 0 or x >= w or y >= h or seen[x][y]:
            continue
        r, g, b, a = px[x, y]
        if a == 0:
            seen[x][y] = True
            q.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
            continue
        if dist((r, g, b), key) > TOL:
            continue
        seen[x][y] = True
        px[x, y] = (r, g, b, 0)
        removed += 1
        q.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))

    # 1 px asindirma: saydam komsusu olan ve hala anahtar renge yakin pikselleri temizle
    fringe = 0
    for x in range(w):
        for y in range(h):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            near_alpha = any(
                0 <= x + dx < w and 0 <= y + dy < h and px[x + dx, y + dy][3] == 0
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))
            )
            if near_alpha and dist((r, g, b), key) < EDGE_TOL:
                px[x, y] = (r, g, b, 0)
                fringe += 1

    # Ikinci gecis: anahtar rengi CANLI MAGENTA ise ic bolgeleri de temizle.
    #
    # Kenardan tasma-doldurma, sprite'in ICINDEKI magenta tonlarini bilerek korur
    # (mor bir dusman gemisi silinmesin diye). Ama dron rotorlari, nisan
    # cercevesinin ici gibi "delik" bolgelerde arka plan iceride kalir ve
    # magenta diskler olarak ekrana gelir. Anahtar saf magentaya yakinsa
    # (R yuksek, G cok dusuk, B yuksek) bu renk gercek bir sanat rengi degildir;
    # o zaman tum karede renge gore silmek guvenlidir.
    kr, kg, kb = key
    if kr > 200 and kg < 70 and kb > 150:
        # Yumusak alfa + despill. Piksel-art'ta ikili kesme yeterliydi; render
        # tarzi gorsellerde kenarlar yumusak oldugu icin ikili kesme testere
        # disi ve pembe sacak birakir. Anahtara cok yakin piksel tamamen
        # saydam, SOFT bandindaki piksel kismi saydam olur; ayrica kalan
        # piksellerdeki magenta lekesi (R ve B'nin G'yi asmasi) bastirilir.
        SOFT = TOL * 2.2
        # aggressive: anahtarin KOYU/soluk tonlarini da sil. Model zemine
        # magenta bir golge cizdiginde (ornegin #A0006E) bu renk TOL'un cok
        # disinda kalir ve binanin altinda pembe leke olarak gorunur. Renk
        # tonuna bakariz: kirmizi ve mavi yesili acikca asiyorsa arka plandir.
        def is_key_hue(r, g, b):
            return r > 55 and r > g * 1.55 and b > g * 1.35
        for x in range(w):
            for y in range(h):
                r, g, b, a = px[x, y]
                if a == 0:
                    continue
                d = dist((r, g, b), key)
                if aggressive and d > TOL and is_key_hue(r, g, b):
                    px[x, y] = (r, g, b, 0)
                    removed += 1
                    continue
                if d <= TOL:
                    px[x, y] = (r, g, b, 0)
                    removed += 1
                elif d < SOFT:
                    frac = (d - TOL) / (SOFT - TOL)
                    na = int(a * frac)
                    # despill: magenta kanallarini yesile dogru cek
                    lim = g + int((255 - g) * 0.35)
                    px[x, y] = (min(r, lim), g, min(b, lim), na)
                    fringe += 1

    im.save(path)
    total = w * h
    return key, removed, fringe, total


if __name__ == "__main__":
    for p in sys.argv[1:]:
        key, removed, fringe, total = process(p)
        pct = 100 * (removed + fringe) / total
        print(f"{p}: anahtar #{key[0]:02X}{key[1]:02X}{key[2]:02X} "
              f"silinen {removed}+{fringe} sacak = %{pct:.0f}")
