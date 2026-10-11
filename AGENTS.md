# Project Agent Instructions

## Non-Negotiable: Preserve Local User Data

This app is a companion/chat product. User chat history, memories, diaries,
anniversaries, relationship state, service settings, and selected character data
are product-critical local data. Code changes must not make existing local data
disappear, become unreadable, or get silently overwritten.

Before changing any code that touches chat, characters, storage, onboarding,
settings, message ordering, archives, or app initialization:

- Treat existing user data as production data, even in local development.
- Do not change storage keys, character ids, message schema, or persistence
  format without an explicit migration path.
- Do not clear `AsyncStorage`, file-system backups, or local app data as a fix.
- Do not replace persisted default characters in a way that loses user edits,
  memories, diaries, anniversaries, or emotional state.
- Do not make UI changes that only hide missing history. Trace the load path and
  persistence layer first.

The current chat persistence boundary is:

- `src/services/chatPersistence.ts`
- `src/store/chatStore.ts`
- `src/utils/chatHistory.ts`

Chat records must continue to be recoverable from all supported sources:

- primary indexed records: `@bcmp_chat_db_v1_${characterId}`
- legacy records: `@bcmp_messages_${characterId}`
- file backups under `FileSystem.documentDirectory/bcmp-chat-backups/`

If storage behavior changes, update the persistence layer and keep backward
compatibility. Loading should migrate old data forward instead of returning an
empty conversation.

## Required Verification For Chat Or Storage Changes

Run these checks after any change that may affect chat history, message order,
archives, character data, settings, or AI message flow:

```bash
npx tsc --noEmit
node scripts/verify-chat-history-ordering.js
npm run verify:debug-now
```

If a check cannot be run, state the exact reason in the final response. Do not
claim a chat/storage change is safe without either running these checks or
explaining the verification gap.

## Expected Fix Pattern

When a user reports that chat records disappeared after an update:

1. Inspect the real load and save path before changing UI.
2. Check whether records still exist under legacy keys or file backups.
3. Add a migration or fallback read path if records are present but unreadable.
4. Keep the old key readable for at least one full migration cycle.
5. Verify with the commands above.

Assumption for future agents: preserving the user's existing interaction history
has higher priority than visual polish, refactors, or cleanup.

## Non-Negotiable: Preserve Visual Assets

Character artwork, avatars, memory comics, theme decorations, icons, and all
files under `assets/**` are product-critical UI assets. Code or feature changes
must not make existing assets disappear, become unreadable, render nearly
transparent, get cropped into unusable fragments, or become hidden behind
overlays.

Assumption for future agents: every project change can accidentally affect
visual assets through bundling, persisted character data, theme overlays,
layout stacking, or image-loading behavior. Treat image/material preservation as
a required regression point for every update, even when the requested change
does not sound visual at first.

Before changing any code that touches screens, themes, character rendering,
image loading, navigation chrome, onboarding, memory views, chat bubbles, or
layout layers:

- Keep existing `require(...)` asset references working unless there is an
  explicit replacement and fallback path.
- Do not delete, rename, move, or regenerate assets without updating every
  import/reference and checking the rendered screen.
- Treat `opacity`, `zIndex`, `position`, `resizeMode`, gradients, masks, and
  background overlays as asset-risk changes. Avoid values that make artwork look
  blank or washed out.
- Prefer visible fallbacks for failed image loading instead of silently showing
  an empty white area.
- Do not fix a visual issue by hiding the image container. Trace the render path,
  asset reference, layer order, and persisted character fallback first.

## Required Verification For Visual Assets

Run these checks after any change that may affect app screens, themes, layout,
navigation, character data, image loading, asset imports, Expo bundling, or
rendering behavior:

```bash
npx tsc --noEmit
npm run verify:visual-assets
```

For changes touching a visible screen, also verify the affected screen in the
simulator, a screenshot, or an Expo export/build output that lists bundled
assets. A blank/white area where character artwork or materials should appear is
a release blocker, not an acceptable cosmetic issue.

The visual definition of done is actual rendered pixels, not just successful
compilation. Do not mark a visual or screen-affecting change complete only
because TypeScript passes, the asset file exists, or Expo export lists the asset.
At least one rendered proof is required:

- a fresh simulator screenshot after reloading or rebuilding the current bundle;
- a browser/simulator screenshot for web or Expo previews;
- an automated visual smoke test that inspects the screenshot and fails when the
  expected artwork area is blank, all-white, all-black, or only a gradient.

If the simulator is showing an old static bundle, start the current dev server
or rebuild/reinstall before taking the screenshot. If that is blocked, say so
explicitly and do not claim the visible-screen fix is complete.

