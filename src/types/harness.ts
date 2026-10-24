/**
 * Agent Harness Type Definitions for Yinzhi v2
 * 
 * This file defines the complete type system for the **Agent Harness Architecture**,
 * a modular framework for building fluid, context-aware AI companions.
 * 
 * ## Agent Harness 设计理念 (Design Philosophy)
 * 
 * Agent Harness 是一个「可组装的对话技能运行时」，将传统的单一 System Prompt
 * 拆解为：
 * 
 * 1. **双向人设存储 (DualPersonaStore)**: AI 人设 + 用户镜像
 * 2. **技能注册表 (BrewSkillRegistry)**: 可切换的对话模式（基底饮品）+ 实时调节器（佐料）
 * 3. **多模态入茶管线 (IngestDistiller)**: 将用户原始输入（文本/语音/图片）转译为待泡茶叶
 * 4. **三温层上下文管理 (ContextWindowManager)**: 热茶（最近对话）+ 茶海（会话摘要）+ 博古架（长期记忆）
 * 5. **茶室会话服务 (TeahouseSession)**: 泡茶 → 饮茶双向校准 → 封瓶三态分拣循环
 * 6. **茶宠收藏系统 (TeaPetShelf)**: 将自我发现结晶为可视化收藏，替代传统亲密度条
 * 
 * 这套架构让 AI 陪伴从「固定服务流程」变为「流动的对话技能组合」，
 * 用户可以像调制饮品一样实时调整对话风格，同时保证长期记忆的双向校准与垃圾回收。
 */

import type { Message } from './index';

// ============================================================================
// Layer 1: Dual Persona Store (双向人设存储)
// ============================================================================

/**
 * **用户镜像 (User Mirror)**
 * 
 * Agent Harness 的核心创新：不仅存储 AI 的人设，也动态维护「用户的镜像」。
 * 
 * 传统做法：AI 只有自己的人设，用户信息散落在对话历史中。
 * Harness 做法：将用户的特质、当前状态、已解决问题结构化存储，
 * 并通过「饮茶双向校准」机制实时更新，避免错误理解污染长期记忆。
 */
export interface UserMirror {
  /** 用户特质标签（通过多次对话沉淀） */
  traits: string[];
  
  /** 当前关注焦点（会随会话更新） */
  currentFocus: string[];
  
  /** 已解决的问题/障碍（避免重复追问） */
  resolvedBlockers: string[];
  
  /** 用户偏好的对话风格 */
  preferredBrewStyles: string[];
  
  /** 最后更新时间戳 */
  lastUpdatedAt: number;
  
  /** 更新来源追踪 */
  updateLog: {
    timestamp: number;
    source: 'sip_resonate' | 'sip_adjust' | 'settle_update';
    delta: string;
  }[];
}

/**
 * **茶室主人人设 (Teahouse Host Persona)**
 * 
 * 鹿芽的静态人设定义，与 UserMirror 共同构成「双向人设」。
 */
export interface TeahouseHostPersona {
  name: string;
  identity: string;
  location: string;
  personality: string[];
  conversationStyle: string;
  boundaries: string[];
}

/**
 * **双向人设存储 (DualPersonaStore)**
 * 
 * 同时维护 AI 人设与用户镜像，是所有 Harness 层的基础数据源。
 */
export interface DualPersonaStore {
  host: TeahouseHostPersona;
  userMirror: UserMirror;
  schemaVersion: 2;
  createdAt: number;
  updatedAt: number;
}

// ============================================================================
// Layer 2: Brew Skill Registry (流动饮品技能注册表)
// ============================================================================

/**
 * **基底饮品技能 (Base Drink Skill)**
 * 
 * 去 SOP 化的核心：不再硬编码「第一问事实、第二问感受」的固定流程，
 * 而是将对话模式抽象为「饮品」，每种饮品有自己的泡茶哲学。
 * 
 * 例如：
 * - `oolong` (岩骨乌龙): 层层递进、深度剥开，适合解开纠结思路
 * - `espresso` (手冲黑咖): 清晰拆解、直指行动，适合破局决策
 * - `chamomile` (晚安洋甘菊): 低询问、接住疲惫，适合夜间卸甲
 * - `matcha` (薄茶点拂): 轻快碰撞、灵感激发，适合创意头脑风暴
 */
