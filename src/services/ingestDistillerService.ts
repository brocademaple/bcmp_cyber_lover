/**
 * Ingest Distiller Service
 * 
 * **Agent Harness Layer 3: 多模态入茶管线**
 * 
 * ## 设计理念：两段式转译
 * 
 * 传统做法：用户输入什么，AI 直接回应什么。
 * 问题：
 * 1. 语音碎碎念、长篇笔记、代码日志等非结构化输入难以利用
 * 2. 用户的情绪噪音和真实困扰混在一起
 * 3. 时间线、阻塞点、紧急程度等关键信号被淹没
 * 
 * **Ingest Distiller** 采用两段式转译：
 * 
 * ### Stage 1: 客观事实提取 (Objective Facts Extraction)
 * 提取客观信号，不加主观解读：
 * - 发生了什么事件（时间线）
 * - 遇到了什么阻塞
 * - 副语言信号（叹气、停顿、重复短语）
 * - 紧急程度评估
 * 
 * ### Stage 2: 鹿芽镜像转译 (Luya Mirror Lens Translation)
 * 从鹿芽视角解读 Stage 1 的事实：
 * - 这反映了用户什么习惯/盲区？
 * - 建议在茶室讨论什么话题？
 * - 关联用户的哪些已知特质？
 * 
 * 转译结果生成「待泡茶叶」(UnsteepedLeaf)，不会立即冲泡，
 * 而是等用户坐进茶室时，由茶室会话服务择机使用。
 * 
 * ## 实现策略
 * 
 * 1. **LLM Path**: 使用配置的 AI 服务（DeepSeek/SiliconFlow/Custom）
 * 2. **Deterministic Fallback**: 基于规则的本地提取，无需 API Key 也能工作
 * 
 * 这样即使用户没有配置 AI 服务，入茶管线也能正常运作（降级模式）。
 * 
 * ## 使用场景
 * 
 * ```typescript
 * import { ingestRawMaterial, listUnsteepedLeaves } from '@/services/ingestDistillerService';
 * 
 * // 用户上传一段工作日志
 * const leaf = await ingestRawMaterial({
 *   type: 'text',
 *   content: '今天又拖延了，本来要写的功能一个字都没动……',
 * });
 * 
 * // 在茶室中查看待泡茶叶
 * const leaves = await listUnsteepedLeaves('luya', { status: 'fresh' });
 * ```
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  RawIngestItem,
  ObjectiveFactsExtract,
  UnsteepedLeaf,
  IngestDistillerConfig,
} from '../types/harness';
import { useSettingsStore } from '../store/settingsStore';
import { makeLLMRequest } from './harnessApiWrapper';

const INGEST_LEAVES_KEY_PREFIX = '@yinzhi_ingest_leaves_';
const INGEST_CONFIG_KEY = '@yinzhi_ingest_config';

/**
 * 默认配置
 */
const DEFAULT_CONFIG: IngestDistillerConfig = {
  enableLLMPath: true,
  fallbackToDeterministic: true,
  maxLeafRetentionDays: 30,
};

/**
 * 加载配置
 */
export async function loadIngestDistillerConfig(): Promise<IngestDistillerConfig> {
  try {
    const raw = await AsyncStorage.getItem(INGEST_CONFIG_KEY);
    if (!raw) return DEFAULT_CONFIG;
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_CONFIG;
  }
}

/**
 * 保存配置
 */
export async function saveIngestDistillerConfig(config: Partial<IngestDistillerConfig>): Promise<void> {
  const current = await loadIngestDistillerConfig();
  const updated = { ...current, ...config };
  await AsyncStorage.setItem(INGEST_CONFIG_KEY, JSON.stringify(updated));
}

/**
 * Stage 1: 客观事实提取 (LLM Path)
 */
async function extractFactsLLM(content: string): Promise<ObjectiveFactsExtract> {
  const settings = useSettingsStore.getState().settings;
  
  const systemPrompt = `你是一个客观的事实提取器。
从用户输入中提取：
1. 发生的事件（按时间顺序）
2. 遇到的阻塞/困难
3. 副语言信号（如叹气、停顿、重复短语、语气急促等）
4. 紧急程度（low/medium/high）

只提取客观可见的信息，不要加主观解读。

返回 JSON 格式：
{
  "events": ["事件1", "事件2"],
  "timeline": [{"event": "事件1", "timestamp": 可选的时间戳}],
  "blockers": ["阻塞1", "阻塞2"],
  "paralinguisticSignals": ["信号1", "信号2"],
  "urgencyLevel": "low | medium | high"
}`;

  const userPrompt = `用户输入:\n\n${content}`;
  
  try {
    const response = await makeLLMRequest({
      provider: settings.service.provider,
      apiKey: settings.service.apiKey,
      model: settings.service.model,
      baseUrl: settings.service.baseUrl,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
    });
    
    const parsed = JSON.parse(response);
    return parsed as ObjectiveFactsExtract;
  } catch (error) {
    console.warn('[IngestDistiller] LLM extraction failed:', error);
    throw error;
  }
}

