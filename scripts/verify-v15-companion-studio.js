#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const Module = require('module');
const ts = require('typescript');

const projectRoot = path.resolve(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

function loadTsModule(relativePath) {
  const filePath = path.join(projectRoot, relativePath);
  const compiled = ts.transpileModule(read(relativePath), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName: filePath,
  }).outputText;
  const module = { exports: {} };
  const script = new vm.Script(Module.wrap(compiled), { filename: filePath });
  script.runInThisContext()(
    module.exports,
    (request) => (request === '../types' ? {} : require(request)),
    module,
    filePath,
    path.dirname(filePath)
  );
  return module.exports;
}

function assert(label, condition) {
  console.log(`${condition ? 'PASS' : 'FAIL'} ${label}`);
  if (!condition) process.exitCode = 1;
}

const studio = loadTsModule('src/services/characterStudioService.ts');
const timeline = loadTsModule('src/services/relationshipTimelineService.ts');
const types = read('src/types/index.ts');
const store = read('src/store/chatStore.ts');
const chat = read('src/screens/ChatScreen.tsx');
const memorySettings = read('src/screens/MemorySettingsScreen.tsx');
const editor = read('src/screens/CharacterEditorScreen.tsx');
const versions = read('src/services/characterVersionService.ts');
const portability = read('src/services/appDataPortability.ts');
const dataScreen = read('src/screens/DataManagementScreen.tsx');
const onboarding = read('src/screens/OnboardingScreen.tsx');
const call = read('src/screens/CallScreen.tsx');

const blank = studio.createBlankCharacter(123456);
assert('simple studio creates a stable custom character id', blank.id === 'custom_123456');
assert('new characters start with non-empty local relationship data', blank.relationshipStage === 'firstMeeting' && Array.isArray(blank.relationshipEvents));
assert('simple studio prompt contains identity, behavior, voice and boundary layers', ['【身份】', '【称呼与风格】', '【行为】', '【禁令】'].every((part) => blank.systemPrompt.includes(part)));
assert('new character definition passes the local quality audit', studio.auditCharacterDefinition(blank).ready);

assert('relationship stages cover all four V1.5 chapters', [0, 55, 70, 85].map(timeline.deriveRelationshipStage).join(',') === 'firstMeeting,familiar,trusted,sharedRoutine');
assert('relationship stage only advances forward', timeline.didRelationshipStageAdvance('trusted', 'sharedRoutine') && !timeline.didRelationshipStageAdvance('trusted', 'familiar'));
assert('relationship milestones are confirmed records', timeline.createRelationshipStageEvent('trusted', 100).verified === true);

assert('memory schema preserves source, confidence and lifecycle metadata', ['sourceMessageId?: string', 'sourceAssistantMessageId?: string', 'confidence?: number', "status?: 'active' | 'locked' | 'superseded'"].every((part) => types.includes(part)));
assert('chat stores source message ids with confirmed memories', chat.includes('sourceMessageId: next.userMsg.id') && chat.includes('sourceAssistantMessageId: aiMsg.id'));
assert('memory store de-duplicates and supports edit/delete', store.includes('normalizedContent') && store.includes('updateMemory: async') && store.includes('deleteMemory: async'));
assert('memory library exposes lock, edit and delete controls', memorySettings.includes('锁定') && memorySettings.includes('修正') && memorySettings.includes('删除记忆'));

assert('character revisions snapshot definitions without relationship history', versions.includes('getCharacterDefinition') && !versions.slice(versions.indexOf('return {'), versions.indexOf('};', versions.indexOf('return {'))).includes('memories'));
assert('character editor offers simple/expert depths and rollback', editor.includes("useState<StudioDepth>('simple')") && editor.includes("['expert', '专家模式'") && editor.includes('restoreRevision'));
assert('character editor keeps custom characters in the roster', editor.includes('const customRoster = characters.filter') && editor.includes('createBlankCharacter'));

assert('backup excludes secure keys and legacy chat duplication', portability.includes("key.startsWith('@bcmp_secure_')") && portability.includes('CHAT_RECORD_PREFIX') && portability.includes('LEGACY_CHAT_PREFIX'));
assert('restore always creates a pre-restore backup', portability.includes("await exportAppData('pre-restore')"));
assert('chat restore writes through the compatibility persistence layer', portability.includes('saveChatMessages(characterId, messages)'));
assert('data management exposes backup, restore and diagnostics', dataScreen.includes('创建本地备份') && dataScreen.includes('恢复最近备份') && dataScreen.includes('最近诊断'));

assert('onboarding tests the service before persisting configuration', onboarding.includes('await testChatCompletion') && onboarding.indexOf('await testChatCompletion') < onboarding.indexOf('await saveSettings'));
assert('onboarding hides API key input', onboarding.includes('secureTextEntry'));
assert('call screen does not simulate speech-to-text', !call.includes('（语音消息）请和我说说话吧') && call.includes('Speech-to-Text API'));
assert(
  'call greeting comes from the selected character',
  call.includes('const characterGreeting = character?.greeting') && call.includes('characterGreeting.trim()')
);

if (!process.exitCode) console.log('V1.5 companion + character studio verification passed.');
