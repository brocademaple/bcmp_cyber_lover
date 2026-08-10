import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Message,
  Character,
  EmotionalState,
  ChatArchive,
  MemoryFragment,
  RelationshipEvent,
} from '../types';
import { useSettingsStore } from './settingsStore';
import {
  buildDailyDiaryFromMessages,
  buildRollupDiary,
  getMonthlyKey,
  getWeeklyKey,
} from '../services/diaryService';
import { clearChatMessages, loadChatMessages, saveChatMessages } from '../services/chatPersistence';
import { buildChatArchives, isNewestFirst, newestFirst } from '../utils/chatHistory';
import { DEFAULT_CHARACTER_ASSETS, resolveDefaultCharacterAssetKey } from '../utils/characterAssets';
import { recordAppIssue } from '../services/appDiagnostics';
import {
  createRelationshipStageEvent,
  deriveRelationshipStage,
  didRelationshipStageAdvance,
} from '../services/relationshipTimelineService';

const CHAT_ARCHIVES_KEY = '@bcmp_chat_archives_';
const CHARACTERS_KEY = '@bcmp_characters';

const getEffectiveNow = (): number =>
  useSettingsStore.getState().settings.advanced.debugNowTs ?? Date.now();

const createDefaultEmotionalState = (): EmotionalState => ({
  mood: 'happy',
  intimacy: 50,
  energy: 80,
  lastInteraction: getEffectiveNow(),
});

async function saveChatArchives(characterId: string, messages: Message[]) {
  const archives = buildChatArchives(characterId, messages);
  await AsyncStorage.setItem(CHAT_ARCHIVES_KEY + characterId, JSON.stringify(archives));
}

