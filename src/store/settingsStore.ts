import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppSettings, ServiceProvider, AppMode } from '../types';
import { saveSecure, getSecure, deleteSecure } from '../services/secureStorage';

const STORAGE_KEY = '@bcmp_settings';
const API_KEY_SECURE = 'bcmp_api_key';
const DEEPSEEK_BASE_URL = 'https://api.deepseek.com/v1';
const DEEPSEEK_DEFAULT_MODEL = 'deepseek-chat';

declare const process: {
  env?: {
    EXPO_PUBLIC_DEEPSEEK_API_KEY?: string;
  };
} | undefined;

const envDeepSeekApiKey =
  (typeof process !== 'undefined' ? process.env?.EXPO_PUBLIC_DEEPSEEK_API_KEY : undefined)?.trim() ?? '';

function getDeepSeekServiceDefaults() {
  return {
    provider: 'deepseek' as const,
    apiKey: envDeepSeekApiKey,
    model: DEEPSEEK_DEFAULT_MODEL,
    visionModel: DEEPSEEK_DEFAULT_MODEL,
    baseUrl: DEEPSEEK_BASE_URL,
  };
}

const defaultSettings: AppSettings = {
  appMode: 'explore',
  service: getDeepSeekServiceDefaults(),
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
    theme: 'urbanClear',
    themeMode: 'manual',
  },
  selectedCharacterId: 'qingning',
};

function mergeSettings(parsed: Partial<AppSettings>): AppSettings {
  const merged = {
    ...defaultSettings,
    ...parsed,
    service: { ...defaultSettings.service, ...parsed.service },
    life: { ...defaultSettings.life, ...parsed.life },
    memory: { ...defaultSettings.memory, ...parsed.memory },
    advanced: { ...defaultSettings.advanced, ...parsed.advanced },
  };

  if (merged.service.provider === 'mimo') {
    merged.service.baseUrl = PROVIDER_CONFIGS.mimo.baseUrl;
    if (!merged.service.model || merged.service.model === 'mimo-v2.5') {
      merged.service.model = PROVIDER_CONFIGS.mimo.defaultModel;
    }
    if (!merged.service.visionModel || merged.service.visionModel === 'mimo-v2.5') {
      merged.service.visionModel = PROVIDER_CONFIGS.mimo.defaultModel;
    }
  }

  if (merged.service.provider === 'deepseek') {
    merged.service.baseUrl = PROVIDER_CONFIGS.deepseek.baseUrl;
    if (!merged.service.model) {
      merged.service.model = PROVIDER_CONFIGS.deepseek.defaultModel;
    }
    if (!merged.service.visionModel) {
      merged.service.visionModel = PROVIDER_CONFIGS.deepseek.defaultModel;
    }
  }

  return merged;
}

function applyEnvDeepSeekFallback(settings: AppSettings, savedApiKey?: string | null): AppSettings {
  if (!envDeepSeekApiKey || savedApiKey) return settings;
  return {
    ...settings,
    service: {
      ...settings.service,
      ...getDeepSeekServiceDefaults(),
    },
  };
}

interface SettingsStore {
  settings: AppSettings;
  isLoaded: boolean;
  loadSettings: () => Promise<void>;
  updateService: (updates: Partial<AppSettings['service']>) => void;
  updateLife: (updates: Partial<AppSettings['life']>) => void;
  updateMemory: (updates: Partial<AppSettings['memory']>) => void;
  updateAdvanced: (updates: Partial<AppSettings['advanced']>) => void;
  setAppMode: (mode: AppMode) => void;
  setDebugNowTs: (ts?: number) => void;
  setSelectedCharacter: (id: string) => void;
  saveSettings: (settingsOverride?: AppSettings) => Promise<boolean>;
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
        if (parsed.appMode !== 'admin' && parsed.appMode !== 'explore') {
          parsed.appMode = defaultSettings.appMode;
        }
        set({ settings: applyEnvDeepSeekFallback(mergeSettings(parsed), apiKey), isLoaded: true });
      } else {
        set({ settings: applyEnvDeepSeekFallback(defaultSettings, apiKey), isLoaded: true });
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

  setAppMode: (mode) => {
    set((state) => ({
      settings: { ...state.settings, appMode: mode },
    }));
  },

  setDebugNowTs: (ts) => {
    set((state) => ({
      settings: {
        ...state.settings,
        advanced: { ...state.settings.advanced, debugNowTs: ts },
      },
    }));
  },

  setSelectedCharacter: (id) => {
    set((state) => ({
      settings: { ...state.settings, selectedCharacterId: id },
    }));
  },

  saveSettings: async (settingsOverride) => {
    try {
      const currentSettings = settingsOverride ?? get().settings;
      const normalizedSettings: AppSettings = {
        ...currentSettings,
        service: {
          ...currentSettings.service,
          apiKey: currentSettings.service.apiKey.trim(),
          model: currentSettings.service.model.trim(),
          visionModel: currentSettings.service.visionModel.trim(),
          baseUrl: currentSettings.service.baseUrl?.trim(),
        },
      };
      const apiKey = normalizedSettings.service.apiKey;

      // 保存 API Key 到安全存储
      if (apiKey) {
        await saveSecure(API_KEY_SECURE, apiKey);
      } else {
        await deleteSecure(API_KEY_SECURE);
      }

      // 保存其他设置到 AsyncStorage（不包含 API Key）
      const settingsToSave = {
        ...normalizedSettings,
        service: { ...normalizedSettings.service, apiKey: '' }
      };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settingsToSave));
      set({ settings: normalizedSettings });
      return true;
    } catch (e) {
      console.error('Failed to save settings', e);
      return false;
    }
  },
}));

export const PROVIDER_CONFIGS: Record<ServiceProvider, { baseUrl: string; label: string; defaultModel: string }> = {
  mimo: {
    baseUrl: 'https://token-plan-cn.xiaomimimo.com/v1',
    label: 'MiMo',
    defaultModel: 'mimo-v2.5-pro',
  },
  deepseek: {
    baseUrl: DEEPSEEK_BASE_URL,
    label: 'DeepSeek',
    defaultModel: DEEPSEEK_DEFAULT_MODEL,
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
