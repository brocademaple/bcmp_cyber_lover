import { Character, EmotionalState } from '../types';

export type MemoryDecision =
  | { action: 'none' }
  | { action: 'save'; content: string; tags: string[]; importance: number }
  | { action: 'ask'; content: string; tags: string[]; importance: number; question: string };

const DIRECT_MEMORY_PATTERNS = [
  /帮我记住/,
  /记住这件事/,
  /记住这个/,
  /不要忘记/,
  /别忘了/,
  /这个很难忘/,
  /这件事很难忘/,
  /我想让你记住/,
];

const MEMORY_CANDIDATE_PATTERNS = [
  /我喜欢/,
  /我讨厌/,
  /我害怕/,
  /我想要/,
  /我的生日/,
  /生日是/,
  /纪念日/,
  /第一次/,
  /约定/,
  /习惯/,
  /目标/,
  /很难过/,
  /很开心/,
  /今天.*累/,
  /这件事.*重要/,
  /对我.*重要/,
  /难忘/,
];

const AFFINITY_PATTERNS: Record<string, { patterns: RegExp[]; bonus: number }> = {
  qingning: {
    bonus: 2,
    patterns: [
      /今天/,
      /吃饭|晚饭|午饭|早餐|零食/,
      /哈哈|笑死|好玩|有趣/,
      /陪我|想你|抱抱|需要你/,
      /听你的|谢谢你|你真好/,
    ],
  },
  sakura: {
    bonus: 2,
    patterns: [
      /我觉得|我其实|说不清|慢慢说/,
      /难过|焦虑|害怕|失眠|沉默/,
      /书|电影|雨|音乐|散步|咖啡/,
      /谢谢你听我说|我想讲/,
    ],
  },
  luna: {
    bonus: 2,
    patterns: [
      /累|撑不住|烦|崩溃|睡不着/,
      /游戏|通关|番|科幻|音游/,
      /啧|行吧|受不了你|嘴硬/,
      /别管我|没事|还好/,
    ],
  },
};

export function getRelationshipPrompt(character: Character): string {
  const rules = character.relationshipRules;
  if (!rules) return '';

  return `
【关系成长规则】
1. 你可以在合适时机提出“要不要把这件事写进记忆”，但不能声称已经记住，除非用户明确要求记住。
2. 你更容易被这些行为打动：${rules.affinityTriggers.join('、')}。
3. 你更容易觉得这些内容值得记住：${rules.memoryTriggers.join('、')}。
4. 询问记忆时使用这种语气：${rules.askMemoryStyle}`;
}

export function calculateAffinityDelta(character: Character, userText: string): number {
  const config = AFFINITY_PATTERNS[character.id];
  if (!config) return 1;
  const matched = config.patterns.some((pattern) => pattern.test(userText));
  return matched ? 1 + config.bonus : 1;
}

export function nextEmotionalState(
  currentState: EmotionalState | undefined,
  delta: number,
  now: number,
  userText: string
): EmotionalState {
  const base = currentState ?? {
    mood: 'happy',
    intimacy: 50,
    energy: 80,
    lastInteraction: now,
  };

  const tired = /累|困|疲惫|睡不着|撑不住/.test(userText);
  const sad = /难过|崩溃|委屈|焦虑|害怕/.test(userText);
  const happy = /开心|哈哈|笑死|喜欢|谢谢|太好了/.test(userText);

  return {
    ...base,
    intimacy: Math.min(100, base.intimacy + delta),
    energy: Math.max(0, Math.min(100, tired ? base.energy - 4 : base.energy)),
    mood: sad ? 'sad' : tired ? 'tired' : happy ? 'happy' : base.mood,
    lastInteraction: now,
  };
}

export function evaluateMemoryDecision(character: Character, userText: string): MemoryDecision {
  const normalized = userText.trim();
  if (!normalized) return { action: 'none' };

  const tags = inferMemoryTags(normalized);
  const content = cleanupMemoryText(normalized);
  const hasDirectIntent = DIRECT_MEMORY_PATTERNS.some((pattern) => pattern.test(normalized));
  if (hasDirectIntent) {
    return {
      action: 'save',
      content,
      tags: tags.length > 0 ? tags : ['用户主动要求记住'],
      importance: 8,
    };
  }

  const hasCandidate = MEMORY_CANDIDATE_PATTERNS.some((pattern) => pattern.test(normalized));
  if (!hasCandidate) return { action: 'none' };

  return {
    action: 'ask',
    content,
    tags: tags.length > 0 ? tags : ['值得回看'],
    importance: /重要|难忘|生日|纪念日|第一次/.test(normalized) ? 8 : 6,
    question: buildMemoryQuestion(character),
  };
}

function cleanupMemoryText(text: string): string {
  return text
    .replace(/^(帮我记住|记住这件事|记住这个|不要忘记|别忘了|我想让你记住)[，,：:\s]*/, '')
    .trim();
}

function inferMemoryTags(text: string): string[] {
  const tags: string[] = [];
  if (/喜欢|讨厌|害怕|想要/.test(text)) tags.push('偏好');
  if (/生日|纪念日|日期|第一次/.test(text)) tags.push('重要日期');
  if (/难过|开心|累|焦虑|重要|难忘/.test(text)) tags.push('情绪事件');
  if (/约定|记住|别忘|我们/.test(text)) tags.push('关系事件');
  return [...new Set(tags)];
}

function buildMemoryQuestion(character: Character): string {
  if (character.relationshipRules?.askMemoryStyle) return character.relationshipRules.askMemoryStyle;
  return '要不要把这件事写进记忆里？';
}
