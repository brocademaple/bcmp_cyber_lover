import { Character, CharacterDefinitionSnapshot } from '../types';

export interface CharacterStudioAudit {
  score: number;
  ready: boolean;
  passed: string[];
  issues: string[];
}
const REQUIRED_PROMPT_SECTIONS = ['身份', '称呼与风格', '行为', '禁令'];

export function buildSimpleCharacterPrompt(character: {
  name: string;
  personality: string;
  backstory: string;
  catchphrases: string[];
  taboos: string[];
  goals: string[];
}): string {
  const catchphrases = character.catchphrases.length
    ? `可以自然使用这些口头禅：${character.catchphrases.join('、')}。`
    : '使用自然、稳定、符合人物性格的中文表达。';
  const taboos = character.taboos.length
    ? `不要触碰这些边界：${character.taboos.join('、')}。`
    : '尊重用户边界，不贬低、操控或诱导用户。';
  const goals = character.goals.length
    ? `陪伴目标：${character.goals.join('、')}。`
    : '认真回应用户当下的情绪和生活。';

  return [
    `【身份】你是${character.name}。${character.backstory || `你的性格是${character.personality || '温柔、真诚'}。`}`,
    `【称呼与风格】${catchphrases} 性格关键词：${character.personality || '温柔、真诚'}。`,
    `【行为】${goals} 先理解用户正在表达的事，再给出符合你们关系的回应。`,
    `【禁令】${taboos} 不要突然变成客服、百科或机械助手。`,
  ].join('\n');
}

export function createBlankCharacter(now = Date.now()): Character {
  return {
    id: `custom_${now}`,
    name: '新角色',
    avatar: '✦',
    theme: 'urbanClear',
    personality: '温柔、真诚',
    greeting: '你来了。先坐一会儿，慢慢告诉我今天发生了什么。',
    systemPrompt: buildSimpleCharacterPrompt({
      name: '新角色',
      personality: '温柔、真诚',
      backstory: '一个愿意长期陪伴用户、记住共同经历的角色。',
      catchphrases: [],
      taboos: ['伤害、贬低或操控用户'],
      goals: ['让用户感到被理解', '记住重要的共同经历'],
    }),
    relationshipRules: {
      affinityTriggers: ['真诚分享日常', '表达真实情绪'],
      memoryTriggers: ['稳定偏好', '重要日期', '约定与计划'],
      askMemoryStyle: '这件事好像会在以后被想起。要不要让我替你记住？',
    },
    profile: {
      backstory: '一个愿意长期陪伴用户、记住共同经历的角色。',
      hobbies: [],
      catchphrases: [],
      taboos: ['伤害、贬低或操控用户'],
      goals: ['让用户感到被理解', '记住重要的共同经历'],
    },
    memories: [],
    diaries: [],
    anniversaries: [],
    relationshipEvents: [],
    relationshipStage: 'firstMeeting',
    definitionVersion: 1,
    emotionalState: {
      mood: 'neutral',
      intimacy: 45,
      energy: 75,
      lastInteraction: now,
    },
  };
}

export function auditCharacterDefinition(
  definition: CharacterDefinitionSnapshot
): CharacterStudioAudit {
  const passed: string[] = [];
  const issues: string[] = [];

  if (definition.name.trim().length >= 2) passed.push('角色名称清晰');
  else issues.push('角色名称至少需要 2 个字符');

  if (definition.greeting.trim().length >= 8) passed.push('开场白可以建立关系氛围');
  else issues.push('开场白过短，建议写出关系和语气');

  if (definition.personality.trim().length >= 4) passed.push('性格关键词已填写');
  else issues.push('至少填写两个性格关键词');

  for (const section of REQUIRED_PROMPT_SECTIONS) {
    if (definition.systemPrompt.includes(`【${section}】`)) passed.push(`${section}规则已定义`);
    else issues.push(`缺少【${section}】Prompt 段落`);
  }

  if ((definition.profile?.taboos.length ?? 0) > 0) passed.push('角色边界已定义');
  else issues.push('建议补充角色边界和忌讳');

  if ((definition.relationshipRules?.memoryTriggers.length ?? 0) > 0) passed.push('长期记忆触发已定义');
  else issues.push('建议补充值得记住的内容类型');

  const total = passed.length + issues.length;
  const score = total ? Math.round((passed.length / total) * 100) : 0;
  return { score, ready: issues.length === 0, passed, issues };
}
