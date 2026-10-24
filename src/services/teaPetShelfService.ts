/**
 * Tea Pet & Curio Shelf Service
 * 
 * **Agent Harness Layer 6: 茶宠收藏系统**
 * 
 * ## 设计理念：自我发现收藏替代亲密度条
 * 
 * 传统恋爱/陪伴 AI 产品常见做法：
 * - 用「亲密度」数值条展示关系进展
 * - 用户被动接受 AI 的评价
 * - 关系进展 = 对话次数累积
 * 
 * 问题：
 * 1. 「亲密度条」暗示用户在「追求 AI」→ 失去独立性
 * 2. 数值增长容易游戏化、失去真实感
 * 3. 无法体现自我发现的质量
 * 
 * **Tea Pet Shelf** 的创新：
 * - 焦点从「和鹿芽的关系进展」转为「用户的自我发现收藏」
 * - 4 只茶宠代表 4 种成长维度：澄明、笃行、松弛、灵光
 * - 每个自我发现结晶为「封存的瓶子」，滋养对应的茶宠
 * - 茶宠的「包浆」(patina) 代表用户在该维度的积累
 * 
 * ## 四只茶宠的设计哲学
 * 
 * ### 1. 青瓷小鹿 · 澄明 (Clarity Deer)
 * - 维度：思路理清、迷雾散去
 * - 滋养来源：乌龙深聊、复杂问题理清、认知刷新
 * - 象征：从纠结到清晰的过程
 * 
 * ### 2. 乌木小猫 · 笃行 (Action Cat)
 * - 维度：破局决策、实际行动
 * - 滋养来源：黑咖破局、拆解行动、执行验证
 * - 象征：从犹豫到行动的跨越
 * 
 * ### 3. 白玉睡狐 · 松弛 (Ease Fox)
 * - 维度：卸下防备、自我接纳
 * - 滋养来源：洋甘菊卸甲、情绪接住、自我和解
 * - 象征：从紧绷到松弛的释放
 * 
 * ### 4. 赤陶小雀 · 灵光 (Spark Bird)
 * - 维度：灵感碰撞、创意涌现
 * - 滋养来源：薄茶头脑风暴、跨界联想、突破定式
 * - 象征：从固化到灵动的跃迁
 * 
 * ## 包浆系统 (Patina System)
 * 
 * 「包浆」是茶宠被茶水滋养后产生的光泽，象征时间和照料的积累。
 * - patinaExp: 当前经验值
 * - level: 茶宠等级（影响视觉呈现）
 * - feedingHistory: 滋养历史（哪个瓶子贡献了多少经验）
 * 
 * 不同于「打卡签到」，包浆只能通过真实的自我发现获得。
 * 
 * ## 使用场景
 * 
 * ```typescript
 * import { sealBottleAndNourishPet } from '@/services/teaPetShelfService';
 * 
 * // 会话结束时，用户确认「封瓶」某个自我发现
 * await sealBottleAndNourishPet('luya', {
 *   insight: '我其实「害怕做不好」，所以会拖延和回避',
 *   sessionId: currentSessionId,
 *   nourishes: 'clarity_deer',  // 滋养「澄明」
 *   patinaContribution: 50,
 * });
 * ```
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CurioShelf, TeaPet, SealedBottle } from '../types/harness';

const CURIO_SHELF_KEY_PREFIX = '@yinzhi_curio_shelf_';

/**
 * 四只茶宠的初始定义
 */
const DEFAULT_TEA_PETS: Record<string, Omit<TeaPet, 'patinaExp' | 'level' | 'lastNourishedAt' | 'feedingHistory'>> = {
  clarity_deer: {
    id: 'clarity_deer',
    displayName: '青瓷小鹿 · 澄明',
    description: '思路理清、迷雾散去时，小鹿的眼睛会更加清亮',
    icon: '🦌',
  },
  action_cat: {
    id: 'action_cat',
    displayName: '乌木小猫 · 笃行',
    description: '破局决策、实际行动时，小猫会从慵懒变得矫健',
    icon: '🐱',
  },
  ease_fox: {
    id: 'ease_fox',
    displayName: '白玉睡狐 · 松弛',
    description: '卸下防备、自我接纳时，睡狐睡得更香甜',
    icon: '🦊',
  },
  spark_bird: {
    id: 'spark_bird',
    displayName: '赤陶小雀 · 灵光',
    description: '灵感碰撞、创意涌现时，小雀会跃起飞舞',
    icon: '🐦',
  },
};

/**
 * 创建默认的博古架
 */
