#!/usr/bin/env python3
"""压缩 assets/ 里体积过大的 PNG（不改变游戏内显示效果）。"""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
MIN_KB = 80
# 结算页最大显示高度约 140px，保留 2x 超采样即可
UI_MAX_PX = 280


def maybe_downscale(path: Path) -> bool:
    if path.name not in {"mouse_fail1.png", "mouse_fail2.png"}:
        return False
    img = Image.open(path).convert("RGBA")
    w, h = img.size
    longest = max(w, h)
    if longest <= UI_MAX_PX:
        return False
    scale = UI_MAX_PX / longest
    nw, nh = max(1, int(w * scale)), max(1, int(h * scale))
    img.resize((nw, nh), Image.Resampling.LANCZOS).save(
        path, format="PNG", optimize=True, compresslevel=9
    )
    print(f"{path.name}: 缩放 {w}x{h} -> {nw}x{nh}")
    return True


def optimize(path: Path) -> int:
    before = path.stat().st_size
    maybe_downscale(path)
    if before < MIN_KB * 1024 and path.stat().st_size == before:
        return 0
    img = Image.open(path).convert("RGBA")
    img.save(path, format="PNG", optimize=True, compresslevel=9)
    after = path.stat().st_size
    if after < before:
        print(f"{path.name}: {before // 1024}KB -> {after // 1024}KB")
        return before - after
    return 0


def main():
    saved = 0
    for p in sorted(ASSETS.glob("*.png")):
        saved += optimize(p)
    print(f"共节省 {saved // 1024} KB")


if __name__ == "__main__":
    main()
