#!/usr/bin/env python3
"""生成 tools/skin_manifest.json（30 款仓鼠皮肤）。"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = Path(__file__).resolve().parent / "skin_manifest.json"

# IAA 无内购：按编号分配解锁方式
UNLOCK_RULES = [
    (1, 3, "default", "皮肤"),
    (4, 4, "login_day_7", "七日登录"),
    (5, 5, "login_day_14", "十四日登录"),
    (6, 10, "ad_reward", "广告皮肤"),
    (11, 15, "task", "任务皮肤"),
    (16, 20, "level_clear", "通关皮肤"),
    (21, 30, "event", "活动皮肤"),
]


def unlock_meta(n: int):
    for lo, hi, unlock, prefix in UNLOCK_RULES:
        if lo <= n <= hi:
            if unlock == "default":
                name = f"皮肤{n}"
            elif n == 4:
                name = "七日登录"
            elif n == 5:
                name = "十四日登录"
            else:
                name = f"{prefix}{n:02d}"
            return unlock, name
    return "event", f"活动皮肤{n:02d}"


def main():
    skins = []
    for n in range(1, 31):
        unlock, name = unlock_meta(n)
        sid = f"skin_{n:02d}"
        fname = f"hamster_skin_{n:02d}.png"
        skins.append({
            "id": sid,
            "file": fname,
            "name": name,
            "unlock": unlock,
            "sort": n,
            "aliases": [
                f"皮肤{n}", f"皮肤 {n}", f"skin{n}", sid, fname.replace(".png", ""),
            ],
        })
    data = {
        "comment": "仓鼠皮肤 01-30。IAA 无内购。已按 hamster_skin_XX.png 命名时直接放 incoming/pifu 运行 import_skins.py",
        "incoming_dir": "assets/incoming/pifu",
        "output_dir": "assets/skins/hamster",
        "target_size": {"w": 140, "h": 106},
        "skins": skins,
    }
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"Wrote {OUT} ({len(skins)} skins)")


if __name__ == "__main__":
    main()