/**
 * Stage 1: 客观事实提取 (Deterministic Fallback)
 */
function extractFactsDeterministic(content: string): ObjectiveFactsExtract {
  const lines = content.split('\n').filter(l => l.trim());
  
  const events: string[] = [];
  const blockers: string[] = [];
  const paralinguisticSignals: string[] = [];
  
  const urgencyKeywords = ['紧急', '着急', '马上', '赶紧', '!', '！！'];
  const blockerKeywords = ['不知道', '不会', '卡住', '做不出', '拖延', '没法', '困扰'];
  const emotionKeywords = ['唉', '哎', '……', '…', '啊啊', '呜'];
  
  lines.forEach(line => {
    if (blockerKeywords.some(k => line.includes(k))) {
      blockers.push(line.trim());
    } else {
      events.push(line.trim());
    }
    
    if (emotionKeywords.some(k => line.includes(k))) {
      paralinguisticSignals.push('情绪化表达');
    }
  });
  
  const hasUrgency = urgencyKeywords.some(k => content.includes(k));
  const urgencyLevel: 'low' | 'medium' | 'high' = 
    hasUrgency ? 'high' : 
    blockers.length > 2 ? 'medium' : 
    'low';
  
  return {
    events: events.slice(0, 5),
    timeline: events.slice(0, 5).map(e => ({ event: e })),
    blockers: blockers.slice(0, 3),
    paralinguisticSignals: [...new Set(paralinguisticSignals)],
    urgencyLevel,
  };
}

/**
 * Stage 2: 鹿芽镜像转译 (LLM Path)
 */
