#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const Module = require('module');
const ts = require('typescript');

const projectRoot = path.resolve(__dirname, '..');
const aiServicePath = path.join(projectRoot, 'src/services/aiService.ts');
const characterPromptArchitecturePath = path.join(projectRoot, 'src/services/characterPromptArchitectureService.ts');
const chatScreenPath = path.join(projectRoot, 'src/screens/ChatScreen.tsx');
const homeScreenPath = path.join(projectRoot, 'src/screens/HomeScreen.tsx');

function loadTsModule(filePath, requireStub) {
  const source = fs.readFileSync(filePath, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName: filePath,
  }).outputText;

  const exports = {};
  const module = { exports };
  const wrapped = Module.wrap(compiled);
  const script = new vm.Script(wrapped, { filename: filePath });
  script.runInThisContext()(exports, requireStub, module, filePath, path.dirname(filePath));
  return module.exports;
}

function loadCharacterPromptArchitectureService() {
  return loadTsModule(characterPromptArchitecturePath, (request) => {
    if (request === '../types') return {};
    return require(request);
  });
}

function loadAiServiceForNode() {
  return loadTsModule(aiServicePath, (request) => {
    if (request === '../store/settingsStore') {
      return {
        PROVIDER_CONFIGS: {
          custom: { baseUrl: 'https://mock.local/v1', label: 'Custom', defaultModel: 'mock-model' },
          mimo: { baseUrl: '', label: 'MiMo', defaultModel: '' },
          deepseek: { baseUrl: '', label: 'DeepSeek', defaultModel: '' },
          siliconflow: { baseUrl: '', label: 'SiliconFlow', defaultModel: '' },
        },
      };
    }
    if (request === './relationshipService') {
      return { getRelationshipPrompt: () => '\n【关系语境】保持自然亲近。' };
    }
    if (request === '../utils/chatHistory') {
      return {
        recentChronological: (messages, count) =>
          messages
            .slice()
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, count)
            .sort((a, b) => a.timestamp - b.timestamp),
      };
    }
    if (request === './characterPromptArchitectureService') {
      return loadCharacterPromptArchitectureService();
    }
    if (request === '../types') return {};
    return require(request);
  });
}

function assert(label, condition) {
  console.log(`${condition ? 'PASS' : 'FAIL'} ${label}`);
  if (!condition) process.exitCode = 1;
}

function createCharacter(id, name, mood = 'neutral') {
  const presets = {
    qingning: {
      name: '鹿芽',
      avatar: '🦌',
      systemPrompt: '【身份】你是鹿芽，像晨光一样亮闪闪的陪聊伙伴。',
      greeting: '哟，你这家伙终于冒泡啦！',
      personality: '元气、嘴甜、黏人',
      profile: { backstory: '路灯下面的元气室友。', hobbies: ['便利店'], catchphrases: ['你这家伙', '诶诶'], taboos: [], goals: [] },
    },
    sakura: {
      name: '纪遥',
      avatar: '📖',
      systemPrompt: '【身份】你是纪遥，沉静、靠谱的倾听型陪伴。',
      greeting: '……你来了。',
      personality: '温柔、克制、知性',
      profile: { backstory: '旧书店里的慢热倾听者。', hobbies: ['读书'], catchphrases: ['……嗯', '我在听'], taboos: [], goals: [] },
    },
    luna: {
      name: '凛夜',
      avatar: '⚡',
      systemPrompt: '【身份】你是凛夜，嘴硬心软的吐槽役姐姐型陪伴。',
      greeting: '啧，又晃进来了？',
      personality: '毒舌、傲娇、理性',
      profile: { backstory: '夜班节奏里的置顶聊天。', hobbies: ['打音游'], catchphrases: ['啧', '行吧'], taboos: [], goals: [] },
    },
  };
  const preset = presets[id] ?? {
    name,
    avatar: '✦',
    systemPrompt: `【身份】你是${name}。`,
    greeting: `${name}在这里。`,
    personality: '自定义陪伴角色',
    profile: { backstory: '自定义背景。', hobbies: [], catchphrases: ['嗯'], taboos: [], goals: ['陪伴用户'] },
  };

  return {
    id,
    name: preset.name,
    avatar: preset.avatar,
    systemPrompt: preset.systemPrompt,
    greeting: preset.greeting,
    personality: preset.personality,
    profile: preset.profile,
    relationshipRules: {
      affinityTriggers: ['分享日常'],
      memoryTriggers: ['重要偏好'],
      askMemoryStyle: '要记一下吗？',
    },
    emotionalState: {
      mood,
      intimacy: 62,
      energy: mood === 'tired' ? 30 : 78,
      lastInteraction: new Date('2026-07-05T20:00:00+08:00').getTime(),
    },
    memories: [],
  };
}

const { buildPromptDebugSnapshot } = loadAiServiceForNode();
const { buildCharacterPromptLayers, getMoodEntryGreetingFallback } = loadCharacterPromptArchitectureService();

const config = {
  provider: 'custom',
  baseUrl: 'https://mock.local/v1',
  apiKey: 'debug-key',
  model: 'mock-model',
  visionModel: 'mock-vision',
};
const memory = {
  enabled: true,
  alwaysRetainHistory: true,
  retentionRange: 100,
  sendRange: 20,
  alwaysProvideFullMemory: true,
  specificTimeRangeHours: 24,
  autoSummarize: false,
  autoSummarizeTrigger: 'on_exit',
  memorySystemPrompt: '',
};
const advanced = {
  compatibilityMode: false,
  deepThinking: false,
  customRequestParams: {},
  darkMode: 'light',
  sendDelayMs: 0,
  theme: 'softSweet',
  themeMode: 'manual',
  debugNowTs: new Date('2026-07-05T20:30:00+08:00').getTime(),
};