export interface BaseDrinkSkill {
  /** 饮品 ID（如 'oolong', 'espresso'） */
  id: string;
  
  /** 饮品名称（如「岩骨乌龙 · 慢焙深聊」） */
  displayName: string;
  
  /** 饮品简介 */
  description: string;
  
  /** 对话哲学（影响 System Prompt 的核心段落） */
  conversationPhilosophy: string;
  
  /** 提问风格（如「层层剥开」、「直指要害」） */
  questioningStyle: string;
  
  /** 适用场景 */
  bestFor: string[];
  
  /** 视觉标识（Emoji 或图片 URI） */
  icon: string;
}

/**
 * **佐料调节器 (Drink Modifier / 加料)**
 * 
 * 实时运行时参数调节器，用户可以在对话中途随时加减：
 * 
 * - `milk` (加鲜奶): 增加共情缓冲，软化提问锋芒
 * - `sugar` (加方糖): 增加肯定权重，多看见用户做对的地方
 * - `peel` (加三年陈皮): 增强长期记忆召回，跨会话联结模式
 * - `ice` (加冰块): 增加清醒锐度，直奔核心 trade-off
 * 
 * 每个 Modifier 会在运行时修改 System Prompt 的对应段落或参数权重。
 */
export interface DrinkModifier {
  /** 佐料 ID（如 'milk', 'sugar', 'peel', 'ice'） */
  id: string;
  
  /** 佐料名称（如「加鲜奶 · 增加温度」） */
  displayName: string;
  
  /** 佐料简介 */
  description: string;
  
  /** 影响的运行时参数 */
  affectsParameter: 'empathyCushion' | 'affirmationBoost' | 'memoryEcho' | 'sobrietySharpness';
  
  /** 参数增量（0.0 - 1.0） */
  parameterDelta: number;
  
  /** 对应的 Prompt 修饰段落 */
  promptSnippet: string;
  
  /** 视觉标识 */
  icon: string;
}

/**
 * **技能注册表 (BrewSkillRegistry)**
 * 
 * 管理所有可用的基底饮品与佐料，是 Harness 的「技能菜单」。
 */
export interface BrewSkillRegistry {
  baseDrinks: Record<string, BaseDrinkSkill>;
  modifiers: Record<string, DrinkModifier>;
  defaultBaseDrink: string;
  schemaVersion: 1;
}

// ============================================================================
// Layer 3: Multi-modal Ingest Distiller (多模态入茶管线)
// ============================================================================

/**
 * **原始入茶项 (Raw Ingest Item)**
 * 
 * 用户可以通过多种方式输入「生茶原料」：
 * - 文本笔记（Markdown、日记、工作日志）
 * - 语音碎碎念（转录后的文本）
 * - 图片（带 OCR 或图像描述）
 * - 代码调试记录
 * 
 * Ingest Distiller 会将这些原始输入转译为「待泡茶叶」。
 */
export interface RawIngestItem {
  id: string;
  type: 'text' | 'voice_transcript' | 'image_caption' | 'code_log';
  content: string;
  metadata?: {
    source?: string;
    capturedAt?: number;
    voiceDuration?: number;
    imageUri?: string;
  };
  timestamp: number;
}

/**
 * **客观事实提取 (Objective Facts Extract)**
 * 
 * Stage 1 输出：从原始输入中提取的客观信号，不加主观解读。
 */
export interface ObjectiveFactsExtract {
  events: string[];
  timeline: { event: string; timestamp?: number }[];
  blockers: string[];
  paralinguisticSignals: string[];
  urgencyLevel: 'low' | 'medium' | 'high';
}

