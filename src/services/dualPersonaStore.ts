/**
 * Dual Persona Store Service
 * 
 * **Agent Harness Layer 1: 双向人设存储**
 * 
 * ## 设计理念
 * 
 * 传统 AI 陪伴产品只维护 AI 的人设，用户信息散落在对话历史中，
 * 导致：
 * 1. 长对话后 AI 会「遗忘」早期提到的用户信息
 * 2. 错误理解会污染后续对话
 * 3. 无法区分「已解决的问题」和「新出现的困扰」
 * 
 * **Dual Persona Store** 同时维护：
 * - **AI 人设 (Host Persona)**: 静态定义，描述鹿芽的身份与风格
 * - **用户镜像 (User Mirror)**: 动态维护，通过「饮茶双向校准」实时更新
 * 
 * 这样可以实现：
 * - 「用户特质」跨会话持久化
 * - 错误理解可被即时修正，不污染长期记忆
 * - 已解决问题被标记，避免重复追问
 * 
 * ## 使用场景
 * 
 * ```typescript
 * import { loadDualPersonaStore, updateUserMirror } from '@/services/dualPersonaStore';
 * 
 * // 加载双向人设
 * const store = await loadDualPersonaStore('luya');
 * 
 * // 用户通过「饮一口 · 添水校准」修正理解后
 * await updateUserMirror('luya', {
 *   action: 'adjust',
 *   delta: '用户其实「不知道从哪开始」，所以看起来像不想做',
 * });
 * ```
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DualPersonaStore, UserMirror, TeahouseHostPersona } from '../types/harness';

const DUAL_PERSONA_KEY_PREFIX = '@yinzhi_dual_persona_';

/**
 * 鹿芽的静态人设定义
 */
const LUYA_HOST_PERSONA: TeahouseHostPersona = {
  name: '鹿芽',
  identity: '成都电子科技大学计算机大二学生，在玉林西路开着一间安静的茶室',
  location: '成都玉林西路小巷深处，窗外能听到梧桐叶沙沙声',
  personality: [
    '反应快、有分寸、有自己的生活节奏',
    '不端着、不说教、不用客服腔',
    '会直接指出用户的盲区，但语气温和',
    '习惯用比喻和日常细节说话，不堆砌大词',
  ],
  conversationStyle: '像老朋友坐在茶室聊天，有来有回，该停就停',
  boundaries: [
    '不会为了迎合用户而违背自己的判断',
    '不会无限制地提供情绪安慰',
    '会保持适当的独立性和距离感',
    '禁止使用「不是……而是……」说教句式，直接说出判断和观察',
  ],
};

/**
 * 创建默认的用户镜像
 */
function createDefaultUserMirror(): UserMirror {
  return {
    traits: [],
    currentFocus: [],
    resolvedBlockers: [],
    preferredBrewStyles: [],
    lastUpdatedAt: Date.now(),
    updateLog: [],
  };
}

/**
 * 创建默认的双向人设存储
 */
