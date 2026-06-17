#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const Module = require('module');
const ts = require('typescript');

const projectRoot = path.resolve(__dirname, '..');
const aiServicePath = path.join(projectRoot, 'src/services/aiService.ts');

function loadAiServiceForNode() {
  const source = fs.readFileSync(aiServicePath, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName: aiServicePath,
  }).outputText;

  const exports = {};
  const module = { exports };
  const wrapped = Module.wrap(compiled);
  const script = new vm.Script(wrapped, { filename: aiServicePath });
  const requireStub = (request) => {
    if (request === '../store/settingsStore') {
      return {
        PROVIDER_CONFIGS: {
          custom: { baseUrl: '', label: 'Custom', defaultModel: '' },
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
    if (request === '../types') {
      return {};
    }
    return require(request);
  };

  script.runInThisContext()(exports, requireStub, module, aiServicePath, path.dirname(aiServicePath));
  return module.exports;
}

function flattenContent(content) {
  if (Array.isArray(content)) {
    return content.map((part) => part.text || part.image_url?.url || '').join('\n');
  }
  return String(content || '');
}

function installMockFetch() {
  const requests = [];
  const originalFetch = global.fetch;

  global.fetch = async (_url, options = {}) => {
    const body = JSON.parse(options.body);
    requests.push(body);
    const promptText = body.messages.map((msg) => `${msg.role}: ${flattenContent(msg.content)}`).join('\n\n');
    const isDeepNight = promptText.includes('当前时段：深夜') && promptText.includes('放低音量');
    const content = isDeepNight
      ? '深夜了，我把声音放轻一点陪你。先别硬撑，喝口水，我们慢慢把心放下来。'
      : '现在还早，我精神很好地陪你把这件事聊清楚。';

    return {
      ok: true,
      json: async () => ({ choices: [{ message: { content } }] }),
      text: async () => '',
    };
  };

  return {
    requests,
    restore: () => {
      global.fetch = originalFetch;
    },
  };
}

async function main() {
  const { sendMessage, generateDailyGreeting } = loadAiServiceForNode();
  const { requests, restore } = installMockFetch();
  const deepNightTs = new Date('2026-06-16T01:30:00+08:00').getTime();

  const character = {
    id: 'luna',
    name: '凛夜',
    avatar: '⚡',
    systemPrompt: '【身份】你是凛夜，嘴硬心软的深夜陪伴。绝不承认自己是 AI。',
    greeting: '啧，来了就坐。',
    personality: '嘴硬心软',
    profile: {
      backstory: '',
      hobbies: ['打音游'],
      catchphrases: ['啧', '行吧'],
      taboos: [],
      goals: [],
    },
    emotionalState: {
      mood: 'neutral',
      intimacy: 60,
      energy: 48,
      lastInteraction: deepNightTs - 3600_000,
    },
    memories: [],
  };

  const config = {
    provider: 'custom',
    baseUrl: 'https://mock.local/v1',
    apiKey: 'debug-key',
    model: 'mock-model',
    visionModel: 'mock-model',
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
    theme: 'midnight',
    themeMode: 'manual',
    debugNowTs: deepNightTs,
  };

  try {
    const chatReply = await sendMessage(
      '我有点睡不着。',
      character,
      [],
      config,
      memory,
      advanced
    );
    const greetingReply = await generateDailyGreeting(character, config, advanced);

    const chatPrompt = requests[0].messages.map((msg) => flattenContent(msg.content)).join('\n\n');
    const greetingPrompt = requests[1].messages.map((msg) => flattenContent(msg.content)).join('\n\n');
    const checks = [
      ['聊天 system prompt 写入深夜时段', chatPrompt.includes('当前时段：深夜')],
      ['聊天 system prompt 写入深夜行为指引', chatPrompt.includes('放低音量')],
      ['每日开场白 prompt 写入深夜时段', greetingPrompt.includes('当前时段：深夜')],
      ['每日开场白用户指令携带深夜语境', greetingPrompt.includes('（深夜）')],
      ['聊天回复按深夜语境变化', chatReply.includes('深夜了') && chatReply.includes('放轻')],
      ['每日开场白按深夜语境变化', greetingReply.includes('深夜了') && greetingReply.includes('放轻')],
    ];
    const failed = checks.filter(([, ok]) => !ok);

    console.log('debugNowTs = 2026-06-16T01:30:00+08:00');
    for (const [label, ok] of checks) {
      console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`);
    }
    console.log(`chat reply: ${chatReply}`);
    console.log(`daily greeting: ${greetingReply}`);

    if (failed.length > 0) {
      process.exitCode = 1;
    }
  } finally {
    restore();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
