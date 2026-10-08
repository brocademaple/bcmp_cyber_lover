# 鹿芽：剧情与画面阅读器 v2

2026-10-05。三篇首批故事已经接入应用，入口是首页「故事与漫画 → 人物故事」。

## 当前体验

默认采用镜头阅读：一段剧情对应一个具体画面。旁白、心里话、人物对白和手机消息分别排版，读者点「下一句」推进对白，读完该镜头才进入下一幅画面。同一镜头提前为最长一句留出空间，文字推进时画面尺寸保持稳定。绘本保留整张场景插画，漫画按原有分格展示。

「图文长卷」将相同的镜头和台词连成一条连续故事。每幅画面紧接属于它的剧情，人物消息也在发生的镜头旁展开；目录可跳到指定镜头，文字稿可独立阅读。

点击画面可查看当前镜头，切换「整页原画」能看到完整源图；支持放大与拖动。原始图片保持完整，应用仅通过视口显示某一分格。画面加载失败时保留可见提示和剧情文字。

| 作品 | 画面与剧情 | 镜头 |
| --- | --- | --- |
| 年份不详 | 旧招牌照片 → 必填年份卡住 → 保留未知 → 改掉限制 → 保存照片 → 回街上仍无答案 | 6 |
| 蓝色明天改 | 原型跑起来 → 关闭重开验证 → 发截图 → 朋友嫌蓝色 → 鹿芽回应、朋友试用 → 还是改色 | 6 |
| 先合上电脑 | 打断朋友的讨论 → 道歉与第二天重新倾听；每张绘本场景分成多句推进 | 2 |

![对白与当前镜头](evidence/blue-dialogue-mobile.jpg)
![绘本场景](evidence/picturebook-dialogue-mobile.jpg)
![连续图文](evidence/blue-long-mobile.jpg)

## 内容编辑约定

关键假设：用户已认可现有人物外形，本轮沿用这些素材；先以三篇线性短篇验证展示方式。事件继续标为「虚构人物故事」，沿用小传改编来源。阅读不会写入共同记忆、生活事件或 AI 关系状态。正式人物背景沿用已有手册，朋友在这些片段中暂不补造姓名和独立身份。

可编辑源文件：

- `src/config/luyaStoryLibrary.ts`：作品、整页图片、原始文字、来源与图集。
- `src/config/luyaStoryScenes.ts`：镜头顺序、地点时间、原图分格边界、台词及说话者。新增画面应同时补充具体动作、台词和后果，再选择整页绘本或分格漫画。
- `src/utils/storyScenes.ts`：将画面与脚本连接；未配置分镜的新页面保留整页图文阅读。
- `src/components/StorySceneReader.tsx`：两种阅读方式共用同一份脚本。

增加新剧情可以沿用「镜头 ID、画面、场景、旁白／对白」这套结构。当前实现是线性阅读，尚未加入分支选项、音频、动画或 AI 临时续写。

## 阅读记录与保留

阅读记录沿用 `@bcmp_story_reader_v1` 和 version 1，增加可选的稳定 `sceneId`、`lineIndex`。旧的页码记录会进入该页第一个镜头；新增记录能在关闭、重新打开和刷新后续读到同一句话。插入新镜头后仍按稳定 ID 找回位置，删除镜头时退回对应页面。

写入串行处理，快速关闭／重开会等待上一次记录保存。遇到损坏或未知版本的数据，不覆盖原记录。人物 ID、聊天持久化格式和旧素材没有迁移或替换。

## 运行与复现

当前验收预览：<http://127.0.0.1:4187/>。长期启动可双击桌面 `鹿芽-启动预览.command`，它重新构建当前代码并打开 Comet 的4177预览。

```bash
cd /Users/eee/Desktop/code/bcmp_cyber_lover
node scripts/build-luya-preview.mjs
python3 -m http.server 4187 --bind 127.0.0.1 --directory output/luya-preview
```

构建禁用.env载入并扫描预览包中的密钥。验收使用隔离的4187来源，没有清空用户已有数据。

## 验收记录

| 验收项 | 结果与证据 |
| --- | --- |
| 对白与画面对齐 | 三篇实际打开；漫画每格对应脚本，绘本逐句切换，截图见上方 |
| 手机与小屏 | CSS389×845和358×569实际浏览器截图，画面、文字、上一段／下一句可见 |
| 桌面阅读 | CSS1280×900，[桌面截图](evidence/blue-dialogue-desktop.jpg) |
| 目录、长卷、文字稿 | 实际点击目录到镜头2／6，长卷结尾读完返回；查看文字稿后回到原镜头，[长卷结尾](evidence/long-ending-mobile.jpg) |
| 旧进度、细分进度 | 原第2页记录进入镜头4；蓝色故事镜头5第2句关闭重开、刷新后仍恢复到「能用。」；11项进度测试、5项镜头测试通过 |
| 完整原画 | 实际切换「整页原画」，[小屏截图](evidence/full-original-small.jpg) |
| 图集、共同记忆 | 两个入口实际打开；[图集截图](evidence/art-regression-mobile.jpg)。共同记忆保留原示例与管理入口 |
| TypeScript和本轮文件lint | 均通过，日志在evidence下 |
| 全量单元测试 | 107通过，1项真实模型验收跳过；本轮不接入模型关系阶段 |
| 视觉资源 | 114项资源与集中注册验证通过；17项IP资源可解码且引用有效，原60项图片哈希和5项人物／聊天／记忆源码哈希保持一致 |
| 聊天回归 | 聊天排序、历史恢复边界和debug-now检查通过 |

```bash
npx tsc --noEmit
npx eslint src/components/CharacterStoryLibrary.tsx src/components/StorySceneReader.tsx src/config/luyaStoryScenes.ts src/utils/storyScenes.ts src/services/storyReadingProgress.ts tests/storyScenes.test.ts tests/storyReadingProgress.test.ts
npx vitest run
npm run verify:visual-assets
node scripts/verify-luya-ip-assets.mjs
node scripts/verify-chat-history-ordering.js
npm run verify:debug-now
```

截图尺寸与哈希见 [evidence.json](evidence.json)。截图副本仅去掉浏览器工具返回的视口外空白，源图片均未裁切写回。浏览器日志只有已有的expo-notifications网页能力提示；没有发现阅读器运行错误。

本次已验证当前安全导出的网页版本；iOS／Android设备阅读和图片失败重试的故障注入尚未实测。这些证据不代表真实设备或正式发布验收。
