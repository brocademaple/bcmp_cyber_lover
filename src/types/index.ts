export type MessageRole = 'user' | 'assistant' | 'system';

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  imageUri?: string;
  audioUri?: string;
  isThinking?: boolean;
}

export interface Character {
  id: string;
  name: string;
  avatar: string;        // emoji or image uri
  systemPrompt: string;
  greeting: string;
  personality: string;
}

export type ServiceProvider = 'deepseek' | 'siliconflow' | 'custom';

export interface ServiceConfig {
  provider: ServiceProvider;
  apiKey: string;
  model: string;
  visionModel: string;
  baseUrl?: string;       // for custom provider
}

export interface LifeConfig {
  enabled: boolean;
  allowProactiveMessages: boolean;
  allowBackgroundMessages: boolean;
  proactiveIntervalMinutes: number;
  backgroundToastEnabled: boolean;
  backgroundExitConfirm: boolean;
  enhancedMomentProactivity: boolean;
}

export interface MemoryConfig {
  enabled: boolean;
  alwaysRetainHistory: boolean;
  retentionRange: number;      // number of messages to retain
  sendRange: number;           // number of messages to include in each request
  alwaysProvideFullMemory: boolean;
  specificTimeRangeHours: number;
  autoSummarize: boolean;
  autoSummarizeTrigger: 'during' | 'on_exit' | 'both';
  memorySystemPrompt: string;
}

export interface AdvancedConfig {
  compatibilityMode: boolean;
  deepThinking: boolean;
  customRequestParams: Record<string, unknown>;
  darkMode: 'auto' | 'light' | 'dark';
  sendDelayMs: number;
}

export interface AppSettings {
  service: ServiceConfig;
  life: LifeConfig;
  memory: MemoryConfig;
  advanced: AdvancedConfig;
  selectedCharacterId: string;
}

export type CallType = 'audio' | 'video';

export interface CallState {
  active: boolean;
  type: CallType;
  duration: number;
  isMuted: boolean;
  isCameraOff: boolean;
  isSpeakerOn: boolean;
}

export type RootStackParamList = {
  Main: undefined;
  Chat: { characterId: string };
  Call: { characterId: string; callType: CallType };
  Settings: undefined;
  LifeSettings: undefined;
  MemorySettings: undefined;
  AdvancedSettings: undefined;
  ServiceSettings: undefined;
  CharacterEditor: { characterId?: string };
};
