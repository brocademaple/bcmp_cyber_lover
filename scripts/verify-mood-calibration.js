#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const Module = require('module');
const ts = require('typescript');

const projectRoot = path.resolve(__dirname, '..');
const servicePath = path.join(projectRoot, 'src/services/moodJudgementService.ts');

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

function loadMoodService() {
  return loadTsModule(servicePath, (request) => {
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
    if (request === '../utils/characterAssets') {
      return { resolveDefaultCharacterAssetKey: (character) => character.id };
    }
    if (request === '../types') return {};
    return require(request);
  });
}

function assert(label, condition, detail) {
  console.log(`${condition ? 'PASS' : 'FAIL'} ${label}`);
  if (!condition) {
    if (detail) console.log(`  ${detail}`);
    process.exitCode = 1;
  }
}

function createCharacter(id, name, mood) {
  return {
    id,
    name,
    avatar: '◇',
    systemPrompt: `你是${name}。`,
    greeting: `${name}在这里。`,
    personality: '陪伴型角色',
    profile: { backstory: '', hobbies: [], catchphrases: [], taboos: [], goals: [] },
    relationshipRules: {
      affinityTriggers: [],
      memoryTriggers: [],
      askMemoryStyle: '',
    },
    emotionalState: {
      mood,
      intimacy: 62,
      energy: mood === 'tired' ? 30 : 70,
      lastInteraction: Date.now(),
    },
    memories: [],
  };
}

function msg(id, role, content, timestamp) {
  return { id, role, content, timestamp };
}

const baseAdvanced = {
  compatibilityMode: false,
  deepThinking: false,
  customRequestParams: {},
  darkMode: 'light',
  sendDelayMs: 0,
  theme: 'softSweet',
  themeMode: 'manual',
};

const localService = {
  provider: 'custom',
  baseUrl: '',
  apiKey: '',
  model: 'mock-model',
  visionModel: '',
};

async function run() {
  const { evaluateMoodFromConversation } = loadMoodService();

  const qingningTiredCare = await evaluateMoodFromConversation({
    character: createCharacter('qingning', '鹿芽', 'tired'),
    messages: [
      msg('u1', 'user', '想你了，今天好累。', 1),
      msg('a1', 'assistant', '累成这样还惦记着来找我呀……先裹着小毯子，我去给你泡杯热可可，喝完再慢慢说。', 2),
    ],
    service: localService,
    advanced: baseAdvanced,
    preferLocal: true,
  });
  assert('tired + 想你/热可可/毯子维持 tired', qingningTiredCare.suggestedMood === 'tired' && !qingningTiredCare.shouldSync, JSON.stringify(qingningTiredCare));

  const qingningHappyBurst = await evaluateMoodFromConversation({
    character: createCharacter('qingning', '鹿芽', 'tired'),
    messages: [
      msg('u1', 'user', '今天突然有个好消息。', 1),
      msg('a1', 'assistant', '哈哈哈哈好耶！我整个人都亮晶晶了，开心到想立刻玩梗冲呀，零食开趴双倍快乐！', 2),
      msg('u2', 'user', '你也太开心了。', 3),
      msg('a2', 'assistant', '嘿嘿太好了太好了，我要把这份快乐分你一大杯！', 4),
    ],
    service: localService,
    advanced: baseAdvanced,
    preferLocal: true,
  });
  assert('tired 下连续高能开心表达才建议 happy', qingningHappyBurst.suggestedMood === 'happy' && qingningHappyBurst.shouldSync, JSON.stringify(qingningHappyBurst));

  const sakuraCloseness = await evaluateMoodFromConversation({
    character: createCharacter('sakura', '纪遥', 'neutral'),
    messages: [
      msg('u1', 'user', '我想你了。', 1),
      msg('a1', 'assistant', '……我把书合上，认真看着你。这次不绕弯，我也想靠近一点。', 2),
    ],
    service: localService,
    advanced: baseAdvanced,
    preferLocal: true,
  });
  assert('纪遥强亲近不误判普通 happy', sakuraCloseness.suggestedMood !== 'happy', JSON.stringify(sakuraCloseness));

  const lunaAwkwardCare = await evaluateMoodFromConversation({
    character: createCharacter('luna', '凛夜', 'angry'),
    messages: [
      msg('u1', 'user', '你是不是不高兴了？', 1),
      msg('a1', 'assistant', '啧，别装没听见。我就是嘴硬，台阶都给你放这儿了，过来坐下。', 2),
    ],
    service: localService,
    advanced: baseAdvanced,
    preferLocal: true,
  });
  assert('凛夜啧/台阶/嘴硬维持别扭在意，不误判 sad', lunaAwkwardCare.suggestedMood === 'angry' && lunaAwkwardCare.suggestedMood !== 'sad', JSON.stringify(lunaAwkwardCare));

  const insufficient = await evaluateMoodFromConversation({
    character: createCharacter('qingning', '鹿芽', 'happy'),
    messages: [msg('u1', 'user', '在吗？', 1)],
    service: localService,
    advanced: baseAdvanced,
    preferLocal: true,
  });
  assert('上下文不足时维持当前状态', insufficient.suggestedMood === 'happy' && !insufficient.shouldSync && insufficient.confidence < 0.5, JSON.stringify(insufficient));

  global.fetch = async () => ({
    ok: true,
    json: async () => ({
      choices: [
        {
          message: {
            content: JSON.stringify({
              mood: 'happy',
              score: 86,
              reason: '模型误把温柔照顾判成开心。',
              confidence: 0.9,
              evidence: ['用户说想你', '角色递热饮'],
            }),
          },
        },
      ],
    }),
  });

  const llmConflict = await evaluateMoodFromConversation({
    character: createCharacter('qingning', '鹿芽', 'tired'),
    messages: [
      msg('u1', 'user', '想你了，今天好累。', 1),
      msg('a1', 'assistant', '那先盖好小毯子，热可可给你放手边。别硬撑，慢慢喝。', 2),
    ],
    service: {
      provider: 'custom',
      baseUrl: 'https://mock.local/v1',
      apiKey: 'debug-key',
      model: 'mock-model',
      visionModel: '',
    },
    advanced: baseAdvanced,
  });
  assert('模型误报 happy 时本地锚点校准回 tired', llmConflict.suggestedMood === 'tired' && !llmConflict.shouldSync, JSON.stringify(llmConflict));
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
