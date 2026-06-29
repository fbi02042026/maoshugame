# 仓鼠大作战 · Unity 移植可行方案

> 基于当前 `hamster_battle.html` 单文件 Canvas 版本。结论：**可行**，建议分阶段迁移，不要一次性重写。

---

## 一、总体结论

| 维度 | 评估 |
|------|------|
| 玩法逻辑 | 适合移植（状态机、碰撞、关卡数据可迁） |
| 2D 俯视角 | Unity 2D / UGUI 非常匹配 |
| 现有素材 | PNG 可直接用，需统一 PPU 与锚点 |
| IAA 广告 | Unity 有 LevelPlay / AdMob 等，比 Web 更合适 |
| 当前 HTML 代码 | **不适合**原样搬入，需按模块重写 |

---

## 二、可直接复用（约 40%）

| 资源 / 数据 | 说明 |
|-------------|------|
| `assets/**/*.png` | 家具、食物、皮肤、角色图 |
| `tools/asset_manifest.json` | 尺寸、命名、分类 |
| `tools/skin_manifest.json` / `skin_catalog.json` | 皮肤解锁配置 |
| `LEVELS` 关卡表 | 食物数、猫速、陷阱类型 → 改成 ScriptableObject 或 JSON |
| `TRAP_DATA`、`FOOD_TYPES` | 数据表 |
| 美术规范 | `ASSETS.md`、俯视角摆放规则 |
| 设计文档 | `.uploads` 内 V1.0 文档 |

---

## 三、需要重做（约 50%）

| 模块 | 现状 | Unity 做法 |
|------|------|------------|
| 渲染 | Canvas 2D 手绘 | SpriteRenderer / UI Image |
| 场景 | `generateMap()` 拼房间 | Prefab + 地图生成脚本 |
| 猫 AI | JS 状态机 ~800 行 | `CatController` + 状态模式 |
| 碰撞 | 自写 circRect | Collider2D / 自定义网格 |
| 相机 | 手写 lerp/zoom | Cinemachine 或自写 CameraFollow |
| UI | `drawBtn` 画布绘制 | UGUI / UI Toolkit 面板 |
| 存档 | localStorage | PlayerPrefs / JSON 文件 |
| 音效 | WebAudio 振荡器 | AudioClip + AudioSource |
| 输入 | 触摸 + 键盘 | Input System + 虚拟摇杆 UI |

---

## 四、不太适合 / 需替换（约 10%）

| 项 | 原因 | 建议 |
|----|------|------|
| 单文件 3000+ 行 HTML | 难维护、难测试 | 拆成 Assembly 模块 |
| Canvas 即时模式 UI | Unity 无等价物 | 全部改 UGUI 面板 |
| `localStorage` 同步存档 | 不支持 | 云存档另接服务 |
| 浏览器 file:// 路径 | 不适用 | Addressables / Resources |
| WebAudio 程序音效 | 音质有限 | 换成真实音频素材 |
| 部分 `setTimeout` 时序 | 帧率无关 | 改 Coroutine / UniTask |

---

## 五、推荐 Unity 项目结构

```
Assets/
  Art/           # 从 assets/ 迁入
  Prefabs/
    Furniture/   # top_*, wall_*, sofa_*, decor_*
    Characters/
    Food/
  Scenes/
    Boot.unity
    Menu.unity
    Game.unity
  Scripts/
    Core/        # GameManager, SaveSystem
    Cat/         # CatStateMachine
    Hamster/     # PlayerController, SkinSystem
    Map/         # MapGenerator（对应 placeTopWall 等）
    UI/          # Menu, SkinShop, HUD
    Data/        # LevelConfig, SkinConfig ScriptableObjects
  Resources/ or Addressables/
```

---

## 六、分阶段迁移计划

### 阶段 1：原型（核心玩法）

- 单场景：一张地图 + 老鼠移动 + 猫追逐 + 偷食物回洞  
- 复用 PNG，碰撞用 BoxCollider2D  
- 不做了皮肤、关卡选择、广告  

### 阶段 2：内容与地图

- 实现 `generateMap` 等价逻辑：顶墙 / 侧墙 / 装饰 / 自由家具 / 食物  
- 8 关配置 JSON 化  
- 陷阱、眩晕、装饰摇摆  

### 阶段 3：系统

- 主菜单、关卡选择、暂停、结算  
- 皮肤系统 + 存档（对齐 `skin_catalog.json`）  
- IAA 激励视频接口（Unity Ads / 穿山甲等）  

### 阶段 4：打磨

- 音效、粒子、镜头震动  
- 微信 / 抖音小游戏：可考虑 **Tuanjie（团结）** 或继续 Web 壳 + Unity 仅 App  

---

## 七、Web 小游戏 vs Unity App

| 渠道 | 建议 |
|------|------|
| 微信 / 抖音小游戏 | 当前 HTML 版迭代更快；Unity 需专用导出链 |
| TapTap / App | Unity 更合适 |
| IAA 变现 | Unity 广告 SDK 更成熟 |

**双轨策略**：  
- 短期：继续维护 `hamster_battle.html` 验证玩法与素材  
- 中期：Unity 做 App 版，共用 `assets/` 与 JSON 配置  
- 配置双端同步：manifest / skin_catalog 作为唯一数据源  

---

## 八、工作量粗估（技术维度，非日历）

| 阶段 | 涉及子系统 |  invasive |
|------|-----------|----------|
| 原型 | 移动、碰撞、猫追、结算 | 中 |
| 地图 | 5 类摆放 + 关卡 | 中高 |
| 系统 | UI、皮肤、存档、广告 | 中 |
| 打磨 | 特效、多平台 | 低中 |

---

## 九、立即可以做的准备

1. 保持 `asset_manifest.json`、`skin_catalog.json` 为**唯一配置源**  
2. 新图继续按 `top_*` / `food_*` / `hamster_skin_*` 命名  
3. 从 HTML 抽出 `LEVELS`、`TRAP_DATA` 为独立 `levels.json`（便于 Unity `JsonUtility` 读取）  
4. 猫状态枚举与转移表单独写成文档（移植时对照 `updateCat`）

---

*文档版本：2026-06-27 · 对应 main 分支 HTML 版 + 皮肤系统*
