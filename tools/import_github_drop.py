#!/usr/bin/env python3
"""从 assets/incoming/github_drop/ 分类文件夹导入素材到 assets/。"""
import json
import re
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DROP = ROOT / "assets" / "incoming" / "github_drop"
MANIFEST = ROOT / "tools" / "asset_manifest.json"
ASSETS = ROOT / "assets"
MAP_OUT = ROOT / "tools" / "github_drop_mapping.json"

FOLDER_GROUPS = {
    "上面靠墙": "top",
    "靠墙": "wall_left",
    "随意": "free",
    "装饰": "decor",
    "食物": "food",
}


def resize_cover(img: Image.Image, w: int, h: int) -> Image.Image:
    src = img.convert("RGBA")
    scale = max(w / src.width, h / src.height)
    nw, nh = max(1, int(src.width * scale)), max(1, int(src.height * scale))
    resized = src.resize((nw, nh), Image.Resampling.LANCZOS)
    left = (nw - w) // 2
    top = (nh - h) // 2
    return resized.crop((left, top, left + w, top + h))


def aspect(w, h):
    return w / h if h else 1.0


def match_by_aspect(files, entries):
    """按宽高比将文件匹配到 manifest 条目（贪心）。"""
    scored = []
    for fp in files:
        with Image.open(fp) as im:
            ar = aspect(im.width, im.height)
        for entry in entries:
            tar = aspect(entry["w"], entry["h"])
            scored.append((abs(ar - tar), fp, entry))
    scored.sort(key=lambda x: x[0])
    used_files = set()
    used_entries = set()
    pairs = []
    for _, fp, entry in scored:
        key = entry["file"]
        if fp in used_files or key in used_entries:
            continue
        used_files.add(fp)
        used_entries.add(key)
        pairs.append((fp, entry))
        if len(pairs) >= len(entries):
            break
    # 未匹配的条目：用剩余文件按顺序填
    rem_files = [f for f in files if f not in used_files]
    rem_entries = [e for e in entries if e["file"] not in used_entries]
    for fp, entry in zip(rem_files, rem_entries):
        pairs.append((fp, entry))
    return pairs


def main():
    with open(MANIFEST, encoding="utf-8") as f:
        manifest = json.load(f)

    mapping_log = {"groups": []}
    total = 0

    for folder_cn, group in FOLDER_GROUPS.items():
        folder = DROP / folder_cn
        if not folder.is_dir():
            continue
        files = sorted(
            [p for p in folder.glob("*.png") if p.name.lower() != "readme.png"],
            key=lambda p: p.name,
        )
        entries = manifest.get(group, [])
        if not files:
            print(f"跳过 {folder_cn}: 无 PNG")
            continue
        if not entries:
            print(f"跳过 {folder_cn}: manifest 无 {group}")
            continue

        pairs = match_by_aspect(files, entries)
        group_log = {"folder": folder_cn, "group": group, "items": []}

        for src, entry in pairs:
            dst = ASSETS / entry["file"]
            img = Image.open(src)
            resize_cover(img, entry["w"], entry["h"]).save(dst, optimize=True)
            group_log["items"].append({
                "from": src.relative_to(ROOT).as_posix(),
                "to": entry["file"],
                "size": f"{entry['w']}x{entry['h']}",
            })
            print(f"OK [{folder_cn}] {src.name} -> {entry['file']}")
            total += 1

        mapping_log["groups"].append(group_log)

    with open(MAP_OUT, "w", encoding="utf-8") as f:
        json.dump(mapping_log, f, ensure_ascii=False, indent=2)
    print(f"\n完成: 导入 {total} 张 -> {MAP_OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
