# LEARNING.md — 项目学习记录

本文档记录项目的技术决策、踩坑经验、当前状态和待完成事项，供未来开发参考。

---

## 项目概述

**心动伴侣 (HeartBeat Companion)** 是一款 React Native + Expo 的 AI 虚拟伴侣应用（安卓优先）。用户选择一个 AI 角色，通过文字聊天建立情感连接。底层调用 OpenAI-compatible API（主要支持硅基流动）。

当前处于 **MVP 简化阶段**：剔除复杂功能，聚焦核心留存体验。

---

## 当前状态（2026-03-24）

### MVP 简化需求完成情况

| 需求 | 功能 | 状态 |
|------|------|------|
| T1 | 每日定时本地通知（默认晚 8 点） | ✅ 完成 |
| T1 | 通知文案使用角色台词 | ✅ 完成 |
| T1 | 点击通知跳转对应角色聊天页 | ✅ 完成 |
| T1 | 进入聊天后角色发 AI 生成开场白 | ✅ 完成 |
| T1 | **用户可在设置中修改通知时间** | ❌ 未完成 |
| T2 | 聊天页快捷回应按钮（5 个） | ✅ 完成 |
| T3 | 首次启动 Onboarding 流程（3 步） | ✅ 完成 |
| T4 | 隐藏非 MVP 功能入口（不删代码） | ✅ 完成 |
| T5 | 收敛 System Prompt（移除复杂逻辑，加回复规范） | ✅ 完成 |

### 唯一遗留项
`LifeSettingsScreen` 有通知时间的 UI 标签，但 `onPress` 为空，没有实现时间选择器和重新注册通知的逻辑。

---

## 架构决策

### 状态管理
- 使用 **Zustand**，分两个 store：
  - `chatStore.ts`：角色列表、聊天记录
  - `settingsStore.ts`：API 配置、高级设置、生命设置（含通知时间）
- 数据通过 **AsyncStorage** 持久化（API Key 用 expo-secure-store 加密）

### 导航结构
```
AppNavigator
├── Onboarding Stack（首次启动）
│   └── OnboardingScreen
└── Main Stack（主流程）
    ├── HomeScreen（角色列表）
    ├── ChatScreen（聊天）
    ├── SettingsScreen → ServiceSettings / CharacterEditor / LifeSettings
    └── 隐藏路由（代码保留但无入口）：
        CallScreen / MemorySettings / AdvancedSettings / CharacterSettings
```

### AI 调用
- 统一在 `aiService.ts` 封装，兼容任意 OpenAI-compatible 接口
- `buildSystemMessage()` 注入：角色性格 + 口头禅 + 当前时间 + 回复规范（4 条）
- `generateDailyGreeting()` 额外注入当前时段语境，生成每日开场白

### 通知系统
- `notificationService.ts` 封装 expo-notifications
- 每次调用 `scheduleDailyNotification()` 时先取消旧通知再注册新的（幂等）
- 通知 payload 携带 `characterId`，App 监听后导航到对应聊天页并传 `autoGreet: true`
- `ChatScreen` 检测 `autoGreet` 参数，调用 `generateDailyGreeting()` 并自动发送

---

## 隐藏的功能（代码保留）

以下功能已从 UI 入口隐藏，代码完整保留，未来可随时恢复：

| 功能 | 相关文件 | 隐藏方式 |
|------|----------|----------|
| 视频/语音通话 | `CallScreen.tsx` | HomeScreen/ChatScreen 移除导航入口 |
| 记忆设置 | `MemorySettingsScreen.tsx` | SettingsScreen 注释掉菜单项 |
| 高级设置 | `AdvancedSettingsScreen.tsx` | SettingsScreen 注释掉菜单项 |
| 情感状态数值条 | `EmotionalStateBar.tsx` | ChatScreen/HomeScreen 不引用 |
| 主题切换 | HomeScreen `handleToggleDarkMode` | Header 按钮注释隐藏 |
| 纪念日祝福 | `anniversaryService.ts` | ChatScreen 移除触发 useEffect |
| 角色独立设置 | `CharacterSettingsScreen.tsx` | ChatScreen 设置按钮不跳转此页 |

---

## 踩坑记录

### expo-notifications 注意事项
- Android 需要在 `app.json` 配置 `useNextNotificationsApi: true`（expo SDK 50+）
- 模拟器上通知可能不触发，需真机测试
- `scheduleNotificationAsync` 的 DAILY trigger 在部分安卓机上受省电策略影响，建议在 onboarding 时引导用户关闭省电优化

### AsyncStorage 与 Zustand 的初始化顺序
- Store 的 `loadSettings()` 是异步的，App.tsx 中需等待 `initialized` 状态为 true 再渲染导航树，否则 Onboarding 判断会误触发

### System Prompt 长度控制
- 移除记忆评分/情感状态注入后，token 消耗显著降低
- 当前 buildSystemMessage 控制在 ~400 tokens 以内，适合低成本模型（Qwen2.5-7B 等）

---

## 待完成

1. **T1 通知时间设置**：在 `LifeSettingsScreen` 添加小时选择器（Picker 或 Modal），保存后调用 `scheduleDailyNotification(newHour, 0, characterId)` 重新注册
2. **Onboarding 中的 API Key 验证**：目前跳过验证直接进入主页，建议填完后调一次测试请求再放行
3. **通知权限引导**：Android 13+ 需要运行时申请通知权限，目前 Onboarding 里已调用 `requestPermissionsAsync`，但没有处理拒绝场景

---

## 技术栈速查

| 库 | 用途 |
|----|------|
| React Native + Expo SDK 51 | 跨平台框架 |
| TypeScript | 类型安全 |
| Zustand | 状态管理 |
| React Navigation v6 | 导航 |
| expo-notifications | 本地推送通知 |
| expo-secure-store | API Key 加密存储 |
| AsyncStorage | 普通数据持久化 |
| expo-av | 录音/播放（通话功能保留） |
| expo-camera | 摄像头（视频通话保留） |
