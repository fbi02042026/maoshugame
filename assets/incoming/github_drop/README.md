# GitHub 网页上传 · 投放区

把新素材**直接拖到 GitHub 这个文件夹**即可，不用自己改名。  
上传完成后在 Cursor 里说：**「上传好了，帮我整理」**。

## 怎么上传（网页）

1. 打开 https://github.com/fbi02042026/maoshugame  
2. 进入本目录：`assets/incoming/github_drop/`  
3. 点 **Add file → Upload files**  
4. 把 PNG **全选拖进去** → Commit changes  

## 放什么图到这里

| 类型 | 说明 |
|------|------|
| 家具 / 食物 / 装饰 | 压缩包解压后的 PNG，中文名、旧名都可以 |
| 皮肤 | 更推荐直接上传到 `assets/skins/hamster/`（已改好 `hamster_skin_XX.png`） |

## AI 会做什么

1. `git pull` 拉取你上传的文件  
2. 对照 `tools/asset_manifest.json` / `tools/skin_manifest.json` 改名  
3. 挪到 `assets/` 或 `assets/skins/hamster/`  
4. 跑 `import_skins.py` / `setup_assets.py`、`repack_assets_zip.py`  
5. `commit` + `push` 回 GitHub  

**不要**上传到仓库根目录或随便建文件夹，统一放这里最省事。