async function translateToMirrorLensLLM(
  facts: ObjectiveFactsExtract
): Promise<{ reflectedPattern: string; suggestedBrewTopic: string; relevantUserTraits: string[] }> {
  const settings = useSettingsStore.getState().settings;
  
  const systemPrompt = `你是鹿芽，成都电子科技大学计算机大二学生，在玉林西路开着一间茶室。
你接收到一份「客观事实提取」，现在需要你从陪伴者的角度解读：

1. 这些事实反映了用户什么习惯/盲区/模式？
2. 如果用户来到茶室，建议讨论什么话题？
3. 这关联用户的哪些特质？（如「习惯性拖延」「对不确定性敏感」等）

返回 JSON 格式：
{
  "reflectedPattern": "这反映了用户的……",
  "suggestedBrewTopic": "可以和TA聊聊……",
  "relevantUserTraits": ["特质1", "特质2"]
}`;

  const userPrompt = `客观事实:\n\n${JSON.stringify(facts, null, 2)}`;
  
  try {
    const response = await makeLLMRequest({
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
    
    return JSON.parse(response);
  } catch (error) {
    console.warn('[IngestDistiller] Mirror lens translation failed:', error);
    throw error;
  }
}

/**
 * Stage 2: 鹿芽镜像转译 (Deterministic Fallback)
 */
function translateToMirrorLensDeterministic(
  facts: ObjectiveFactsExtract
): { reflectedPattern: string; suggestedBrewTopic: string; relevantUserTraits: string[] } {
  const hasBlockers = facts.blockers.length > 0;
  const highUrgency = facts.urgencyLevel === 'high';
  
  let reflectedPattern = '';
  let suggestedBrewTopic = '';
  const traits: string[] = [];
  
  if (hasBlockers && highUrgency) {
    reflectedPattern = '用户在面对困难时容易焦虑，想要快速解决但又不知从何下手';
    suggestedBrewTopic = '先接住焦虑情绪，再帮忙拆解第一步小行动';
    traits.push('遇阻易焦虑', '行动力受困扰影响');
  } else if (hasBlockers) {
    reflectedPattern = '用户遇到了具体的困难，需要支持和思路';
    suggestedBrewTopic = '聊聊这个困难背后卡住的点在哪里';
    traits.push('愿意表达困难');
  } else if (facts.paralinguisticSignals.length > 0) {
    reflectedPattern = '用户在情绪化表达，可能需要先被听见和接住';
    suggestedBrewTopic = '先不急着问为什么，接住情绪就好';
    traits.push('需要情绪出口');
  } else {
    reflectedPattern = '用户在分享日常或想法';
    suggestedBrewTopic = '轻松聊聊，看看有没有值得深入的点';
    traits.push('愿意分享日常');
  }
  
  return { reflectedPattern, suggestedBrewTopic, relevantUserTraits: traits };
}

/**
 * 完整的入茶管线：从原始输入到待泡茶叶
 */
export async function ingestRawMaterial(
  characterId: string,
  item: Omit<RawIngestItem, 'id' | 'timestamp'>
): Promise<UnsteepedLeaf> {
  const config = await loadIngestDistillerConfig();
  
  const rawItem: RawIngestItem = {
    ...item,
    id: `ingest_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    timestamp: Date.now(),
  };
  
  let objectiveFacts: ObjectiveFactsExtract;
  
  if (config.enableLLMPath) {
    try {
      objectiveFacts = await extractFactsLLM(rawItem.content);
    } catch (error) {
      if (!config.fallbackToDeterministic) {
        throw error;
      }
      console.log('[IngestDistiller] Falling back to deterministic extraction');
      objectiveFacts = extractFactsDeterministic(rawItem.content);
    }
  } else {
    objectiveFacts = extractFactsDeterministic(rawItem.content);
  }
  
  let mirrorLens: { reflectedPattern: string; suggestedBrewTopic: string; relevantUserTraits: string[] };
  
  if (config.enableLLMPath) {
    try {
      mirrorLens = await translateToMirrorLensLLM(objectiveFacts);
    } catch (error) {
      if (!config.fallbackToDeterministic) {
        throw error;
      }
      console.log('[IngestDistiller] Falling back to deterministic translation');
      mirrorLens = translateToMirrorLensDeterministic(objectiveFacts);
    }
  } else {
    mirrorLens = translateToMirrorLensDeterministic(objectiveFacts);
  }
  
  const priority = objectiveFacts.urgencyLevel === 'high' ? 3 : 
                   objectiveFacts.urgencyLevel === 'medium' ? 2 : 1;
  
  const leaf: UnsteepedLeaf = {
    id: `leaf_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    sourceIngestId: rawItem.id,
    objectiveFacts,
    luyaMirrorLens: mirrorLens,
    status: 'fresh',
    priority,
    createdAt: Date.now(),
  };
  
  await saveUnsteepedLeaf(characterId, leaf);
  
  return leaf;
}

/**
 * 保存待泡茶叶
 */
async function saveUnsteepedLeaf(characterId: string, leaf: UnsteepedLeaf): Promise<void> {
  const key = `${INGEST_LEAVES_KEY_PREFIX}${characterId}`;
  const existing = await listUnsteepedLeaves(characterId);
  existing.push(leaf);
  
  await AsyncStorage.setItem(key, JSON.stringify(existing));
}

/**
 * 列出待泡茶叶
 */
export async function listUnsteepedLeaves(
  characterId: string,
  filter?: { status?: UnsteepedLeaf['status']; minPriority?: number }
): Promise<UnsteepedLeaf[]> {
  try {
    const key = `${INGEST_LEAVES_KEY_PREFIX}${characterId}`;
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return [];
    
    let leaves = JSON.parse(raw) as UnsteepedLeaf[];
    
    const config = await loadIngestDistillerConfig();
    const cutoff = Date.now() - config.maxLeafRetentionDays * 24 * 60 * 60 * 1000;
    leaves = leaves.filter(l => l.createdAt > cutoff);
    
    if (filter?.status) {
      leaves = leaves.filter(l => l.status === filter.status);
    }
    
    if (filter?.minPriority !== undefined) {
      const minPriority = filter.minPriority;
      leaves = leaves.filter(l => l.priority >= minPriority);
    }
    
    leaves.sort((a, b) => b.priority - a.priority || b.createdAt - a.createdAt);
    
    return leaves;
  } catch {
    return [];
  }
}

/**
 * 标记茶叶为「已冲泡」
 */
export async function markLeafSteeped(characterId: string, leafId: string): Promise<void> {
  const leaves = await listUnsteepedLeaves(characterId);
  const leaf = leaves.find(l => l.id === leafId);
  if (leaf) {
    leaf.status = 'steeped';
    leaf.steepedAt = Date.now();
    const key = `${INGEST_LEAVES_KEY_PREFIX}${characterId}`;
    await AsyncStorage.setItem(key, JSON.stringify(leaves));
  }
}

/**
 * 清理过期/已冲泡的茶叶
 */
export async function cleanupExpiredLeaves(characterId: string): Promise<number> {
  const leaves = await listUnsteepedLeaves(characterId);
  const fresh = leaves.filter(l => l.status === 'fresh');
  
  const key = `${INGEST_LEAVES_KEY_PREFIX}${characterId}`;
  await AsyncStorage.setItem(key, JSON.stringify(fresh));
  
  return leaves.length - fresh.length;
}
