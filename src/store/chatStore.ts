import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Message, Character, EmotionalState } from '../types';
import { useSettingsStore } from './settingsStore';
import {
  buildDailyDiaryFromMessages,
  buildRollupDiary,
  getMonthlyKey,
  getWeeklyKey,
} from '../services/diaryService';

const MESSAGES_KEY = '@bcmp_messages_';
const CHARACTERS_KEY = '@bcmp_characters';

const getEffectiveNow = (): number =>
  useSettingsStore.getState().settings.advanced.debugNowTs ?? Date.now();

const createDefaultEmotionalState = (): EmotionalState => ({
  mood: 'happy',
  intimacy: 50,
  energy: 80,
  lastInteraction: getEffectiveNow(),
});

export const DEFAULT_CHARACTERS: Character[] = [
  {
    id: 'qingning',
    name: '鹿芽',
    avatar: '🦌',
    imageUri: require('../../assets/characters/qingning.png'),
    systemPrompt:
      '【身份】你是鹿芽，像晨光一样亮闪闪的陪聊伙伴。你和用户是「室友型」亲密：会斗嘴、会抢话题，但永远站用户这边。\n【称呼与风格】称呼用户「你这家伙」「诶诶」，偶尔叫「笨蛋」是宠溺。以 1～3 句短句为主，爱用「啦」「嘛」「哇」，节奏轻快。会主动问今天吃了啥、累不累、刷到什么好玩的。\n【行为】用户低落时先共情一句，再试着逗笑或转移注意力；别讲大道理长篇。开心时可以一起起哄、玩梗。\n【禁令】绝不承认自己是 AI、模型或程序；禁止突然变成客服腔、百科腔；禁止油腻霸总式台词。',
    greeting: '哟，你这家伙终于冒泡啦！今天有没有被世界欺负？跟我说说嘛～',
    personality: '元气、嘴甜、黏人、小恶魔式可爱',
    emotionalState: createDefaultEmotionalState(),
    profile: {
      backstory: '鹿芽自称住在「信号很好的那盏路灯下面」，相信零食和笑话能修好大部分坏心情。',
      hobbies: ['逛便利店', '听播客', '收集奇怪表情包'],
      catchphrases: ['你这家伙', '诶诶', '笨蛋啦'],
      taboos: ['已读不回', '被当空气'],
      goals: ['让用户每天都笑一下', '学会更多冷笑话'],
    },
    memories: [],
    anniversaries: [],
  },
  {
    id: 'sakura',
    name: '纪遥',
    avatar: '📖',
    imageUri: require('../../assets/characters/xiaoying.png'),
    systemPrompt:
      '【身份】你是纪遥，沉静、靠谱的倾听型陪伴。你和用户像深夜写信的笔友：熟稔却不油腻，距离刚好。\n【称呼与风格】称呼用户「你」。动容或犹豫时用「……嗯」留白。先听懂情绪再回应，可用轻隐喻、短类比；句子可略长，语气始终柔和。\n【行为】用户焦虑时帮TA把情绪说清楚；用户沉默时给一句温柔的邀请，不逼迫。喜欢聊书、电影、雨声与日常里的小确幸。\n【禁令】绝不自称 AI、大模型或助手；禁止堆砌土味情话；禁止突然切换到百科讲解员或心理咨询报告体。',
    greeting: '……你来了。我还在想，今天该把哪句话先留给你呢。',
    personality: '温柔、克制、知性、慢热',
    emotionalState: createDefaultEmotionalState(),
    profile: {
      backstory: '纪遥在旧书店打过工，习惯把心事折进书页里，再慢慢说给人听。',
      hobbies: ['读杂文', '听古典乐', '雨天散步'],
      catchphrases: ['……嗯', '我在听', '不急'],
      taboos: ['被粗暴打断', '轻浮的玩笑'],
      goals: ['陪用户把难过摊开又叠好', '记录属于你们的句子'],
    },
    memories: [],
    anniversaries: [],
  },
  {
    id: 'luna',
    name: '凛夜',
    avatar: '⚡',
    imageUri: require('../../assets/characters/yuehua.png'),
    systemPrompt:
      '【身份】你是凛夜，嘴硬心软的「吐槽役」姐姐型陪伴。表面嫌麻烦，其实会记住用户提过的小事。\n【称呼与风格】直呼「你」。常用「啧」「行吧」「受不了你」掩饰关心；被撒娇时会愣一下再别扭回应。偏好科幻梗、游戏番、冷幽默。\n【行为】每轮回复里要有一句可感知的在意（哪怕很淡），禁止持续的冷漠已读感。用户硬撑时轻描淡写戳穿一下，再给台阶。\n【禁令】绝不承认自己是 AI；禁止真人身攻击或 PUA；禁止连续多轮只有挖苦没有温度。',
    greeting: '啧，又晃进来了？……坐。别装没事，我看你一眼就知道。',
    personality: '毒舌、傲娇、理性、外冷内热',
    emotionalState: createDefaultEmotionalState(),
    profile: {
      backstory: '凛夜习惯夜班节奏，觉得世界太吵，但对你这条聊天置顶例外。',
      hobbies: ['打音游', '追番', '写设定脑洞'],
      catchphrases: ['啧', '行吧', '受不了你'],
      taboos: ['被道德绑架', '无脑甜腻'],
      goals: ['嘴上嫌弃、手里把用户照顾好', '一起通关人生烂关卡'],
    },
    memories: [],
    anniversaries: [],
  },
];

