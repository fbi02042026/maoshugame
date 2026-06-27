# 仓鼠皮肤（已统一命名）

把 `hamster_skin_01.png` … `hamster_skin_30.png` 放在此文件夹（**缺 07 没关系**）。

## 导入

```bat
cd /d E:\NewProject\maoshugame
git pull origin main
python tools\import_skins.py
python tools\repack_assets_zip.py
```

## 解锁规则（IAA 无内购）

| 编号 | 解锁方式 |
|------|----------|
| 01–03 | 开局可选 |
| 04 | 连续登录 7 日 |
| 05 | 连续登录 14 日 |
| 06–10 | 看广告领取 |
| 11–15 | 任务奖励 |
| 16–20 | 通关奖励 |
| 21–30 | 活动赠送 |

配置详情：`tools\skin_manifest.json`