Prefer stable asset architecture over per-screen patches:

- Keep default character asset mapping centralized in `src/store/chatStore.ts`
  or a dedicated asset registry module. Do not duplicate incompatible mappings
  across screens.
- Preserve old default character ids and aliases when ids are renamed. If an id
  changes, add a migration or alias map so persisted settings and characters
  still hydrate the correct assets.
- Each default character must have a bundled local fallback for main image,
  avatar/headshot, idle frames, and memory scene. Remote/custom images may add to
  this, but must not replace the bundled fallback.
- Image containers must reserve stable dimensions and render a visible fallback
  while the preferred image loads. Avoid relying on a single absolute background
  layer with no foreground fallback.
- Any change to `opacity`, `zIndex`, absolute positioning, gradients, masks,
  `resizeMode`, SafeArea layout, or animation timing must be treated as an image
  visibility risk and checked on the actual screen.

If visual verification cannot be run, state the exact reason in the final
response and name the remaining risk. Do not claim an update preserved images or
materials without either running the checks above or explaining the verification
gap.

When a user reports that images or materials disappeared after an update:

1. Check that the asset files still exist under `assets/**`.
2. Inspect the real `require(...)` or URI path used by the screen.
3. Check whether persisted character/settings data is missing new asset fields
   and needs a non-destructive fallback merge.
4. Check layout and theme overlays for opacity, z-index, clipping, and
   `resizeMode` regressions.
5. Run `npx tsc --noEmit` and, when possible, verify the affected screen in the
   simulator or with a screenshot before claiming the fix is complete.

## 饮之视觉（Visual Style, locked 2026-10-11；无框 HUD 2026-10-11）

Source of truth: this section. Change it only after the user confirms. Any
front-end change (screens, themes, components, generated UI art, Pages 门面)
must follow it. Old theme switching (都市清透 / 甜美柔软 etc.) is removed; only
this pink-gold set remains. Full style memo: `/workspace/style-specs/yinzhi.md`.

### 定位

- 仓库仍叫 `bcmp_cyber_lover`，产品和页面名叫「饮之」。
- 气质是温柔陪伴、软引导，不是恋爱向。粉色表示柔软和安静。
- 鹿芽是引导者，带你把一段记忆聊完，然后回去过自己的日子。
- 不要爱心、亲密度、心动、情侣构图这类字眼、图标和素材。
- 借鉴乙游的是 HUD 布局和沉浸手法，不借恋爱数值和恋爱文案。
- 不借个人主页的海蓝金，不套 Noto Serif SC。
- 文案直接说是什么；不要写「不是……而是……」这类句式。

### 字体（已锁）

| 用途 | 字体 | 文件 |
|---|---|---|
| 标题、字标、大标题、名签 | 站酷小薇 ZCOOL XiaoWei | `assets/fonts/ZCOOLXiaoWei-Regular.ttf` |
| 标题缺字补字 | 源泉圆体 GenSenRounded2 TW Medium | `assets/fonts/GenSenRounded2TW-M.otf` |
| 正文、选项、说明、按钮 | 源泉圆体 GenSenRounded2 TW Regular | `assets/fonts/GenSenRounded2TW-R.otf` |
| 正文强调（可选） | GenSenRounded2 TW Medium | 同上 M |

- 字体加载入口：`src/utils/appFonts.ts`（启动时 expo-font 加载）。
- 用完整字库本地加载。不要走 Google Fonts 子集，子集会缺字变方块。
- 缺字只替换那几个字，对齐粗细和大小，不让它跳出来。Web 写法：
  `font-family: "ZCOOL XiaoWei", "GenSenRounded2 TW", sans-serif`。
- 不要用站酷快乐体做标题（太卡通）。不要整页用小薇（小字太细、偏宋）。

### 颜色（已锁）

| 用途 | 色值 |
|---|---|
| 主色粉：主入口、淡底、轻发光 | `#E7A0B4` |
| 香槟金：角饰、下划线、焦点点缀 | `#C4A574` |
| 页面底色（立绘缺失时兜底） | `#FBF6F3` |
| 浮层浅底（对话条 / 临时半屏） | `#FFFDFB` |
| 正文文字 | `#3C3032` |
| 次要文字 / 说明 | `#8A735C` |
| 字标 / 次入口文字 | `#6E5430` |
| 默认细线 | `#EADFCE` |

- 粉色优先做主入口和很淡的底，不要整栏铺满顶栏。
- 香槟金做点缀和可读性描边，不铺大面积。

### 无框 HUD（主场景必守）