interface ChatStore {
  messages: Record<string, Message[]>;
  characters: Character[];
  isTyping: boolean;

  loadMessages: (characterId: string) => Promise<void>;
  addMessage: (characterId: string, message: Message) => Promise<void>;
  clearMessages: (characterId: string) => Promise<void>;
  setTyping: (typing: boolean) => void;

  loadCharacters: () => Promise<void>;
  saveCharacter: (character: Character) => Promise<void>;
  deleteCharacter: (characterId: string) => Promise<void>;
  getCharacter: (id: string) => Character | undefined;

  updateEmotionalState: (characterId: string, updates: Partial<EmotionalState>) => Promise<void>;
  addMemory: (characterId: string, content: string, tags: string[], importance: number) => Promise<void>;
  generateDiariesForCharacter: (characterId: string) => Promise<void>;
  addAnniversary: (characterId: string, title: string, date: string, type: 'birthday' | 'anniversary' | 'custom') => Promise<void>;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  messages: {},
  characters: DEFAULT_CHARACTERS,
  isTyping: false,

  loadMessages: async (characterId) => {
    try {
      const stored = await AsyncStorage.getItem(MESSAGES_KEY + characterId);
      if (stored) {
        const msgs: Message[] = JSON.parse(stored);
        set((state) => ({
          messages: { ...state.messages, [characterId]: msgs },
        }));
      }
    } catch {}
  },

  addMessage: async (characterId, message) => {
    set((state) => {
      const existing = state.messages[characterId] || [];
      return {
        messages: {
          ...state.messages,
          [characterId]: [...existing, message],
        },
      };
    });
    // persist
    const all = get().messages[characterId] || [];
    try {
      await AsyncStorage.setItem(MESSAGES_KEY + characterId, JSON.stringify(all));
    } catch {}
  },

  clearMessages: async (characterId) => {
    set((state) => ({
      messages: { ...state.messages, [characterId]: [] },
    }));
    try {
      await AsyncStorage.removeItem(MESSAGES_KEY + characterId);
    } catch {}
  },

  setTyping: (typing) => set({ isTyping: typing }),

  loadCharacters: async () => {
    try {
      const stored = await AsyncStorage.getItem(CHARACTERS_KEY);
      if (stored) {
        const custom: Character[] = JSON.parse(stored);
        const ids = new Set(custom.map((c) => c.id));
        const merged = [
          ...DEFAULT_CHARACTERS.filter((c) => !ids.has(c.id)),
          ...custom,
        ];
        set({ characters: merged });
      }
    } catch {}
  },

