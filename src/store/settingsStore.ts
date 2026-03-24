import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppSettings, ServiceProvider } from '../types';
import { saveSecure, getSecure } from '../services/secureStorage';

const STORAGE_KEY = '@bcmp_settings';
const API_KEY_SECURE = 'bcmp_api_key';

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
    notificationHour: 20,
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
    darkMode: 'light',
    sendDelayMs: 0,
    theme: 'pink',
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
      const apiKey = await getSecure(API_KEY_SECURE);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (apiKey) {
          parsed.service.apiKey = apiKey;
        }
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
      const currentSettings = get().settings;
      const apiKey = currentSettings.service.apiKey;

      // 保存 API Key 到安全存储
      if (apiKey) {
        await saveSecure(API_KEY_SECURE, apiKey);
      }

      // 保存其他设置到 AsyncStorage（不包含 API Key）
      const settingsToSave = {
        ...currentSettings,
        service: { ...currentSettings.service, apiKey: '' }
      };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settingsToSave));
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
