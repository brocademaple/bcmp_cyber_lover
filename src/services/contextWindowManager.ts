/**
 * Context Window Manager Service
 * 
 * **Agent Harness Layer 4: 三温层上下文管理**
 * 
 * ## 设计理念：分层上下文策略
 * 
 * 传统做法：
 * - 简单粗暴：只保留最近 N 条消息
 * - 全量加载：把所有历史都塞进 Context Window
 * 
 * 问题：
 * 1. 只保留最近消息 → 丢失长期模式
 * 2. 全量加载 → Token 浪费严重 + 响应慢
 * 3. 无法区分「重要的」和「噪音」
 * 
 * **Context Window Manager** 采用三温层策略：
 * 
 * ### 热茶层 (Hot Tier / 杯中热茶)
 * - 最近 6-10 轮原始对话
 * - 直接进入 Context Window
 * - 用于处理当前话题的连贯性
 * 
 * ### 温茶层 (Warm Tier / 公道杯茶海)
 * - 当前会话的滚动摘要 (TeaSeaDigest)
 * - 只保留用户通过「饮一口 · 回甘」确认的共鸣点
 * - 当热茶层溢出时自动生成
 * 
 * ### 冷茶层 (Cold Tier / 博古架召回)
 * - 长期封存的瓶子 (SealedBottle)
 * - 双向人设 (DualPersonaStore)
 * - 选择性召回：根据当前话题相关度
 * - 当 `peel` (陈皮) modifier 激活时，召回权重提升
 * 
 * ## 核心创新：双向校准驱动的摘要
 * 
 * 不是所有对话都值得保留。只有经过用户「饮一口」确认的共鸣点
 * 才会进入温茶层，避免错误理解污染长期记忆。
 * 
 * ## 使用场景
 * 
 * ```typescript
 * import { assembleContextSnapshot } from '@/services/contextWindowManager';
 * 
 * // 用户发起新对话时
 * const context = await assembleContextSnapshot({
 *   characterId: 'luya',
 *   sessionId: currentSessionId,
 *   recentMessages: messages.slice(-10),
 *   peelModifierActive: false,
 * });
 * 
 * // context 包含完整的三温层数据，可直接用于组装 System Prompt
 * ```
 */

import type {
  ContextSnapshot,
  HotTierContext,
  WarmTierContext,
  ColdTierContext,
  TeaSeaDigestPoint,
  SealedBottle,
} from '../types/harness';
import type { Message } from '../types';
import { loadDualPersonaStore } from './dualPersonaStore';
import { listSealedBottles } from './teaPetShelfService';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TEA_SEA_KEY_PREFIX = '@yinzhi_tea_sea_';

const DEFAULT_HOT_TIER_MAX_TURNS = 10;
const DEFAULT_WARM_TIER_MAX_DIGEST_POINTS = 15;

/**
 * 粗略估算 Token 数量（简化版）
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3);
}

/**
 * 加载当前会话的茶海摘要
 */
async function loadTeaSeaDigest(characterId: string, sessionId: string): Promise<TeaSeaDigestPoint[]> {
  try {
    const key = `${TEA_SEA_KEY_PREFIX}${characterId}_${sessionId}`;
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return [];
    return JSON.parse(raw) as TeaSeaDigestPoint[];
  } catch {
    return [];
  }
}

/**
 * 保存当前会话的茶海摘要
 */
export async function saveTeaSeaDigest(
  characterId: string,
  sessionId: string,
  digest: TeaSeaDigestPoint[]
): Promise<void> {
  const key = `${TEA_SEA_KEY_PREFIX}${characterId}_${sessionId}`;
  await AsyncStorage.setItem(key, JSON.stringify(digest));
}

/**
 * 添加一个茶海摘要点（当用户点击「回甘」时）
 */
export async function addTeaSeaDigestPoint(
  characterId: string,
  sessionId: string,
  point: Omit<TeaSeaDigestPoint, 'timestamp'>
): Promise<void> {
  const digest = await loadTeaSeaDigest(characterId, sessionId);
  
  const newPoint: TeaSeaDigestPoint = {
    ...point,
    timestamp: Date.now(),
  };
  
  digest.push(newPoint);
  
  if (digest.length > DEFAULT_WARM_TIER_MAX_DIGEST_POINTS) {
    digest.shift();
  }
  
  await saveTeaSeaDigest(characterId, sessionId, digest);
}

/**
 * 组装热茶层 (Hot Tier)
 */
function assembleHotTier(recentMessages: Message[]): HotTierContext {
  const maxTurns = DEFAULT_HOT_TIER_MAX_TURNS;
  const sliced = recentMessages.slice(-maxTurns);
  
  return {
    recentMessages: sliced,
    maxTurns,
  };
}

/**
 * 组装温茶层 (Warm Tier)
 */
