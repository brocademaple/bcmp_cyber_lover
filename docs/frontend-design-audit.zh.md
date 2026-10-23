# 前端设计审计报告

日期：2026-06-17
项目：HeartBeat Companion
模式：保留现有方向的改版审计
使用方法：`design-taste-frontend`，按 React Native 移动端产品做了语境转换

## 设计判断

我把当前项目理解为：一个面向情感陪伴场景的移动端聊天产品，用户会在意角色感、亲密感、沉浸感和日常可用性。当前视觉方向偏“角色大图 + 柔和玻璃面板 + 轻奢陪伴感”，更适合走原生移动端的精致产品系统，而不是网页落地页式的大标题和营销视觉。

当前三项设计读数：

- `DESIGN_VARIANCE: 6`
  角色图、装饰层、非对称圆角已经有表达性，但主结构仍是标准移动端。

- `MOTION_INTENSITY: 3-4`
  首页有尊重“减少动态效果”的 idle frame 轮换，大部分交互仍比较静态。

- `VISUAL_DENSITY: 6`
  聊天页和设置页控件较多，功能完整，但视觉上稍显拥挤。

## 审计证据

Simulator 环境：

- iPhone 17 Pro
- iOS 26.5
- Expo Go

截图：

- 聊天页：`docs/audit-assets/frontend-audit-chat.jpg`
- 首页：`docs/audit-assets/frontend-audit-home.jpg`
- 设置页：`docs/audit-assets/frontend-audit-settings.jpg`

运行状态验证：

```bash
curl -s http://127.0.0.1:8081/status
# packager-status:running
```

## 总结结论

当前前端最强的部分，是产品方向对了：全屏角色图、关系状态、柔和玻璃卡片、快捷回复、主题装饰层，这些都能让它不像一个普通聊天壳，而是有“陪伴空间”的感觉。尤其角色图不是小头像，而是整个屏幕的情绪背景，这一点很关键。

当前最大的问题，是设计系统还没有被锁住。每个屏幕局部看都有设计，但整体规则没有统一：圆角很多套、emoji 当图标、文字符号当按钮、字重普遍过重、默认配色偏暖 beige + brass、装饰层和内容层抢视觉。这会让产品显得亲近，但也会削弱高级感和稳定感。

建议方向：保留沉浸式角色大图这条主线，把 UI 语言收敛成一套稳定的移动端设计系统。

优先统一这几件事：

- 一套圆角规则
- 一套图标策略
- 一套字体层级
- 一套玻璃/卡片表面规则
- 一个关系状态模块
- 每个页面明确装饰预算

## 做得好的地方

### 1. 角色图是第一视觉信号

首页和聊天页都把当前角色图作为主环境。对陪伴型应用来说，这是非常对的。角色不是导航栏里的小头像，而是整个界面的气氛来源。

相关代码：

- `src/screens/HomeScreen.tsx`：首页背景、idle frames、状态图切换
- `src/screens/ChatScreen.tsx`：`ImageBackground` 和渐变遮罩

### 2. 主题不是简单换色

`urbanClear`、`softSweet`、`midnight` 这几个主题已经有明确差异，不只是换一个 primary color。它们会影响气泡、背景、装饰资源、输入区和整体情绪。

相关代码：

- `src/utils/colors.ts`
- `src/components/ThemeArtworkLayer.tsx`

### 3. 聊天交互方向是对的

输入框保持可用、快捷回复贴近输入区、发送队列已经存在。这比“AI 回复时强行禁用用户输入”更适合陪伴型聊天。

相关代码：

- `src/screens/ChatScreen.tsx`
- `src/components/MessageInput.tsx`

### 4. 设置页信息架构比较清楚

设置页从上到下是：服务连接、视觉风格、陪伴体验。这个顺序是能理解的，比一上来暴露所有高级参数要干净。

相关代码：

- `src/screens/SettingsScreen.tsx`

## 主要问题

### P1. 聊天页视觉层级过载

聊天页现在叠了很多层：角色背景、渐变遮罩、主题装饰层、浮动头部、消息气泡、快捷回复、输入栏。实机看下来，角色背景很有情绪，但它也在和消息阅读抢注意力。

证据：

- `frontend-audit-chat.jpg`
- `src/screens/ChatScreen.tsx`：`ImageBackground`、`LinearGradient`、`ThemeArtworkLayer`、浮动头部、快捷回复、输入栏
- `src/components/ThemeArtworkLayer.tsx`：`urbanClear` 和 `softSweet` 在聊天页都会注入装饰图层

建议：

