# 代码变更日志

本文档记录项目的所有代码变更，按日期倒序排列（最新的在最上面）。

---

## 2026-03-07 - 横向卡片布局 + 人设图片支持

### 概述
重新设计主页为横向滑动卡片布局，支持显示角色人设图片。

### 新增文件
- `assets/characters/qingning.png` - 青柠娘人设图
- `assets/characters/xiaoying.png` - 小樱人设图
- `assets/characters/yuehua.png` - 月华人设图

### 修改文件

**`src/types/index.ts`**
- `Character` 接口新增 `imageUri` 字段

**`src/store/chatStore.ts`**
- 为三个默认角色添加 `imageUri` 字段，引用 assets 中的图片

**`src/screens/HomeScreen.tsx`**
- 完全重构为横向滑动布局
- 使用 ScrollView 实现横向滑动
- 卡片宽度为屏幕宽度的 28%，高度 420
- 支持显示角色图片（Image 组件）
- 简化顶部栏为单行布局
- 创建卡片使用虚线边框

### 影响范围
- 主页 UI：从垂直列表改为横向滑动卡片
- 视觉体验：大图展示角色人设

---

## 2026-03-07 - 夜间模式支持

### 概述
为四种主题色添加夜间模式，支持浅色/深色/自动三种模式切换。

### 新增文件
无

### 修改文件

**`src/utils/colors.ts`**
- 新增 `PinkThemeDark`、`BlueThemeDark`、`YellowThemeDark`、`PurpleThemeDark` 夜间主题
- 导出 `ThemeMapDark` 夜间主题映射

**`src/utils/theme.ts`**
- 导入 `ThemeMapDark` 和 `useColorScheme`
- 更新 `useThemeColors` 函数支持夜间模式逻辑
- 根据 `darkMode` 设置返回对应主题（light/dark/auto）

**`src/screens/HomeScreen.tsx`**
- 新增 `handleToggleDarkMode` 函数（循环切换 light → dark → auto）
- 新增 `darkModeIcons` 图标映射（☀️/🌙/🌗）
- 在 header 添加夜间模式切换按钮

### 影响范围
- 全局 UI：所有页面支持夜间模式
- 用户体验：可根据系统设置自动切换或手动选择

---

## 2026-03-07 - UI 卡片化 + 主题弹窗 + 项目更名

### 概述
将角色展示改为卡片形式，编辑按钮改为铅笔图标，主题切换改为弹窗选择，项目更名为"心动伴侣"。

### 修改文件

**`src/screens/HomeScreen.tsx`**
- 编辑按钮改为圆形铅笔图标（✏️）
- 新增主题选择弹窗（Modal）
- 主题切换从循环切换改为弹窗选择
- 新增 `showThemeModal` 状态管理
- 新增 `handleSelectTheme` 函数
- 新增弹窗样式：`modalOverlay`、`modalContent`、`themeOption` 等

**`package.json`**
- 项目名称从 `bcmp-cyber-lover` 改为 `heartbeat-companion`

**`app.json`**
- 应用名称从 `AI伴侣` 改为 `心动伴侣`
- slug 从 `bcmp-cyber-lover` 改为 `heartbeat-companion`

**`src/navigation/AppNavigator.tsx`**
- Main 页面标题从 `AI 伴侣` 改为 `心动伴侣`

**`README.md`**
- 项目标题从 `AI 伴侣 (bcmp_cyber_lover)` 改为 `心动伴侣 (HeartBeat Companion)`

### 影响范围
- UI 交互：主题切换更直观，用户可以看到所有主题选项
- 视觉设计：编辑按钮更简洁美观
- 品牌形象：项目名称更有吸引力和情感共鸣

---

## 2026-03-07 - 多主题系统 + 角色独立设置

### 概述
添加四种甜美主题色彩、修复UI bug、为每个角色创建独立设置页面。

### 新增文件

**`src/screens/CharacterSettingsScreen.tsx`** - 角色独立设置页面
- 查看和管理角色情感状态
- 添加记忆和纪念日
- 查看角色档案和记忆列表
- 快捷编辑角色信息入口

### 修改文件

**`src/utils/colors.ts`**
- 新增 `PinkTheme`（粉色甜美）、`BlueTheme`（蓝色清新）、`YellowTheme`（黄色阳光）、`PurpleTheme`（紫色梦幻）
- 导出 `ThemeMap` 和 `ThemeType`

**`src/utils/theme.ts`**
- 简化主题逻辑，根据用户设置返回对应主题

**`src/types/index.ts`**
- `AdvancedConfig` 新增 `theme` 字段
- `RootStackParamList` 新增 `CharacterSettings` 路由

**`src/store/settingsStore.ts`**
- 默认主题设置为 `'pink'`

**`src/screens/HomeScreen.tsx`**
- 添加主题切换按钮（🎨）
- 标题显示当前主题 emoji
- 修复编辑按钮文字颜色（添加背景色）

