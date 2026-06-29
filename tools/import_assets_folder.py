#!/usr/bin/env python3
"""把本地压缩后的 assets 文件夹全量同步到仓库 assets/ 目录。

用法（仓库根目录）：
  python tools/import_assets_folder.py "C:/Users/Admin/Downloads/assets_pack/assets"
  python tools/import_assets_folder.py --wipe "C:/Users/Admin/Downloads/assets_pack/assets"

--wipe：先删除 assets/*.png 里所有旧图，再只保留你提供的文件 + 角色图（若源目录未提供）。
"""
import argparse
import json
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
MANIFEST = Path(__file__).resolve().parent / "asset_manifest.json"

LEGACY_REMOVE = {
    "fridge.png", "stove.png", "counter.png", "cabinet.png", "cabinet2.png",
    "catbed.png", "table.png", "chair.png", "sofa.png", "coffeeTable.png",
    "plant.png", "box.png", "cart.png",
    "food_nut.png", "food_cheese.png", "food_strawberry.png", "food_cookie.png",
    "food_croissant.png", "food_donut.png", "food_cake.png",
}

ROLE_SPRITES = {
    "mouse.png", "cat_sleep.png", "cat_stun.png", "cat_rage1.png", "cat_rage2.png",
    "cat_surprise.png", "cat_alert1.png", "cat_alert2.png", "cat_happy.png",
    "cat_angry.png", "mouse_fail1.png", "mouse_fail2.png", "sage.png",
}


def manifest_files():
    with open(MANIFEST, encoding="utf-8") as f:
        data = json.load(f)
    files = set()
    for group in ("top", "wall_left", "decor", "free", "catbed", "food"):
        for entry in data.get(group, []):
            files.add(entry["file"])
    return files


def wipe_assets(keep: set[str]):
    for p in ASSETS.glob("*.png"):
        if p.name not in keep:
            p.unlink()
            print("删除", p.name)


def import_folder(src: Path, wipe: bool = False):
    if not src.is_dir():
        print("错误: 路径不存在", src)
        sys.exit(1)

    user_pngs = {p.name for p in src.glob("*.png")}
    if not user_pngs:
        print("错误: 源目录没有 PNG 文件")
        sys.exit(1)
    print(f"源目录 {len(user_pngs)} 张 PNG")

    for name in LEGACY_REMOVE:
        p = ASSETS / name
        if p.exists():
            p.unlink()
            print("删除旧版", name)

    if wipe:
        # 全量替换：只保留源目录提供的图；角色图若源里没有则暂留仓库旧版
        keep_before = user_pngs & ROLE_SPRITES
        wipe_assets(keep_before)
        print("已清空旧素材（保留源目录中已有的角色图）")

    copied = 0
    for name in sorted(user_pngs):
        shutil.copy2(src / name, ASSETS / name)
        copied += 1
        print("覆盖", name)

    keep = manifest_files() | user_pngs | ROLE_SPRITES
    for p in list(ASSETS.glob("*.png")):
        if p.name not in keep:
            p.unlink()
            print("删除未使用", p.name)

    total = len(list(ASSETS.glob("*.png")))
    print(f"完成: 复制 {copied} 张，当前 assets/ 共 {total} 张 PNG")
    print("请运行: python3 tools/repack_assets_zip.py")


def main():
    parser = argparse.ArgumentParser(description="导入压缩后的 assets 文件夹")
    parser.add_argument("src", help="本地 assets 文件夹路径")
    parser.add_argument(
        "--wipe", action="store_true",
        help="先删除 assets/ 里全部旧 PNG，再用你的压缩图替换",
    )
    args = parser.parse_args()
    import_folder(Path(args.src).expanduser().resolve(), wipe=args.wipe)


if __name__ == "__main__":
    main()
