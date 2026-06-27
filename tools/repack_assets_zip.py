#!/usr/bin/env python3
"""根据当前 assets/ 重新打包 assets_pack.zip"""
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
OUT = ROOT / "assets_pack.zip"

with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as z:
    for p in sorted(ASSETS.rglob("*.png")):
        z.write(p, p.relative_to(ROOT).as_posix())
    manifest = ROOT / "tools" / "asset_manifest.json"
    if manifest.exists():
        z.write(manifest, "tools/asset_manifest.json")
    readme = ASSETS / "incoming" / "README.md"
    if readme.exists():
        z.write(readme, readme.relative_to(ROOT).as_posix())

print(OUT, OUT.stat().st_size // 1024, "KB,", len(list(ASSETS.glob('*.png'))), "png")
