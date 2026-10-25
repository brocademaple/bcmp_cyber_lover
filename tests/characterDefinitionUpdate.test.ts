import { describe, expect, it, vi } from 'vitest';
import type { Character, CharacterDefinitionSnapshot } from '../src/types';
import { mergeCurrentCharacterDefinition, saveCharacterDefinitionUpdate } from '../src/services/characterDefinitionUpdateService';
import { createLuyaRuntime } from '../src/services/luyaLifeService';

function character(): Character {
  return { id: 'qingning', name: '鹿芽', avatar: '🦌', systemPrompt: '当前设定', greeting: '你好', personality: '独立', definitionVersion: 2, memories: [], diaries: [], anniversaries: [], relationshipEvents: [], luyaRuntime: createLuyaRuntime(Date.parse('2026-09-29T12:00:00+08:00')) };
}
describe('definition editing across asynchronous backups', () => {
  it('preserves interaction data written while awaiting the backup', async () => {
    let current = character();
    const initial = current;
    const result = await saveCharacterDefinitionUpdate({
      getCurrent: () => current,
      backup: async () => {
        await Promise.resolve();
        current = { ...current, definitionVersion: 3,
          memories: [{ id: 'm-new', content: '备份期间刚确认的记忆', timestamp: 3, tags: [], importance: 8 }],
          diaries: [{ id: 'd-new', period: 'daily', periodKey: '2026-09-29', title: '当天', content: '备份期间刚生成的日记', timestamp: 3 }],
          relationshipEvents: [{ id: 'e-new', type: 'memory', title: '新事件', detail: '备份期间的实际互动', timestamp: 3 }],
          anniversaries: [{ id: 'a-new', title: '新纪念日', type: 'custom', date: '2026-09-30' }],
          luyaRuntime: { ...current.luyaRuntime!, room: { ...current.luyaRuntime!.room, wallColor: 'blue' }, boundaries: { ...current.luyaRuntime!.boundaries, imaginedTouch: 'declined' } },
        };
      },
      save: async (updated) => { current = updated; },
      definition: { greeting: '用户的新开场' },
    });
    expect(result.greeting).toBe('用户的新开场');
    expect(result.definitionVersion).toBe(4);
    expect(result.memories?.[0].id).toBe('m-new');
    expect(result.diaries?.[0].id).toBe('d-new');
    expect(result.relationshipEvents?.[0].id).toBe('e-new');
    expect(result.anniversaries?.[0].id).toBe('a-new');
    expect(result.luyaRuntime?.room.wallColor).toBe('blue');
    expect(result.luyaRuntime?.boundaries.imaginedTouch).toBe('declined');
    expect(initial.memories).toEqual([]);
  });
  it('rollback applies only definition fields even if an old snapshot contains extra properties', async () => {
    const current = character();
    const pollutedSnapshot = { greeting: '历史开场', id: 'different', memories: [], luyaRuntime: undefined } as Partial<CharacterDefinitionSnapshot>;
    current.memories = [{ id: 'keep', content: '保留', timestamp: 1, importance: 7, tags: [] }];
    const restored = mergeCurrentCharacterDefinition(current, pollutedSnapshot, 1);
    expect(restored.greeting).toBe('历史开场');
    expect(restored.definitionVersion).toBe(1);
    expect(restored.id).toBe('qingning');
    expect(restored.memories).toBe(current.memories);
    expect(restored.luyaRuntime).toBe(current.luyaRuntime);
  });
  it('backup failure cannot overwrite the live character', async () => {
    const save = vi.fn(); const current = character();
    await expect(saveCharacterDefinitionUpdate({ getCurrent: () => current, backup: async () => { throw new Error('backup full'); }, save, definition: { greeting: '未保存' } })).rejects.toThrow('backup full');
    expect(save).not.toHaveBeenCalled();
    expect(current.greeting).toBe('你好');
  });
  it('does not resurrect a character deleted during backup', async () => {
    let current: Character | undefined = character(); const save = vi.fn();
    await expect(saveCharacterDefinitionUpdate({ getCurrent: () => current, backup: async () => { current = undefined; }, save, definition: { greeting: '未保存' } })).rejects.toThrow('备份期间发生变化');
    expect(save).not.toHaveBeenCalled();
  });
  it('propagates a write failure instead of claiming that the definition was applied', async () => {
    const current = character();
    await expect(saveCharacterDefinitionUpdate({ getCurrent: () => current, backup: async () => undefined, save: async () => { throw new Error('save full'); }, definition: { greeting: '未保存' } })).rejects.toThrow('save full');
    expect(current.greeting).toBe('你好');
  });
});
