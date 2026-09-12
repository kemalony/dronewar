#!/usr/bin/env python3
"""Records a golden trace from the web build for the Android `parity` gate.

The web version is the reference implementation. This script drives it in a real
browser, one sim step at a time, and writes every step's state as raw float64 hex.
The Kotlin sim must reproduce the sequence with zero bit difference.

Two rules make the trace meaningful:

  * One tick == exactly one sim step. Clock.advance(ms) runs floor-ish steps from an
    accumulator, so a tick sized to the sim step makes step index and tick index the
    same number. Driving by wall-clock frames instead would run a different number of
    steps at different frame rates and produce a fake parity failure.
  * Input transitions are keyed to SIM STEP INDEX, never to elapsed time.

Numbers are stored as raw IEEE-754 float64 bit patterns. Decimal formatting throws
away exactly the bits this gate exists to compare.

    .venv-mac/bin/python tools/record_trace.py [--steps N] [--out PATH]
"""
from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import struct
import subprocess
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
INDEX = ROOT / "index.html"
GOLDEN_DIR = ROOT / "android" / "harness" / "golden"
SIM_HZ = 120

# Input script, keyed to sim step index. Chosen to exercise acceleration, the
# exponential decay when input stops, diagonal movement, and the boundary clamp
# on both axes -- the four things the player integrator can get subtly wrong.
SCRIPT: list[tuple[int, str, str]] = [
    (0,   "press",   "right"),
    (100, "release", "right"),
    (100, "press",   "left"),
    (250, "release", "left"),
    (300, "press",   "up"),
    (380, "press",   "right"),
    (450, "release", "up"),
    (450, "release", "right"),
    (520, "press",   "down"),
    (600, "release", "down"),
]


def f64hex(x: float) -> str:
    return "f64:0x" + struct.pack(">d", float(x)).hex()


def git_sha() -> str:
    return subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT).decode().strip()


def config_hash() -> str:
    p = GOLDEN_DIR / "config.json"
    if not p.exists():
        return ""
    return hashlib.sha256(p.read_bytes()).hexdigest()[:16]


def record(steps: int) -> tuple[dict, list[dict]]:
    url = f"file://{INDEX}?autotest=1"
    tick_ms = 1000.0 / SIM_HZ

    by_step: dict[int, list[tuple[str, str]]] = {}
    for step, action, key in SCRIPT:
        by_step.setdefault(step, []).append((action, key))

    rows: list[dict] = []
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome")
        page = browser.new_page(viewport={"width": 480, "height": 800})
        errors: list[str] = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(url)
        page.wait_for_function("window.__game !== undefined", timeout=20000)
        # Let every sprite finish loading. An asset still in flight would change the
        # draw path mid-trace, and a half-loaded reference is not a reference.
        page.wait_for_timeout(3000)

        state0 = page.evaluate("window.__game.state()")
        if state0["assetsProcedural"] != 0:
            print(
                f"warning: {state0['assetsProcedural']} sprites fell back to procedural",
                file=sys.stderr,
            )

        page.evaluate("window.__game.startGame()")

        for i in range(steps):
            for action, key in by_step.get(i, []):
                page.evaluate(f"window.__game.{action}({key!r})")
            page.evaluate(f"window.__game.tick({tick_ms!r})")
            s = page.evaluate(
                "(() => { const s = window.__game.state();"
                " return {x: s.player.x, y: s.player.y, vx: s.player.vx,"
                " vy: s.player.vy, mode: s.mode}; })()"
            )
            if s["mode"] != "play":
                raise SystemExit(f"left play mode at step {i}: {s['mode']}")
            rows.append(
                {
                    "step": i,
                    "x": f64hex(s["x"]),
                    "y": f64hex(s["y"]),
                    "vx": f64hex(s["vx"]),
                    "vy": f64hex(s["vy"]),
                }
            )

        if errors:
            raise SystemExit(f"page errors during recording: {errors[:3]}")
        browser.close()

    header = {
        "schema": 1,
        "trace": "player_only",
        "webSha": git_sha(),
        "configHash": config_hash(),
        "simHz": SIM_HZ,
        "tickMs": tick_ms,
        "steps": steps,
        "startState": "startGame",
        "drone": "falcon",
        "script": [{"step": s, "action": a, "key": k} for s, a, k in SCRIPT],
        "note": "player-only trace: no entities, no LCG draws. Positions are raw float64 bits.",
    }
    return header, rows


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--steps", type=int, default=720)
    ap.add_argument("--out", default=str(GOLDEN_DIR / "trace_player.ndjson.gz"))
    args = ap.parse_args()

    header, rows = record(args.steps)
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    with gzip.open(out, "wt", encoding="utf-8") as fh:
        fh.write(json.dumps(header, sort_keys=True) + "\n")
        for r in rows:
            fh.write(json.dumps(r, sort_keys=True) + "\n")

    try:
        shown = out.relative_to(ROOT)
    except ValueError:
        shown = out
    print(f"wrote {len(rows)} steps to {shown}")
    print(f"  webSha={header['webSha'][:12]} configHash={header['configHash']}")
    print(f"  first: {rows[0]}")
    print(f"  last:  {rows[-1]}")


if __name__ == "__main__":
    main()
