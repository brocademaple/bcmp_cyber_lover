#!/usr/bin/env node
// Execute the actual pure service modules, using TypeScript solely as a loader.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ts = require('typescript');
const assert = require('assert/strict');
const originalTsLoader = require.extensions['.ts'];
require.extensions['.ts'] = (module, filename) => {
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }, fileName: filename }).outputText;
  module._compile(code, filename);
};
const root = path.resolve(__dirname, '..');
const { createLuyaRuntime, advanceLuyaRuntime, buildLuyaRuntimePrompt, getLuyaLifeProjection, luyaDateKey } = require('../src/services/luyaLifeService.ts');
const hash = value => crypto.createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
const START = Date.parse('2026-09-28T09:30:00+08:00');
const DAY = 86400000;
const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  command: 'node scripts/verify-luya-life-replay.js',
  testData: 'Synthetic isolated replay. No user app storage is read or changed. No model or network requests are made.',
  timezone: 'Asia/Shanghai',
  seedTimestamp: START,
  sourceFiles: ['src/services/luyaLifeService.ts', 'src/services/luyaRelationshipService.ts', 'src/services/luyaRoomService.ts', 'src/types/luya.ts'].map(file => ({ file, sha256: hash(fs.readFileSync(path.join(root, file), 'utf8')) })),
  limitations: ['Historical time travel is deliberately blocked: runtime lacks full historical snapshots. Rewinding before updatedAt preserves storage and suppresses dynamic prompt facts. Restore time at or after the latest saved record before operating.', 'This replay verifies deterministic engine behavior and JSON round trips. It does not prove a device restart, UI rendering or real-model behavior.'],
  replays: [],
};
for (const duration of [14, 30]) {
  let direct = createLuyaRuntime(START);
  let restarted = JSON.parse(JSON.stringify(direct));
  const checkpoints = [];
  for (let day = 0; day <= duration; day++) {
    const now = START + day * DAY;
    direct = advanceLuyaRuntime(direct, now);
    restarted = advanceLuyaRuntime(JSON.parse(JSON.stringify(restarted)), now);
    const directHash = hash(direct), restartedHash = hash(restarted);
    assert.equal(directHash, restartedHash, `JSON round-trip divergence on day ${day}`);
    assert.ok(direct.life.events.every(e => e.occurredAt <= now), 'A future event leaked');
    assert.equal(new Set(direct.life.events.map(e => e.id)).size, direct.life.events.length, 'Duplicate event');
    for (const item of direct.room.items.filter(i => i.sourceType === 'luya_life_event')) assert.ok(direct.life.events.some(e => item.sourceEventIds.includes(e.id) && e.occurredAt <= item.createdAt), 'Unsourced room object');
    checkpoints.push({ day, dateKey: luyaDateKey(now), timestamp: now, eventCount: direct.life.events.length, roomObjectCount: direct.room.items.length, relationshipStage: direct.relationship.stage, internshipStage: direct.life.internshipStage, projectedFactCount: getLuyaLifeProjection(direct.life, now).facts.length, directHash, restartedHash, hashesEqual: directHash === restartedHash });
  }
  const offline = advanceLuyaRuntime(createLuyaRuntime(START), START + duration * DAY);
  assert.ok(Object.keys(offline.life.plans).length <= 4, 'Offline catch-up exceeded initial day plus 3 days');
  assert.ok(offline.life.events.length < 20, 'Offline event amplification');
  assert.equal(direct.relationship.stage, 'visitor', 'Offline life granted relationship identity');
  assert.equal(direct.life.internshipStage, 'preparing', 'Offline life advanced internship');
  assert.deepEqual(getLuyaLifeProjection(direct.life, START).facts, [], 'Rewind projected future facts');
  assert.ok(buildLuyaRuntimePrompt(direct, START).includes('时间校验'));
  assert.strictEqual(advanceLuyaRuntime(direct, START), direct);
  report.replays.push({ durationDays: duration, checkpoints, finalStateHash: hash(direct), restartHashesEqual: true, offlineCatchup: { planCount: Object.keys(offline.life.plans).length, eventCount: offline.life.events.length, relationshipStage: offline.relationship.stage, requests: 0 }, provenance: direct.room.items.filter(i => i.sourceType === 'luya_life_event').map(item => ({ itemId: item.id, sourceEventIds: item.sourceEventIds, sourceEvents: direct.life.events.filter(e => item.sourceEventIds.includes(e.id)) })), rewind: { target: START, dynamicFacts: [], prompt: buildLuyaRuntimePrompt(direct, START), mutationBlocked: true }, passed: true });
}
if (originalTsLoader) require.extensions['.ts'] = originalTsLoader;
else delete require.extensions['.ts'];
const output = path.join(root, 'docs/luya/evidence/life-replay.json');
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log(`PASS 14/30-day engine replay; wrote ${path.relative(root, output)}`);
