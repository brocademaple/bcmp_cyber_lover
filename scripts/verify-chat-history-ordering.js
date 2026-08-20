#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const Module = require('module');
const ts = require('typescript');

const projectRoot = path.resolve(__dirname, '..');
const utilityPath = path.join(projectRoot, 'src/utils/chatHistory.ts');
const chatScreenPath = path.join(projectRoot, 'src/screens/ChatScreen.tsx');
const chatBubblePath = path.join(projectRoot, 'src/components/ChatBubble.tsx');
const chatPersistencePath = path.join(projectRoot, 'src/services/chatPersistence.ts');
const sqliteNativePath = path.join(projectRoot, 'src/services/sqliteChatStorage.native.ts');
const sqliteFallbackPath = path.join(projectRoot, 'src/services/sqliteChatStorage.ts');

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
  { id: 'm2', role: 'assistant', content: '今天晚上散步。', timestamp: day1Night, characterMood: 'neutral' },
  { id: 'm4', role: 'assistant', content: '晚安，明天见。', timestamp: day2Night, characterMood: 'tired' },
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
const displayWithMoodEntry = oldestFirst([
  { id: 'later_user', role: 'user', content: '想你了', timestamp: day2Night },
  { id: 'mood_entry', role: 'assistant', content: '低电量问候', timestamp: day2Morning },
  { id: 'later_assistant', role: 'assistant', content: '我也想你', timestamp: day2Night + 1000 },
]);

assert('newestFirst puts latest message first', ids(newest).startsWith('m5,m4'));
assert('isNewestFirst recognizes normalized storage order', isNewestFirst(newest));
assert('oldestFirst keeps display/API order chronological', ids(oldest).startsWith('m1,m2'));
assert('recentChronological returns the newest N in chronological order', ids(recent) === 'm4,m5');
assert('filterByDate returns only one local calendar day in chronological order', ids(dateMessages) === 'm3,m4,m5');
assert('searchMessages filters by query and sender role', ids(searchResults) === 'm3');
assert('buildChatArchives excludes failed messages from counts', archives[0].messageCount === 2);
assert('buildChatArchives keeps latest archive first', archives[0].dateKey === dateKey);
assert('mood entry display messages sort by timestamp with chat history', ids(displayWithMoodEntry) === 'mood_entry,later_user,later_assistant');
assert('message ordering preserves the assistant mood snapshot', newest.find((message) => message.id === 'm4')?.characterMood === 'tired');

const chatScreen = fs.readFileSync(chatScreenPath, 'utf8');
const chatBubble = fs.readFileSync(chatBubblePath, 'utf8');
const chatPersistence = fs.readFileSync(chatPersistencePath, 'utf8');
const sqliteNative = fs.readFileSync(sqliteNativePath, 'utf8');
const sqliteFallback = fs.readFileSync(sqliteFallbackPath, 'utf8');

assert(
  'ChatScreen waits for persisted history before writing first greeting',
  chatScreen.includes('historyLoadedCharacterId !== characterId') &&
    chatScreen.includes('loadMessages(characterId).finally')
);
assert(
  'ChatScreen merges mood entry into chronological display order',
  chatScreen.includes('function buildDisplayMessages') &&
    chatScreen.includes('oldestFirst([...chatMessages, moodEntryMessage])') &&
    !chatScreen.includes('displayMessages.push(moodEntryMessage)')
);
assert(
  'ChatScreen snapshots the character mood used for each persisted assistant reply',
  chatScreen.includes("characterMood: latestCharacter.emotionalState?.mood ?? 'neutral'") &&
    chatScreen.includes('characterMood: moodEntryMood')
);
assert(
  'ChatBubble shows full assistant date-time and the captured reply mood',
  chatBubble.includes("isUser ? 'HH:mm' : 'yyyy-MM-dd HH:mm'") &&
    chatBubble.includes('getMoodStateLabel(message.characterMood)') &&
    chatBubble.includes('回复时心情')
);
assert(
  'chatPersistence reads durable file snapshots during recovery',
  chatPersistence.includes('readBackupSnapshotMessageSources(characterId)') &&
    chatPersistence.includes('readDirectoryAsync(snapshotDir)')
);
assert(
  'chatPersistence writes capped durable file snapshots on save',
  chatPersistence.includes('writeBackupSnapshot(characterId, serialized, now)') &&
    chatPersistence.includes('MAX_BACKUP_SNAPSHOTS_PER_CHARACTER')
);
assert(
  'native chat storage uses SQLite as the primary local message store',
  sqliteNative.includes("import * as SQLite from 'expo-sqlite'") &&
    sqliteNative.includes('SQLite.openDatabaseAsync') &&
    sqliteNative.includes('CREATE TABLE IF NOT EXISTS messages') &&
    chatPersistence.includes('readSqliteMessages(characterId)')
);
assert(
  'web/default chat storage avoids static expo-sqlite imports',
  !chatPersistence.includes("from 'expo-sqlite'") &&
    !sqliteFallback.includes("from 'expo-sqlite'") &&
    sqliteFallback.includes('return []')
);
assert(
  'chatPersistence keeps legacy AsyncStorage migration sources readable',
  chatPersistence.includes('readStorageMessages(getRecordKey(characterId))') &&
    chatPersistence.includes('readStorageMessages(getLegacyKey(characterId))')
);
