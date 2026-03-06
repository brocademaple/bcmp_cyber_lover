import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppSettings, ServiceProvider } from '../types';

const STORAGE_KEY = '@bcmp_settings';

const defaultSettings: AppSettings = {
  service: {
    provider: 'siliconflow',
    apiKey: '',
    model: 'Qwen/Qwen2.5-72B-Instruct',
    visionModel: 'Qwen/Qwen2.5-VL-72B-Instruct',
    baseUrl: '',
  },
  life: {
    enabled: true,
    allowProactiveMessages: true,
    allowBackgroundMessages: true,
    proactiveIntervalMinutes: 30,
    backgroundToastEnabled: false,
    backgroundExitConfirm: false,
    enhancedMomentProactivity: true,
  },
  memory: {
    enabled: true,
    alwaysRetainHistory: true,
    retentionRange: 100,
    sendRange: 20,
    alwaysProvideFullMemory: true,
    specificTimeRangeHours: 24,
    autoSummarize: false,
    autoSummarizeTrigger: 'on_exit',
    memorySystemPrompt: '你是一个有记忆的AI伴侣，请根据以往的聊天记录理解用户的喜好和习惯。',
  },
  advanced: {
    compatibilityMode: false,
    deepThinking: false,
    customRequestParams: {},
    darkMode: 'auto',
    sendDelayMs: 0,
  },
  selectedCharacterId: 'qingning',
};

interface SettingsStore {
  settings: AppSettings;
  isLoaded: boolean;
  loadSettings: () => Promise<void>;
  updateService: (updates: Partial<AppSettings['service']>) => void;
  updateLife: (updates: Partial<AppSettings['life']>) => void;
  updateMemory: (updates: Partial<AppSettings['memory']>) => void;
  updateAdvanced: (updates: Partial<AppSettings['advanced']>) => void;
  setSelectedCharacter: (id: string) => void;
  saveSettings: () => Promise<void>;
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: defaultSettings,
  isLoaded: false,

  loadSettings: async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        set({ settings: { ...defaultSettings, ...parsed }, isLoaded: true });
      } else {
        set({ isLoaded: true });
      }
    } catch {
      set({ isLoaded: true });
    }
  },

  updateService: (updates) => {
    set((state) => ({
      settings: {
        ...state.settings,
        service: { ...state.settings.service, ...updates },
      },
    }));
  },

  updateLife: (updates) => {
    set((state) => ({
      settings: {
        ...state.settings,
        life: { ...state.settings.life, ...updates },
      },
    }));
  },

  updateMemory: (updates) => {
    set((state) => ({
      settings: {
        ...state.settings,
        memory: { ...state.settings.memory, ...updates },
      },
    }));
  },

  updateAdvanced: (updates) => {
    set((state) => ({
      settings: {
        ...state.settings,
        advanced: { ...state.settings.advanced, ...updates },
      },
    }));
  },

  setSelectedCharacter: (id) => {
    set((state) => ({
      settings: { ...state.settings, selectedCharacterId: id },
    }));
  },

  saveSettings: async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(get().settings));
    } catch (e) {
      console.error('Failed to save settings', e);
    }
  },
}));

export const PROVIDER_CONFIGS: Record<ServiceProvider, { baseUrl: string; label: string; defaultModel: string }> = {
  deepseek: {
    baseUrl: 'https://api.deepseek.com/v1',
    label: 'DeepSeek',
    defaultModel: 'deepseek-chat',
  },
  siliconflow: {
    baseUrl: 'https://api.siliconflow.cn/v1',
    label: '硅基流动',
    defaultModel: 'Qwen/Qwen2.5-72B-Instruct',
  },
  custom: {
    baseUrl: '',
    label: '自定义',
    defaultModel: '',
  },
};
