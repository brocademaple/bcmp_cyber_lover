#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const Module = require('module');
const ts = require('typescript');

const projectRoot = path.resolve(__dirname, '..');
const moduleCache = new Map();

function recentChronological(messages, count) {
  return messages
    .slice()
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, count)
    .sort((a, b) => a.timestamp - b.timestamp);
}

function loadTsModule(filePath) {
  const absolutePath = path.resolve(filePath);
  if (moduleCache.has(absolutePath)) return moduleCache.get(absolutePath);

  const source = fs.readFileSync(absolutePath, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName: absolutePath,
  }).outputText;

  const exports = {};
  const module = { exports };
  moduleCache.set(absolutePath, module.exports);

  const requireStub = (request) => {
    if (request === '../types') return {};
    if (request === '../utils/chatHistory') return { recentChronological };
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

    if (request.startsWith('.')) {
      const candidate = path.resolve(path.dirname(absolutePath), request);
      const tsPath = candidate.endsWith('.ts') ? candidate : `${candidate}.ts`;
      if (fs.existsSync(tsPath)) return loadTsModule(tsPath);
    }

    return require(request);
  };

  const wrapped = Module.wrap(compiled);
  const script = new vm.Script(wrapped, { filename: absolutePath });
  script.runInThisContext()(exports, requireStub, module, absolutePath, path.dirname(absolutePath));
  moduleCache.set(absolutePath, module.exports);
  return module.exports;
}

function message(id, role, content, timestamp) {
  return { id, role, content, timestamp };
}

function createCharacter(memoryCount = 10) {
  return {
    id: 'qingning',
    name: '鹿芽',
    avatar: '🦌',
    systemPrompt: '你是鹿芽。',
    greeting: '嗨。',
    personality: '元气',
    memories: Array.from({ length: memoryCount }, (_, index) => ({
      id: `mem_${index + 1}`,
      content: `长期记忆 ${index + 1}`,
      tags: ['测试'],
      importance: 5,
      timestamp: index + 1,
    })),
    relationshipRules: {
      affinityTriggers: [],
      memoryTriggers: ['偏好'],
      askMemoryStyle: '要记住吗？',
    },
  };
}

function createMemory(overrides = {}) {
  return {
    enabled: true,
    alwaysRetainHistory: true,
    retentionRange: 100,
    sendRange: 20,
    alwaysProvideFullMemory: true,
    specificTimeRangeHours: 24,
    autoSummarize: false,
    autoSummarizeTrigger: 'on_exit',
    memorySystemPrompt: '只记录稳定偏好和重要约定。',
    ...overrides,
  };
}

function createInput(overrides = {}) {
  const now = 1000;
  return {
    character: createCharacter(),
    userMessage: message('u_current', 'user', '我喜欢抹茶拿铁', now + 5),
    assistantMessage: message('a_current', 'assistant', '我记下你提到的抹茶拿铁。', now + 6),
    recentMessages: [
      message('u1', 'user', '旧消息 1', now + 1),
      message('a1', 'assistant', '旧消息 2', now + 2),
      message('u2', 'user', '旧消息 3', now + 3),
      message('a2', 'assistant', '新消息 4', now + 4),
      message('u_current', 'user', '新消息 5', now + 5),
      message('a_current', 'assistant', '新消息 6', now + 6),
    ],
    service: {
      provider: 'custom',
      baseUrl: 'https://mock.local/v1',
      apiKey: '',
      model: 'mock-model',
      visionModel: 'mock-model',
    },
    memory: createMemory(),
    advanced: {
      compatibilityMode: false,
      deepThinking: false,
      customRequestParams: {},
      darkMode: 'light',
      sendDelayMs: 0,
      theme: 'urbanClear',
      themeMode: 'manual',
    },
    ...overrides,
  };
}

function installMockFetch(responseContent = '{"action":"none"}') {
  const requests = [];
  const originalFetch = global.fetch;
  global.fetch = async (_url, options = {}) => {
    const body = JSON.parse(options.body);
    requests.push(body);
    return {
      ok: true,
      json: async () => ({ choices: [{ message: { content: responseContent } }] }),
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

function flattenPrompt(request) {
  return request.messages.map((item) => `${item.role}: ${item.content}`).join('\n\n');
}

function promptHasMemoryLine(prompt, content) {
  return prompt.split('\n').some((line) => line.trim() === `- ${content}`);
}

async function main() {
  const servicePath = path.join(projectRoot, 'src/services/memoryDecisionService.ts');
  const { evaluateMemoryDecisionAfterReply } = loadTsModule(servicePath);
  const checks = [];

  const noAutoCandidate = await evaluateMemoryDecisionAfterReply(createInput());
  checks.push(['自动总结关闭时，普通候选不会弹窗', noAutoCandidate.action === 'none']);

  const noAutoDirect = await evaluateMemoryDecisionAfterReply(createInput({
    userMessage: message('u_direct', 'user', '帮我记住，我喜欢抹茶拿铁', 2000),
  }));
  checks.push(['自动总结关闭时，明确要求记住仍会保存', noAutoDirect.action === 'save']);

  const autoFallback = await evaluateMemoryDecisionAfterReply(createInput({
    memory: createMemory({ autoSummarize: true, autoSummarizeTrigger: 'during' }),
  }));
  checks.push(['自动总结开启且无 LLM 时，本地候选会弹窗', autoFallback.action === 'ask']);

  const promptFetch = installMockFetch();
  try {
    await evaluateMemoryDecisionAfterReply(createInput({
      service: {
        provider: 'custom',
        baseUrl: 'https://mock.local/v1',
        apiKey: 'debug-key',
        model: 'mock-model',
        visionModel: 'mock-model',
      },
      memory: createMemory({
        autoSummarize: true,
        autoSummarizeTrigger: 'during',
        retentionRange: 3,
        alwaysProvideFullMemory: false,
        memorySystemPrompt: '只记录长期稳定偏好；不要记录普通寒暄。',
      }),
    }));

    const prompt = flattenPrompt(promptFetch.requests[0]);
    checks.push(['记忆沉淀规则进入 LLM 判断 prompt', prompt.includes('只记录长期稳定偏好；不要记录普通寒暄。')]);
    checks.push(['保留范围限制判断上下文', prompt.includes('新消息 4') && prompt.includes('新消息 5') && prompt.includes('新消息 6') && !prompt.includes('旧消息 1')]);
    checks.push([
      '关闭完整记忆库时只提供最近 8 条记忆',
      promptHasMemoryLine(prompt, '长期记忆 10') && !promptHasMemoryLine(prompt, '长期记忆 1'),
    ]);
  } finally {
    promptFetch.restore();
  }

  const fullMemoryFetch = installMockFetch();
  try {
    await evaluateMemoryDecisionAfterReply(createInput({
      service: {
        provider: 'custom',
        baseUrl: 'https://mock.local/v1',
        apiKey: 'debug-key',
        model: 'mock-model',
        visionModel: 'mock-model',
      },
      memory: createMemory({
        autoSummarize: true,
        autoSummarizeTrigger: 'during',
        alwaysProvideFullMemory: true,
      }),
    }));
    const prompt = flattenPrompt(fullMemoryFetch.requests[0]);
    checks.push([
      '开启完整记忆库时提供全部长期记忆',
      promptHasMemoryLine(prompt, '长期记忆 1') && promptHasMemoryLine(prompt, '长期记忆 10'),
    ]);
  } finally {
    fullMemoryFetch.restore();
  }

  const failed = checks.filter(([, ok]) => !ok);
  for (const [label, ok] of checks) {
    console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`);
  }

  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
