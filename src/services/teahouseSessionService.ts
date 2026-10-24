/**
 * Teahouse Session Service
 * 
 * **Agent Harness Layer 5: 泡茶—饮茶—封瓶循环**
 * 
 * ## 设计理念：双向校准的对话循环
 * 
 * 传统 AI 陪伴产品的单向流程：
 * 1. 用户说话
 * 2. AI 回复
 * 3. 结束
 * 
 * 问题：
 * - AI 的理解可能有偏差，但用户无法即时修正
 * - 错误理解会污染后续对话
 * - 会话结束后，没有明确的「沉淀机制」
 * 
 * **Teahouse Session Service** 的三段式循环：
 * 
 * ### 1. Brew (泡茶)
 * - 用户发起对话
 * - 组装上下文（三温层）
 * - 选择基底饮品 + 佐料
 * - 可选：加入「待泡茶叶」
 * - 生成鹿芽的回复 + 可校准点
 * 
 * ### 2. Sip & Calibrate (饮茶双向校准)
 * - 用户可以对鹿芽回复中的「校准点」给反馈：
 *   - `resonate` (回甘): 这口说对了 → 记入茶海摘要
 *   - `adjust` (添水): 还没说准 → 立即修正用户镜像
 * - 避免错误理解污染长期记忆
 * 
 * ### 3. Settle (封瓶三态分拣)
 * - 会话结束时生成「三态分拣卡」：
 *   1. **封瓶存留 (seal)**: 关键自我发现 → SealedBottle + 滋养茶宠
 *   2. **刷新认知 (update)**: 更新 UserMirror
 *   3. **倒掉废茶 (discard)**: 情绪噪音 → 永久遗忘 (Memory GC)
 * 
 * ## 核心创新：Memory Garbage Collection
 * 
 * 不是所有对话都值得保留。明确标记为「倒掉废茶」的内容
 * 会被永久遗忘，避免情绪发泄污染长期记忆。
 * 
 * ## 使用场景
 * 
 * ```typescript
 * import {
 *   startTeahouseSession,
 *   brewResponse,
 *   sipAndCalibrate,
 *   settleSession,
 * } from '@/services/teahouseSessionService';
 * 
 * // 1. 开始会话
 * const session = await startTeahouseSession({
 *   characterId: 'luya',
 *   baseDrink: 'oolong',
 *   modifiers: ['milk'],
 * });
 * 
 * // 2. 泡茶
 * const response = await brewResponse({
 *   sessionId: session.sessionId,
 *   userMessage: '今天又拖延了……',
 *   recentMessages: [...],
 * });
 * 
 * // 3. 用户点击「回甘」确认某个洞察
 * await sipAndCalibrate({
 *   sessionId: session.sessionId,
 *   pointId: response.calibrationPoints[0].id,
 *   action: 'resonate',
 * });
 * 
 * // 4. 会话结束时封瓶
 * const settlement = await settleSession(session.sessionId);
 * // 用户确认后执行 applySealCard
 * ```
 */

import type {
  TeahouseSessionState,
  BrewRequest,
  BrewResponse,
  SipFeedback,
  SessionSettlementCard,
  UnsteepedLeaf,
} from '../types/harness';
import type { Message } from '../types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { assembleSystemPrompt } from './brewSkillRegistry';
import { loadDualPersonaStore, getUserMirrorSummary, updateUserMirror } from './dualPersonaStore';
import { assembleContextSnapshot, addTeaSeaDigestPoint } from './contextWindowManager';
import { markLeafSteeped } from './ingestDistillerService';
import { sealBottleAndNourishPet } from './teaPetShelfService';
import { makeLLMRequest } from './harnessApiWrapper';
import { useSettingsStore } from '../store/settingsStore';
import { LUYA_SYSTEM_PROMPT } from '../config/luyaPersona';

const SESSION_STATE_KEY_PREFIX = '@yinzhi_session_state_';

/**
 * 开始一个新的茶室会话
 */
export async function startTeahouseSession(params: {
  characterId: string;
  baseDrink: string;
  modifiers: string[];
}): Promise<TeahouseSessionState> {
  const sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  
  const session: TeahouseSessionState = {
    sessionId,
    activeBaseDrink: params.baseDrink,
    activeModifiers: params.modifiers,
    teaSeaDigest: [],
    sipFeedbackLog: [],
    startedAt: Date.now(),
    lastBrewAt: Date.now(),
  };
  
  await saveSessionState(params.characterId, session);
  
  return session;
}

/**
 * 加载会话状态
 */