const recentMessages = [
  { id: 'u1', role: 'user', content: '今天有点累，想去便利店买点零食。', timestamp: 1 },
  { id: 'a1', role: 'assistant', content: '那先坐一下。', timestamp: 2 },
];

const qingningTired = createCharacter('qingning', '鹿芽', 'tired');
const qingningSnapshot = buildPromptDebugSnapshot({
  character: qingningTired,
  chatHistory: recentMessages,
  config,
  memory,
  advanced,
  userText: '我今天低电量了。',
});
const sectionTitles = qingningSnapshot.sections.map((section) => section.title).join('\n');
const finalPrompt = qingningSnapshot.finalSystemPrompt;

assert('debug snapshot exposes character description layer', sectionTitles.includes('角色事实 Character Description'));
assert('debug snapshot exposes scenario layer', sectionTitles.includes('性格与处境 Personality / Scenario'));
assert('debug snapshot exposes mood layer', sectionTitles.includes('当前心情 State Mood'));
assert('debug snapshot exposes voice layer', sectionTitles.includes('口癖与语气 Voice Style'));
assert('debug snapshot exposes example dialogue layer', sectionTitles.includes('样例对话 Example Dialogues'));
assert('debug snapshot exposes author note layer', sectionTitles.includes("作者备注 Author's Note"));
assert('debug snapshot exposes lorebook layer', sectionTitles.includes('动态设定 World Info / Lorebook'));
assert('final system prompt includes SillyTavern-style layers', finalPrompt.includes('Character Description') && finalPrompt.includes('Example Dialogues'));
assert('tired qingning prompt includes low-energy character behavior', finalPrompt.includes('零食毯子模式') && finalPrompt.includes('明显降噪'));
assert('dynamic lorebook hits recent snack keywords', finalPrompt.includes('便利店和零食'));

const noLoreLayers = buildCharacterPromptLayers(qingningTired, {
  chatHistory: [{ id: 'u2', role: 'user', content: '今天开会很多。', timestamp: 3 }],
});
assert('dynamic lorebook stays inactive when no keyword matches', noLoreLayers.some((layer) => layer.key === 'dynamicLorebook' && !layer.active));

const promptsByCharacter = ['qingning', 'sakura', 'luna'].map((id) =>
  buildPromptDebugSnapshot({
    character: createCharacter(id, id, 'excited'),
    chatHistory: [],
    config,
    memory,
    advanced,
    userText: '我想你了。',
  }).finalSystemPrompt
);
assert('three default characters produce different prompt voices', new Set(promptsByCharacter).size === 3);
assert('sakura excited prompt is restrained but direct', promptsByCharacter[1].includes('克制失守') && promptsByCharacter[1].includes('更直接'));
assert('luna excited prompt keeps hard-shell care', promptsByCharacter[2].includes('嘴硬') && promptsByCharacter[2].includes('行动感'));

const qingningHappyPrompt = buildPromptDebugSnapshot({
  character: createCharacter('qingning', '鹿芽', 'happy'),
  chatHistory: [],
  config,
  memory,
  advanced,
  userText: '今天好开心。',
}).finalSystemPrompt;
assert('mood switch changes prompt content', qingningHappyPrompt !== finalPrompt && qingningHappyPrompt.includes('亮晶晶上扬'));

const customLayers = buildCharacterPromptLayers(createCharacter('custom_mei', '莓', 'neutral'), { chatHistory: [] });
assert('custom character has fallback voice profile', customLayers.some((layer) => layer.key === 'voiceStyle' && layer.content.includes('可自然使用这些口头禅')));
assert('mood entry fallback is local and character-specific', getMoodEntryGreetingFallback(qingningTired, 'tired').includes('低电量鹿芽'));

const chatScreen = fs.readFileSync(chatScreenPath, 'utf8');
const homeScreen = fs.readFileSync(homeScreenPath, 'utf8');
const homeOpenChatBlock = homeScreen.slice(
  homeScreen.indexOf('const handleOpenChat'),
  homeScreen.indexOf('const handleOpenMemory')
);
assert('ChatScreen skips persisted first greeting for mood entry', chatScreen.includes('!autoGreet && !moodEntry && chatMessages.length === 0'));
assert('ChatScreen renders mood entry without addMessage side effect', chatScreen.includes('setMoodEntryMessage') && !chatScreen.includes('addMessage(characterId, moodEntry'));
assert('HomeScreen passes home status mood entry to Chat route', homeScreen.includes("source: 'homeStatus' as const") && homeScreen.includes('moodEntry ? { characterId: character.id, moodEntry }'));
assert('HomeScreen only keeps mood entry valid for five minutes', homeScreen.includes('MOOD_ENTRY_VALID_MS = 5 * 60 * 1000') && homeOpenChatBlock.includes('now - lastMoodEntry.changedAt <= MOOD_ENTRY_VALID_MS'));
assert('HomeScreen consumes mood entry after opening chat', homeOpenChatBlock.includes('setLastMoodEntry(null)'));
assert('HomeScreen does not update emotional state just for opening chat', !homeOpenChatBlock.includes('updateEmotionalState'));
assert('ChatScreen skips expired mood entry defensively', chatScreen.includes('MOOD_ENTRY_VALID_MS = 5 * 60 * 1000') && chatScreen.includes('Date.now() - moodEntryChangedAt > MOOD_ENTRY_VALID_MS'));
assert('ChatScreen only accepts home status mood entry source', chatScreen.includes("moodEntrySource !== 'homeStatus'"));
