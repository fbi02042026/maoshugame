# 仓鼠大作战 · Cocos Creator 移植方案

> 基于 `hamster_battle.html`（约 3447 行 Canvas 单文件）。结论：**可行**；微信/抖音小游戏比 Unity 更合适；逻辑需 TypeScript **重写**，素材与 JSON **可直接复用**。

---

## 一、总体结论

| 维度 | 评估 |
|------|------|
| 玩法逻辑 | 适合移植（状态机、碰撞、关卡数据已抽出） |
| 2D 俯视角 | Cocos 2D + UI 非常匹配 |
| 现有素材 | `assets/**/*.png` 直接用 |
| 小游戏发布 | Creator 微信/抖音导出链成熟 |
| HTML 代码 | **不能**原样嵌入，按模块重写 |
| AI 可完成比例 | 约 **70%～85%** 代码与配置；编辑器预览、真机、提审需你本地完成 |

---

## 二、可直接复用（约 40%）

| 资源 / 数据 | 路径 |
|-------------|------|
| 家具 / 食物 / 角色 PNG | `assets/` |
| 皮肤 | `assets/skins/hamster/`、`skin_catalog.json` |
| 家具尺寸与分类 | `tools/asset_manifest.json` |
| 皮肤解锁规则 | `tools/skin_manifest.json` |
| **关卡与数值（新）** | `tools/game_config.json` |
| 美术规范 | `ASSETS.md`、`RULES.md` |

---

## 三、需要重做（约 50%）

| HTML 模块 | 行号约 | Cocos 对应 |
|-----------|--------|------------|
| Canvas 渲染循环 | 全局 | `Component.update(dt)` |
| `generateMap` + 五类摆放 | 788～1050 | `MapGenerator.ts` |
| `updateCat` 猫 AI | 1148～1800 | `CatController.ts`（**最难**） |
| `updateAction` 玩法 | 2322～2500 | `GameController.ts` |
| `circRectHit` 碰撞 | 604+ | `Collision2D.ts` 或 BoxCollider2D |
| 相机 lerp/zoom | 2239+ | `CameraFollow.ts` |
| UI（菜单/换装/HUD） | 2638+ | Cocos UI 节点 |
| 存档 | `loadSave` | `sys.localStorage` / 微信存储 API |
| WebAudio 音效 | 493+ | `AudioClip` 或暂留程序音 |

---

## 四、猫 AI 状态机（移植时对照表）

`updateCat` 约 **650 行**，状态枚举：

| 状态 | 含义 | 主要转移 |
|------|------|----------|
| `sleeping` | 睡觉 | 警戒满 → `alert`；计时 → `lazy` / `patrol` |
| `lazy` | 懒散 | 警戒 → `alert` |
| `patrol` | 巡逻 | 警戒 → `alert`；发现食物方向 |
| `alert` | 警觉 | 高警戒 → `charging` / `surprised` |
| `surprised` | 吃惊 | 短时 → `chase` |
| `charging` | 蓄力窜出 | → `chase` |
| `chase` | 追逐 | 丢目标 → `patrol`；家具 → `stunned` |
| `stunned` | 眩晕 | 计时结束 → `patrol` |
| `confused` | 困惑 | 撞墙后 |
| `returning` | 回窝 | 警戒低 |

关键常量见 `tools/game_config.json` → `cat`、`difficulty`。

---

## 五、推荐 Cocos 工程结构

```
cocos/HamsterBattle/          ← Creator 工程（本地创建，见 cocos/README.md）
  assets/
    scenes/
      Boot.scene
      Menu.scene
      Game.scene
    scripts/
      core/
        GameManager.ts
        SaveManager.ts
        ConfigLoader.ts       # 读 game_config.json
      map/
        MapGenerator.ts       # placeTopWallFurniture 等
        FurniturePlacer.ts
      character/
        HamsterController.ts
        CatController.ts
        CatStateMachine.ts
      collision/
        CircRect.ts
      ui/
        Joystick.ts
        SkinShopUI.ts
        HUD.ts
    resources/
      config/
        game_config.json
        asset_manifest.json
        skin_catalog.json
    art/                        # 链到 ../../../assets
```