- 聊天页的装饰预算要比首页更严格。首页可以更沉浸，聊天页要优先保证阅读。
- 保留角色背景，但默认降低或关闭聊天页 `ThemeArtworkLayer`。
- 给消息列表一个更稳定的阅读表面，比如更明确的 scrim，或者让气泡本身更不依赖背景。
- 把层级写成 token：header、messages、quick replies、input 各自有稳定层级，不要靠零散 `zIndex`。

### P1. 圆角语言没有锁住

现在同时存在圆形按钮、胶囊按钮、8px 卡片、12px 卡片、14px 输入框、16px 按钮、18px 气泡、22px 卡片、24-28px 面板、999px pill，还有主题特有的非对称圆角。表达性有了，但规则太散。

证据：

- `src/components/ChatBubble.tsx`：用户/助手气泡和主题圆角
- `src/components/MessageInput.tsx`：图片按钮、输入框、发送按钮的圆角
- `src/screens/HomeScreen.tsx`：底部 dock、问候卡、状态 pill、亲密度心形、主 CTA
- `rg "borderRadius" src` 可以看到圆角分布非常散

建议增加一个设计 token：

```ts
export const radii = {
  xs: 8,
  sm: 12,
  md: 18,
  lg: 24,
  pill: 999,
};
```

使用规则：

- 聊天气泡可以保留表达性圆角。
- 主 CTA 统一用大圆角或 pill，同一主题只选一种。
- 卡片和面板统一用 `lg`。
- 输入框统一用 `md`。

### P1. emoji 和文字符号承担了太多 UI 图标职责

emoji 可以出现在聊天语气里，但现在很多控件都靠 emoji 或文字符号当图标：快捷回复、设置齿轮、发送箭头、加号、关闭按钮、亲密度心形、菜单图标、状态 mark。Computer Use 的可访问性树也显示这些会被读成普通文字或泛泛的元素。

证据：

- `src/screens/ChatScreen.tsx`：`😊`、`❤️`、`😴`、`🥺`、`⚙️`
- `src/components/MessageInput.tsx`：`＋`、`↑`、`✕`
- `src/screens/HomeScreen.tsx`：`♡`、`💬`、`‹`、`›`、`⌛`
- `src/screens/SettingsScreen.tsx`：`▣`、`♡`、`⌁`、`⚙`

建议：

- 选择一个 React Native 图标方案，例如 `@expo/vector-icons`，或一组自维护 SVG icon 组件。
- 导航、设置、发送、添加图片、关闭、进度标记等全部换成统一 icon。
- emoji 只保留在表达语气的位置，比如快捷回复文案。
- icon-only 按钮都补 `accessibilityLabel`，装饰符号从可访问性树里隐藏。

### P1. 默认配色偏“暖 beige + brass”

当前默认是 `urbanClear`。这个主题低饱和、比较统一，但 `#fbfaf7` 背景、`#c9a76b` 香槟金、`#f6f1ea` 输入底色、`#4b4540` 暖文字组合起来，很容易落入常见的“温暖纸感 + 黄铜”高级消费品套路。

证据：

- `src/store/settingsStore.ts`：默认主题是 `urbanClear`
- `src/utils/colors.ts`：`UrbanClearTheme`

建议：

保留 `urbanClear` 的方向，但往“冷感轻奢”调一点：

- 背景改成更冷的 off-white 或银灰
- 香槟金只做细线和轻 accent，不做大面积 CTA
- 主 CTA 可考虑 graphite、dusty violet、deep plum 这类更稳的颜色
- 角色情绪可以留在气泡里，系统 chrome 尽量克制

### P2. 字重普遍太重

很多地方用了 `fontWeight: '900'`。这会有冲击力，但当所有信息都很重时，就没有真正的重点。

证据：

- `src/screens/HomeScreen.tsx`：CTA、标签、弹窗标题、状态文案大量 900
- `src/screens/SettingsScreen.tsx`：标题、分组、状态标题、选项标题
- `src/components/ChatBubble.tsx`：发送者、时间、提示层级还可以更轻

建议建立字体角色：

- `display`：28-32，800 或 900，只用于大标题
- `title`：18-22，750 或 800
- `body`：15-16，400 或 500
- `caption`：11-13，500 或 600
- `chip`：13-14，700

然后审一遍 `fontWeight: '900'`，大部分可以降到 700 或 800。

### P2. 关系状态模块信息太多

首页里关系状态同时用了：心情标签、状态选择器、亲密度百分比、进度条、移动心形、三个 action pill、主 CTA。这些都和陪伴有关，但同屏一起出现时，用户要解析的东西太多。

证据：

- `src/screens/HomeScreen.tsx`：状态选择、亲密度文字、progress rail、heart marker、context action pills

建议做成一个更简洁的关系模块：

- 第一行：当前状态
- 主信息：亲密度，文本或 compact ring 二选一
- 一个次级入口：切换状态或查看关系
- 去掉填充式进度条 + 心形浮标，改成更安静的 badge 或小型 meter