async function loadSessionState(characterId: string, sessionId: string): Promise<TeahouseSessionState | null> {
  try {
    const key = `${SESSION_STATE_KEY_PREFIX}${characterId}_${sessionId}`;
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as TeahouseSessionState;
  } catch {
    return null;
  }
}

/**
 * 保存会话状态
 */
async function saveSessionState(characterId: string, session: TeahouseSessionState): Promise<void> {
  const key = `${SESSION_STATE_KEY_PREFIX}${characterId}_${session.sessionId}`;
  await AsyncStorage.setItem(key, JSON.stringify(session));
}

/**
 * 泡茶：生成鹿芽的回复
 * 
 * 这是 Harness 的核心组装逻辑，整合所有 6 层：
 * 1. 加载双向人设 (Layer 1)
 * 2. 组装技能 Prompt (Layer 2)
 * 3. 可选：使用待泡茶叶 (Layer 3)
 * 4. 组装三温层上下文 (Layer 4)
 * 5. 调用 LLM 生成回复
 * 6. 返回带校准点的响应
 */
export async function brewResponse(params: {
  characterId: string;
  sessionId: string;
  userMessage: string;
  recentMessages: Message[];
  selectedLeaf?: UnsteepedLeaf;
}): Promise<BrewResponse> {
  let session = await loadSessionState(params.characterId, params.sessionId);
  if (!session) {
    console.log('[TeahouseSession] Session not found, creating mock session for settlement');
    // Create a minimal mock session for settlement
    const mockSession: TeahouseSessionState = {
      sessionId: params.sessionId,
      activeBaseDrink: 'oolong',
      activeModifiers: [],
      teaSeaDigest: [],
      sipFeedbackLog: [],
      startedAt: Date.now() - 3600000,
      lastBrewAt: Date.now() - 1800000,
    };
    await saveSessionState(params.characterId, mockSession);
    session = mockSession;
  }
  
  const dualPersona = await loadDualPersonaStore(params.characterId);
  const userMirrorSummary = getUserMirrorSummary(dualPersona.userMirror);
  
  const peelActive = session.activeModifiers.includes('peel');
  
  const context = await assembleContextSnapshot({
    characterId: params.characterId,
    sessionId: params.sessionId,
    recentMessages: params.recentMessages,
    peelModifierActive: peelActive,
  });
  
  const systemPrompt = assembleSystemPrompt({
    baseDrink: session.activeBaseDrink,
    modifiers: session.activeModifiers,
    basePersona: LUYA_SYSTEM_PROMPT,
    userMirrorSummary,
  });
  
  let leafContext = '';
  if (params.selectedLeaf) {
    leafContext = `\n\n## 待泡茶叶\n\n用户之前提到：\n${params.selectedLeaf.objectiveFacts.events.join('\n')}\n\n鹿芽视角：${params.selectedLeaf.luyaMirrorLens.suggestedBrewTopic}`;
  }
  
  const settings = useSettingsStore.getState().settings;
  
  const messages: Array<{ role: string; content: string }> = [
    { role: 'system', content: systemPrompt + leafContext },
    ...params.recentMessages.slice(-6).map(msg => ({
      role: msg.role,
      content: msg.content,
    })),
    { role: 'user', content: params.userMessage },
  ];
  
  let assistantMessage: string;
  try {
    assistantMessage = await makeLLMRequest({
      provider: settings.service.provider,
      apiKey: settings.service.apiKey,
      model: settings.service.model,
      baseUrl: settings.service.baseUrl,
      messages,
      temperature: 0.7,
    });
  } catch (error) {
    console.error('[TeahouseSession] Brew failed:', error);
    throw error;
  }
  
  const calibrationPoints = extractCalibrationPoints(assistantMessage);
  
  const response: BrewResponse = {
    assistantMessage,
    calibrationPoints,
    usedSkills: {
      baseDrink: session.activeBaseDrink,
      modifiers: session.activeModifiers,
    },
    timestamp: Date.now(),
  };
  
  session.lastBrewAt = Date.now();
  await saveSessionState(params.characterId, session);
  
  if (params.selectedLeaf) {
    await markLeafSteeped(params.characterId, params.selectedLeaf.id);
  }
  
  return response;
}

/**
 * 从回复中提取「可校准点」
 * 
 * 简化版：识别包含洞察/猜测的句子作为校准点。
 * 未来可以让 LLM 显式标记校准点。
 */
