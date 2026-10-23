# 鹿芽美术第一批：生活与空间

2026-09-30，三个子任务分别规划房间、人物姿态与首页，并完成首页/房间/聊天页嵌入。由主任务通过内置 image_gen 实际生成 5 张新图。生成提示词完整保存于 [prompts.json](prompts.json)，人物参考为原有 `assets/characters/v2/qingning/main.png`。

## 素材

| 文件 | 用途 |
|---|---|
| [room-day.png](../../../assets/luya-art-v1/room-day.png) | 固定机位 3:2 日间共同房间 |
| [room-night.png](../../../assets/luya-art-v1/room-night.png) | 从日间图定向编辑得到的同机位夜景 |
| [life-focus.png](../../../assets/luya-art-v1/life-focus.png) | 4:3 专注项目/笔记画面 |
| [life-reading.png](../../../assets/luya-art-v1/life-reading.png) | 4:3 阅读思考画面 |
| [life-rest.png](../../../assets/luya-art-v1/life-rest.png) | 4:3 安静休息画面 |

图片保存在项目内；生成源文件留在 Codex generated_images，不作为运行时依赖。原有全部人物图、漫画与用户设定保留。

## 三个子任务方案与落地

- 人物：沿用鹿芽脸型、棕眼、长棕发、鹿形发夹、米白针织与灰粉服装；改变为做事、阅读、独处，不要求每张凝视用户。聊天页接入现有 headshot，加载失败可见回退；顶栏实色正常布局；时间与状态有紧凑实色底。
- 首页：大屏大图加侧栏，小屏完整图片加下方操作；生活画面/经典立绘切换仅影响展示。仅在当前居家日程有对应活动时选新插画；外出、时间回拨或加载失败回退旧图。保留所有经典状态图与状态选择。
- 房间：日夜按上海时间切换；灯光独立轻量表现。物品可点区域仅来自已保存的 room.items，点选查看名称与来源，原管理交互保持。

本轮房间是 **插画背景加交互标记**，没有承诺三维摆放系统。墙色以明确标注的“墙面样板”预览，尚未实现插画墙体局部换材质；物品目前用图形标记，未生成独立透明家具。人物生活插画属于氛围呈现，不生成新的实际共同事件。

## 复现与证据

双击桌面 `鹿芽-启动预览.command`，或：

```bash
cd /Users/eee/Desktop/code/bcmp_cyber_lover
node scripts/build-luya-preview.mjs
python3 -m http.server 4177 --bind 127.0.0.1 --directory output/luya-preview
```

使用 Comet 打开 http://127.0.0.1:4177 。已打开的旧页面需刷新。

- [完整工程回归](verification.log)：TypeScript、lint、78项单元测试、消息顺序、debug-now、素材检查与其他既有回归。
- [Expo 导出](build.log)：5张新增图片均列入实际打包资源。
- [桌面首页](home-desktop.png)、[手机首页](home-mobile.png)、[经典立绘切换](classic-mobile.png)、[手机房间](room-mobile.png)、[桌面房间](room-desktop.png)、[手机聊天](chat-mobile.png)。截图来自重新导出的当前 bundle，400×659 小屏与桌面宽屏实测。
- 真实截图发现并修复了房间 Image 固有尺寸导致的裁切、突兀椭圆光层，以及复杂背景上的状态文字对比不足。

本轮不更改聊天、生活、关系或角色持久化结构，没有删除旧素材；未进行原生模拟器美术验收或线上部署。
