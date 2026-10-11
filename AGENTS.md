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

## 饮之视觉（Visual Style, locked 2026-10-11）

Source of truth: this section. Change it only after the user confirms. Any
front-end change (screens, themes, components, generated UI art) must follow it.
Old theme switching (都市清透 / 甜美柔软 etc.) is removed; only this pink-gold set
remains.

### 定位

- 仓库仍叫 `bcmp_cyber_lover`，产品和页面名叫「饮之」。
- 气质是温柔陪伴、软引导，不是恋爱向。粉色表示柔软和安静。
- 不要爱心、亲密度、心动、情侣构图这类字眼、图标和素材。
- 不借个人主页的海蓝金，不套 Noto Serif SC。

### 字体

| 用途 | 字体 | 文件 |
|---|---|---|
| 标题、字标、大标题、名牌 | 站酷小薇 ZCOOL XiaoWei | `assets/fonts/ZCOOLXiaoWei-Regular.ttf` |
| 标题缺字补字 | 源泉圆体 GenSenRounded2 TW Medium | `assets/fonts/GenSenRounded2TW-M.otf` |
| 正文、选项、说明、按钮 | 源泉圆体 GenSenRounded2 TW Regular | `assets/fonts/GenSenRounded2TW-R.otf` |
| 正文强调（可选） | GenSenRounded2 TW Medium | 同上 M |

- 字体加载入口：`src/utils/appFonts.ts`（启动时 expo-font 加载）。
- 用完整字库本地加载。不要走 Google Fonts 子集，子集会缺字变方块。
- 缺字只替换那几个字，对齐粗细和大小，不让它跳出来。Web 写法：
  `font-family: "ZCOOL XiaoWei", "GenSenRounded2 TW", sans-serif`。
- 不要用站酷快乐体做标题（太卡通）。不要整页用小薇（小字太细、偏宋）。

### 颜色

| 用途 | 色值 |
|---|---|
| 主色粉：主按钮、顶栏点缀、淡底 | `#E7A0B4` |
| 香槟金：选中框、次按钮描边、重点、角饰 | `#C4A574` |
| 页面底色 | `#FBF6F3` |
| 卡片底色 | `#FFFDFB` |
| 正文文字 | `#3C3032` |
| 次要文字 / 说明 | `#8A735C` |
| 字标 / 次按钮文字 | `#6E5430` |
| 默认边线 | `#EADFCE` |

- 粉色不整栏铺满顶栏，优先做主按钮和很淡的底。
- 香槟金做选中边框和点缀，不铺大面积。

### Chrome 语言（用户选定参考图「中饰」）

整站边框、浮层和入口按这套装饰语法走。组件板、生图、代码要一眼看出是同一套。

1. **金框 L 角饰**：卡片、面板、重要容器四角用香槟金 L 形角饰点一下，不满框描粗线。
2. **名牌**：角色名、房间名、关键标题用独立名牌块。字用小薇，底半透或浅卡，描边可用香槟金。
3. **半透玻璃**：浮层、抽屉、遮罩内容区用半透磨砂玻璃（浅粉白底 + 轻模糊），不用实色大块压死立绘。
4. **粉金胶囊**：主操作、标签、筛选项用胶囊形。主态粉 `#E7A0B4`，描边或次态香槟金 `#C4A574`。
5. **圆形入口**：进鹿芽的房间、记忆瓶、设置这类入口优先圆形按钮 / 圆形门洞，不用方块大门。

首页方向：角色立绘当舞台，控件浮在立绘上（顶部字标 + 状态药丸 → 软引导一句 →
主胶囊「和鹿芽说话」→ 一排圆形入口）。不要回到白卡、方按钮列表。

### 状态

- 选中卡：边框 `#C4A574`，外圈 3px `#C4A57433`，可加金框 L 角饰。
- 主按钮：粉金胶囊，底 `#E7A0B4`，文字 `#3C3032`。
- 次按钮：透明底，1.5px `#C4A574` 内描边，文字 `#6E5430`。

### 圆角、字号、行高

- 卡片圆角 16–18px；按钮胶囊 999px；入口优先正圆。
- 大标题约 58–76px（看屏宽）；面板标题约 22px；选项 16px；按钮 14–15px；说明 12px。
- 行高：标题约 1.15；正文、说明 1.4–1.5。

### CSS 变量（Web / 原型参考）

```css
:root{
  --bg:#FBF6F3; --card:#FFFDFB;
  --text:#3C3032; --muted:#8A735C; --accent:#6E5430; --line:#EADFCE;
  --pink:#E7A0B4; --gold:#C4A574;
  --radius-card:16px; --radius-pill:999px; --radius-entry:9999px;
  --font-title:"ZCOOL XiaoWei","GenSenRounded2 TW",sans-serif;
  --font-body:"GenSenRounded2 TW",sans-serif;
  --glass:rgba(255,253,251,.72); --glass-blur:12px;
}
```

### 生图

- UI chrome（角饰、名牌底、玻璃框、按钮底）用 Codex 最新 GPT Image，不用 1.5。
- 角色与故事图沿用现有鹿芽立绘风格。
- 生图不要掺爱心或情侣构图。新素材进 `assets/**` 时遵守上面的 Preserve Visual Assets 规则。

### 改前端前后

- 改前先对这一节。
- 改完自查：字体是否混用、颜色是否跑出上表、有没有方框列表回潮、有没有爱心/亲密度文案。
- 有可见改动，按上面 Required Verification For Visual Assets 出实际截图。
