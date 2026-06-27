#!/usr/bin/env python3
"""把本地压缩后的 assets 文件夹同步到仓库 assets/ 目录。

用法（在你电脑上，仓库根目录执行）：
  python tools/import_assets_folder.py "C:/Users/Admin/Downloads/assets_pack/assets"

或 Mac/Linux：
  python3 tools/import_assets_folder.py ~/Downloads/assets_pack/assets
"""
import json
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
MANIFEST = Path(__file__).resolve().parent / "asset_manifest.json"

# 旧版角度不符的家具，不再保留
LEGACY_REMOVE = {
    "fridge.png", "stove.png", "counter.png", "cabinet.png", "cabinet2.png",
    "catbed.png", "table.png", "chair.png", "sofa.png", "coffeeTable.png",
    "plant.png", "box.png", "cart.png",
    # 旧食物命名（已由 food_* 新图替代）
    "food_nut.png", "food_cheese.png", "food_strawberry.png", "food_cookie.png",
    "food_croissant.png", "food_donut.png", "food_cake.png",
}


def manifest_files():
    with open(MANIFEST, encoding="utf-8") as f:
        data = json.load(f)
    files = set()
    for group in ("top", "wall_left", "decor", "free", "catbed", "food"):
        for entry in data.get(group, []):
            files.add(entry["file"])
    return files


def main():
    if len(sys.argv) < 2:
        print("用法: python tools/import_assets_folder.py <你的assets文件夹路径>")
        sys.exit(1)
    src = Path(sys.argv[1]).expanduser().resolve()
    if not src.is_dir():
        print("错误: 路径不存在", src)
        sys.exit(1)

    user_pngs = {p.name for p in src.glob("*.png")}
    print(f"源目录 {len(user_pngs)} 张 PNG")

    # 删除仓库里的旧版家具
    for name in LEGACY_REMOVE:
        p = ASSETS / name
        if p.exists():
            p.unlink()
            print("删除旧版", name)

    # 复制用户文件（覆盖同名）
    copied = 0
    for name in sorted(user_pngs):
        shutil.copy2(src / name, ASSETS / name)
        copied += 1
        print("覆盖", name)

    # 删除 manifest 外且用户未提供的占位图（用户删掉的）
    keep = manifest_files() | user_pngs
    keep |= {
        "mouse.png", "cat_sleep.png", "cat_stun.png", "cat_rage1.png", "cat_rage2.png",
        "cat_surprise.png", "cat_alert1.png", "cat_alert2.png", "cat_happy.png",
        "cat_angry.png", "mouse_fail1.png", "mouse_fail2.png", "sage.png",
    }
    for p in ASSETS.glob("*.png"):
        if p.name not in keep:
            p.unlink()
            print("删除未使用", p.name)

    print(f"完成: 复制 {copied} 张，当前 assets/ 共 {len(list(ASSETS.glob('*.png')))} 张 PNG")
    print("请运行: python3 tools/repack_assets_zip.py")


if __name__ == "__main__":
    main()
