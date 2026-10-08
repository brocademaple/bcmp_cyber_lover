import { LUYA_MOOD_GUIDES } from '../config/luyaPersona';
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
  if (character.id === 'qingning') return `
【关系和记忆边界】
关系仅由有来源的共同事件、尊重边界、房间参与和修复支持，数值不授权、不升级身份。不因缺席扣亲密。
用户表达喜欢不自动确定恋爱。用户拒绝昵称、身体动作或关系升级，持续尊重。
明确事实与推断分开；未确认相处习惯由理解卡片核对，正文可以自然询问是否理解正确，但不虚报写入记忆。`;
  const rules = character.relationshipRules;
  if (!rules) return '';

  return `
【关系成长规则】
1. 聊天正文里不要主动提出把某件事写进记忆；长期记忆判断由系统在你回复后通过独立控件处理。
2. 你更容易被这些行为打动：${rules.affinityTriggers.join('、')}。
3. 你更容易觉得这些内容值得记住：${rules.memoryTriggers.join('、')}。`;
}

export function calculateAffinityDelta(character: Character, userText: string): number {
  if (character.id === 'qingning') return 0;
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

  // A user's report describes their situation, not the character's emotional state.
  void userText;

  return {
    ...base,
    intimacy: Math.min(100, base.intimacy + delta),
    energy: base.energy,
    mood: base.mood,
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
  const moodReason = '用户处境与角色感受分开；只凭用户文字不改变角色 mood。';
  const energyReason = '角色精力由自己的生活事实决定，用户或第三方疲惫不扣角色精力。';

  return {
    inputText: userText,
    before,
    after,
    affinityDelta,
    matchedAffinityRules,
    moodReason,
    energyReason,
    stateInfluence: [
      character.id === 'qingning' ? LUYA_MOOD_GUIDES[after.mood] : MOOD_DEBUG_GUIDES[after.mood],
      character.id === 'qingning' ? '亲密数值不决定身份、昵称或身体接触许可。' : after.intimacy >= 75
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
  if (character.id === 'qingning' && !isLuyaExplicitMemoryText(normalized)) return { action: 'none' };

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

/** Conservative admission gate for the old memory path. Inferred interaction styles use UserUnderstanding. */
export function isLuyaExplicitMemoryText(text: string): boolean {
  const normalized = text.trim();
  if (/不要记|别记|不保留|不用记|别保存|不要保存/.test(normalized)) return false;
  // Quoted, fictional, forwarded, and third-party accounts never become user traits.
  if (/我朋友|我的朋友|朋友(?:说|又|很|今天)|同事|博主|小说|角色|转发|视频里|他说|她说|他们说|原文|引用|[“”「」«»]|(?:^|\n)>/.test(normalized)) {
    return /^(?:请)?(?:帮我记住|记住这件事|记住这个|我想让你记住)[，,：:\s]/.test(normalized);
  }
  if (DIRECT_MEMORY_PATTERNS.some((pattern) => pattern.test(normalized))) return true;
  // Explicit preferences, dates and facts can be offered for confirmation, never inferred from repetitions.
  return /(?:^|[，。！？\n])(?:我喜欢|我不喜欢|我讨厌|我的生日|我的名字|我住在|我学的是)/.test(normalized);
}
