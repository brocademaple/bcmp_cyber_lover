# 🍵 Agent Harness v2 & Fluid Teahouse Architecture

## 架构概览

Harness v2 是「饮之 · 鹿芽茶席」的核心架构，通过**六层服务**实现「去 SOP 化的流动对话 + 自我发现封存循环」。

```
┌─────────────────────────────────────────────────────┐
│  Layer 1: Dual Persona Store (双重人格存储)         │
│  主持者身份 + 动态用户镜像                           │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│  Layer 2: Brew Skill Registry (流动饮品技能注册表)  │
│  4 基座饮品 + 4 应材伴料 = 16 种组合风格             │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│  Layer 3: Ingest Distiller (多模态入茶蒸馏)         │
│  原始输入 → 客观事实 → 鹿芽镜像解读 = 待泡茶叶       │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│  Layer 4: Context Window Manager (3 层上下文)       │
│  Hot (原始 turn) / Warm (茶海摘要) / Cold (封存瓶)  │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│  Layer 5: Teahouse Session Loop (茶席会话循环)      │
│  冲泡 → 品啜校准 → 收席三态封瓶                     │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│  Layer 6: Tea Pet Shelf (茶宠博古架长期记忆)        │
│  4 茶宠 (澄明/笃行/松弛/灵光) + 包浆经验 + 封存瓶   │
└─────────────────────────────────────────────────────┘
```

---

## 六层架构映射：设计 → 落地文件

### Layer 1: Dual Persona Store (双重人格存储)

**设计意图**:
- **主持者身份** (`host`): 鹿芽固定身份描述
- **动态用户镜像** (`userMirror`): 特质、关注、障碍持续更新

**落地文件**:
- **类型定义**: `src/types/harness.ts` → `DualPersonaStore`, `TeahouseHostPersona`, `UserMirror`
- **CRUD 服务**: `src/services/dualPersonaStore.ts`
  - `loadDualPersonaStore(characterId)` - 加载
  - `updateUserMirror(characterId, updates)` - 更新镜像
  - `getUserMirrorSummary(mirror)` - 生成摘要
- **存储键**: `@bcmp_dual_persona_${characterId}`

**数据结构**:
```typescript
{
  host: {
    identity: "成都大二 CS，经营线上茶席",
    conversationPhilosophy: "不灌输方法论，陪伴自我发现",
    prohibitions: ["不做人机恋", "不假装无所不知"]
  },
  userMirror: {
    traits: ["探索技术与设计", "习惯先想复杂"],
    currentFocus: ["编译器实验", "交互设计"],
    resolvedBlockers: ["调试工具链配置"],
    lastUpdated: 1729814400000
  }
}
```

---

### Layer 2: Brew Skill Registry (流动饮品技能注册表)

**设计意图**:
- 去 SOP 化：不再硬编码固定流程，改为**饮品风格 + 应材加成**组合
- 4 基座饮品：岩骨乌龙、手冲黑咖、晚安洋甘菊、薄茶点拂
- 4 应材伴料：鲜奶、方糖、陈皮、冰块

**落地文件**:
- **类型定义**: `src/types/harness.ts` → `BaseDrinkSkill`, `DrinkModifier`, `BrewSkillRegistry`
- **注册表**: `src/services/brewSkillRegistry.ts`
  - `BASE_DRINKS` - 4 种基座饮品配置
  - `MODIFIERS` - 4 种应材配置
  - `getBrewSkillRegistry()` - 获取完整注册表
  - `assembleSystemPrompt(params)` - 组装系统提示
- **UI 选择**: `src/components/TeahouseHarnessDrawer.tsx` - 实时切换

**基座饮品示例** (岩骨乌龙):
```typescript
{
  id: 'oolong',
  displayName: '岩骨乌龙 · 稳重慢节奏',
  icon: '🍵',
  conversationPhilosophy: '不急着给建议，先听完、再慢慢理清',
  pacing: '慢节奏，留白多',
  prohibitions: ['不催促用户立刻行动', '不用"其实你应该"'],
  bestFor: ['深度反思', '长期规划']
}
```

---

### Layer 3: Ingest Distiller (多模态入茶蒸馏)

**设计意图**:
- **两段式转译**: 
  1. Stage 1: 客观事实提取（事件、阻塞点、紧急度）
  2. Stage 2: 鹿芽镜像解读（反映模式、建议话题、关联特质）
- 生成「待泡茶叶」(`UnsteepedLeaf`)，可择机冲泡进入对话

**落地文件**:
- **类型定义**: `src/types/harness.ts` → `UnsteepedLeaf`, `ObjectiveFactsExtract`
- **服务**: `src/services/ingestDistillerService.ts`
  - `ingestRawMaterial(characterId, input)` - 两段式转译
  - `listUnsteepedLeaves(characterId, filter)` - 列出茶叶
  - `markLeafSteeped(characterId, leafId)` - 标记已起泡
