# 图片素材下载与替换

## 下载当前素材包

https://github.com/fbi02042026/maoshugame/raw/main/assets_pack.zip

## 用你压缩后的图替换（推荐）

1. 解压 `assets_pack.zip`，在本地删好不要的旧图（角度不对的家具）
2. 在**仓库根目录**执行（把路径改成你的）：

```bat
python tools\import_assets_folder.py "C:\Users\Admin\Downloads\assets_pack\assets"
```

3. 重新打包并提交：

```bat
python tools\repack_assets_zip.py
git add assets assets_pack.zip hamster_battle.html
git commit -m "更新压缩后的美术素材"
git push
```

或在 GitHub 网页：**Upload files** → 把 `assets` 文件夹里所有 PNG 拖进 `assets/` 目录覆盖。

## 已删除的旧版文件（不要再加回来）

`fridge.png` `stove.png` `sofa.png` `chair.png` `table.png` `counter.png` `cabinet.png` `cabinet2.png` `catbed.png` `plant.png` `box.png` `cart.png` `coffeeTable.png` 以及旧 `food_nut.png` 等 — 请用 `top_*` `wall_*` `decor_*` `sofa_*` `food_*` 新命名。
