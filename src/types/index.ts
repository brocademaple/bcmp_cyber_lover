export type MessageRole = 'user' | 'assistant' | 'system';

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  characterMood?: EmotionalState['mood'];
  status?: 'queued' | 'sending' | 'sent' | 'failed';
  errorMessage?: string;
  imageUri?: string;
  audioUri?: string;
  isThinking?: boolean;
}

export interface ChatArchive {
  id: string;
  characterId: string;
  dateKey: string;
  title: string;
  lastMessage: string;
  messageCount: number;
  userMessageCount: number;
  assistantMessageCount: number;
  startedAt: number;
  updatedAt: number;
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
  updatedAt?: number;
  sourceMessageId?: string;
  sourceAssistantMessageId?: string;
  confidence?: number; // 0-1; old memories default to 1 when shown
  status?: 'active' | 'locked' | 'superseded';
  lastUsedAt?: number;
  useCount?: number;
  visualUri?: string | number;
  visualTitle?: string;
  visualCaption?: string;
}

export type AppTheme =
  | 'pink'
  | 'blue'
  | 'yellow'
  | 'purple'
  | 'midnight'
  | 'urbanClear'
  | 'softSweet';
export type CharacterImageSource = string | number;

export interface CharacterAssetSet {
  main: CharacterImageSource;
  avatar: CharacterImageSource;
  headshot?: CharacterImageSource;
  idleFrames: CharacterImageSource[];
  memoryScene: CharacterImageSource;
}

export type DiaryPeriod = 'daily' | 'weekly' | 'monthly';

export interface CharacterDiary {
  id: string;
  period: DiaryPeriod;
  periodKey: string; // daily: YYYY-MM-DD, weekly: YYYY-Wxx, monthly: YYYY-MM
  title: string;
  content: string;
  timestamp: number;
  relatedMemoryIds?: string[];
}

export interface CharacterProfile {
  backstory: string;
  hobbies: string[];
  catchphrases: string[];
  taboos: string[];
  goals: string[];
}

export interface RelationshipRules {
  affinityTriggers: string[];
  memoryTriggers: string[];
  askMemoryStyle: string;
}

export interface Anniversary {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  type: 'birthday' | 'anniversary' | 'custom';
  notified?: boolean;
}

export type RelationshipStage = 'firstMeeting' | 'familiar' | 'trusted' | 'sharedRoutine';

export interface RelationshipEvent {
  id: string;
  type: 'memory' | 'milestone' | 'mood' | 'promise' | 'anniversary' | 'chapter';
  title: string;
  detail: string;
  timestamp: number;
  sourceMessageIds?: string[];
  verified?: boolean;
}

export interface CharacterDefinitionSnapshot {
  name: string;
  avatar: string;
  imageUri?: CharacterImageSource;
  assetSet?: CharacterAssetSet;
  theme?: AppTheme;
  systemPrompt: string;
  greeting: string;
  personality: string;
  relationshipRules?: RelationshipRules;
  profile?: CharacterProfile;
}

export interface CharacterRevision {
  id: string;
  characterId: string;
  version: number;
  label: string;
  createdAt: number;
  definition: CharacterDefinitionSnapshot;
}

export interface Character {
  id: string;
  name: string;
  avatar: string;
  imageUri?: CharacterImageSource;
  assetSet?: CharacterAssetSet;
  theme?: AppTheme;
  systemPrompt: string;
  greeting: string;
  personality: string;
  relationshipRules?: RelationshipRules;
  emotionalState?: EmotionalState;
  profile?: CharacterProfile;
  memories?: MemoryFragment[];
  diaries?: CharacterDiary[];
  anniversaries?: Anniversary[];
  relationshipStage?: RelationshipStage;
  relationshipEvents?: RelationshipEvent[];
  definitionVersion?: number;
}

export type ServiceProvider = 'mimo' | 'deepseek' | 'siliconflow' | 'custom';

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
  theme: AppTheme;
  themeMode: 'character' | 'manual';
  debugNowTs?: number;
}

export type AppMode = 'admin' | 'explore';

export interface AppSettings {
  appMode: AppMode;
  service: ServiceConfig;
  life: LifeConfig;
  memory: MemoryConfig;
  advanced: AdvancedConfig;
  selectedCharacterId: string;
}

export interface DebugPromptSection {
  title: string;
  content: string;
  active?: boolean;
}

export interface DebugPromptMessage {
  role: string;
  contentPreview: string;
  hasImage?: boolean;
}

export interface DebugRequestItem {
  label: string;
  value: string;
}

export interface DebugPromptSnapshot {
  kind: 'chat' | 'dailyGreeting' | 'vision' | 'serviceTest';
  title: string;
  provider: ServiceProvider;
  model: string;
  baseUrl: string;
  sections: DebugPromptSection[];
  finalSystemPrompt?: string;
  userPrompt?: string;
  apiMessagesPreview: DebugPromptMessage[];
  requestSummary: DebugRequestItem[];
  notes: string[];
}

export interface DebugAgentSurface {
  title: string;
  description: string;
  sections: DebugPromptSection[];
  requestSummary?: DebugRequestItem[];
  notes?: string[];
}

export interface DebugEmotionExplanation {
  inputText: string;
  before: EmotionalState;
  after: EmotionalState;
  affinityDelta: number;
  matchedAffinityRules: string[];
  moodReason: string;
  energyReason: string;
  stateInfluence: string[];
}

export interface DebugTurnTrace {
  id: string;
  timestamp: number;
  characterId: string;
  characterName: string;
  userMessageId?: string;
  assistantMessageId?: string;
  userText: string;
  model: string;
  promptSummary: string;
  promptRequestSummary?: DebugRequestItem[];
  promptSections?: DebugPromptSection[];
  promptMessagesPreview?: DebugPromptMessage[];
  promptNotes?: string[];
  emotionBefore?: EmotionalState;
  emotionAfter?: EmotionalState;
  affinityDelta?: number;
  memoryDecision: string;
  memoryDecisionDetail?: string;
  assistantText?: string;
  errorMessage?: string;
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
  Chat: {
    characterId: string;
    autoGreet?: boolean;
    moodEntry?: {
      mood: EmotionalState['mood'];
      changedAt: number;
      source: 'homeStatus';
    };
  };
  Call: { characterId: string; callType: CallType };
  Settings: undefined;
  LifeSettings: undefined;
  MemorySettings: { characterId?: string } | undefined;
  DataManagement: undefined;
  AdvancedSettings: undefined;
  ServiceSettings: undefined;
  DeveloperDebug: undefined;
  CharacterEditor: { characterId?: string };
  CharacterSettings: {
    characterId: string;
    initialPage?: 'profile' | 'memory' | 'timeline' | 'archive' | 'anniversary' | 'diary';
  };
};
