import { Character, DebugEmotionExplanation, EmotionalState } from '../types';

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
  /团建|聚会|旅行|放假|假期|考试|面试|搬家|出差|唱歌|KTV/,
  /我是.*(选手|类型|人)/,
  /我平时|我最近|我准备|我打算/,
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

const MOOD_DEBUG_GUIDES: Record<EmotionalState['mood'], string> = {
  neutral: '自然待机：保持平常陪伴感，轻松自然，不刻意提高情绪强度。',
  happy: '开心营业：回复更明亮、更主动，可以轻轻接梗和带一点上扬感。',
  sad: '安静陪着：回复更轻、更短、更会倾听；优先安放情绪，少说教，少转移话题。',
  tired: '低电量关心：降低能量感，少玩梗，轻轻提醒休息、吃饭、喝水或放松。',
  excited: '靠近一下：更主动、更亲近，可以自然表达想靠近和陪伴，但保持舒适边界。',
  angry: '坐着等你：表现为等待后的轻微别扭和在意；可以有一点委屈，但不能责备、阴阳怪气或催促用户。',
};

export function getRelationshipPrompt(character: Character): string {
  const rules = character.relationshipRules;
  if (!rules) return '';

  return `
【关系成长规则】
1. 聊天正文里不要主动提出把某件事写进记忆；长期记忆判断由系统在你回复后通过独立控件处理。
2. 你更容易被这些行为打动：${rules.affinityTriggers.join('、')}。
3. 你更容易觉得这些内容值得记住：${rules.memoryTriggers.join('、')}。`;
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

export function explainEmotionTransition(
  character: Character,
  userText: string,
  now = Date.now()
): DebugEmotionExplanation {
  const before = character.emotionalState ?? {
    mood: 'happy',
    intimacy: 50,
    energy: 80,
    lastInteraction: now,
  };
  const config = AFFINITY_PATTERNS[character.id];
  const matchedAffinityRules = config
    ? config.patterns.filter((pattern) => pattern.test(userText)).map((pattern) => pattern.source)
    : [];
  const affinityDelta = calculateAffinityDelta(character, userText);
  const after = nextEmotionalState(before, affinityDelta, now, userText);
  const tired = /累|困|疲惫|睡不着|撑不住/.test(userText);
  const sad = /难过|崩溃|委屈|焦虑|害怕/.test(userText);
  const happy = /开心|哈哈|笑死|喜欢|谢谢|太好了/.test(userText);
  const moodReason = sad
    ? '命中低落/焦虑词，mood -> sad。'
    : tired
      ? '命中疲惫词，mood -> tired。'
      : happy
        ? '命中开心/感谢词，mood -> happy。'
        : '没有命中强情绪词，沿用原 mood。';
  const energyReason = tired
    ? '命中疲惫词，energy -4，并限制在 0-100。'
    : '未命中疲惫词，energy 保持不变。';

  return {
    inputText: userText,
    before,
    after,
    affinityDelta,
    matchedAffinityRules,
    moodReason,
    energyReason,
    stateInfluence: [
      MOOD_DEBUG_GUIDES[after.mood],
      after.intimacy >= 75
        ? '亲密度较高：回复可以更自然地亲近一点。'
        : after.intimacy >= 45
          ? '亲密度中段：语气亲切，但仍保持边界。'
          : '亲密度较低：先建立可信任感。',
      after.energy <= 35
        ? '精力偏低：回复更短、更软。'
        : after.energy >= 75
          ? '精力充足：可以更主动回应。'
          : '精力平稳：保持自然节奏。',
    ],
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
  if (character.relationshipRules?.memoryTriggers?.length) {
    return '发现一条可能值得长期记忆的内容';
  }
  return '这次对话里有一条可能值得长期记忆的内容';
}
