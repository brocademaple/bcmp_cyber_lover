/**
 * Local Teahouse Mirror - Zero-Config Fallback
 * 
 * 当没有配置外部 API 密钥时，使用活动的 Harness 配置
 * （BaseDrink、Modifiers、UserMirror）生成富上下文感知的本地回复。
 * 
 * 这使得「投茶 → 多轮冲泡 → 品啜校准 → 封瓶」流程
 * 在无需 API 密钥的情况下 100% 可体验。
 */

import type { Message } from '../types';
import type { DualPersonaStore } from '../types/harness';
import { getBrewSkillRegistry } from './brewSkillRegistry';
import { loadDualPersonaStore } from './dualPersonaStore';

interface LocalBrewParams {
  characterId: string;
  userMessage: string;
  recentMessages: Message[];
  baseDrink: string;
  modifiers: string[];
}

/**
 * 生成本地茶镜回复
 */
export async function generateLocalTeahouseReply(params: LocalBrewParams): Promise<string> {
  const { characterId, userMessage, recentMessages, baseDrink, modifiers } = params;
  
  try {
    const registry = getBrewSkillRegistry();
    const drink = registry.baseDrinks[baseDrink];
    const dualPersona = await loadDualPersonaStore(characterId);
    
    // 根据 BaseDrink 选择回应风格
    const reply = assembleDrinkStyleReply(userMessage, drink, modifiers, dualPersona, recentMessages);
    
    return reply;
  } catch (error) {
    console.error('[LocalTeahouseMirror] Failed to generate reply:', error);
    return generateSimpleFallback(userMessage);
  }
}

function assembleDrinkStyleReply(
  userMessage: string,
  drink: any,
  modifiers: string[],
  dualPersona: DualPersonaStore,
  recentMessages: Message[]
): string {
  const userTraits = dualPersona.userMirror.traits.slice(0, 2).join('、') || '探索中';
  const drinkName = drink.displayName;
  
  // 基于饮品风格的核心回应策略
  const responses: Record<string, string[]> = {
    oolong: [
      `${userMessage.length < 10 ? '嗯。' : '听到了。'}刚泡了壶${drinkName}，${userTraits}这个方向，慢慢聊。`,
      `${drinkName}第二泡，刚好。${detectUserTopic(userMessage)}`,
      `这泡${drinkName}正好配你说的这个。${userTraits}，继续？`,
    ],
    espresso: [
      `好。${detectUserTopic(userMessage)}直接说。`,
      `${drinkName}正浓，${userTraits}。往下走？`,
      `明白。${detectUserEmotion(userMessage)}${drinkName}提神，说具体的。`,
    ],
    chamomile: [
      `${detectUserEmotion(userMessage)}泡了杯${drinkName}，不急。`,
      `听着呢。${drinkName}温着，${userTraits}，慢慢来。`,
      `嗯。${detectUserTopic(userMessage)}${drinkName}陪着，歇会儿？`,
    ],
    matcha: [
      `${detectUserTopic(userMessage)}${drinkName}点了下，${userTraits}。`,
      `好的。${drinkName}一点，${detectUserEmotion(userMessage)}`,
      `明白。${drinkName}轻盈，${userTraits}，继续聊？`,
    ],
  };
  
  const drinkReplies = responses[drink.id] || responses.oolong;
  const baseReply = drinkReplies[recentMessages.length % drinkReplies.length];
  
  // 应用 Modifiers
  let reply = baseReply;
  
  if (modifiers.includes('milk')) {
    reply += '\n\n（加了点鲜奶，柔和些）';
  }
  if (modifiers.includes('sugar')) {
    reply += '甜一点，舒服。';
  }
  if (modifiers.includes('peel')) {
    reply += '\n\n陈皮提香，回味长。';
  }
  if (modifiers.includes('ice')) {
    reply += '\n\n冰镇直给，清醒点。';
  }
  
  return reply;
}

function detectUserTopic(userMessage: string): string {
  if (/累|疲|困|睡/.test(userMessage)) return '听起来累了。';
  if (/难|烦|焦虑|压力/.test(userMessage)) return '遇到难的了。';
  if (/学|作业|实验|代码/.test(userMessage)) return '学业的事？';
  if (/想|希望|打算/.test(userMessage)) return '在想什么？';
  return '';
}

function detectUserEmotion(userMessage: string): string {
  if (/累|困/.test(userMessage)) return '休息下。';
  if (/难过|伤心/.test(userMessage)) return '别急。';
  if (/焦虑|紧张/.test(userMessage)) return '稳住。';
  if (/开心|好/.test(userMessage)) return '好事。';
  return '';
}

function generateSimpleFallback(userMessage: string): string {
  if (userMessage.length < 5) {
    return '嗯。';
  }
  if (/？|吗/.test(userMessage)) {
    return '听到了。慢慢说。';
  }
  return '明白。继续？';
}
