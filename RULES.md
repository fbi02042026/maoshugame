# 仓鼠大作战 - 核心规则备忘录

> **以 `hamster_battle.html` 中的实际代码为准。**

## 0. 铁律：每次改完代码必须测试
- 修改代码后用浏览器打开 `index.html` 验证
- 测试：第1关 → 猫追→撞障眩晕×3→第4次只反弹→装饰摇摆→进洞结算可点

## 1. 难度参数（`DIFFICULTY`）
- `hamsterBaseSpeed: 1.93` 老鼠基础速度
- `hamsterSpeedBoost: 1.75` 被抓后加速倍率
- `hamsterBoostDuration: 1.5` 加速持续(秒)
- `catBaseSpeed: 1.93` 猫基础速度
- `catChaseMultiplier: 1.0` 追逐速度倍率
- `level1RoomScale: 0.5` 第1关房间缩放（家具尺寸不缩放）
- 撞飞距离 20px，无敌 2.5s

## 2. 猫不能卡死
- stunned/confused 跳过转向避障，沿当前方向滑行
- 1.5s 内移动 <15px 自动脱困
- 每帧 `clampCatInBounds` 防止猫出房间

## 3. 猫碰撞眩晕（`G.catHits` + `getStunTime`）
- 追逐/窜出中，速度 ≥50% 追逐速度（或 dash）撞**家具/装饰/墙**可眩晕
- 本关累计眩晕 **3 次后**（`CAT_MAX_STUN_HITS`）只反弹，不再眩晕
- 眩晕时长递减：100% → 50% → 15%
- **装饰小件**（`decor`）：同样可眩晕，但推开距离更短（r+6），被撞后左右摇摆 0.45s
- 撞墙也会计入 catHits 并眩晕（满 3 次后仅反弹）

## 4. 唤醒与追逐
- 吃惊 **0.5s** → 蓄力 **0.5s** → 追逐加速 **1s** 到全速
- 贴脸（≤猫半径+鼠半径+4px）或警戒满 100 → 瞬间醒
- 偷第一个食物 → 警戒瞬间拉满
- 逃出警戒圈后警戒缓慢降至 ≤50 才回窝

## 5. 视野与警戒
- 视野：100px 圆 + **90°** 扇形
- 睡觉时显示警戒圈，不显示视野锥
- 贴着约 4s 警戒满（非贴脸瞬间满）

## 6. 地图与素材摆放
| 类型 | 说明 |
|------|------|
| `top_*` | 房间最上方灶台/冰箱，不可碰撞 |
| `wall_*` | 左墙默认朝向；右墙 `flipX` 水平翻转 |
| `decor_*` | 小件装饰，可碰撞、可眩晕、短反弹、摇摆 |
| 沙发/桌子等 | 中央大件，可躲藏（金色光边） |
| `catbed_*` | 3 个猫窝，每局随机一个作猫出生点 |
| `food_*` | 每关从 17 种中随机抽取，同关不重复 |

## 7. 猫状态 → 图片

| 状态 | 图片 |
|------|------|
| sleeping | catSleep |
| lazy / patrol | catAlert1 |
| alert | catAlert1 ↔ catAlert2 |
| surprised | catSurprise |
| charging（蓄力） | catAngry + 烟雾 |
| chase（未撞） | catAngry |
| chase（撞过） | catRage1 ↔ catRage2 |
| stunned | catStun |
| confused | catHappy → catAlert1 |

## 8. UI 与其他
- 暂停：P / Esc / ⏸；`endGame` 清除 sageHint，结算可点击
- 食物静态金色光边；提示文字自动换行
- 存档：localStorage `hamster_battle_save_v1`
