#!/usr/bin/env node
// Synthetic evidence only. Never read or write the user's app data.
const fs = require('fs');
const ts = require('typescript');
const crypto = require('crypto');
const assert = require('assert/strict');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
const { migrateLuyaPersona } = require('../src/services/luyaPersonaMigration.ts');
const hash = v => crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');
const before = { id: 'qingning', name: '鹿芽', avatar: '🦌', systemPrompt: '测试用户明确编辑的设定', greeting: '哟，你这家伙终于冒泡啦！今天有没有被世界欺负？跟我说说嘛～', profile: { hobbies: ['测试用户自定义：陶器'] }, memories: Array.from({length:135},(_,i)=>({id:`m${i}`,content:`测试记忆${i}`,timestamp:i,importance:5,tags:[]})), diaries: Array.from({length:145},(_,i)=>({id:`d${i}`,content:`测试日记${i}`,timestamp:i})), anniversaries:[{id:'a1',title:'测试纪念日',date:'2020-02-02',type:'custom'}], relationshipEvents: Array.from({length:140},(_,i)=>({id:`e${i}`,detail:`测试事件${i}`,timestamp:i})), emotionalState:{mood:'happy',intimacy:88,energy:76,lastInteraction:1}, relationshipStage:'sharedRoutine' };
const original = JSON.stringify(before);
const after = migrateLuyaPersona(before, Date.parse('2026-09-29T15:00:00+08:00'));
assert.equal(JSON.stringify(before), original);
const unchanged = ['id','systemPrompt','memories','diaries','anniversaries','relationshipEvents','emotionalState','relationshipStage'].map(field=>{ assert.deepEqual(after[field],before[field]); return {field,beforeHash:hash(before[field]),afterHash:hash(after[field]),equal:true,count:Array.isArray(before[field])?before[field].length:undefined}; });
assert.deepEqual(after.profile.hobbies,before.profile.hobbies);
assert.strictEqual(migrateLuyaPersona(after,Date.now()),after);
const others = ['sakura','luna','custom-test'].map(id=>({id,...{name:id,avatar:'🌱',systemPrompt:'保留',memories:[{id:'private',content:'测试资料'}]}}));
for(const other of others) assert.strictEqual(migrateLuyaPersona(other,Date.now()),other);
const result = {generatedAt:new Date().toISOString(),command:'node scripts/verify-luya-migration.js',dataKind:'Synthetic fixture. No real user data accessed. Store write-ahead and failure recovery are covered separately by tests/luyaStore.test.ts.',unchanged,otherCharactersUnchanged:others.map(c=>c.id),idempotent:true,before,after,sourceHashes:['src/services/luyaPersonaMigration.ts','src/config/luyaPersona.ts'].map(file=>({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')})),passed:true};
fs.writeFileSync('docs/luya/evidence/migration-comparison.json',JSON.stringify(result,null,2)+'\n');
console.log('PASS migration comparison: 135 memories, 145 diaries, 140 relationship events, user edits and three other characters preserved.');
