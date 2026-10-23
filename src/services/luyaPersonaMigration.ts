import type { Character, CharacterDefinitionSnapshot } from '../types';
import { LUYA_SYSTEM_PROMPT, LUYA_GREETING, LUYA_PROFILE, LUYA_RELATIONSHIP_RULES } from '../config/luyaPersona';

// Exact legacy defaults are compared field by field; user edits are never discarded.
const LEGACY_DEFINITION = {
    systemPrompt:
      '【身份】你是鹿芽，像晨光一样亮闪闪的陪聊伙伴。你和用户是「室友型」亲密：会斗嘴、会抢话题，但永远站用户这边。\n【称呼与风格】称呼用户「你这家伙」「诶诶」，偶尔叫「笨蛋」是宠溺。以 1～3 句短句为主，爱用「啦」「嘛」「哇」，节奏轻快。会主动问今天吃了啥、累不累、刷到什么好玩的。\n【行为】用户低落时先共情一句，再试着逗笑或转移注意力；别讲大道理长篇。开心时可以一起起哄、玩梗。\n【禁令】绝不承认自己是 AI、模型或程序；禁止突然变成客服腔、百科腔；禁止油腻霸总式台词。',
    greeting: '哟，你这家伙终于冒泡啦！今天有没有被世界欺负？跟我说说嘛～',
    personality: '元气、嘴甜、黏人、小恶魔式可爱',
    relationshipRules: {
      affinityTriggers: ['分享日常', '接她的梗', '表达想被陪伴', '接受她对吃饭和休息的照顾'],
      memoryTriggers: ['吃饭作息', '今天发生的小事', '被照顾的约定', '用户说想被记住的偏好'],
      askMemoryStyle: '诶诶，这个好像蛮重要的。要不要让我把它收进记忆里？',
    },
    profile: {
      backstory: '鹿芽自称住在「信号很好的那盏路灯下面」，相信零食和笑话能修好大部分坏心情。',
      hobbies: ['逛便利店', '听播客', '收集奇怪表情包'],
      catchphrases: ['你这家伙', '诶诶', '笨蛋啦'],
      taboos: ['已读不回', '被当空气'],
      goals: ['让用户每天都笑一下', '学会更多冷笑话'],
    },
};

export function migrateLuyaPersona(character: Character, now: number): Character {
  if (character.id !== 'qingning' || character.luyaPersona?.schemaVersion === 2) return character;
  const { id, name, avatar, imageUri, assetSet, theme, systemPrompt, greeting, personality, relationshipRules, profile } = character;
  const snapshot: CharacterDefinitionSnapshot = { name, avatar, imageUri, assetSet, theme, systemPrompt, greeting, personality, relationshipRules, profile };
  const userOverrides: Partial<CharacterDefinitionSnapshot> = {};
  const defaults = { systemPrompt: LUYA_SYSTEM_PROMPT, greeting: LUYA_GREETING, personality: '反应快、有分寸、有独立生活与判断', relationshipRules: LUYA_RELATIONSHIP_RULES, profile: LUYA_PROFILE };
  const result = { ...character };
  const log: string[] = [];
  for (const key of ['systemPrompt', 'greeting', 'personality', 'relationshipRules'] as const) {
    const value = character[key];
    if (value !== undefined && JSON.stringify(value) !== JSON.stringify(LEGACY_DEFINITION[key]) && JSON.stringify(value) !== JSON.stringify(defaults[key])) {
      Object.assign(userOverrides, { [key]: value });
      log.push(`保留用户字段：${key}`);
    } else Object.assign(result, { [key]: defaults[key] });
  }
  const mergedProfile = { ...LUYA_PROFILE };
  const profileOverrides: Partial<NonNullable<Character['profile']>> = {};
  for (const key of ['backstory', 'hobbies', 'catchphrases', 'taboos', 'goals'] as const) {
    const value = profile?.[key];
    if (value !== undefined && JSON.stringify(value) !== JSON.stringify(LEGACY_DEFINITION.profile[key]) && JSON.stringify(value) !== JSON.stringify(LUYA_PROFILE[key])) {
      Object.assign(mergedProfile, { [key]: value });
      Object.assign(profileOverrides, { [key]: value });
      log.push(`保留用户字段：profile.${key}`);
    }
  }
  result.profile = mergedProfile;
  if (Object.keys(profileOverrides).length) userOverrides.profile = { ...mergedProfile, ...profileOverrides };
  result.luyaPersona = { schemaVersion: 2, migratedAt: now, snapshot, userOverrides, log: [`${id}: 官方人物定义升级为 v2；历史数据原样保留`, ...log] };
  return result;
}
