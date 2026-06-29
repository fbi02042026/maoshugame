# 新美术素材投放目录

把聊天里发的那批 PNG **按 `tools/asset_manifest.json` 里的文件名** 放进此目录，然后运行：

```bash
python3 tools/setup_assets.py
```

脚本会按 manifest 里的宽高缩放并写入 `assets/` 根目录。  
若某文件不存在，会暂时用旧素材 stub 占位。

## 分组说明

| 分组 | 摆放 | 右墙 |
|------|------|------|
| `top_*.png` | 房间最上方靠墙 | — |
| `wall_*.png` | 左墙（默认朝向） | 右墙时水平翻转 |
| `decor_*.png` | 小件装饰，任意空地 | — |
| `sofa_` / `table_` 等 | 中央大件，程序随机摆 | — |
| `catbed_*.png` | 猫窝，每局随机一个作猫出生点 | — |
| `food_*.png` | 食物，每关随机不重复 | — |

压缩完成后用你自己的图覆盖 `assets/*.png` 或重新放入此目录再跑脚本。