/**
 * **待泡茶叶 (Unsteeped Leaf)**
 * 
 * Stage 2 输出：经过鹿芽视角转译的「镜像解读」，
 * 包含「这反映了用户什么习惯/盲区」，以及建议的泡茶话题。
 * 
 * 这是 Harness 的核心创新：不直接用原始输入污染对话，
 * 而是先提炼为「结构化的待讨论议题」，再择机冲泡。
 */
export interface UnsteepedLeaf {
  id: string;
  sourceIngestId: string;
  objectiveFacts: ObjectiveFactsExtract;
  luyaMirrorLens: {
    reflectedPattern: string;
    suggestedBrewTopic: string;
    relevantUserTraits: string[];
  };
  status: 'fresh' | 'steeped' | 'expired';
  priority: number;
  createdAt: number;
  steepedAt?: number;
}

/**
 * **入茶蒸馏服务配置 (Ingest Distiller Config)**
 */
export interface IngestDistillerConfig {
  enableLLMPath: boolean;
  llmModel?: string;
  fallbackToDeterministic: boolean;
  maxLeafRetentionDays: number;
}

// ============================================================================
// Layer 4: Three-Tier Context Window Manager (三温层上下文管理)
// ============================================================================

/**
 * **热茶层 (Hot Tier / 杯中热茶)**
 * 
 * 最近 6-10 轮原始对话，直接进入 Context Window。
 */
export interface HotTierContext {
  recentMessages: Message[];
  maxTurns: number;
}

/**
 * **茶海摘要点 (Tea Sea Digest Point)**
 * 
 * 当热茶层溢出后，被「倒入公道杯」的摘要点，
 * 包含用户通过「饮一口 · 回甘」确认的共鸣点。
 */
export interface TeaSeaDigestPoint {
  turnIndex: number;
  userMessage: string;
  assistantInsight: string;
  resonanceConfirmed: boolean;
  timestamp: number;
}

/**
 * **温茶层 (Warm Tier / 公道杯茶海)**
 * 
 * 当前会话的滚动摘要，保留经过用户确认的关键点。
 */
export interface WarmTierContext {
  sessionId: string;
  digest: TeaSeaDigestPoint[];
  maxDigestPoints: number;
}

/**
 * **冷茶层 (Cold Tier / 博古架召回)**
 * 
 * 长期记忆选择性召回：封存的瓶子 + 双向人设。
 * 当 `peel` (陈皮) modifier 激活时，召回权重提升。
 */
export interface ColdTierContext {
  relevantBottles: SealedBottle[];
  dualPersona: DualPersonaStore;
  recallBoost: number;
}

/**
 * **三温层上下文快照 (Context Snapshot)**
 * 
 * 实时组装的完整上下文，供茶室会话服务使用。
 */
export interface ContextSnapshot {
  hot: HotTierContext;
  warm: WarmTierContext;
  cold: ColdTierContext;
  totalTokenEstimate: number;
  assembledAt: number;
}

// ============================================================================
// Layer 5: Teahouse Session Service (泡茶—饮茶—封瓶循环)
// ============================================================================

/**
 * **泡茶请求 (Brew Request)**
 * 
 * 用户发起对话时的完整请求上下文。
 */
export interface BrewRequest {
  userMessage: string;
  selectedBaseDrink: string;
  activeModifiers: string[];
  selectedLeaf?: UnsteepedLeaf;
  contextSnapshot: ContextSnapshot;
  timestamp: number;
}

/**
 * **泡茶响应 (Brew Response)**
 * 
 * 鹿芽的回复，包含可供「饮一口」校准的要点。
 */
export interface BrewResponse {
  assistantMessage: string;
  calibrationPoints: {
    id: string;
    snippet: string;
    type: 'insight' | 'guess' | 'reflection';
  }[];
  usedSkills: {
    baseDrink: string;
    modifiers: string[];
  };
  timestamp: number;
}

/**
 * **饮茶反馈 (Sip Feedback)**
 * 
 * 用户对某个 calibrationPoint 的反馈：
 * - `resonate` (回甘): 确认这口说到心里了
 * - `adjust` (添水): 还没说准，给出修正
 */