**`src/screens/ChatScreen.tsx`**
- 右上角设置按钮跳转到角色设置页面

**`src/screens/CharacterEditorScreen.tsx`**
- 修复编辑角色时保留完整信息（情感状态、档案、记忆等）

**`src/navigation/AppNavigator.tsx`**
- 添加 `CharacterSettings` 路由

### Bug 修复
- 修复主页编辑按钮文字颜色不清晰问题
- 修复编辑角色时丢失情感状态等扩展信息的问题

### 影响范围
- UI 主题系统：全局主题切换
- 角色管理：独立设置页面
- 用户体验：更清晰的按钮样式

---

## 2026-03-06 - AI 社交与角色扮演系统全面升级

### 概述
添加情感状态系统、增强记忆系统、深度角色系统、纪念日提醒和安全加密存储功能。

### 新增文件

**`src/services/emotionService.ts`** - 情感状态管理
- `calculateEmotionChange()` - 根据互动计算情感变化
- `getMoodEmoji()` - 获取心情 emoji
- `getIntimacyLevel()` - 获取亲密度等级文字

**`src/services/anniversaryService.ts`** - 纪念日系统
- `checkAnniversaries()` - 检查今日纪念日
- `getAnniversaryMessage()` - 生成纪念日祝福消息

**`src/services/secureStorage.ts`** - 加密存储
- `saveSecure()` - 安全保存数据
- `getSecure()` - 安全读取数据
- `deleteSecure()` - 安全删除数据

**`src/components/EmotionalStateBar.tsx`** - 情感状态显示组件
- 显示角色的心情、亲密度和精力值

### 修改文件

**`src/types/index.ts`**
- 新增 `EmotionalState` 接口（心情、亲密度、精力值）
- 新增 `MemoryFragment` 接口（记忆片段、标签、重要性）
- 新增 `CharacterProfile` 接口（背景故事、兴趣爱好、口头禅等）
- 新增 `Anniversary` 接口（纪念日）
- `Character` 接口新增字段：`emotionalState`、`profile`、`memories`、`anniversaries`

**`src/store/chatStore.ts`**
- 新增 `createDefaultEmotionalState()` 函数
- 为所有默认角色添加情感状态和档案信息
- 新增方法：
  - `updateEmotionalState()` - 更新角色情感状态
  - `addMemory()` - 添加记忆（最多保留 50 条）
  - `addAnniversary()` - 添加纪念日

**`src/store/settingsStore.ts`**
- 导入 `saveSecure`、`getSecure` 加密存储函数
- 修改 `loadSettings()` - 从加密存储读取 API Key
- 修改 `saveSettings()` - API Key 保存到加密存储，其他设置保存到 AsyncStorage

**`src/services/aiService.ts`**
- 修改 `buildSystemMessage()` - 整合角色档案、情感状态、关键记忆到 system prompt
- 新增 `analyzeFrameWithEmotion()` - 视频通话情感识别，返回 AI 回复和检测到的用户情绪

**`src/screens/CallScreen.tsx`**
- 导入 `analyzeFrameWithEmotion`、`calculateEmotionChange`
- 修改 `captureAndAnalyze()` - 使用情感识别，根据用户情绪更新角色状态

**`src/screens/ChatScreen.tsx`**
- 导入 `checkAnniversaries`、`getAnniversaryMessage`、`calculateEmotionChange`
- 新增纪念日检查 useEffect - 自动发送纪念日祝福
- 新增情感状态更新 useEffect - 根据互动更新角色情感

**`src/screens/HomeScreen.tsx`**
- 导入 `EmotionalStateBar` 组件
- 在 `CharacterCard` 中显示角色情感状态

**`README.md`**
- 新增功能说明：情感状态系统、增强记忆系统、深度角色系统、纪念日系统、安全与隐私
- 更新目录结构，标注新增服务和组件

### 依赖变更
```bash
npm install expo-secure-store
```

### 影响范围
- 核心功能：角色系统、AI 对话、视频通话
- 数据存储：新增加密存储，修改设置保存逻辑
- 用户界面：主页显示情感状态

### 技术亮点
- 动态情感系统：角色根据互动调整心情和亲密度
- 智能记忆：重要记忆（≥7分）优先引用
- 情感识别：视频通话识别用户情绪
- 安全加密：API Key 加密存储

---

## 模板（供未来使用）

```markdown
## YYYY-MM-DD - 更新标题

### 概述
简要描述本次更新的主要内容。

### 新增文件
- `文件路径` - 文件说明

### 修改文件
- `文件路径` - 修改内容说明

### 删除文件
- `文件路径` - 删除原因

### 依赖变更
npm install/uninstall package-name

### 影响范围
说明影响的功能模块。

### 注意事项
需要特别注意的事项。
```
