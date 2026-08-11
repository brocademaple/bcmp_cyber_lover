#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const Module = require('module');
const ts = require('typescript');

const projectRoot = path.resolve(__dirname, '..');
const utilityPath = path.join(projectRoot, 'src/utils/debugTraceExport.ts');

function loadDebugTraceExportUtils() {
  const source = fs.readFileSync(utilityPath, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName: utilityPath,
  }).outputText;

  const exports = {};
  const module = { exports };
  const wrapped = Module.wrap(compiled);
  const script = new vm.Script(wrapped, { filename: utilityPath });
  const requireStub = (request) => {
    if (request === '../types') return {};
    return require(request);
  };

  script.runInThisContext()(exports, requireStub, module, utilityPath, path.dirname(utilityPath));
  return module.exports;
}

function assert(label, condition) {
  console.log(`${condition ? 'PASS' : 'FAIL'} ${label}`);
  if (!condition) process.exitCode = 1;
}

const {
  DEBUG_TRACE_EXPORT_DIR,
  buildDebugTraceExportFileStem,
  buildDebugTraceHtml,
  buildDebugTraceMarkdown,
} = loadDebugTraceExportUtils();

const now = new Date('2026-06-24T20:15:30+08:00').getTime();
const traces = [
  {
    id: 'trace_2',
    timestamp: now + 1000,
    characterId: 'qingning',
    characterName: '鹿芽',
    userMessageId: 'user_2',
    assistantMessageId: 'assistant_2',
    userText: '帮我记住我喜欢晚上跑步。',
    model: 'mimo-v2.5-pro',
    promptSummary: '鹿芽 · 主聊天 Prompt · 4 messages · mimo-v2.5-pro',
    promptRequestSummary: [{ label: 'Model', value: 'mimo-v2.5-pro' }],
    promptSections: [{ title: '基础 Persona', content: '你是鹿芽。', active: true }],
    promptMessagesPreview: [{ role: 'system', contentPreview: '你是鹿芽。' }],
    promptNotes: ['标准模式'],
    emotionBefore: { mood: 'happy', intimacy: 50, energy: 80, lastInteraction: now },
    emotionAfter: { mood: 'happy', intimacy: 53, energy: 80, lastInteraction: now + 1000 },
    affinityDelta: 3,
    memoryDecision: 'save',
    memoryDecisionDetail: JSON.stringify({
      action: 'save',
      content: '用户喜欢晚上跑步。',
      tags: ['偏好'],
      importance: 7,
    }, null, 2),
    assistantText: '记住啦，晚上跑步这件事我会放好。',
  },
  {
    id: 'trace_1',
    timestamp: now,
    characterId: 'qingning',
    characterName: '鹿芽',
    userText: '今天有点累。',
    model: 'mimo-v2.5-pro',
    promptSummary: '鹿芽 · 主聊天 Prompt · 2 messages · mimo-v2.5-pro',
    emotionBefore: { mood: 'happy', intimacy: 50, energy: 80, lastInteraction: now },
    emotionAfter: { mood: 'tired', intimacy: 51, energy: 76, lastInteraction: now },
    affinityDelta: 1,
    memoryDecision: 'none',
    memoryDecisionDetail: JSON.stringify({ action: 'none' }, null, 2),
    assistantText: '那先坐一下，我陪你把今天放慢一点。',
  },
];

const markdown = buildDebugTraceMarkdown(traces, now);
const html = buildDebugTraceHtml(traces, now);
const fileStem = buildDebugTraceExportFileStem(now);

assert('export dir points to docs/private/chat-logic', DEBUG_TRACE_EXPORT_DIR === 'docs/private/chat-logic');
assert('file stem is stable and local-time based', fileStem === 'debug-turn-traces-20260624-201530');
assert('markdown includes user message', markdown.includes('帮我记住我喜欢晚上跑步。'));
assert('markdown includes prompt summary', markdown.includes('Prompt 摘要') && markdown.includes('主聊天 Prompt'));
assert('markdown includes memory decision detail', markdown.includes('"action": "save"') && markdown.includes('用户喜欢晚上跑步'));
assert('markdown includes emotion before and after', markdown.includes('Emotion') || (markdown.includes('Before') && markdown.includes('After')));
assert('markdown includes assistant reply and timestamp', markdown.includes('记住啦') && markdown.includes('2026'));
assert('markdown sorts traces chronologically', markdown.indexOf('今天有点累') < markdown.indexOf('帮我记住我喜欢晚上跑步'));
assert('html renders exported content', html.includes('<!doctype html>') && html.includes('AI 调试台真实 Turn Trace'));