export interface SipFeedback {
  pointId: string;
  action: 'resonate' | 'adjust';
  adjustmentNote?: string;
  timestamp: number;
}

/**
 * **会话封瓶三态卡 (Session Settlement Card)**
 * 
 * 会话结束时生成的三态分拣清单，供用户确认：
 * 
 * 1. **封瓶存留 (seal)**: 关键自我发现 → SealedBottle + 滋养茶宠
 * 2. **刷新认知 (update)**: 更新 UserMirror（特质/关注/已解决障碍）
 * 3. **倒掉废茶 (discard)**: 情绪发泄噪音 → 永久遗忘（Memory GC）
 */
export interface SessionSettlementCard {
  sessionId: string;
  
  toSeal: {
    insight: string;
    nourishes: string;
    estimatedPatinaExp: number;
  }[];
  
  toUpdate: {
    traits?: string[];
    currentFocus?: string[];
    resolvedBlockers?: string[];
  };
  
  toDiscard: {
    snippet: string;
    reason: string;
  }[];
  
  generatedAt: number;
}

/**
 * **茶室会话状态 (Teahouse Session State)**
 */
export interface TeahouseSessionState {
  sessionId: string;
  activeBaseDrink: string;
  activeModifiers: string[];
  teaSeaDigest: TeaSeaDigestPoint[];
  sipFeedbackLog: SipFeedback[];
  startedAt: number;
  lastBrewAt: number;
}

// ============================================================================
// Layer 6: Tea Pet & Curio Shelf (茶宠收藏系统)
// ============================================================================

/**
 * **封存的瓶子 (Sealed Bottle)**
 * 
 * 自我发现的结晶体，放置在博古架上，关联到特定茶宠。
 */
export interface SealedBottle {
  id: string;
  insight: string;
  sourceSessionId: string;
  nourishes: string;
  patinaContribution: number;
  sealedAt: number;
}

/**
 * **茶宠 (Tea Pet)**
 * 
 * 博古架上的四只茶宠，各自代表不同成长维度：
 * 
 * - **青瓷小鹿 · 澄明 (Clarity Deer)**: 思路理清、迷雾散去的收藏
 * - **乌木小猫 · 笃行 (Action Cat)**: 破局决策、实际行动的收藏
 * - **白玉睡狐 · 松弛 (Ease Fox)**: 卸下防备、自我接纳的收藏
 * - **赤陶小雀 · 灵光 (Spark Bird)**: 灵感碰撞、创意涌现的收藏
 */
export interface TeaPet {
  id: 'clarity_deer' | 'action_cat' | 'ease_fox' | 'spark_bird';
  displayName: string;
  description: string;
  icon: string;
  
  patinaExp: number;
  level: number;
  
  lastNourishedAt?: number;
  feedingHistory: {
    bottleId: string;
    exp: number;
    timestamp: number;
  }[];
}

/**
 * **博古架 (Curio Shelf)**
 * 
 * 用户的完整茶宠收藏系统，替代传统亲密度条。
 */
export interface CurioShelf {
  pets: Record<string, TeaPet>;
  bottles: SealedBottle[];
  totalPatinaExp: number;
  shelfLevel: number;
  createdAt: number;
  updatedAt: number;
}

// ============================================================================
// Harness Inspector (透视镜数据)
// ============================================================================

/**
 * **Harness Inspector Snapshot (透视镜快照)**
 * 
 * 供用户学习 Agent Harness 原理时实时查看的内部状态。
 */
export interface HarnessInspectorSnapshot {
  assembledSystemPrompt: string;
  activeSkills: {
    baseDrink: BaseDrinkSkill;
    modifiers: DrinkModifier[];
  };
  contextState: {
    hotTurnCount: number;
    warmDigestCount: number;
    coldBottleCount: number;
    totalTokenEstimate: number;
  };
  memoryGCQueue: {
    snippet: string;
    scheduledForDiscard: boolean;
  }[];
  lastUpdatedAt: number;
}
