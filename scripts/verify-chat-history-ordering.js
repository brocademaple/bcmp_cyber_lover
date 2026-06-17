#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const Module = require('module');
const ts = require('typescript');

const projectRoot = path.resolve(__dirname, '..');
const utilityPath = path.join(projectRoot, 'src/utils/chatHistory.ts');

function loadChatHistoryUtils() {
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

function ids(messages) {
  return messages.map((message) => message.id).join(',');
}

const {
  buildChatArchives,
  filterByDate,
  getDateKey,
  isNewestFirst,
  newestFirst,
  oldestFirst,
  recentChronological,
  searchMessages,
} = loadChatHistoryUtils();

const day1Morning = new Date('2026-06-14T09:00:00+08:00').getTime();
const day1Night = new Date('2026-06-14T22:00:00+08:00').getTime();
const day2Morning = new Date('2026-06-15T08:00:00+08:00').getTime();
const day2Night = new Date('2026-06-15T21:00:00+08:00').getTime();

const mixed = [
  { id: 'm2', role: 'assistant', content: '今天晚上散步。', timestamp: day1Night },
  { id: 'm4', role: 'assistant', content: '晚安，明天见。', timestamp: day2Night },
  { id: 'm1', role: 'user', content: '早上好', timestamp: day1Morning },
  { id: 'm3', role: 'user', content: '明天要开会', timestamp: day2Morning },
  { id: 'm5', role: 'user', content: '这条失败', timestamp: day2Night + 1000, status: 'failed' },
];

const newest = newestFirst(mixed);
const oldest = oldestFirst(mixed);
const recent = recentChronological(mixed, 2);
const dateKey = getDateKey(day2Morning);
const dateMessages = filterByDate(mixed, dateKey);
const searchResults = searchMessages(mixed, '明天', 'user');
const archives = buildChatArchives('luna', mixed);

assert('newestFirst puts latest message first', ids(newest).startsWith('m5,m4'));
assert('isNewestFirst recognizes normalized storage order', isNewestFirst(newest));
assert('oldestFirst keeps display/API order chronological', ids(oldest).startsWith('m1,m2'));
assert('recentChronological returns the newest N in chronological order', ids(recent) === 'm4,m5');
assert('filterByDate returns only one local calendar day in chronological order', ids(dateMessages) === 'm3,m4,m5');
assert('searchMessages filters by query and sender role', ids(searchResults) === 'm3');
assert('buildChatArchives excludes failed messages from counts', archives[0].messageCount === 2);
assert('buildChatArchives keeps latest archive first', archives[0].dateKey === dateKey);
