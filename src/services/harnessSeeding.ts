/**
 * Harness Seeding Service
 * 
 * **开箱即用演示数据初始化**
 * 
 * 当用户首次打开 v2 Harness 系统时，预置真实、丰富的演示数据：
 * - 2 个待泡茶叶（生茶罐）
 * - 2 个封存瓶子 + 茶宠初始包浆
 * - 初始双向人设存储
 * 
 * 让用户立即看到完整可交互的 Harness 系统。
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createDefaultDualPersonaStore,
  saveDualPersonaStore,
  updateUserMirror,
} from './dualPersonaStore';
import {
  sealBottleAndNourishPet,
  loadCurioShelf,
} from './teaPetShelfService';
import type { UnsteepedLeaf } from '../types/harness';

const HARNESS_SEEDED_KEY = '@yinzhi_harness_seeded_v2';
const INGEST_LEAVES_KEY_PREFIX = '@yinzhi_ingest_leaves_';

/**
 * 检查是否已经播种
 */
async function isAlreadySeeded(): Promise<boolean> {
  try {
    const seeded = await AsyncStorage.getItem(HARNESS_SEEDED_KEY);
    return seeded === 'true';
  } catch {
    return false;
  }
}

/**
 * 标记为已播种
 */
async function markAsSeeded(): Promise<void> {
  await AsyncStorage.setItem(HARNESS_SEEDED_KEY, 'true');
}

/**
 * 创建演示茶叶（生茶罐）
 */
async function seedUnsteepedLeaves(characterId: string): Promise<void> {
  const leaves: UnsteepedLeaf[] = [
    {
      id: `leaf_seed_1_${Date.now()}`,
      sourceIngestId: 'ingest_seed_1',
      objectiveFacts: {
        events: [
          '深夜凌晨 1 点还在权衡产品功能取舍',
          '想加很多功能但担心复杂度失控',
          '反复修改方案但始终拿不定主意',
        ],
        timeline: [
          { event: '深夜凌晨 1 点还在权衡产品功能取舍' },
        ],
        blockers: [
          '不知道该做「大而全」还是「小而美」',
          '担心做少了不够吸引人，做多了自己维护不了',
        ],
        paralinguisticSignals: ['深夜时段', '重复修改', '焦虑决策'],
        urgencyLevel: 'medium',
      },
      luyaMirrorLens: {
        reflectedPattern: '在面对开放选择时，容易陷入「想要覆盖所有可能」的焦虑，反而难以推进',
        suggestedBrewTopic: '可以聊聊：是什么让你觉得必须一次做对？能不能先做一个最小的可验证版本？',
        relevantUserTraits: ['完美主义倾向', '对不确定性敏感', '需要外部确认'],
      },
      status: 'fresh',
      priority: 2,
      createdAt: Date.now() - 2 * 60 * 60 * 1000,
    },
    {
      id: `leaf_seed_2_${Date.now()}`,
      sourceIngestId: 'ingest_seed_2',
      objectiveFacts: {
        events: [
          '在学习 Agent Harness 架构的代码',
          '觉得这套设计很清晰、模块化很好',
          '想用到自己项目里但不确定从哪开始',
        ],
        timeline: [
          { event: '在学习 Agent Harness 架构的代码' },
        ],
        blockers: [
          '看懂了架构但不知道怎么迁移到自己场景',
          '担心照搬会水土不服',
        ],
        paralinguisticSignals: [],
        urgencyLevel: 'low',
      },
      luyaMirrorLens: {
        reflectedPattern: '学东西快，能看懂系统设计，但在「如何应用」这一步会卡住',
        suggestedBrewTopic: '可以聊聊：你项目里现在最需要解决的具体问题是什么？从那个点切入可能更自然',
        relevantUserTraits: ['学习能力强', '理解力好', '应用迁移需要具体锚点'],
      },
      status: 'fresh',
      priority: 1,
      createdAt: Date.now() - 12 * 60 * 60 * 1000,
    },
  ];
  
  const key = `${INGEST_LEAVES_KEY_PREFIX}${characterId}`;
  await AsyncStorage.setItem(key, JSON.stringify(leaves));
}

/**
 * 创建演示封存瓶子 + 茶宠包浆
 */
async function seedBottlesAndTeaPets(characterId: string): Promise<void> {
  await sealBottleAndNourishPet(characterId, {
    insight: '我习惯把问题想得很复杂，但其实很多时候「先做一个最简单能跑的版本」反而更快',
    sourceSessionId: 'seed_session_1',
    nourishes: 'clarity_deer',
    patinaContribution: 80,
  });
  
  await sealBottleAndNourishPet(characterId, {
    insight: '我确实有「想做就立刻铺开很多任务」的习惯，导致经常做到一半卡住',
    sourceSessionId: 'seed_session_1',
    nourishes: 'action_cat',
    patinaContribution: 60,
  });
}

/**
 * 创建初始双向人设存储
 */
async function seedDualPersona(characterId: string): Promise<void> {
  const store = createDefaultDualPersonaStore(characterId);
  
  await saveDualPersonaStore(characterId, store);
  
  await updateUserMirror(characterId, {
    action: 'settle_update',
    delta: 'Initial seed: User traits observed from demo interactions',
    traitsToAdd: [
      '对产品设计和技术实现都感兴趣',
      '习惯深夜工作和思考',
      '在开放选择时容易纠结',
    ],
    focusToAdd: [
      '正在探索 Agent Harness 架构',
      '想把学到的东西应用到自己项目',
    ],
  });
}

/**
 * 主播种函数
 * 
 * 在 App 启动或用户首次进入茶室时调用。
 * 如果已经播种过，直接跳过。
 */
export async function seedHarnessDataIfNeeded(characterId: string = 'qingning'): Promise<{
  seeded: boolean;
  wasAlreadySeeded: boolean;
}> {
  const alreadySeeded = await isAlreadySeeded();
  
  if (alreadySeeded) {
    return { seeded: false, wasAlreadySeeded: true };
  }
  
  try {
    await seedUnsteepedLeaves(characterId);
    
    await seedBottlesAndTeaPets(characterId);
    
    await seedDualPersona(characterId);
    
    await markAsSeeded();
    
    console.log('[HarnessSeeding] Successfully seeded demo data');
    
    return { seeded: true, wasAlreadySeeded: false };
  } catch (error) {
    console.error('[HarnessSeeding] Failed to seed:', error);
    return { seeded: false, wasAlreadySeeded: false };
  }
}

/**
 * 重置播种状态（仅用于开发/测试）
 */
export async function resetHarnessSeedingForDev(): Promise<void> {
  await AsyncStorage.removeItem(HARNESS_SEEDED_KEY);
  console.log('[HarnessSeeding] Seeding flag reset');
}
