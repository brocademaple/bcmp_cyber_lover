#!/usr/bin/env node

const fs = require('fs');

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function assert(label, condition) {
  console.log(`${condition ? 'PASS' : 'FAIL'} ${label}`);
  if (!condition) process.exitCode = 1;
}

const persistence = read('src/services/chatPersistence.ts');
const sqlite = read('src/services/sqliteChatStorage.native.ts');
const chat = read('src/screens/ChatScreen.tsx');
const call = read('src/screens/CallScreen.tsx');
const portability = read('src/services/appDataPortability.ts');
const packageJson = JSON.parse(read('package.json'));

assert('recovery uses explicit source priority', persistence.includes('mergeMessageSourcesByPriority'));
assert('normal SQLite writes do not delete the conversation first', !sqlite.includes("DELETE FROM messages WHERE character_id = ?', [characterId]);\n    for"));
assert('pending sends are persisted before processing', chat.includes('enqueuePendingSend(pendingSend)'));
assert('chat generation receives an abort signal', chat.includes('requestController.signal'));
assert('backup schema includes checksum and media', portability.includes('checksum: bundleChecksum(payload)') && portability.includes('mediaFiles'));
assert('interrupted restore rolls back from its safety backup', portability.includes('recoverInterruptedRestore') && portability.includes('safetyBackupUri'));
assert('lockfile is expected by npm ci', !read('.gitignore').split(/\r?\n/).includes('package-lock.json'));
assert('CI verification command exists', typeof packageJson.scripts.verify === 'string');
assert('lint warnings fail CI', packageJson.scripts.lint.includes('--max-warnings=0'));
assert(
  'call connection timer is cleared on unmount',
  call.includes('connectionTimerRef.current') && call.includes('clearTimeout(connectionTimerRef.current)')
);
