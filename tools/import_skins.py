#!/usr/bin/env python3
"""导入/同步仓鼠皮肤，生成 skin_catalog.json。

用法（仓库根目录）：
  python tools/import_skins.py

两种放图方式（二选一）：
  A. 已改名 hamster_skin_XX.png → 直接放 assets/skins/hamster/
  B. 未改名的原图（皮肤1.png 等）→ 放 assets/incoming/pifu/，脚本会重命名写入 hamster/

优先读取 incoming/pifu；若为空则扫描 assets/skins/hamster/ 并原地处理。
"""
import json
import re
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


def collect_pngs(incoming: Path, out_dir: Path):
    incoming_pngs = sorted(incoming.glob("*.png"))
    if incoming_pngs:
        return incoming_pngs, "incoming"
    out_pngs = sorted(out_dir.glob("*.png"))
    if out_pngs:
        return out_pngs, "hamster"
    return [], None


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

    pngs, source = collect_pngs(incoming, out_dir)
    if not pngs:
        print("未找到皮肤 PNG。请放到以下任一目录后重试：")
        print(f"  1) {out_dir}  （已改好名 hamster_skin_XX.png，推荐）")
        print(f"  2) {incoming}  （未改名的原图，脚本会重命名导入）")
        return

    print(f"来源: {source} ({len(pngs)} 张)")

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
        if source == "incoming":
            print(f"OK {src.name} -> {dst.relative_to(ROOT).as_posix()} ({skin['id']} {skin['unlock']})")
        else:
            print(f"OK {dst.name} ({skin['id']} {skin['unlock']})")
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
    with open(catalog_path, "w", encoding="utf-8") as f:
        json.dump(catalog, f, ensure_ascii=False, indent=2)
    print(f"写入 {catalog_path.relative_to(ROOT).as_posix()}")
    print(f"\n完成: 处理 {copied} 张皮肤")
    if skipped:
        print("未识别:", ", ".join(skipped))


if __name__ == "__main__":
    main()
