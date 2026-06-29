# 仓鼠大作战 - 美术素材清单

> 命名与尺寸见 `tools/asset_manifest.json`。新图放 `assets/incoming/` 后运行 `python3 tools/setup_assets.py`。

## 一、角色（`assets/`）

| 文件 | 用途 |
|------|------|
| `cat_sleep.png` … `cat_angry.png` | 猫 9 态 |
| `mouse.png` | 老鼠 |
| `mouse_fail1/2.png` | 失败（体积大，待压缩） |
| `sage.png` | 仙人 |

## 二、房间顶部（靠墙，不可碰撞）

| 文件 | 尺寸 | 摆放 |
|------|------|------|
| `top_stove.png` | 220×72 | 房间上方居中 |
| `top_fridge_white.png` | 78×100 | 左上 |
| `top_fridge_blue.png` | 72×96 | 右上 |

## 三、侧墙（不可碰撞，右墙 flipX）

| 文件 | 尺寸 |
|------|------|
| `wall_chair_brown.png` | 72×78 |
| `wall_chair_grey.png` | 72×78 |
| `wall_appliance_sm.png` | 52×72 |
| `wall_fridge_tall.png` | 62×108 |
| `wall_cabinet_tan.png` | 54×54 |

## 四、装饰小件（可碰撞，短反弹+摇摆）

| 文件 | 尺寸 |
|------|------|
| `decor_trash.png` | 36×40 |
| `decor_bucket.png` | 34×36 |
| `decor_mat.png` | 38×38 |
| `decor_crate.png` / `decor_crate_strap.png` | 38–40 |
| `decor_plant_*.png` / `decor_succulent.png` | 28–42 |
| `decor_chest.png` | 38×34 |

## 五、中央家具（可碰撞、可躲藏）

`sofa_*.png`、`table_round_*.png`、`bench_wood.png`、`cushion_square.png`、`chest_heart.png` 等，程序随机摆放。

## 六、猫窝（3 选 1 出生点）

| 文件 | 尺寸 |
|------|------|
| `catbed_grey.png` | 76×58 |
| `catbed_pink.png` | 76×58 |
| `catbed_round.png` | 74×56 |

## 七、食物（17 种，每关随机不重复）

`food_fish.png`、`food_chicken.png`、`food_nuts_lg.png` … `food_wagashi_red.png`（均 32×32）

## 八、仓鼠皮肤（`assets/skins/hamster/`）

IAA 无内购。皮肤图放 `assets/skins/hamster/`（已改名）或 `assets/incoming/pifu/`（未改名），运行 `python tools/import_skins.py`。

| 文件 | 解锁方式 |
|------|----------|
| `hamster_skin_01.png` … `03` | 开局可选（`default`） |
| `hamster_skin_04.png` | 登录 7 日（`login_day_7`） |
| `hamster_skin_05.png` | 登录 14 日（`login_day_14`） |
| `hamster_skin_06`–`10` | 看广告（`ad_reward`） |
| `hamster_skin_11`–`15` | 任务（`task`） |
| `hamster_skin_16`–`20` | 通关（`level_clear`） |
| `hamster_skin_21`–`30` | 活动（`event`） |

共 30 款，缺 `hamster_skin_07.png` 可跳过。配置见 `tools/skin_manifest.json`（可用 `python tools/gen_skin_manifest.py` 重新生成）。

## 九、打包压缩

仓库根目录 `assets_pack.zip` 含全部 `assets/*.png`，解压替换或压缩后覆盖即可。

## 十、已废弃（勿再使用）

旧版 `fridge.png`、`sofa.png`、`chair.png` 等已删除，统一用 `top_*` / `wall_*` / `decor_*` / `sofa_*` 新素材。