async function assembleWarmTier(
  characterId: string,
  sessionId: string
): Promise<WarmTierContext> {
  const digest = await loadTeaSeaDigest(characterId, sessionId);
  
  return {
    sessionId,
    digest,
    maxDigestPoints: DEFAULT_WARM_TIER_MAX_DIGEST_POINTS,
  };
}

/**
 * 组装冷茶层 (Cold Tier)
 * 
 * 选择性召回封存的瓶子和双向人设。
 * 简化版：目前召回最近 N 个瓶子，未来可以基于语义相似度召回。
 */
async function assembleColdTier(
  characterId: string,
  peelModifierActive: boolean
): Promise<ColdTierContext> {
  const dualPersona = await loadDualPersonaStore(characterId);
  
  const allBottles = await listSealedBottles(characterId);
  
  const recallBoost = peelModifierActive ? 1.5 : 1.0;
  
  const maxBottles = peelModifierActive ? 5 : 3;
  const relevantBottles = allBottles
    .sort((a, b) => b.sealedAt - a.sealedAt)
    .slice(0, maxBottles);
  
  return {
    relevantBottles,
    dualPersona,
    recallBoost,
  };
}

/**
 * 组装完整的上下文快照
 * 
 * 这是 Context Window Manager 的核心接口，
 * 返回完整的三温层数据供茶室会话服务使用。
 */
export async function assembleContextSnapshot(params: {
  characterId: string;
  sessionId: string;
  recentMessages: Message[];
  peelModifierActive: boolean;
}): Promise<ContextSnapshot> {
  const hot = assembleHotTier(params.recentMessages);
  const warm = await assembleWarmTier(params.characterId, params.sessionId);
  const cold = await assembleColdTier(params.characterId, params.peelModifierActive);
  
  let totalTokenEstimate = 0;
  
  hot.recentMessages.forEach(msg => {
    totalTokenEstimate += estimateTokens(msg.content);
  });
  
  warm.digest.forEach(point => {
    totalTokenEstimate += estimateTokens(point.userMessage);
    totalTokenEstimate += estimateTokens(point.assistantInsight);
  });
  
  cold.relevantBottles.forEach(bottle => {
    totalTokenEstimate += estimateTokens(bottle.insight);
  });
  
  const userMirrorText = JSON.stringify(cold.dualPersona.userMirror);
  totalTokenEstimate += estimateTokens(userMirrorText);
  
  return {
    hot,
    warm,
    cold,
    totalTokenEstimate,
    assembledAt: Date.now(),
  };
}

/**
 * 生成三温层的文本表示（用于注入 System Prompt）
 */
export function renderContextForPrompt(context: ContextSnapshot): {
  hotTierText: string;
  warmTierText: string;
  coldTierText: string;
} {
  const hotTierText = context.hot.recentMessages
    .map(msg => `[${msg.role}] ${msg.content}`)
    .join('\n\n');
  
  let warmTierText = '';
  if (context.warm.digest.length > 0) {
    warmTierText = `## 本次会话共鸣点 (Tea Sea Digest)\n\n`;
    warmTierText += context.warm.digest
      .map((point, idx) => 
        `${idx + 1}. 用户: ${point.userMessage}\n   鹿芽: ${point.assistantInsight}\n   (用户确认: ${point.resonanceConfirmed ? '✓ 回甘' : '待确认'})`
      )
      .join('\n\n');
  }
  
  let coldTierText = '';
  if (context.cold.relevantBottles.length > 0) {
    coldTierText = `## 博古架封存记忆 (Sealed Bottles)\n\n`;
    coldTierText += context.cold.relevantBottles
      .map((bottle, idx) => 
        `${idx + 1}. ${bottle.insight}\n   (滋养: ${bottle.nourishes}, 封存于: ${new Date(bottle.sealedAt).toLocaleDateString()})`
      )
      .join('\n\n');
  }
  
  return { hotTierText, warmTierText, coldTierText };
}

/**
 * 清理过期的茶海摘要（可选的后台任务）
 */
export async function cleanupOldTeaSeaDigests(characterId: string, maxAgeDays: number = 30): Promise<number> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const prefix = `${TEA_SEA_KEY_PREFIX}${characterId}_`;
    const relevantKeys = allKeys.filter(k => k.startsWith(prefix));
    
    const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
    let removedCount = 0;
    
    for (const key of relevantKeys) {
      const raw = await AsyncStorage.getItem(key);
      if (!raw) continue;
      
      const digest = JSON.parse(raw) as TeaSeaDigestPoint[];
      if (digest.length === 0 || digest[digest.length - 1].timestamp < cutoff) {
        await AsyncStorage.removeItem(key);
        removedCount++;
      }
    }
    
    return removedCount;
  } catch (error) {
    console.warn('[ContextWindowManager] Cleanup failed:', error);
    return 0;
  }
}
