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

export interface EmotionalState {
  mood: 'happy' | 'sad' | 'excited' | 'tired' | 'angry' | 'neutral';
  intimacy: number; // 0-100 亲密度
  energy: number; // 0-100 精力值
  lastInteraction: number;
}

export interface MemoryFragment {
  id: string;
  content: string;
  tags: string[]; // ['用户喜好', '重要日期', '情感事件']
  importance: number; // 1-10
  timestamp: number;
}

export interface CharacterProfile {
  backstory: string;
  hobbies: string[];
  catchphrases: string[];
  taboos: string[];
  goals: string[];
}

export interface Anniversary {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  type: 'birthday' | 'anniversary' | 'custom';
  notified?: boolean;
}

export interface Character {
  id: string;
  name: string;
  avatar: string;
  imageUri?: string;
  systemPrompt: string;
  greeting: string;
  personality: string;
  emotionalState?: EmotionalState;
  profile?: CharacterProfile;
  memories?: MemoryFragment[];
  anniversaries?: Anniversary[];
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
  notificationHour: number; // 0-23, default 20 (8pm)
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
  theme: 'pink' | 'blue' | 'yellow' | 'purple';
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
  Onboarding: undefined;
  Main: undefined;
  Chat: { characterId: string; autoGreet?: boolean };
  Call: { characterId: string; callType: CallType };
  Settings: undefined;
  LifeSettings: undefined;
  MemorySettings: undefined;
  AdvancedSettings: undefined;
  ServiceSettings: undefined;
  CharacterEditor: { characterId?: string };
  CharacterSettings: { characterId: string };
};