主场景：立绘全屏铺在底层；文案和功能入口悬浮在立绘四周；人物脸和上半身保持可见。
**主场景禁用**卡片墙、方框容器、整块面板装功能。

**可叠在立绘上（主场景 HUD）：**
- 角色名签（鹿芽）
- 当前记忆瓶名 / 茶馆状态短标签
- 时间或场景一句短状态（≤12 字）
- 少量功能入口：茶馆、记忆瓶、设置、导出（每屏 ≤5 个）
- 对话条（底部一条）
- 单行提示 / 轻 toast

**不可叠，进二级半屏层或独立页：**
- 长文、复盘全文、理解卡长正文
- 设置表单、钥匙输入、导出选项列表
- 记忆瓶列表、归档列表、筛选结果
- 多段说明、条款、帮助长文

二级层：从底部或一侧滑入，高度约屏高 **45%～70%**，半透磨砂，立绘仍在背后虚化可见。关闭后回到无框主场景。

#### 人物安全区（竖屏 375×812 基准）

| 区域 | 竖屏占比 | 用途 |
|---|---|---|
| 上安全带 | 顶 0%～12% | 名签、短状态；避开刘海/状态栏 |
| 人物核心区 | 高约 18%～68%、宽约 22%～78% | 脸和上半身；禁止放入口和长文 |
| 左/右边带 | 各宽约 0%～18% / 82%～100% | 圆形入口、图标+短标签，竖排 |
| 下安全带 | 底 0%～22% | 对话条、主入口一行 |
| 对话条高度上限 | ≤屏高 18%（约 140～160px @812） | 最多 3 行正文 + 名签一行 |

横屏 / 桌面（宽 ≥768）：立绘仍铺满可视区；HUD 收到左右两侧边带（各约 160～220px）；人物核心区居中约 40%～60% 宽；对话条贴底，高度上限约 120px。

实现：用 `--safe-top / --safe-bottom / --safe-side`；入口 `position: absolute` 钉在边带，热区不伸进人物核心区。

#### 字体层级（L1–L5）

| 档 | 用途 | 字体 | 字号 | 字重 | 字距 | 行高 |
|---|---|---|---|---|---|---|
| L1 大标题 | 开场字标、记忆瓶大题 | 小薇（缺字补圆体） | 40～56px | Regular | 0.04em | 1.15 |
| L2 名签 | 鹿芽、房间/瓶名 | 小薇 | 18～22px | Regular | 0.06em | 1.2 |
| L3 对话正文 | 对话条内文 | 圆体 Regular | 16～17px | Regular | 0.02em | 1.45 |
| L4 入口标签 | 茶馆、设置等 | 圆体 Regular / Medium | 13～14px | Regular | 0.03em | 1.3 |
| L5 辅助小字 | 时间、提示、禁用说明 | 圆体 Regular | 11～12px | Regular | 0.02em | 1.4 |

叠字可读性（可组合）：文字描边、柔和投影、对话条背后局部压暗渐变。**禁止**用实色大方块垫字；禁止把五档压成同一档。

#### 可点区域（看得出可点，不装框）

- 图标 + 短文字（L4）；圆形入口直径 44～56px（粉淡底或金细环）
- 细金线下划 `1.5px solid #C4A574`；角标香槟金小 L（8～12px 臂长）
- 轻发光仅悬停/焦点：`0 0 12px rgba(231,160,180,.35)`
- 热区最小 **44×44px**；相邻入口中心距 ≥56px
- 图标透明底；字用黑色 `#3C3032`（次入口可用 `#6E5430`）

#### 立绘层

- 全屏铺底 `object-fit: cover`，锚点偏上（脸落在人物核心区）
- 优先 Live2D / 2.5D：待机呼吸、眨眼；触碰轻反馈；呼吸周期约 3～4s
- 视差：背景位移约为前景 40%～60%；手指/鼠标映射 ±8～12px
- 降级：静态立绘 + 轻视差 + CSS 呼吸（`scale` 1.0↔1.015，4s）
- 立绘缺失：回退 `#FBF6F3` + 淡粉径向光斑，HUD 规则不变

### Chrome 语言（适配无框 HUD；参考图「中饰」）

1. **金框 L 角饰**：只用在屏幕四角，或当前焦点入口旁一角；臂长 10～14px，线宽 1.5px，色 `#C4A574`。**禁止围成完整方框。**
2. **悬浮名签**：角色名、瓶名用独立名签，字用小薇 L2；底用极淡椭圆光斑或 `rgba(255,253,251,.55)` 小条，可加 1px 金细线。禁止做成厚卡片。
3. **半透玻璃**：只用于对话条和二级半屏层。禁止用玻璃大卡片装一排功能。
4. **粉金胶囊**：主操作在对话条内或半屏层内可用胶囊；主场景边带入口优先圆形 + 短标签。
5. **圆形入口**：进茶馆、进记忆瓶等主场景入口用圆形（直径 44～56px）。

