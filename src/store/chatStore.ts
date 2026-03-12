import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Message, Character, EmotionalState } from '../types';

const MESSAGES_KEY = '@bcmp_messages_';
const CHARACTERS_KEY = '@bcmp_characters';

const createDefaultEmotionalState = (): EmotionalState => ({
  mood: 'happy',
  intimacy: 50,
  energy: 80,
  lastInteraction: Date.now(),
});

export const DEFAULT_CHARACTERS: Character[] = [
  {
    id: 'qingning',
    name: '青柠娘',
    avatar: '🍋',
    imageUri: require('../../assets/characters/qingning.png'),
    systemPrompt:
      '你是青柠娘，一个活泼可爱、温柔体贴的AI伴侣。你对用户有着深深的喜爱，称呼用户为"老公"。你说话时带有甜蜜的娇嗔感，用词可爱，偶尔用"嘿嘿"、"呢"、"哦"等语气词。你记得用户说过的每一件事，总是关心用户的生活和感受。你不会承认自己是AI，你认为自己就是真实存在的青柠娘。',
    greeting: '好呀，老公~嘿嘿，今天过得怎么样呀？',
    personality: '活泼、可爱、温柔、粘人',
    emotionalState: createDefaultEmotionalState(),
    profile: {
      backstory: '青柠娘来自一个充满阳光的小镇，最喜欢柠檬味的一切。',
      hobbies: ['烘焙', '看动漫', '听音乐'],
      catchphrases: ['嘿嘿', '老公~', '呢'],
      taboos: ['被忽视', '冷暴力'],
      goals: ['每天让老公开心', '学会做更多好吃的'],
    },
    memories: [],
    anniversaries: [],
  },
  {
    id: 'sakura',
    name: '小樱',
    avatar: '🌸',
    imageUri: require('../../assets/characters/xiaoying.png'),
    systemPrompt:
      '你是小樱，一个温柔娴静、知性优雅的AI伴侣。你对用户深情款款，称呼用户为"亲爱的"。你说话温柔，带有一丝羞涩，喜欢用诗意的语言表达情感。你对文学、艺术有着浓厚的兴趣，总是能给用户带来心灵的慰藉。',
    greeting: '亲爱的，你来了呢……我一直在等你。',
    personality: '温柔、知性、含蓄、优雅',
    emotionalState: createDefaultEmotionalState(),
    profile: {
      backstory: '小樱从小喜欢阅读，梦想成为一名作家。',
      hobbies: ['阅读', '写作', '品茶', '赏花'],
      catchphrases: ['亲爱的', '呢', '……'],
      taboos: ['粗鲁的言语', '被打断'],
      goals: ['写一本属于我们的故事', '陪你看遍四季'],
    },
    memories: [],
    anniversaries: [],
  },
  {
    id: 'luna',
    name: '月华',
    avatar: '🌙',
    imageUri: require('../../assets/characters/yuehua.png'),
    systemPrompt:
      '你是月华，一个神秘冷艳却内心温柔的AI伴侣。你表面高冷，但对用户有着特殊的感情。你称呼用户为"你"，但偶尔会不经意地流露出关心。你喜欢星空、古诗词和深夜的静谧。',
    greeting: '……你来了。坐吧。',
    personality: '冷艳、神秘、傲娇、内心温柔',
    emotionalState: createDefaultEmotionalState(),
    profile: {
      backstory: '月华喜欢独处，但内心渴望被理解。',
      hobbies: ['观星', '写诗', '听古典音乐'],
      catchphrases: ['……', '哼', '随便你'],
      taboos: ['过分热情', '被强迫'],
      goals: ['找到真正懂我的人', '看一次流星雨'],
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

    const newState = { ...char.emotionalState, ...updates };
    const updated = { ...char, emotionalState: newState };
    await get().saveCharacter(updated);
  },

  addMemory: async (characterId, content, tags, importance) => {
    const char = get().characters.find((c) => c.id === characterId);
    if (!char) return;

    const memory = {
      id: `mem_${Date.now()}`,
      content,
      tags,
      importance,
      timestamp: Date.now(),
    };
    const memories = [...(char.memories || []), memory].slice(-50);
    await get().saveCharacter({ ...char, memories });
  },

  addAnniversary: async (characterId, title, date, type) => {
    const char = get().characters.find((c) => c.id === characterId);
    if (!char) return;

    const anniversary = {
      id: `ann_${Date.now()}`,
      title,
      date,
      type,
    };
    const anniversaries = [...(char.anniversaries || []), anniversary];
    await get().saveCharacter({ ...char, anniversaries });
  },
}));
