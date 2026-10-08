import { describe, expect, it } from 'vitest';
import type { Character } from '../src/types';
import { migrateLuyaPersona } from '../src/services/luyaPersonaMigration';
import { LUYA_PROFILE, LUYA_SYSTEM_PROMPT } from '../src/config/luyaPersona';

const original = (): Character => ({
  id: 'qingning', name: '鹿芽', avatar: '🦌', systemPrompt: '用户自己写的人物指令', greeting: '用户开场', personality: '用户修改',
  profile: { backstory: '用户修改背景', hobbies: ['用户兴趣'], catchphrases: ['自定义'], taboos: ['个人禁忌'], goals: ['用户目标'] },
  memories: Array.from({ length: 130 }, (_, i) => ({ id: `m${i}`, content: `记忆${i}`, timestamp: i, importance: 10, tags: [], status: 'locked' as const })),
  diaries: [{ id: 'd', period: 'daily', periodKey: '2026-09-29', title: '原日记', content: '真实日记', timestamp: 1 }],
  anniversaries: [{ id: 'a', title: '旧纪念日', date: '2026-01-01', type: 'custom' }],
  relationshipEvents: [{ id: 'e', type: 'memory', title: '旧关系事件', detail: '原文', timestamp: 1 }],
});
describe('Luya non-destructive migration', () => {
  it('preserves all user edits and long historical collections, records a pre-migration snapshot', () => {
    const old = original(); const serialized = JSON.stringify(old); const next = migrateLuyaPersona(old, 100);
    expect(JSON.stringify(old)).toBe(serialized);
    expect(next.luyaPersona?.snapshot.systemPrompt).toBe(old.systemPrompt);
    expect(next.luyaPersona?.userOverrides.profile).toEqual(old.profile);
    for (const key of ['memories', 'diaries', 'anniversaries', 'relationshipEvents', 'greeting', 'systemPrompt'] as const) expect(next[key]).toEqual(old[key]);
    expect(migrateLuyaPersona(next, 200)).toBe(next);
  });
  it('does not migrate another character or mix their data', () => {
    const other = { ...original(), id: 'sakura' }; expect(migrateLuyaPersona(other, 100)).toBe(other);
  });
  it('keeps current built-in values out of the user override layer across serialization', () => {
    const next = migrateLuyaPersona({ ...original(), systemPrompt: LUYA_SYSTEM_PROMPT, profile: LUYA_PROFILE }, 100);
    expect(next.luyaPersona?.userOverrides.systemPrompt).toBeUndefined();
    expect(next.luyaPersona?.userOverrides.profile).toBeUndefined();
    const restored = JSON.parse(JSON.stringify(next)); expect(migrateLuyaPersona(restored, 200)).toEqual(next);
  });
});
