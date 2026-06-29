# 仓鼠皮肤正式目录

把 `hamster_skin_01.png` … `hamster_skin_30.png` 放在此文件夹。

## 同步到游戏

```bat
cd /d E:\NewProject\maoshugame
python tools\import_skins.py
python tools\repack_assets_zip.py
```

`import_skins.py` 会：缩放图片（140×106）+ 生成 `assets/skins/skin_catalog.json`。

解锁规则见 `tools/skin_manifest.json`。