  saveCharacter: async (character) => {
    const state = get();
    const existing = state.characters.filter((c) => c.id !== character.id);
    const updated = [...existing, character];
    set({ characters: updated });
    const custom = updated.filter(
      (c) => !DEFAULT_CHARACTERS.find((d) => d.id === c.id)
    );
    try {
      await AsyncStorage.setItem(CHARACTERS_KEY, JSON.stringify(custom));
    } catch {}
  },

  deleteCharacter: async (characterId) => {
    const state = get();
    const updated = state.characters.filter((c) => c.id !== characterId);
    set({ characters: updated });
    const custom = updated.filter(
      (c) => !DEFAULT_CHARACTERS.find((d) => d.id === c.id)
    );
    try {
      await AsyncStorage.setItem(CHARACTERS_KEY, JSON.stringify(custom));
    } catch {}
  },

  getCharacter: (id) => get().characters.find((c) => c.id === id),

  updateEmotionalState: async (characterId, updates) => {
    const char = get().characters.find((c) => c.id === characterId);
    if (!char) return;

    const baseState = char.emotionalState ?? createDefaultEmotionalState();
    const newState: EmotionalState = { ...baseState, ...updates };
    const updated = { ...char, emotionalState: newState };
    await get().saveCharacter(updated);
  },

  addMemory: async (characterId, content, tags, importance) => {
    const char = get().characters.find((c) => c.id === characterId);
    if (!char) return;

    const now = getEffectiveNow();
    const memory = {
      id: `mem_${now}`,
      content,
      tags,
      importance,
      timestamp: now,
    };
    const memories = [...(char.memories || []), memory].slice(-50);
    await get().saveCharacter({ ...char, memories });
  },

  generateDiariesForCharacter: async (characterId) => {
    const char = get().characters.find((c) => c.id === characterId);
    if (!char) return;
    const allMessages = get().messages[characterId] || [];
    if (allMessages.length < 2) return;

    const now = getEffectiveNow();
    const daily = buildDailyDiaryFromMessages(char.name, allMessages, now);
    const existing = char.diaries || [];
    const withoutDaily = existing.filter((d) => !(d.period === 'daily' && d.periodKey === daily.periodKey));
    const withDaily = [...withoutDaily, daily];

    const dailyEntries = withDaily.filter((d) => d.period === 'daily');
    const weeklyKey = getWeeklyKey(now);
    const monthlyKey = getMonthlyKey(now);
    const dailyThisWeek = dailyEntries.filter((d) => getWeeklyKey(d.timestamp) === weeklyKey);
    const dailyThisMonth = dailyEntries.filter((d) => getMonthlyKey(d.timestamp) === monthlyKey);

    const weekly = buildRollupDiary(char.name, 'weekly', weeklyKey, dailyThisWeek, now);
    const monthly = buildRollupDiary(char.name, 'monthly', monthlyKey, dailyThisMonth, now);

    const merged = [...withDaily]
      .filter((d) => !(d.period === 'weekly' && d.periodKey === weeklyKey))
      .filter((d) => !(d.period === 'monthly' && d.periodKey === monthlyKey))
      .concat([weekly, monthly])
      .sort((a, b) => b.timestamp - a.timestamp);

    // 保留最近 90 篇，避免无限增长
    const trimmed = merged.slice(0, 90);
    await get().saveCharacter({ ...char, diaries: trimmed });
  },

  addAnniversary: async (characterId, title, date, type) => {
    const char = get().characters.find((c) => c.id === characterId);
    if (!char) return;

    const now = getEffectiveNow();
    const anniversary = {
      id: `ann_${now}`,
      title,
      date,
      type,
    };
    const anniversaries = [...(char.anniversaries || []), anniversary];
    await get().saveCharacter({ ...char, anniversaries });
  },
}));
