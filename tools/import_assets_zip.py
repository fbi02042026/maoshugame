#!/usr/bin/env python3
"""从 assets_pack.zip 或任意 zip 全量导入压缩素材。

用法：
  python tools/import_assets_zip.py assets/incoming/compressed.zip
  python tools/import_assets_zip.py --wipe ~/Downloads/assets_pack.zip
"""
import argparse
import shutil
import sys
import tempfile
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(Path(__file__).resolve().parent))
from import_assets_folder import import_folder  # noqa: E402


def extract_png_folder(zip_path: Path) -> Path:
    tmp = Path(tempfile.mkdtemp(prefix="assets_import_"))
    with zipfile.ZipFile(zip_path) as zf:
        zf.extractall(tmp)
    # zip 根目录可能是 assets/ 或直接是 png
    if (tmp / "assets").is_dir():
        png_dir = tmp / "assets"
    else:
        pngs = list(tmp.rglob("*.png"))
        if not pngs:
            print("错误: zip 里没有 PNG")
            sys.exit(1)
        # 取包含最多 png 的目录
        counts: dict[Path, int] = {}
        for p in pngs:
            counts[p.parent] = counts.get(p.parent, 0) + 1
        png_dir = max(counts, key=counts.get)
    return png_dir


def main():
    parser = argparse.ArgumentParser(description="从 zip 导入压缩素材")
    parser.add_argument("zip_path", help="assets_pack.zip 或含 PNG 的 zip")
    parser.add_argument("--wipe", action="store_true", help="先清空旧素材再导入")
    args = parser.parse_args()

    zip_path = Path(args.zip_path).expanduser().resolve()
    if not zip_path.is_file():
        print("错误: 文件不存在", zip_path)
        sys.exit(1)

    png_dir = extract_png_folder(zip_path)
    try:
        import_folder(png_dir, wipe=args.wipe)
    finally:
        shutil.rmtree(png_dir.parent, ignore_errors=True)


if __name__ == "__main__":
    main()
