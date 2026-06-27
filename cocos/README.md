# Cocos 本地工程 · 快速上手

> 在仓库内创建 Cocos Creator 工程，与 HTML 版共用 `assets/` 与 JSON 配置。

---

## 一、你需要安装的

| 软件 | 版本建议 | 下载 |
|------|----------|------|
| Cocos Creator | **3.8.x LTS** | https://www.cocos.com/creator-download |
| Git | 已有 | — |
| Python | 3.x（整理素材用） | 已有 |

---

## 二、推荐目录结构

把 Cocos 工程建在仓库里的 `cocos/HamsterBattle/`，这样美术不用复制两份：

```
E:\NewProject\maoshugame\
  assets\                    ← HTML 与 Cocos 共用 PNG
  tools\
    game_config.json         ← 关卡/陷阱/数值
    asset_manifest.json
  cocos\
    HamsterBattle\           ← 你用 Creator 新建的工程放这里
      assets\
      settings\
      project.json
  hamster_battle.html        ← 对照用原版
```

---

## 三、创建工程（第一次）

1. 打开 **Cocos Dashboard** → **新建** → **空项目**
2. 项目名：`HamsterBattle`
3. 路径选：`E:\NewProject\maoshugame\cocos\HamsterBattle`
4. 渲染：选 **2D**
5. 语言：**TypeScript**

创建完成后先 **保存场景** 为 `assets/scenes/Boot.scene`（或默认 scene 改名）。

---

## 四、拉取最新文档与配置

```bat
cd /d E:\NewProject\maoshugame
git pull origin main
```

本次 pull 会拿到：

- `COCOS_PORT.md` — 完整移植方案与模块对照
- `tools/game_config.json` — 关卡表、猫常量、食物类型
- 本文件 `cocos/README.md`

---

## 五、把仓库素材链进 Cocos（二选一）

### 方式 A：符号链接（推荐，省磁盘）

在 **管理员 cmd** 里执行（只需一次）：

```bat
cd /d E:\NewProject\maoshugame\cocos\HamsterBattle\assets
mklink /D art ..\..\..\assets
```

Cocos 里会出现 `assets/art/`，里面就是全部 PNG。

### 方式 B：复制（简单但占空间）

```bat
xcopy /E /I /Y E:\NewProject\maoshugame\assets E:\NewProject\maoshugame\cocos\HamsterBattle\assets\art
```

以后换图要重新复制，或改脚本；试玩阶段可用。

### 配置 JSON

同样链或复制 `tools` 里的 JSON 到 Cocos `assets/resources/config/`：

```bat
mkdir E:\NewProject\maoshugame\cocos\HamsterBattle\assets\resources\config
copy /Y E:\NewProject\maoshugame\tools\game_config.json E:\NewProject\maoshugame\cocos\HamsterBattle\assets\resources\config\
copy /Y E:\NewProject\maoshugame\tools\asset_manifest.json E:\NewProject\maoshugame\cocos\HamsterBattle\assets\resources\config\
copy /Y E:\NewProject\maoshugame\assets\skins\skin_catalog.json E:\NewProject\maoshugame\cocos\HamsterBattle\assets\resources\config\
```

> `resources` 目录下的文件可用 `resources.load('config/game_config')` 加载。

---

## 六、Creator 项目设置建议

打开 **项目 → 项目设置**：

| 项 | 建议值 | 原因 |
|----|--------|------|
| 设计分辨率 | 432 × 768 | 与 HTML `GW/GH` 一致 |
| 适配 | SHOW_ALL 或 FIXED_HEIGHT | 竖屏手游 |
| 物理 | 2D，可先用自定义碰撞 | HTML 用圆-矩形，不必强行 Box2D |
| 帧率 | 60 | 与 HTML `requestAnimationFrame` 接近 |

---

## 七、Phase 0 验收标准（第一版可玩）

先不做菜单/换装，只验证核心：

- [ ] 第 1 关地图能生成（墙 + 少量家具 + 1 个食物）
- [ ] 仓鼠摇杆移动，不能穿墙
- [ ] 猫初始睡觉，靠近会警戒并追逐
- [ ] 捡到食物、回鼠洞算赢

对照 HTML：浏览器打开 `index.html` 玩第 1 关，Cocos 手感应接近。

---

## 八、你和 AI 怎么配合

| 你本地做 | AI（对话里）做 |
|----------|----------------|
| 装 Creator、建空工程 | 写 `assets/scripts/` 下 TS 脚本 |
| 预览 / 构建 / 微信开发者工具 | 移植 `updateCat`、地图生成等逻辑 |
| 截图 + 报错发我 | 改代码、`git push` 到分支 |
| 申请微信 AppID（后期） | 接广告占位、存档适配 |

**反馈模板**（复制填空）：

```
Phase: 0
问题：猫追不上 / 穿墙了 / 黑屏
操作：第1关，摇杆往右走 3 秒
报错：（控制台红字粘贴）
截图：（如有）
```

---

## 九、不要把整个 Cocos 工程提交进 Git

`cocos/HamsterBattle/library/`、`temp/`、`local/` 体积大且是缓存。

若要把脚本纳入版本管理，可二选一：

1. **推荐**：Cocos 工程仍放本地，只把 `cocos/scripts/` 同步目录放到仓库（AI 后续会加）
2. 或在 `cocos/HamsterBattle/.gitignore` 里忽略 `library/`、`temp/`，只提交 `assets/scripts` 和 `settings`

当前阶段：**你先本地建工程试跑即可**，脚本由下一波对话推送。

---

*对应仓库 main · 详见 `COCOS_PORT.md`*
