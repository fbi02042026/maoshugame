#!/usr/bin/env python3
"""从 assets/incoming/pifu 导入并重命名仓鼠皮肤。

用法（仓库根目录）：
  python tools/import_skins.py

把原图放进 assets/incoming/pifu/，支持中文名如 皮肤1.png、七日.png。
输出到 assets/skins/hamster/，并生成 assets/skins/skin_catalog.json 供游戏读取。
"""
import json
import re
import shutil
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = Path(__file__).resolve().parent / "skin_manifest.json"


def norm_key(s: str) -> str:
    s = Path(s).stem.lower()
    s = re.sub(r"[\s_\-]+", "", s)
    s = s.replace(".png", "")
    return s


def resize_cover(img: Image.Image, w: int, h: int) -> Image.Image:
    src = img.convert("RGBA")
    scale = max(w / src.width, h / src.height)
    nw, nh = max(1, int(src.width * scale)), max(1, int(src.height * scale))
    resized = src.resize((nw, nh), Image.Resampling.LANCZOS)
    left = (nw - w) // 2
    top = (nh - h) // 2
    return resized.crop((left, top, left + w, top + h))


def build_alias_map(skins):
    mapping = {}
    for skin in skins:
        keys = {norm_key(skin["file"]), norm_key(skin["id"])}
        for alias in skin.get("aliases", []):
            keys.add(norm_key(alias))
        for k in keys:
            if k:
                mapping[k] = skin
    return mapping


def match_skin(filename: str, alias_map: dict, skins_by_id: dict):
    key = norm_key(filename)
    if key in alias_map:
        return alias_map[key]
    stem = Path(filename).stem.lower()
    m = re.match(r"hamster_skin_(\d+)$", stem)
    if m:
        sid = f"skin_{int(m.group(1)):02d}"
        return skins_by_id.get(sid)
    m = re.match(r"^皮肤(\d+)$", Path(filename).stem.replace(" ", ""))
    if m:
        sid = f"skin_{int(m.group(1)):02d}"
        return skins_by_id.get(sid)
    return None


def main():
    with open(MANIFEST, encoding="utf-8") as f:
        data = json.load(f)

    incoming = ROOT / data.get("incoming_dir", "assets/incoming/pifu")
    out_dir = ROOT / data.get("output_dir", "assets/skins/hamster")
    tw = data["target_size"]["w"]
    th = data["target_size"]["h"]
    skins = data["skins"]
    skins_by_id = {s["id"]: s for s in skins}
    alias_map = build_alias_map(skins)

    incoming.mkdir(parents=True, exist_ok=True)
    out_dir.mkdir(parents=True, exist_ok=True)

    pngs = sorted(incoming.glob("*.png"))
    if not pngs:
        print(f"提示: {incoming} 里没有 PNG，请把皮肤图放进该文件夹后重试")
        return

    used_ids = set()
    copied = 0
    skipped = []
    imported = []

    for src in pngs:
        skin = match_skin(src.name, alias_map, skins_by_id)
        if not skin:
            skipped.append(src.name)
            print("跳过（未在 manifest 登记）:", src.name)
            continue
        if skin["id"] in used_ids:
            print("警告: 重复匹配", skin["id"], "<-", src.name)
        used_ids.add(skin["id"])
        dst = out_dir / skin["file"]
        img = Image.open(src)
        resize_cover(img, tw, th).save(dst, optimize=True)
        print(f"OK {src.name} -> {dst.relative_to(ROOT).as_posix()} ({skin['id']} {skin['unlock']})")
        copied += 1
        imported.append(skin)

    catalog = {
        "version": 1,
        "character": "hamster",
        "monetization": "iaa_no_iap",
        "skins": [
            {
                "id": s["id"],
                "file": f"assets/skins/hamster/{s['file']}",
                "name": s["name"],
                "unlock": s["unlock"],
                "sort": s["sort"],
            }
            for s in sorted(imported, key=lambda x: x["sort"])
        ],
    }
    catalog_path = ROOT / "assets" / "skins" / "skin_catalog.json"
    catalog_path.parent.mkdir(parents=True, exist_ok=True)
    with open(catalog_path, "w", encoding="utf-8") as f:
        json.dump(catalog, f, ensure_ascii=False, indent=2)
    print(f"写入 {catalog_path.relative_to(ROOT).as_posix()}")

    print(f"\n完成: 导入 {copied} 张")
    if skipped:
        print("未识别文件:", ", ".join(skipped))
        print("请在 tools/skin_manifest.json 为该皮肤添加 aliases 后重跑")


if __name__ == "__main__":
    main()
