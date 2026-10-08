# 房间竖屏素材 v2

2026-10-05，按用户确认的“沉浸式场景＋布置抽屉＋有限摆件预设”新增。以旧房间布局为参考，用 imagegen 生成日间/夜间对应竖向构图；两张均为 1086×1448（3:4）。未覆盖、删除或移动任何原图。

| 文件 | SHA-256 |
| --- | --- |
| `assets/luya-art-v2/room-day-portrait.png` | `e0b91715fad2fd1ec7ba57c9eb47d052e0c4418a497b9e8f4ed2a5f6bdf948db` |
| `assets/luya-art-v2/room-night-portrait.png` | `486b89fd9c2b0abd0f0a1599dd51e4e2af2d2f5ed135971481aa6a10e3714c75` |

引用统一放在 `src/utils/luyaArt.ts`。房间用清晰完整前景＋模糊背景延展，旧横图仍是加载回退来源。墙色只影响右侧墙面，摆件是有限程序绘制预设，未承诺任意装修或家具模型。

原始 58 个素材哈希全部未变，证据：`output/playwright/experience-2026-10-05/assets-preservation.json`。