**主场景一律停用：** 卡片墙、方框容器、整块面板装功能；选中卡外圈粗描边装一整块内容；卡片圆角 16～18px 的内容格栅；半透玻璃铺成多张功能卡；爱心 / 亲密度条 / 心动图标 / 情侣构图。

### 状态（无框版）

- 主入口 / 主操作：粉 `#E7A0B4` 淡底或胶囊，文字 `#3C3032`；可加轻粉发光。
- 次入口：透明，金细环或金下划，文字 `#6E5430`。
- 当前选中：金下划 2px，或金环 2px；角上可加小 L 角饰。
- 对话条：玻璃 + 底部压暗渐变；名签在条上方或条内左上。

### 圆角与间距

- 主场景入口：正圆（9999px）或无圆角文字链。
- 对话条：顶角 12～16px，底边贴屏可直角。
- 二级半屏层：顶角 16～20px。
- 胶囊（仅条内/半屏内）：999px。
- 主场景禁止再使用「内容卡片 16～18px 圆角格栅」。
- 字号以 L1–L5 为准；大标题用 L1 的 `clamp`，随屏宽收。

### CSS 变量与类名建议

```css
:root{
  --bg:#FBF6F3; --surface:#FFFDFB;
  --text:#3C3032; --muted:#8A735C; --accent:#6E5430; --line:#EADFCE;
  --pink:#E7A0B4; --gold:#C4A574;
  --font-title:"ZCOOL XiaoWei","GenSenRounded2 TW",sans-serif;
  --font-body:"GenSenRounded2 TW",sans-serif;
  --fs-l1:clamp(40px,8vw,56px);
  --fs-l2:20px; --fs-l3:16px; --fs-l4:13px; --fs-l5:12px;
  --safe-top:12%; --safe-bottom:22%; --safe-side:18%;
  --core-top:18%; --core-bottom:68%; --core-left:22%; --core-right:78%;
  --glass:rgba(255,253,251,.72); --glass-blur:12px;
  --hit-min:44px; --glow-pink:0 0 12px rgba(231,160,180,.35);
  --text-shadow-on-art:0 1px 2px rgba(60,48,50,.35),0 0 12px rgba(251,246,243,.55);
  --dialogue-veil:linear-gradient(to top,rgba(60,48,50,.42),rgba(60,48,50,.18) 55%,transparent);
}
/* .yinzhi-stage / .yinzhi-live2d / .yinzhi-hud / .yinzhi-core-safe
   .yinzhi-nameplate / .yinzhi-dialogue / .yinzhi-entry(--round)
   .yinzhi-sheet / .yinzhi-corner */
```

落地顺序：舞台 + 立绘 + 安全区 → 对话条与名签 → 边带入口 → 二级半屏。改样式走 Codex；同一仓库同时只开一个编码工具。

### 生图

- UI chrome（角饰、名牌底、按钮底）用 Codex 最新 GPT Image，不用 1.5。
- 角色与故事图沿用现有鹿芽立绘风格（当前首页优先立绘3气质）。
- 生图不要掺爱心或情侣构图。新素材进 `assets/**` 时遵守上面的 Preserve Visual Assets 规则。

### 参考来源（乙游 HUD 借鉴）

借鉴布局与沉浸手法（立绘铺底、边角入口、竖屏面对面、Live2D 待机、对话条叠字）。不借鉴恋爱数值、亲密度、心动文案。

- 《恋与深空》Love and Deepspace：竖屏面对面；入口在下方与侧边。
- 《光与夜之恋》Light and Night：简约精致；场景/氛围为主；图标化导航。
- 《恋与制作人》Mr Love: Queen's Choice：主界面 Live2D；待机/触碰反馈。
- 《未定事件簿》Tears of Themis：立绘铺底对话层；选项叠屏；角落快捷入口。
- 《世界之外》：公开资料缺少可核实的无框 HUD 细节，本版不写具体借鉴点。出处明细见 `/workspace/style-specs/yinzhi.md`。

### 改前端前后

- 改前先对这一节（及 `/workspace/style-specs/yinzhi.md`）。
- 改完自查：字体是否混用、颜色是否跑出上表、主场景有没有方框/卡片墙回潮、有没有爱心/亲密度文案、入口是否挡人物核心区。
- 有可见改动，按上面 Required Verification For Visual Assets 出实际截图。