- **存储**: `@bcmp_unsteeped_leaves_${characterId}`
- **UI**: `src/components/IngestPanel.tsx` - 上传原始内容 + 查看转译结果

**确定性 Fallback**:
- 无 LLM 时，使用规则提取关键词 + 模板生成
- 确保离线/无 API 密钥时依然可用

---

### Layer 4: Context Window Manager (3 层上下文)

**设计意图**:
- **Hot Tier (热茶层)**: 原始近期 turn，即时连续性
- **Warm Tier (茶海摘要)**: 压缩的会话要点，节省 token
- **Cold Tier (博古架)**: 长期封存瓶召回，持久记忆

**落地文件**:
- **类型定义**: `src/types/harness.ts` → `ContextSnapshot`, `TeaSeaDigestPoint`
- **服务**: `src/services/contextWindowManager.ts`
  - `assembleHotTier(messages)` - 原始消息
  - `assembleWarmTier(characterId, sessionId)` - 茶海摘要
  - `assembleColdTier(characterId, peelActive)` - 封存瓶召回
  - `assembleContextSnapshot(params)` - 完整 3 层组装
  - `addTeaSeaDigestPoint(characterId, sessionId, point)` - 添加摘要点
  - `estimateTokenCount(text)` - token 估算
- **存储**: `@bcmp_tea_sea_digest_${characterId}_${sessionId}`

**Token 预算**:
- Hot: ~2000 tokens (8-10 turn)
- Warm: ~500 tokens (5-8 摘要点)
- Cold: ~300 tokens (3-5 封存瓶)

---

### Layer 5: Teahouse Session Loop (茶席会话循环)

**设计意图**:
- **冲泡 (Brew)**: 生成回复，注入 Harness prompt
- **品啜校准 (Sip)**: 用户反馈「回甘」或「添水」
- **收席封瓶 (Settle)**: 三态分拣（封瓶存留/刷新认知/倒掉废茶）

**落地文件**:
- **类型定义**: `src/types/harness.ts` → `TeahouseSessionState`, `SipFeedback`, `SessionSettlementCard`
- **服务**: `src/services/teahouseSessionService.ts`
  - `startTeahouseSession(characterId)` - 创建会话
  - `brewResponse(params)` - 冲泡回复
  - `sipAndCalibrate(params)` - 品啜校准
  - `settleSession(characterId, sessionId, messages)` - 生成封瓶卡
  - `applySealCard(characterId, card, selection)` - 应用封瓶
- **存储**: `@bcmp_teahouse_session_${characterId}_${sessionId}`
- **UI**:
  - `src/components/SipCalibrationButton.tsx` - 品啜按钮
  - `src/components/SessionSettlementModal.tsx` - 封瓶三态界面

**确定性 Fallback**:
- 无 LLM 或少量 turn 时，生成结构化的占位封瓶卡
- 基于用户消息内容的简单规则分拣

---

### Layer 6: Tea Pet Shelf (茶宠博古架长期记忆)

**设计意图**:
- **4 茶宠**: 澄明 (clarity_deer)、笃行 (action_cat)、松弛 (ease_fox)、灵光 (spark_bird)
- **包浆经验**: 每封存一个瓶子，滋养对应茶宠 (10-100 exp)
- **等级升级**: 每 100 exp 升 1 级，最高 Lv.5

**落地文件**:
- **类型定义**: `src/types/harness.ts` → `TeaPet`, `SealedBottle`, `CurioShelf`
- **服务**: `src/services/teaPetShelfService.ts`
  - `sealBottleAndNourishPet(characterId, params)` - 封瓶 + 滋养茶宠
  - `loadCurioShelf(characterId)` - 加载博古架
  - `listSealedBottles(characterId, filter)` - 列出封存瓶
  - `getShelfStats(characterId)` - 获取统计
  - `getPetById(characterId, petId)` - 获取单只茶宠
- **存储**: `@bcmp_curio_shelf_${characterId}`
- **UI**: `src/components/TeaPetShelf.tsx` - 茶宠展示 + 瓶子列表

**包浆点显示**:
- 每 20 exp 填充 1 个点 (5 点 = 100 exp per level)
- 填充：香槟金 `#C4A574`
- 空点：半透明香槟金

---

## 零配置本地茶镜 (Local Teahouse Mirror)

**设计意图**:
- 无 API 密钥时，依然可以完整体验茶席流程
- 基于 BaseDrink + Modifiers + UserMirror 生成上下文感知回复

**落地文件**:
- **服务**: `src/services/localTeahouseMirror.ts`
  - `generateLocalTeahouseReply(params)` - 生成本地回复
  - `assembleDrinkStyleReply()` - 饮品风格回复
  - `detectUserTopic()` - 话题检测
  - `detectUserEmotion()` - 情绪检测
