# 心动伴侣 (HeartBeat Companion)

一款支持安卓的 AI 虚拟伴侣移动应用，复刻并扩展了原版功能，新增**音视频通话 + 多模态模型**支持。

## 功能特性

### 💬 聊天功能
- 与多种性格的 AI 角色对话（青柠娘、小樱、月华等）
- 流式输出（Streaming）回复，打字效果
- 图片消息支持（发送图片，视觉模型解析）
- 聊天历史本地持久化

### 💖 情感状态系统（新增）
- **动态情绪**：角色根据互动频率和内容动态调整心情（开心/难过/兴奋/疲惫等）
- **亲密度系统**：0-100 亲密度值，影响对话风格和语气
- **精力值**：角色精力随时间恢复，影响互动积极性
- **情感可视化**：主页实时显示角色当前情感状态

### 📞 音视频通话
- **语音通话**：按住说话，AI 实时回复并用 TTS 朗读
- **视频通话**：前置摄像头实时画面，AI 每隔 8 秒通过多模态模型分析画面并回应
- **情感识别**：视频通话时自动识别用户情绪（开心/难过/疲惫），角色据此调整回应
- 通话控制：静音、关摄像头、扬声器切换
- 通话记录保存至聊天历史

### 🧠 增强记忆系统
- **关键记忆提取**：自动标记重要对话片段（用户喜好、重要日期、情感事件）
- **记忆重要性评分**：1-10 分，高分记忆优先在对话中引用
- **智能记忆检索**：根据当前话题自动调用相关历史记忆
- 记忆库：长期记忆存储（最多保留 50 条）
- 可配置保留条数、发送条数
- 自定义记忆提示词

### 🎭 深度角色系统
- **角色档案**：每个角色包含背景故事、兴趣爱好、口头禅、禁忌话题、人生目标
- **性格一致性**：AI 根据角色档案保持对话风格统一
- 3 个内置角色（可编辑）
- 自定义新角色：头像、性格、开场白、系统提示词

### 📅 纪念日系统（新增）
- **重要日期提醒**：生日、纪念日、自定义日期
- **主动祝福**：到达纪念日时角色主动发送祝福消息
- 支持多个纪念日管理

### 🔌 多服务商支持
- **DeepSeek**：`api.deepseek.com`
- **硅基流动（SiliconFlow）**：`api.siliconflow.cn`（支持 Qwen、GLM 等）
- **自定义**：任意 OpenAI 兼容接口
- 一键获取模型列表，支持独立设置文字模型和视觉模型

### 🔒 安全与隐私（新增）
- **加密存储**：使用 expo-secure-store 加密存储 API Key
- **本地数据**：所有聊天记录和角色数据仅存储在本地设备
- **隐私保护**：敏感信息不会明文保存

### 💖 生命系统
- 主动消息推送（可设置时间间隔）
- 后台消息提醒
- 动态主动性增强

### ⚙️ 高级设置
- 兼容模式（解决多 system 消息限制）
- 深度思考模式（enable_thinking）
- 自定义请求参数
- 深色/浅色/跟随系统主题
- 发送延时配置

### 👤 角色系统
- 3 个内置角色（可编辑）
- 自定义新角色：头像、性格、开场白、系统提示词

## 快速开始

### 安装依赖
```bash
npm install
```

### 启动开发服务器
```bash
npx expo start
```

### 构建 Android APK
```bash
# 安装 EAS CLI
npm install -g eas-cli
eas login

# 构建 APK
eas build --platform android --profile preview
```

### 本地 Android 调试
```bash
npx expo start --android
```

## 配置说明

1. 打开应用 → 右上角 ⚙️ → **服务提供商**
2. 选择服务商，填入 API 密钥
3. 选择文字模型（如 `Qwen/Qwen2.5-72B-Instruct`）
4. 选择视觉模型用于视频通话（如 `Qwen/Qwen2.5-VL-72B-Instruct`）
5. 点击**测试连接**验证，然后**保存**

## 技术栈

| 技术 | 说明 |
|------|------|
| React Native + Expo | 跨平台框架（安卓优先） |
| TypeScript | 类型安全 |
| Zustand | 状态管理 |
| React Navigation | 导航 |
| expo-av | 录音 / 播放 |
| expo-camera | 摄像头（视频通话） |
| expo-speech | TTS 语音合成 |
| AsyncStorage | 本地持久化 |
| OpenAI-compatible API | AI 服务接入 |

## 多模态视频通话原理

```
用户开启视频通话
      │
      ▼
expo-camera 捕获前置摄像头画面
      │
      ▼ (每 8 秒)
将帧转为 base64 → 发送给视觉模型 API
（如 Qwen2.5-VL / GLM-4V / GPT-4o）
      │
      ▼
AI 分析画面 → 生成关心/互动文本
      │
      ▼
expo-speech TTS 朗读回复
```

## 目录结构

```
src/
├── types/          # TypeScript 类型定义
├── store/          # Zustand 状态管理
│   ├── settingsStore.ts
│   └── chatStore.ts
├── services/       # 服务层
│   ├── aiService.ts          (多提供商 + 流式 + 视觉)
│   ├── memoryService.ts
│   ├── emotionService.ts     (情感状态计算)
│   ├── anniversaryService.ts (纪念日提醒)
│   └── secureStorage.ts      (加密存储)
├── screens/        # 页面组件
│   ├── HomeScreen.tsx
│   ├── ChatScreen.tsx
│   ├── CallScreen.tsx        ← 音视频通话
│   ├── SettingsScreen.tsx
│   ├── ServiceSettingsScreen.tsx
│   ├── LifeSettingsScreen.tsx
│   ├── MemorySettingsScreen.tsx
│   ├── AdvancedSettingsScreen.tsx
│   └── CharacterEditorScreen.tsx
├── components/     # 可复用组件
│   ├── ChatBubble.tsx
│   ├── MessageInput.tsx
│   ├── SettingsRow.tsx
│   └── EmotionalStateBar.tsx ← 情感状态显示
├── navigation/     # 导航配置
└── utils/          # 工具函数（主题、颜色）
```