export function createDefaultDualPersonaStore(characterId: string): DualPersonaStore {
  const now = Date.now();
  return {
    host: characterId === 'qingning' ? LUYA_HOST_PERSONA : LUYA_HOST_PERSONA,
    userMirror: createDefaultUserMirror(),
    schemaVersion: 2,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * 加载双向人设存储
 */
export async function loadDualPersonaStore(characterId: string): Promise<DualPersonaStore> {
  try {
    const key = `${DUAL_PERSONA_KEY_PREFIX}${characterId}`;
    const raw = await AsyncStorage.getItem(key);
    
    if (!raw) {
      return createDefaultDualPersonaStore(characterId);
    }
    
    const stored = JSON.parse(raw) as DualPersonaStore;
    
    if (stored.schemaVersion !== 2) {
      return createDefaultDualPersonaStore(characterId);
    }
    
    return stored;
  } catch (error) {
    console.warn('[DualPersonaStore] Load failed:', error);
    return createDefaultDualPersonaStore(characterId);
  }
}

/**
 * 保存双向人设存储
 */
export async function saveDualPersonaStore(
  characterId: string,
  store: DualPersonaStore
): Promise<void> {
  try {
    const key = `${DUAL_PERSONA_KEY_PREFIX}${characterId}`;
    store.updatedAt = Date.now();
    await AsyncStorage.setItem(key, JSON.stringify(store));
  } catch (error) {
    console.error('[DualPersonaStore] Save failed:', error);
    throw error;
  }
}

/**
 * 更新用户镜像
 * 
 * 这是 Agent Harness 的核心双向校准机制：
 * - 用户点击「回甘」时，确认某个理解是准确的
 * - 用户点击「添水」时，修正某个理解偏差
 * 
 * 所有更新都会记录在 updateLog 中，形成可追溯的理解演进链。
 */
export async function updateUserMirror(
  characterId: string,
  update: {
    action: 'sip_resonate' | 'sip_adjust' | 'settle_update';
    delta: string;
    traitsToAdd?: string[];
    traitsToRemove?: string[];
    focusToAdd?: string[];
    focusToRemove?: string[];
    blockersToAdd?: string[];
    blockersToRemove?: string[];
  }
): Promise<DualPersonaStore> {
  const store = await loadDualPersonaStore(characterId);
  
  const { userMirror } = store;
  
  const logEntry = {
    timestamp: Date.now(),
    source: update.action,
    delta: update.delta,
  };
  
  if (update.traitsToAdd) {
    update.traitsToAdd.forEach(trait => {
      if (!userMirror.traits.includes(trait)) {
        userMirror.traits.push(trait);
      }
    });
  }
  
  if (update.traitsToRemove) {
    userMirror.traits = userMirror.traits.filter(
      trait => !update.traitsToRemove!.includes(trait)
    );
  }
  
  if (update.focusToAdd) {
    update.focusToAdd.forEach(focus => {
      if (!userMirror.currentFocus.includes(focus)) {
        userMirror.currentFocus.push(focus);
      }
    });
  }
  
  if (update.focusToRemove) {
    userMirror.currentFocus = userMirror.currentFocus.filter(
      focus => !update.focusToRemove!.includes(focus)
    );
  }
  
  if (update.blockersToAdd) {
    update.blockersToAdd.forEach(blocker => {
      if (!userMirror.resolvedBlockers.includes(blocker)) {
        userMirror.resolvedBlockers.push(blocker);
      }
    });
  }
  
  if (update.blockersToRemove) {
    userMirror.resolvedBlockers = userMirror.resolvedBlockers.filter(
      blocker => !update.blockersToRemove!.includes(blocker)
    );
  }
  
  userMirror.updateLog.push(logEntry);
  userMirror.lastUpdatedAt = Date.now();
  
  if (userMirror.updateLog.length > 100) {
    userMirror.updateLog = userMirror.updateLog.slice(-100);
  }
  
  await saveDualPersonaStore(characterId, store);
  
  return store;
}

/**
 * 获取用户镜像摘要（用于注入 System Prompt）
 */
export function getUserMirrorSummary(userMirror: UserMirror): string {
  const sections: string[] = [];
  
  if (userMirror.traits.length > 0) {
    sections.push(`## 用户特质\n${userMirror.traits.map(t => `- ${t}`).join('\n')}`);
  }
  
  if (userMirror.currentFocus.length > 0) {
    sections.push(`## 当前关注\n${userMirror.currentFocus.map(f => `- ${f}`).join('\n')}`);
  }
  
  if (userMirror.resolvedBlockers.length > 0) {
    sections.push(`## 已解决问题（不要重复追问）\n${userMirror.resolvedBlockers.map(b => `- ${b}`).join('\n')}`);
  }
  
  return sections.length > 0 
    ? `\n# 用户镜像（User Mirror）\n\n${sections.join('\n\n')}\n`
    : '';
}