---

## 六、HTML → Cocos 函数对照（移植清单）

| HTML 函数 | 职责 | 优先级 |
|-----------|------|--------|
| `generateMap` | 建墙、摆家具、放食物 | P0 |
| `placeTopWallFurniture` | 顶墙家具 | P0 |
| `placeSideWallFurniture` | 侧墙（右墙 flipX） | P0 |
| `placeFreeFurniture` | 自由家具 | P1 |
| `placeDecorations` | 装饰反弹 | P1 |
| `placeCatBeds` | 猫窝 | P0 |
| `pickUniqueFoods` | 随机食物种类 | P0 |
| `updateCat` | 猫 AI | P0 |
| `updateAction` | 收食物、陷阱、胜负 | P0 |
| `updateOpening` | 开场运镜 | P2 |
| `drawSkinShop` / 皮肤逻辑 | 换装 | P2 |
| `loadSave` / `saveProgress` | 存档 | P2 |
| `drawMenu` / `drawLevelSelect` | 主流程 UI | P1 |

---

## 七、分阶段计划

### Phase 0：核心原型（建议你先做到这步）

- 单场景 Game：第 1 关地图 + 摇杆 + 猫睡觉/巡逻/追逐 + 胜负
- 不做：换装、8 关、陷阱、开场动画
- 验收：手感与 HTML 第 1 关接近

### Phase 1：地图与关卡

- 五类家具摆放、8 关 `game_config.json`
- 陷阱、眩晕、装饰摇摆

### Phase 2：系统

- 主菜单、关卡选择、暂停、结算
- 皮肤商店 + 存档
- IAA 激励视频接口（占位）

### Phase 3：平台

- 微信小游戏构建、真机适配、广告 SDK

---

## 八、分工：你能做多少 / 你要做什么

| 执行方 | 工作内容 |
|--------|----------|
| **AI** | TS 脚本、配置、模块拆分、Git 推送、对照 HTML 修逻辑 |
| **你** | 安装 Creator、建工程、链素材、点预览、真机玩、截图反馈 |
| **你（后期）** | 微信 AppID、提审、运营活动皮肤 |

无法由 AI 代劳：**Cocos 可视化编辑器内拖节点**、**微信开发者工具扫码**、**手感最终拍板**。

---

## 九、Cocos vs Unity vs HTML（本项目的渠道选择）

| 渠道 | 建议 |
|------|------|
| 浏览器 / 快速迭代 | 继续 `hamster_battle.html` |
| 微信 / 抖音小游戏 | **Cocos Creator** |
| TapTap / 原生 App | Unity（见 `UNITY_PORT.md`） |

**双轨策略**：`assets/` + `tools/*.json` 为唯一数据源；HTML 验证玩法，Cocos 做小游戏上架。

---

## 十、配置同步约定

1. 改关卡、猫速、陷阱：优先改 `tools/game_config.json`，再同步 HTML（或反向，但两处要一致）
2. 新家具图：按 `asset_manifest.json` 命名，跑 `setup_assets.py`
3. 新皮肤：按 `skin_manifest.json`，跑 `import_skins.py`

---

## 十一、已知移植注意点

| 项 | 说明 |
|----|------|
| 坐标系 | HTML 画布 Y 向下；Cocos 2D 默认 Y 向上，地图生成时要统一 |
| 碰撞 | HTML 用 `circRectHit`；迁物理引擎后眩晕时长需重调 |
| `hamster_skin_30` | 目录缺第 30 张皮肤图，换装需容错 |
| `updateCatImg` altTimer | HTML 有双倍扣减 bug，Cocos 可顺便修 |

---

## 十二、本地第一步

详见 **`cocos/README.md`**：

1. `git pull origin main`
2. Creator 新建工程到 `cocos/HamsterBattle/`
3. 链 `assets/`、复制 `game_config.json`
4. 对话里让 AI 开始写 Phase 0 脚本

---

*文档版本：2026-06-27 · 对应 main 分支 HTML 版 + 皮肤系统*