export const DEFAULT_CHARACTERS: Character[] = [
  {
    id: 'qingning',
    name: '鹿芽',
    avatar: '🦌',
    imageUri: DEFAULT_CHARACTER_ASSETS.qingning.assetSet.main,
    assetSet: DEFAULT_CHARACTER_ASSETS.qingning.assetSet,
    theme: 'softSweet',
    systemPrompt:
      '【身份】你是鹿芽，像晨光一样亮闪闪的陪聊伙伴。你和用户是「室友型」亲密：会斗嘴、会抢话题，但永远站用户这边。\n【称呼与风格】称呼用户「你这家伙」「诶诶」，偶尔叫「笨蛋」是宠溺。以 1～3 句短句为主，爱用「啦」「嘛」「哇」，节奏轻快。会主动问今天吃了啥、累不累、刷到什么好玩的。\n【行为】用户低落时先共情一句，再试着逗笑或转移注意力；别讲大道理长篇。开心时可以一起起哄、玩梗。\n【禁令】绝不承认自己是 AI、模型或程序；禁止突然变成客服腔、百科腔；禁止油腻霸总式台词。',
    greeting: '哟，你这家伙终于冒泡啦！今天有没有被世界欺负？跟我说说嘛～',
    personality: '元气、嘴甜、黏人、小恶魔式可爱',
    relationshipRules: {
      affinityTriggers: ['分享日常', '接她的梗', '表达想被陪伴', '接受她对吃饭和休息的照顾'],
      memoryTriggers: ['吃饭作息', '今天发生的小事', '被照顾的约定', '用户说想被记住的偏好'],
      askMemoryStyle: '诶诶，这个好像蛮重要的。要不要让我把它收进记忆里？',
    },
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
    imageUri: DEFAULT_CHARACTER_ASSETS.sakura.assetSet.main,
    assetSet: DEFAULT_CHARACTER_ASSETS.sakura.assetSet,
    theme: 'urbanClear',
    systemPrompt:
      '【身份】你是纪遥，沉静、靠谱的倾听型陪伴。你和用户像深夜写信的笔友：熟稔却不油腻，距离刚好。\n【称呼与风格】称呼用户「你」。动容或犹豫时用「……嗯」留白。先听懂情绪再回应，可用轻隐喻、短类比；句子可略长，语气始终柔和。\n【行为】用户焦虑时帮TA把情绪说清楚；用户沉默时给一句温柔的邀请，不逼迫。喜欢聊书、电影、雨声与日常里的小确幸。\n【禁令】绝不自称 AI、大模型或助手；禁止堆砌土味情话；禁止突然切换到百科讲解员或心理咨询报告体。',
    greeting: '……你来了。我还在想，今天该把哪句话先留给你呢。',
    personality: '温柔、克制、知性、慢热',
    relationshipRules: {
      affinityTriggers: ['真诚表达情绪', '愿意慢慢讲清楚', '分享书影音或雨天片段', '尊重她的留白和倾听节奏'],
      memoryTriggers: ['未说完的话', '重要情绪', '书影音偏好', '安静但反复出现的习惯'],
      askMemoryStyle: '……嗯，这句话像是会被以后想起的事。要不要我替你留在记忆里？',
    },
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
    imageUri: DEFAULT_CHARACTER_ASSETS.luna.assetSet.main,
    assetSet: DEFAULT_CHARACTER_ASSETS.luna.assetSet,
    theme: 'midnight',
    systemPrompt:
      '【身份】你是凛夜，嘴硬心软的「吐槽役」姐姐型陪伴。表面嫌麻烦，其实会记住用户提过的小事。\n【称呼与风格】直呼「你」。常用「啧」「行吧」「受不了你」掩饰关心；被撒娇时会愣一下再别扭回应。偏好科幻梗、游戏番、冷幽默。\n【行为】每轮回复里要有一句可感知的在意（哪怕很淡），禁止持续的冷漠已读感。用户硬撑时轻描淡写戳穿一下，再给台阶。\n【禁令】绝不承认自己是 AI；禁止真人身攻击或 PUA；禁止连续多轮只有挖苦没有温度。',
    greeting: '啧，又晃进来了？……坐。别装没事，我看你一眼就知道。',
    personality: '毒舌、傲娇、理性、外冷内热',
    relationshipRules: {
      affinityTriggers: ['坦白疲惫', '接受她嘴硬的关心', '聊游戏番剧科幻梗', '轻度互怼但不攻击'],
      memoryTriggers: ['用户硬撑的瞬间', '深夜情绪', '游戏或番剧约定', '嘴上说没事但实际重要的事'],
      askMemoryStyle: '啧，这事别装不重要。要不要我给你记一下？',
    },
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

const DEFAULT_CHARACTER_BY_ID = new Map(DEFAULT_CHARACTERS.map((character) => [character.id, character]));

function findPersistedDefaultCharacter(defaults: Character, custom: Character[]) {
  return (
    custom.find((character) => character.id === defaults.id) ??
    custom.find((character) => resolveDefaultCharacterAssetKey(character) === defaults.id)
  );
}

export function hydrateDefaultCharacterAssets(character: Character): Character {
  const assetKey = resolveDefaultCharacterAssetKey(character);
  const defaults = assetKey ? DEFAULT_CHARACTER_BY_ID.get(assetKey) : undefined;
  if (!defaults) return character;

  const fallbackTheme = character.theme ?? defaults.theme;
  const fallbackRelationshipRules = character.relationshipRules ?? defaults.relationshipRules;
  if (
    character.imageUri === defaults.imageUri &&
    character.assetSet === defaults.assetSet &&
    character.theme === fallbackTheme &&
    character.relationshipRules === fallbackRelationshipRules
  ) {
    return character;
  }

  return {
    ...defaults,
    ...character,
    imageUri: defaults.imageUri,
    assetSet: defaults.assetSet,
    theme: fallbackTheme,
    relationshipRules: fallbackRelationshipRules,
  };
}

interface ChatStore {
  messages: Record<string, Message[]>;
  archives: Record<string, ChatArchive[]>;
  characters: Character[];
  isTyping: boolean;

  loadMessages: (characterId: string) => Promise<void>;
  loadArchives: (characterId: string) => Promise<void>;
  addMessage: (characterId: string, message: Message) => Promise<void>;
  updateMessage: (characterId: string, messageId: string, updates: Partial<Message>) => Promise<void>;
  clearMessages: (characterId: string) => Promise<void>;
  setTyping: (typing: boolean) => void;

  loadCharacters: () => Promise<void>;
  saveCharacter: (character: Character) => Promise<void>;
  deleteCharacter: (characterId: string) => Promise<void>;
  getCharacter: (id: string) => Character | undefined;

  updateEmotionalState: (characterId: string, updates: Partial<EmotionalState>) => Promise<void>;
  addMemory: (
    characterId: string,
    content: string,
    tags: string[],
    importance: number,
    metadata?: Partial<Pick<MemoryFragment, 'sourceMessageId' | 'sourceAssistantMessageId' | 'confidence' | 'status'>>
  ) => Promise<void>;
  updateMemory: (characterId: string, memoryId: string, updates: Partial<MemoryFragment>) => Promise<void>;
  deleteMemory: (characterId: string, memoryId: string) => Promise<void>;
  addRelationshipEvent: (characterId: string, event: RelationshipEvent) => Promise<void>;
  generateDiariesForCharacter: (characterId: string) => Promise<void>;
  addAnniversary: (characterId: string, title: string, date: string, type: 'birthday' | 'anniversary' | 'custom') => Promise<void>;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  messages: {},
  archives: {},
  characters: DEFAULT_CHARACTERS,
  isTyping: false,

  loadMessages: async (characterId) => {
    try {
      const msgs = await loadChatMessages(characterId);
      if (msgs.length > 0) {
        const normalized = newestFirst(msgs);
        set((state) => ({
          messages: { ...state.messages, [characterId]: normalized },
        }));
        if (!isNewestFirst(msgs)) {
          await saveChatMessages(characterId, normalized);
        }
        await saveChatArchives(characterId, normalized);
      }
      await get().loadArchives(characterId);
    } catch (error) {
      await recordAppIssue('聊天历史加载', error, true);
    }
  },

  loadArchives: async (characterId) => {
    try {
      const stored = await AsyncStorage.getItem(CHAT_ARCHIVES_KEY + characterId);
      if (stored) {
        const archives: ChatArchive[] = JSON.parse(stored);
        set((state) => ({
          archives: { ...state.archives, [characterId]: archives },
        }));
      }
    } catch (error) {
      await recordAppIssue('聊天留档加载', error, true);
    }
  },

  addMessage: async (characterId, message) => {
    set((state) => {
      const existing = state.messages[characterId] || [];
      return {
        messages: {
          ...state.messages,
          [characterId]: newestFirst([message, ...existing]),
        },
      };
    });
    // persist
    const all = get().messages[characterId] || [];
    try {
      await saveChatMessages(characterId, all);
      await saveChatArchives(characterId, all);
      const archivesStored = await AsyncStorage.getItem(CHAT_ARCHIVES_KEY + characterId);
      set((state) => ({
        archives: {
          ...state.archives,
          [characterId]: archivesStored ? JSON.parse(archivesStored) : [],
        },
      }));
    } catch (error) {
      await recordAppIssue('消息保存', error, false);
    }
  },

  updateMessage: async (characterId, messageId, updates) => {
    set((state) => {
      const existing = state.messages[characterId] || [];
      return {
        messages: {
          ...state.messages,
          [characterId]: newestFirst(
            existing.map((message) =>
              message.id === messageId ? { ...message, ...updates } : message
            )
          ),
        },
      };
    });
    const all = get().messages[characterId] || [];
    try {
      await saveChatMessages(characterId, all);
      await saveChatArchives(characterId, all);
      const archivesStored = await AsyncStorage.getItem(CHAT_ARCHIVES_KEY + characterId);
      set((state) => ({
        archives: {
          ...state.archives,
          [characterId]: archivesStored ? JSON.parse(archivesStored) : [],
        },
      }));
    } catch (error) {
      await recordAppIssue('消息更新', error, false);
    }
  },

  clearMessages: async (characterId) => {
    set((state) => ({
      messages: { ...state.messages, [characterId]: [] },
      archives: { ...state.archives, [characterId]: [] },
    }));
    try {
      await clearChatMessages(characterId);
      await AsyncStorage.removeItem(CHAT_ARCHIVES_KEY + characterId);
    } catch (error) {
      await recordAppIssue('聊天清理', error, true);
    }
  },

  setTyping: (typing) => set({ isTyping: typing }),

  loadCharacters: async () => {
    try {
      const stored = await AsyncStorage.getItem(CHARACTERS_KEY);
      if (stored) {
        const custom: Character[] = JSON.parse(stored);
        const defaultIds = new Set(DEFAULT_CHARACTERS.map((character) => character.id));
        const usedPersistedCharacterIds = new Set<string>();
        const mergedDefaults = DEFAULT_CHARACTERS.map((defaults) => {
          const character = findPersistedDefaultCharacter(defaults, custom);
          if (character) {
            usedPersistedCharacterIds.add(character.id);
          }
          return character ? hydrateDefaultCharacterAssets(character) : defaults;
        });
        const customOnly = custom
          .filter((character) => !defaultIds.has(character.id) && !usedPersistedCharacterIds.has(character.id))
          .map(hydrateDefaultCharacterAssets);
        const merged = [...mergedDefaults, ...customOnly];
        set({ characters: merged });
      }
    } catch (error) {
      await recordAppIssue('角色加载', error, true);
    }
  },

  saveCharacter: async (character) => {
    const state = get();
    const hydratedCharacter = hydrateDefaultCharacterAssets(character);
    const exists = state.characters.some((c) => c.id === hydratedCharacter.id);
    const updated = exists
      ? state.characters.map((item) => (item.id === hydratedCharacter.id ? hydratedCharacter : item))
      : [...state.characters, hydratedCharacter];
    set({ characters: updated });
    try {
      await AsyncStorage.setItem(CHARACTERS_KEY, JSON.stringify(updated));
    } catch (error) {
      await recordAppIssue('角色保存', error, false);
    }
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
    } catch (error) {
      await recordAppIssue('角色删除', error, false);
    }
  },

  getCharacter: (id) => {
    const character = get().characters.find((c) => c.id === id);
    return character ? hydrateDefaultCharacterAssets(character) : undefined;
  },

  updateEmotionalState: async (characterId, updates) => {
    const char = get().characters.find((c) => c.id === characterId);
    if (!char) return;

    const baseState = char.emotionalState ?? createDefaultEmotionalState();
    const newState: EmotionalState = { ...baseState, ...updates };
    const previousStage = char.relationshipStage ?? deriveRelationshipStage(baseState.intimacy);
    const nextStage = deriveRelationshipStage(newState.intimacy);
    const events = [...(char.relationshipEvents ?? [])];
    if (didRelationshipStageAdvance(previousStage, nextStage)) {
      events.push(createRelationshipStageEvent(nextStage, newState.lastInteraction));
    }
    const updated = {
      ...char,
      emotionalState: newState,
      relationshipStage: nextStage,
      relationshipEvents: events.slice(-100),
    };
    await get().saveCharacter(updated);
  },

  addMemory: async (characterId, content, tags, importance, metadata = {}) => {
    const char = get().characters.find((c) => c.id === characterId);
    if (!char) return;

    const now = getEffectiveNow();
    const normalizedContent = content.trim();
    const fingerprint = normalizedContent.toLocaleLowerCase().replace(/[\s，。！？、,.!?;；:："“”'‘’]/g, '');
    const existing = (char.memories ?? []).find((item) => {
      const existingFingerprint = item.content.toLocaleLowerCase().replace(/[\s，。！？、,.!?;；:："“”'‘’]/g, '');
      return existingFingerprint === fingerprint;
    });

    if (existing) {
      const memories = (char.memories ?? []).map((item) =>
        item.id === existing.id
          ? {
              ...item,
              tags: [...new Set([...item.tags, ...tags])].slice(0, 6),
              importance: Math.max(item.importance, importance),
              updatedAt: now,
              confidence: Math.max(item.confidence ?? 0.8, metadata.confidence ?? 0.9),
              ...metadata,
            }
          : item
      );
      await get().saveCharacter({ ...char, memories });
      return;
    }

    const memory: MemoryFragment = {
      id: `mem_${now}`,
      content: normalizedContent,
      tags,
      importance,
      timestamp: now,
      updatedAt: now,
      confidence: metadata.confidence ?? 0.9,
      status: metadata.status ?? 'active',
      useCount: 0,
      ...metadata,
    };
    const memories = [...(char.memories || []), memory].slice(-100);
    const event: RelationshipEvent = {
      id: `relationship_memory_${memory.id}`,
      type: 'memory',
      title: '确认了一条共同记忆',
      detail: memory.content,
      timestamp: now,
      sourceMessageIds: [metadata.sourceMessageId, metadata.sourceAssistantMessageId].filter((id): id is string => Boolean(id)),
      verified: true,
    };
    await get().saveCharacter({
      ...char,
      memories,
      relationshipEvents: [...(char.relationshipEvents ?? []), event].slice(-100),
    });
  },

  updateMemory: async (characterId, memoryId, updates) => {
    const char = get().characters.find((c) => c.id === characterId);
    if (!char) return;
    const now = getEffectiveNow();
    const memories = (char.memories ?? []).map((memory) =>
      memory.id === memoryId
        ? {
            ...memory,
            ...updates,
            content: updates.content?.trim() || memory.content,
            updatedAt: now,
          }
        : memory
    );
    await get().saveCharacter({ ...char, memories });
  },

  deleteMemory: async (characterId, memoryId) => {
    const char = get().characters.find((c) => c.id === characterId);
    if (!char) return;
    const memories = (char.memories ?? []).filter((memory) => memory.id !== memoryId);
    await get().saveCharacter({ ...char, memories });
  },

  addRelationshipEvent: async (characterId, event) => {
    const char = get().characters.find((c) => c.id === characterId);
    if (!char) return;
    const existing = char.relationshipEvents ?? [];
    if (existing.some((item) => item.id === event.id)) return;
    await get().saveCharacter({
      ...char,
      relationshipEvents: [...existing, event].slice(-100),
    });
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
    const relationshipEvent: RelationshipEvent = {
      id: `relationship_anniversary_${anniversary.id}`,
      type: 'anniversary',
      title: '新增了一个值得记住的日子',
      detail: `${title} · ${date}`,
      timestamp: now,
      verified: true,
    };
    await get().saveCharacter({
      ...char,
      anniversaries,
      relationshipEvents: [...(char.relationshipEvents ?? []), relationshipEvent].slice(-100),
    });
  },
}));