### P2. 动效有考虑，但没有中心化

首页 idle frame 已经尊重 Reduce Motion，这是好事。但聊天等待状态用 `setInterval` 每 2400ms 切换文案，没有接入 Reduce Motion。装饰层是静态的，大面板切换也比较突然。

证据：

- `src/screens/HomeScreen.tsx`：`AccessibilityInfo.isReduceMotionEnabled`
- `src/components/ChatBubble.tsx`：`WaitingIndicator` 使用 interval

建议：

- 增加一个通用 `useReduceMotion` hook。
- 把等待提示、idle frame、未来装饰动效都接进去。
- 动效只服务状态变化：状态切换、面板收起、消息进入、发送反馈。

### P2. 设置页混入了用户设置和内部调试

五次点击版本号打开高级工具，对开发方便。但从产品视觉和信息架构上看，普通设置页背后藏着模式切换、时间校准、内部参数，会让设置页变脏。

证据：

- `src/screens/SettingsScreen.tsx`：`advancedTapCount`、`showAdvancedControls`、版本号点击
- `src/store/settingsStore.ts`：加载时会把 admin mode 重置

建议：

- 内部工具放到 dev-only screen 或编译期开关。
- 普通用户设置页只保留用户能理解的东西。
- 版本号可以放进“关于”入口，不要在主设置页底部承担隐藏入口。
- `debugNowTs` 不应该出现在消费端信息架构里。

### P3. 中点分隔符用得偏多

skill 里把中点 metadata 视为一个常见 AI 设计痕迹。这个项目里中点出现在日记标题、记忆副标题、版本号、失败状态、角色元信息里。部分是合理的，但整体频次偏高。

证据：

- `src/services/diaryService.ts`
- `src/utils/memoryVisuals.ts`
- `src/screens/SettingsScreen.tsx`
- `src/components/ChatBubble.tsx`

建议：

中点只保留在很紧凑的 metadata 场景。其他地方用换行、左右布局、弱分隔线。

## 建议改版方向

应该保留：

- 全屏角色图
- 首页底部 dock
- 聊天快捷回复
- 主题和角色绑定
- 记忆、关系、陪伴状态这些核心产品概念

应该减少：

- emoji 当控件图标
- 大量不统一圆角
- 默认暖 beige + brass 风格
- 进度条 + 心形浮标
- 聊天页装饰层抢阅读
- 普通设置页里的隐藏 debug 工具

目标视觉系统：

- 原生移动端的柔和高级感
- 角色图负责情绪
- UI chrome 保持克制
- 只保留少量清晰装饰
- 关系状态模块更像产品组件，而不是一堆状态零件

## 两周执行路线

第一周：

1. 增加 `src/utils/designTokens.ts`，定义圆角、字体、间距、层级、surface alpha。
2. 重构 `MessageInput`、`ChatBubble`、chat header，让它们使用 token。
3. 替换文本符号控件，统一 icon 策略。
4. 降低或默认关闭聊天页 `ThemeArtworkLayer`。
5. 增加 `useReduceMotion`，接入 `WaitingIndicator`。

第二周：

1. 把首页关系模块拆成 `RelationshipStatusCard`。
2. 用更安静的状态 badge 或 compact meter 替代心形进度条。
3. 调冷 `urbanClear`，保留它的轻奢方向。
4. 把内部调试入口移到 dev-only screen。
5. 用 simulator 截图复查首页、聊天页、设置页、记忆页、服务设置页和 dark mode。

## 复现和验证步骤

启动应用：

```bash
npx expo start --localhost --port 8081 --clear
```

打开 iOS Simulator：

```text
在 Expo 终端按 i
```

检查 Metro 状态：

```bash
curl -s http://127.0.0.1:8081/status
```

人工检查清单：

- 首页第一屏：角色仍然是主视觉，底部 dock 不遮脸或关键画面。
- 聊天页：每条消息在背景图上都清晰可读。
- 输入栏：添加、输入、发送按钮风格统一，触控区域足够大。
- 快捷回复：不挤压输入区，文案一行内读完。
- 设置页：用户设置和内部工具分开。
- 可访问性：icon-only 按钮有 label，装饰符号不被读出。
- Reduce Motion：开启减少动态效果后，等待提示和 idle frame 不自动循环。

## 关键假设

- 这份报告只做审计，没有改产品 UI 代码。
- Simulator 状态被保留，没有卸载 app，也没有清空模拟器。
- `design-taste-frontend` 原本主要面向网页落地页/改版审计，这里按移动端产品做了语境转换。
- 当前截图来自 iPhone 17 Pro 的 Expo Go，不等同于最终 production build。