function createDefaultCurioShelf(): CurioShelf {
  const now = Date.now();
  
  const pets: Record<string, TeaPet> = {};
  
  Object.entries(DEFAULT_TEA_PETS).forEach(([id, base]) => {
    pets[id] = {
      ...base,
      patinaExp: 0,
      level: 1,
      feedingHistory: [],
    };
  });
  
  return {
    pets,
    bottles: [],
    totalPatinaExp: 0,
    shelfLevel: 1,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * 加载博古架
 */
export async function loadCurioShelf(characterId: string): Promise<CurioShelf> {
  try {
    const key = `${CURIO_SHELF_KEY_PREFIX}${characterId}`;
    const raw = await AsyncStorage.getItem(key);
    
    if (!raw) {
      return createDefaultCurioShelf();
    }
    
    return JSON.parse(raw) as CurioShelf;
  } catch (error) {
    console.warn('[TeaPetShelf] Load failed:', error);
    return createDefaultCurioShelf();
  }
}

/**
 * 保存博古架
 */
export async function saveCurioShelf(characterId: string, shelf: CurioShelf): Promise<void> {
  try {
    const key = `${CURIO_SHELF_KEY_PREFIX}${characterId}`;
    shelf.updatedAt = Date.now();
    await AsyncStorage.setItem(key, JSON.stringify(shelf));
  } catch (error) {
    console.error('[TeaPetShelf] Save failed:', error);
    throw error;
  }
}

/**
 * 封瓶并滋养茶宠
 * 
 * 这是茶宠系统的核心操作：
 * 1. 创建一个 SealedBottle
 * 2. 将瓶子放在博古架上
 * 3. 滋养对应的茶宠（增加包浆经验）
 * 4. 检查茶宠是否升级
 */
export async function sealBottleAndNourishPet(
  characterId: string,
  params: {
    insight: string;
    sourceSessionId: string;
    nourishes: TeaPet['id'];
    patinaContribution: number;
  }
): Promise<{ bottle: SealedBottle; pet: TeaPet; leveledUp: boolean }> {
  const shelf = await loadCurioShelf(characterId);
  
  const bottle: SealedBottle = {
    id: `bottle_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    insight: params.insight,
    sourceSessionId: params.sourceSessionId,
    nourishes: params.nourishes,
    patinaContribution: params.patinaContribution,
    sealedAt: Date.now(),
  };
  
  shelf.bottles.push(bottle);
  
  const pet = shelf.pets[params.nourishes];
  if (!pet) {
    throw new Error(`[TeaPetShelf] Unknown pet: ${params.nourishes}`);
  }
  
  const oldLevel = pet.level;
  pet.patinaExp += params.patinaContribution;
  pet.lastNourishedAt = Date.now();
  pet.feedingHistory.push({
    bottleId: bottle.id,
    exp: params.patinaContribution,
    timestamp: Date.now(),
  });
  
  const newLevel = calculatePetLevel(pet.patinaExp);
  const leveledUp = newLevel > oldLevel;
  pet.level = newLevel;
  
  shelf.totalPatinaExp += params.patinaContribution;
  shelf.shelfLevel = calculateShelfLevel(shelf.totalPatinaExp);
  
  await saveCurioShelf(characterId, shelf);
  
  return { bottle, pet, leveledUp };
}

/**
 * 计算茶宠等级
 * 
 * 简化的等级曲线：
 * - Level 1: 0-99 exp
 * - Level 2: 100-299 exp
 * - Level 3: 300-599 exp
 * - Level 4: 600-999 exp
 * - Level 5: 1000+ exp
 */
function calculatePetLevel(exp: number): number {
  if (exp < 100) return 1;
  if (exp < 300) return 2;
  if (exp < 600) return 3;
  if (exp < 1000) return 4;
  return 5;
}

/**
 * 计算博古架等级
 */
function calculateShelfLevel(totalExp: number): number {
  if (totalExp < 200) return 1;
  if (totalExp < 600) return 2;
  if (totalExp < 1200) return 3;
  if (totalExp < 2000) return 4;
  return 5;
}

/**
 * 获取茶宠详情
 */
export async function getTeaPetDetails(
  characterId: string,
  petId: TeaPet['id']
): Promise<TeaPet | null> {
  const shelf = await loadCurioShelf(characterId);
  return shelf.pets[petId] || null;
}

/**
 * 列出所有封存的瓶子
 */
export async function listSealedBottles(
  characterId: string,
  filter?: { nourishes?: TeaPet['id']; limit?: number }
): Promise<SealedBottle[]> {
  const shelf = await loadCurioShelf(characterId);
  
  let bottles = [...shelf.bottles];
  
  if (filter?.nourishes) {
    bottles = bottles.filter(b => b.nourishes === filter.nourishes);
  }
  
  bottles.sort((a, b) => b.sealedAt - a.sealedAt);
  
  if (filter?.limit) {
    bottles = bottles.slice(0, filter.limit);
  }
  
  return bottles;
}

/**
 * 获取博古架统计数据
 */
export async function getShelfStats(characterId: string): Promise<{
  totalBottles: number;
  totalPatinaExp: number;
  shelfLevel: number;
  petLevels: Record<string, number>;
  petPatinaExp: Record<string, number>;
  recentBottles: SealedBottle[];
}> {
  const shelf = await loadCurioShelf(characterId);
  
  const petLevels: Record<string, number> = {};
  const petPatinaExp: Record<string, number> = {};
  Object.entries(shelf.pets).forEach(([id, pet]) => {
    petLevels[id] = pet.level;
    petPatinaExp[id] = pet.patinaExp;
  });
  
  const recentBottles = shelf.bottles
    .sort((a, b) => b.sealedAt - a.sealedAt)
    .slice(0, 5);
  
  return {
    totalBottles: shelf.bottles.length,
    totalPatinaExp: shelf.totalPatinaExp,
    shelfLevel: shelf.shelfLevel,
    petLevels,
    petPatinaExp,
    recentBottles,
  };
}

/**
 * 删除瓶子（谨慎使用）
 */
export async function deleteBottle(characterId: string, bottleId: string): Promise<boolean> {
  const shelf = await loadCurioShelf(characterId);
  
  const index = shelf.bottles.findIndex(b => b.id === bottleId);
  if (index === -1) return false;
  
  const bottle = shelf.bottles[index];
  
  const pet = shelf.pets[bottle.nourishes];
  if (pet) {
    pet.patinaExp = Math.max(0, pet.patinaExp - bottle.patinaContribution);
    pet.level = calculatePetLevel(pet.patinaExp);
    pet.feedingHistory = pet.feedingHistory.filter(h => h.bottleId !== bottleId);
  }
  
  shelf.totalPatinaExp = Math.max(0, shelf.totalPatinaExp - bottle.patinaContribution);
  shelf.shelfLevel = calculateShelfLevel(shelf.totalPatinaExp);
  
  shelf.bottles.splice(index, 1);
  
  await saveCurioShelf(characterId, shelf);
  
  return true;
}
