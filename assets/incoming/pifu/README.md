# 仓鼠皮肤原图投放（导入前）

把 PNG 放进此文件夹，文件名可用中文，例如：

| 你的文件名 | 导入后 | 解锁方式 |
|-----------|--------|----------|
| `皮肤1.png` | `assets/skins/hamster/hamster_skin_01.png` | 开局可选（默认解锁） |
| `皮肤2.png` | `hamster_skin_02.png` | 开局可选 |
| `皮肤3.png` | `hamster_skin_03.png` | 开局可选 |
| `七日.png` / `7日登录.png` | `hamster_skin_04.png` | 连续登录 7 日赠送 |
| `活动.png` | `hamster_skin_05.png` | 活动奖励 |
| `广告.png` | `hamster_skin_06.png` | 看广告领取（IAA，无内购） |
| `任务.png` | `hamster_skin_07.png` | 任务奖励 |

## 导入命令

在仓库根目录 `E:\NewProject\maoshugame`：

```bat
python tools\import_skins.py
python tools\repack_assets_zip.py
```

更多皮肤：编辑 `tools\skin_manifest.json` 增加条目和 `aliases`，再放图重跑导入。