- **集成**: `src/screens/ChatScreen.tsx` - 消息发送流程
  - 无 API 密钥 → 调用本地茶镜 → 生成回复
  - 有 API 密钥 → 正常 LLM 流程

**回复策略**:
- 根据 BaseDrink 选择语气和节奏
- 根据 Modifiers 添加风味描述
- 根据用户消息内容检测情绪和话题
- 生成简洁、温暖、符合饮品风格的回复

---

## UI 组件映射

| UI 组件 | 对应架构层 | 文件路径 |
|---------|-----------|---------|
| **TeahouseHarnessDrawer** | Layer 2 (饮品选择) | `src/components/TeahouseHarnessDrawer.tsx` |
| **IngestPanel** | Layer 3 (入茶蒸馏) | `src/components/IngestPanel.tsx` |
| **TeaPetShelf** | Layer 6 (茶宠架) | `src/components/TeaPetShelf.tsx` |
| **HarnessInspector** | 全部 (透视镜) | `src/components/HarnessInspector.tsx` |
| **SipCalibrationButton** | Layer 5 (品啜) | `src/components/SipCalibrationButton.tsx` |
| **SessionSettlementModal** | Layer 5 (封瓶) | `src/components/SessionSettlementModal.tsx` |

---

## 状态管理

**React Context**: `src/contexts/TeahouseHarnessContext.tsx`
- 管理抽屉/面板显示状态
- 管理当前 baseDrink 和 modifiers 选择
- 管理 sessionId 和 unsteepedLeaves
- 提供统一的 CRUD 方法

**Zustand Store**: 
- `useChatStore` - 消息和角色状态
- `useSettingsStore` - 服务配置

---

## 预置演示数据

**服务**: `src/services/harnessSeeding.ts`
- 首次进入茶席时自动种植：
  - 2 片待泡茶叶 (UnsteepedLeaf)
  - 2 个封存瓶 (SealedBottle)
  - 初始用户镜像 (UserMirror)

---

## 测试覆盖

**测试文件**: `tests/harness.test.ts`
- ✅ 饮品注册表完整性
- ✅ 双重人格 CRUD
- ✅ 确定性蒸馏 fallback
- ✅ 茶宠等级计算
- ✅ Token 估算准确性
- ✅ 封瓶三态分拣
- ✅ 文案守卫（禁止「不是……而是……」）

**总测试**: 123 tests passed

---

## 视觉设计系统

**颜色方案**:
- 香槟金: `#C4A574` (边框、accent、填充点)
- 柔粉: `#E7A0B4` (选中态、高亮)
- 温暖羊皮纸: `rgba(253, 248, 245, 0.92)` (半透明背景)

**排版**:
- 主字体: Noto Sans SC
- 行高: 1.5-1.8
- 留白: 充足、透气

**交互**:
- 抽屉/模态框: 从底部滑入，温暖半透明玻璃
- 按钮: 点击 scale 微缩 + 香槟金涟漪
- 品啜校准: 点击后显示「✓ 回甘确认」徽章

---

## 文案守卫规则

**严禁**:
- ❌ 人机恋语气：「想你了」「嗯嗯～」「我也是」
- ❌ 客服腔：「你好我是…进来坐坐吧」「在呢随便坐」
- ❌ 对立式表述：「不是……而是……」「但其实……反而……」

**提倡**:
- ✅ 故事驱动：「刚整理完上层书架的烤乌龙罐子，玉林西路窗外正下着雨」
- ✅ 自我反思提示：「顺着这泡往下聊」「帮我照照卡在哪」
- ✅ 温暖、直接、简洁

---

## 落地提交记录

| 迭代 | 提交 SHA | 主要内容 |
|------|---------|---------|
| Iteration 1 | `c8c4f85` | 核心架构实现 |
| Iteration 2 | `dd14a74` | 端到端连接 + 预置数据 |
| Iteration 3 | `6e35bc6` | 实时闭环运行 |
| Iteration 4 | `eea17d3` | 视觉打磨 + 角色一致性 |
| Iteration 5 | `e243180` | 零配置本地茶镜 |

---

## 下一步扩展方向

1. **多角色 Harness 支持**: 当前仅鹿芽，可扩展到其他角色
2. **语音碎碎念转录**: IngestPanel 增加音频输入
3. **图片 OCR 入茶**: 识别笔记、截图内容
4. **封存瓶智能召回**: 基于当前话题自动召回相关瓶子
5. **茶宠互动动画**: 滋养时显示茶宠反馈动画
6. **Harness 配置导入导出**: 支持备份和迁移

---

**文档版本**: v2.0  
**最后更新**: 2026-10-25  
**PR**: [#9 - Agent Harness v2 & Fluid Teahouse Architecture](https://github.com/brocademaple/bcmp_cyber_lover/pull/9)