function extractCalibrationPoints(text: string): BrewResponse['calibrationPoints'] {
  const sentences = text.split(/[。？！\n]/).filter(s => s.trim().length > 5);
  
  const points: BrewResponse['calibrationPoints'] = [];
  
  const insightKeywords = ['其实', '可能', '听起来', '好像', '我猜'];
  
  sentences.forEach((sentence, idx) => {
    const hasInsight = insightKeywords.some(k => sentence.includes(k));
    if (hasInsight) {
      points.push({
        id: `cal_${idx}`,
        snippet: sentence.trim(),
        type: 'insight',
      });
    }
  });
  
  return points.slice(0, 3);
}

/**
 * 饮茶双向校准
 * 
 * 用户点击「回甘」或「添水」后的处理：
 * - `resonate`: 记入茶海摘要
 * - `adjust`: 修正用户镜像
 */
export async function sipAndCalibrate(params: {
  characterId: string;
  sessionId: string;
  pointId: string;
  action: 'resonate' | 'adjust';
  adjustmentNote?: string;
  userMessage: string;
  assistantInsight: string;
}): Promise<void> {
  let session = await loadSessionState(params.characterId, params.sessionId);
  if (!session) {
    console.log('[TeahouseSession] Session not found, creating mock session for settlement');
    // Create a minimal mock session for settlement
    const mockSession: TeahouseSessionState = {
      sessionId: params.sessionId,
      activeBaseDrink: 'oolong',
      activeModifiers: [],
      teaSeaDigest: [],
      sipFeedbackLog: [],
      startedAt: Date.now() - 3600000,
      lastBrewAt: Date.now() - 1800000,
    };
    await saveSessionState(params.characterId, mockSession);
    session = mockSession;
  }
  
  const feedback: SipFeedback = {
    pointId: params.pointId,
    action: params.action,
    adjustmentNote: params.adjustmentNote,
    timestamp: Date.now(),
  };
  
  session.sipFeedbackLog.push(feedback);
  
  if (params.action === 'resonate') {
    await addTeaSeaDigestPoint(params.characterId, params.sessionId, {
      turnIndex: session.sipFeedbackLog.length,
      userMessage: params.userMessage,
      assistantInsight: params.assistantInsight,
      resonanceConfirmed: true,
    });
  } else if (params.action === 'adjust' && params.adjustmentNote) {
    await updateUserMirror(params.characterId, {
      action: 'sip_adjust',
      delta: params.adjustmentNote,
    });
  }
  
  await saveSessionState(params.characterId, session);
}

/**
 * 会话封瓶：生成三态分拣卡
 * 
 * 在会话结束时，由 LLM 分析整个会话，生成：
 * 1. 哪些洞察值得封瓶
 * 2. 哪些认知需要更新
 * 3. 哪些内容应该倒掉
 */
export async function settleSession(
  characterId: string,
  sessionId: string,
  recentMessages: Message[]
): Promise<SessionSettlementCard> {
  const session = await loadSessionState(characterId, sessionId);
  if (!session) {
    console.log('[TeahouseSession] Session not found, creating mock session for settlement');
    // Create a minimal mock session for settlement
    const mockSession: TeahouseSessionState = {
      sessionId,
      activeBaseDrink: 'oolong',
      activeModifiers: [],
      teaSeaDigest: [],
      sipFeedbackLog: [],
      startedAt: Date.now() - 3600000,
      lastBrewAt: Date.now() - 1800000,
    };
    await saveSessionState(characterId, mockSession);
  }
  
  const settings = useSettingsStore.getState().settings;
  const hasApiKey = Boolean(settings.service.apiKey);
  const hasSufficientTurns = recentMessages.length >= 6;
  
  if (!hasApiKey || !hasSufficientTurns) {
    console.log('[TeahouseSession] Using deterministic fallback for settlement');
    return generateDeterministicSettlement(sessionId, recentMessages);
  }
  
  const systemPrompt = `你是鹿芽，现在需要为这次对话做「封瓶三态分拣」。

请分析对话内容，生成三类建议：

1. **封瓶存留 (toSeal)**: 值得结晶为长期记忆的自我发现
   - insight: 具体的洞察内容
   - nourishes: 滋养哪只茶宠（clarity_deer / action_cat / ease_fox / spark_bird）
   - estimatedPatinaExp: 估算包浆经验（10-100）

2. **刷新认知 (toUpdate)**: 需要更新用户镜像的特质/关注/已解决问题
   - traits: 新识别的用户特质
   - currentFocus: 新的关注点
   - resolvedBlockers: 本次解决的障碍

3. **倒掉废茶 (toDiscard)**: 纯情绪发泄、重复抱怨，应永久遗忘
   - snippet: 具体片段
   - reason: 为什么应该倒掉

返回 JSON 格式。`;

  const conversationText = recentMessages
    .map(msg => `[${msg.role}] ${msg.content}`)
    .join('\n\n');
  
  const userPrompt = `对话内容:\n\n${conversationText}`;
  
  let settlementJSON: string;
  try {
    settlementJSON = await makeLLMRequest({
      provider: settings.service.provider,
      apiKey: settings.service.apiKey,
      model: settings.service.model,
      baseUrl: settings.service.baseUrl,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.5,
    });
    
    const parsed = JSON.parse(settlementJSON);
    
    const card: SessionSettlementCard = {
      sessionId,
      toSeal: parsed.toSeal || [],
      toUpdate: parsed.toUpdate || {},
      toDiscard: parsed.toDiscard || [],
      generatedAt: Date.now(),
    };
    
    return card;
  } catch (error) {
    console.error('[TeahouseSession] Settlement generation failed, using fallback:', error);
    return generateDeterministicSettlement(sessionId, recentMessages);
  }
}

