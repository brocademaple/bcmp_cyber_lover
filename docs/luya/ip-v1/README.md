# 鹿芽 IP 素材与故事库 v1

2026-10-05 · 本地交付，首位角色为鹿芽。沿用用户已认可的脸、画风、六套造型与六种发型。

## 已交付

- 六张服装与发型三视图：L01 熟悉日常、L02 校园项目、L03 城市散步、L04 阅读看展、L05 居家专注、L06 暖季外出。
- 三张完整场景插画：校园做项目、居家阅读、城市观察。
- 三篇作品共六页：《年份不详》《蓝色明天改》为三格漫画，《先合上电脑》为绘本短篇。旁白和对白由应用排版，保留文字稿。
- 两张已认可的造型／发型板打包进应用。合计17张图，其中15张是本轮新增成图。
- 应用首页与设置的「故事与漫画」进入「人物故事／共同记忆／设定图集」。图集中可展开人物小传与背景；故事已升级为镜头阅读与图文长卷，支持逐句剧情、镜头目录、文字稿、完整原画、续读。

## 查看与启动

本轮验收预览：<http://127.0.0.1:4187/>。首页点「故事与漫画」。首次打开可选择「先看看房间，稍后连接」，阅读无需模型密钥。

长期启动使用桌面现有 `鹿芽-启动预览.command`；它重新构建当前代码并在 Comet 打开4177。命令方式：

```bash
cd /Users/eee/Desktop/code/bcmp_cyber_lover
node scripts/build-luya-preview.mjs
python3 -m http.server 4187 --bind 127.0.0.1 --directory output/luya-preview
```

第一条构建命令显式禁用.env加载，并不向预览包写入模型密钥。4187是隔离的验收浏览器来源；没有清空已有4177或设备数据。

## 内容与来源

- [人物与环境手册](character-bible.md)：正式背景、内在动机、造型、场景道具、连续性与后续边界。
- [故事分镜](story-scripts.md)：六页可编辑文字和画面要求。
- [图像提示词](generation-prompts.json)、[生成与修正记录](generation-record.json)：原始参考、提示词、成图来源；修正了L01/L05多带包及校园图鞋子截断。
- [素材清单](manifest.json)：尺寸、SHA-256、旧资源与数据源码保留基线。
- [素材库首轮验收](acceptance.md)：原始素材与书架的检查记录。
- [剧情画面阅读器 v2](../story-reader-v2/README.md)：镜头与对白对应方式、当前阅读体验及验收。

新增内容分两层：图集背景沿用正式人设；漫画事件改编自小传试稿，标为虚构人物故事，等待作者审阅后再决定哪些进入正式叙事设定。阅读作品不写入聊天记忆、生活事件或关系状态。

本包完成基础视觉与首批生活叙事。独立透明人物层、动画、四季服装全量、固定朋友与家人独立IP、其他角色小传仍可扩展。真实大学、地址、生日、企业履历保持未设定。AI关系阶段按用户要求留到素材与叙事设定确认后。

## 复现检查

```bash
npx tsc --noEmit
npx vitest run
node scripts/verify-luya-ip-assets.mjs
npm run verify:visual-assets
node scripts/verify-chat-history-ordering.js
npm run verify:debug-now
npm run verify:memory-settings
```

![桌面故事书架](evidence/bookshelf-desktop.jpg)
![手机故事书架](evidence/bookshelf-mobile.jpg)
