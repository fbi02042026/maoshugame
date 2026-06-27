#!/usr/bin/env python3
"""Resize incoming art or generate stubs from existing assets."""
import json
import os
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
INCOMING = ASSETS / "incoming"
MANIFEST = Path(__file__).resolve().parent / "asset_manifest.json"


def load_manifest():
    with open(MANIFEST, encoding="utf-8") as f:
        data = json.load(f)
    items = []
    for group in ("top", "wall_left", "decor", "free", "catbed", "food"):
        for entry in data.get(group, []):
            items.append((group, entry))
    return items


def resize_cover(img: Image.Image, w: int, h: int) -> Image.Image:
    src = img.convert("RGBA")
    scale = max(w / src.width, h / src.height)
    nw, nh = max(1, int(src.width * scale)), max(1, int(src.height * scale))
    resized = src.resize((nw, nh), Image.Resampling.LANCZOS)
    left = (nw - w) // 2
    top = (nh - h) // 2
    return resized.crop((left, top, left + w, top + h))


def process_one(filename: str, w: int, h: int, stub: str) -> str:
    out = ASSETS / filename
    incoming = INCOMING / filename
    if incoming.exists():
        src_path = incoming
        source = "incoming"
    else:
        src_path = ASSETS / stub
        source = f"stub:{stub}"
    if not src_path.exists():
        print(f"SKIP {filename}: missing {src_path}")
        return "skip"
    img = Image.open(src_path)
    out.parent.mkdir(parents=True, exist_ok=True)
    resize_cover(img, w, h).save(out, optimize=True)
    print(f"OK {filename} ({w}x{h}) <- {source}")
    return "ok"


def main():
    INCOMING.mkdir(parents=True, exist_ok=True)
    ok = skip = 0
    for _group, entry in load_manifest():
        r = process_one(entry["file"], entry["w"], entry["h"], entry["stub"])
        if r == "ok":
            ok += 1
        else:
            skip += 1
    print(f"Done: {ok} written, {skip} skipped")


if __name__ == "__main__":
    main()
