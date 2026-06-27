# 图片素材下载与替换

## 下载当前素材包

https://github.com/fbi02042026/maoshugame/raw/main/assets_pack.zip

## 用你压缩后的图全量替换（推荐）

聊天里发的图片**无法自动写进云端仓库**，请用下面任一方式把本地压缩包同步进来。

### 方式 A：本地脚本（最快）

1. 把压缩好的 PNG 放在例如 `C:\Users\Admin\Downloads\assets_pack\assets`
2. 在**仓库根目录**执行（`--wipe` 会先删光旧图再导入）：

```bat
python tools\import_assets_folder.py --wipe "C:\Users\Admin\Downloads\assets_pack\assets"
python tools\repack_assets_zip.py
git add assets assets_pack.zip
git commit -m "更新压缩后的美术素材"
git push
```

### 方式 B：上传 zip 到 GitHub

1. 把你的 `assets_pack.zip` 重命名为 `compressed.zip`，上传到仓库 `assets/incoming/compressed.zip`
2. 在仓库根目录执行：

```bash
python3 tools/import_assets_zip.py --wipe assets/incoming/compressed.zip
python3 tools/repack_assets_zip.py
```

### 方式 C：GitHub 网页直接覆盖

**Upload files** → 把 `assets` 文件夹里所有 PNG 拖进 `assets/` 目录覆盖 → 本地再跑 `repack_assets_zip.py` 提交 zip。

### 可选：压缩过大的角色图

`mouse_fail1/2.png` 等若仍很大，可运行：

```bash
python3 tools/optimize_pngs.py
```

## 已删除的旧版文件（不要再加回来）

`fridge.png` `stove.png` `sofa.png` `chair.png` `table.png` `counter.png` `cabinet.png` `cabinet2.png` `catbed.png` `plant.png` `box.png` `cart.png` `coffeeTable.png` 以及旧 `food_nut.png` 等 — 请用 `top_*` `wall_*` `decor_*` `sofa_*` `food_*` 新命名。
