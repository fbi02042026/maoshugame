# 图片素材下载

## 一键打包（推荐）

下载 **`assets_pack.zip`**（约 3MB，含全部 PNG + 命名清单）：

- **main 分支直链：**  
  https://github.com/fbi02042026/maoshugame/raw/main/assets_pack.zip

- **最新开发分支直链：**  
  https://github.com/fbi02042026/maoshugame/raw/cursor/pause-save-docs-test-1704/assets_pack.zip

在 GitHub 网页上也可以：**进入仓库 → 点 `assets_pack.zip` → 点右上角 Download 按钮**。

## 不下载 zip 时

直接在仓库里打开 **`assets/`** 文件夹，里面是全部单张 PNG。

## 压缩替换流程

1. 解压 `assets_pack.zip`
2. 用压缩后的 PNG **按原文件名**覆盖
3. 把文件放回仓库 `assets/` 目录，或放进 `assets/incoming/` 后运行：

```bash
python3 tools/setup_assets.py
```

## 摆放规则（与游戏一致）

| 类型 | 文件名前缀 | 摆放 |
|------|-----------|------|
| 上面靠墙 | `top_` | 房间最上方 |
| 左右靠墙 | `wall_` | 左墙默认，右墙自动翻转 |
| 装饰小件 | `decor_` | 空地随机 |
| 大件家具 | `sofa_` `table_` 等 | 空地随机 |
| 猫窝 | `catbed_` | 上方区域，随机选一个出生 |
| 食物 | `food_` | 全图随机，每关不重复 |