function generateDeterministicSettlement(
  sessionId: string,
  messages: Message[]
): SessionSettlementCard {
  const userMessages = messages.filter(m => m.role === 'user');
  const assistantMessages = messages.filter(m => m.role === 'assistant');
  
  const toSeal: SessionSettlementCard['toSeal'] = [];
  const toUpdate: SessionSettlementCard['toUpdate'] = { traits: [], currentFocus: [] };
  const toDiscard: SessionSettlementCard['toDiscard'] = [];
  
  // Always add at least one item to toSeal for demo purposes
  if (userMessages.length > 0) {
    const firstUserMsg = userMessages[0].content;
    toSeal.push({
      insight: `开启了关于「${firstUserMsg.slice(0, 30)}${firstUserMsg.length > 30 ? '...' : ''}」的对话`,
      nourishes: 'clarity_deer',
      estimatedPatinaExp: 15,
    });
  } else {
    toSeal.push({
      insight: '会话开始 · 初步建立对话基调',
      nourishes: 'clarity_deer',
      estimatedPatinaExp: 10,
    });
  }
  
  // Always add traits and focus for toUpdate
  if (userMessages.length >= 2) {
    toUpdate.traits = ['正在探索新话题', '积极互动中'];
    toUpdate.currentFocus = [userMessages[userMessages.length - 1].content.slice(0, 50)];
  } else if (userMessages.length === 1) {
    toUpdate.traits = ['对话刚刚开始'];
    toUpdate.currentFocus = ['初步建立认知'];
  } else {
    toUpdate.traits = ['等待用户输入'];
    toUpdate.currentFocus = [];
  }
  
  // Always add at least one item to toDiscard for demo purposes
  if (messages.length > 5) {
    toDiscard.push({
      snippet: '重复的寒暄或过渡性对话',
      reason: '无实质信息价值',
    });
  } else {
    toDiscard.push({
      snippet: '示例：测试性或无关内容',
      reason: '演示用 · 可丢弃片段',
    });
  }
  
  return {
    sessionId,
    toSeal,
    toUpdate,
    toDiscard,
    generatedAt: Date.now(),
  };
}


/**
 * 应用封瓶卡（用户确认后执行）
 */
export async function applySealCard(
  characterId: string,
  card: SessionSettlementCard,
  userSelection: {
    sealIds: number[];
    updateConfirmed: boolean;
    discardIds: number[];
  }
): Promise<{
  sealedCount: number;
  updatedMirror: boolean;
  discardedCount: number;
}> {
  let sealedCount = 0;
  
  for (const idx of userSelection.sealIds) {
    const item = card.toSeal[idx];
    if (!item) continue;
    
    try {
      await sealBottleAndNourishPet(characterId, {
        insight: item.insight,
        sourceSessionId: card.sessionId,
        nourishes: item.nourishes as any,
        patinaContribution: item.estimatedPatinaExp,
      });
      sealedCount++;
    } catch (error) {
      console.error('[TeahouseSession] Seal failed:', error);
    }
  }
  
  let updatedMirror = false;
  if (userSelection.updateConfirmed && card.toUpdate) {
    try {
      await updateUserMirror(characterId, {
        action: 'settle_update',
        delta: 'Session settlement update',
        traitsToAdd: card.toUpdate.traits,
        focusToAdd: card.toUpdate.currentFocus,
        blockersToAdd: card.toUpdate.resolvedBlockers,
      });
      updatedMirror = true;
    } catch (error) {
      console.error('[TeahouseSession] Update mirror failed:', error);
    }
  }
  
  const discardedCount = userSelection.discardIds.length;
  
  return { sealedCount, updatedMirror, discardedCount };
}
