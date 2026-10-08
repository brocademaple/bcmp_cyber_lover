import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Character, Message } from '../src/types';
import { observeLuyaUnderstanding } from '../src/services/luyaUnderstandingService';

const fixture = vi.hoisted(() => ({
  storage: new Map<string, string>(), writes: [] as { key: string; value: string }[],
  failBackup: false, failCharacters: false, now: Date.parse('2026-09-29T14:00:00+08:00'),
  chats: new Map<string, Message[]>(), issues: [] as string[],
}));
vi.mock('@react-native-async-storage/async-storage', () => ({ default: {
  getItem: vi.fn(async (key: string) => fixture.storage.get(key) ?? null),
  setItem: vi.fn(async (key: string, value: string) => {
    if (fixture.failBackup && key === '@bcmp_luya_pre_v2_characters') throw new Error('backup disk full');
    if (fixture.failCharacters && key === '@bcmp_characters') throw new Error('characters disk full');
    fixture.writes.push({ key, value }); fixture.storage.set(key, value);
  }),
  removeItem: vi.fn(async (key: string) => { fixture.storage.delete(key); }),
} }));
vi.mock('../src/store/settingsStore', () => ({ useSettingsStore: { getState: () => ({ settings: { advanced: { debugNowTs: fixture.now }, selectedCharacterId: 'qingning' } }) } }));
vi.mock('../src/services/appDiagnostics', () => ({ recordAppIssue: vi.fn(async (scope: string) => { fixture.issues.push(scope); }) }));
vi.mock('../src/utils/characterAssets', () => {
  const assetSet = { main: 1, avatar: 2, headshot: 3, idleFrames: [4, 5], memoryScene: 6 };
  return {
    DEFAULT_CHARACTER_ASSETS: { qingning: { assetSet }, sakura: { assetSet }, luna: { assetSet } },
    resolveDefaultCharacterAssetKey: (c: Character) => ['qingning', 'sakura', 'luna'].includes(c.id) ? c.id : undefined,
  };
});
vi.mock('../src/services/chatPersistence', () => ({
  loadChatMessages: vi.fn(async (id: string) => fixture.chats.get(id) ?? []),
  saveChatMessages: vi.fn(async (id: string, messages: Message[]) => { fixture.chats.set(id, messages); }),
  clearChatMessages: vi.fn(async (id: string) => { fixture.chats.delete(id); }),
}));

async function freshStore() {
  vi.resetModules();
  return (await import('../src/store/chatStore')).useChatStore;
}
async function legacyFixture() {
  const { DEFAULT_CHARACTERS } = await import('../src/store/chatStore');
  const luya: Character = {
    ...DEFAULT_CHARACTERS[0],
    greeting: '哟，你这家伙终于冒泡啦！今天有没有被世界欺负？跟我说说嘛～',
    personality: '元气、嘴甜、黏人、小恶魔式可爱',
    systemPrompt: '用户亲自补写的人物说明：保留这句话。',
    profile: { ...DEFAULT_CHARACTERS[0].profile!, hobbies: ['用户自定义：做陶器'] },
    emotionalState: { mood: 'happy', intimacy: 88, energy: 76, lastInteraction: fixture.now - 1000 },
    relationshipStage: 'sharedRoutine',
    memories: Array.from({ length: 135 }, (_, i) => ({ id: `old_memory_${i}`, content: `原有记忆 ${i}`, tags: ['旧数据'], importance: 5, timestamp: fixture.now - i * 86400000 })),
    relationshipEvents: Array.from({ length: 140 }, (_, i) => ({ id: `old_event_${i}`, type: 'memory', title: `事件 ${i}`, detail: `原有事件 ${i}`, timestamp: fixture.now - i * 86400000 })),
    diaries: Array.from({ length: 145 }, (_, i) => ({ id: `old_diary_${i}`, period: 'daily', periodKey: `2020-fixture-${i}`, title: `日记 ${i}`, content: `原有日记 ${i}`, timestamp: Date.parse('2020-01-01') + i * 86400000 })),
    anniversaries: [{ id: 'ann_old', title: '旧纪念日', date: '2020-02-02', type: 'custom' }],
  };
  const others = [DEFAULT_CHARACTERS[1], DEFAULT_CHARACTERS[2], { ...DEFAULT_CHARACTERS[2], id: 'my_custom', name: '用户自建人物', memories: [{ id: 'custom_memory', content: '自建人物记忆', importance: 9, timestamp: 1, tags: [] }] }];
  return [luya, ...others];
}
const persisted = () => JSON.parse(fixture.storage.get('@bcmp_characters')!) as Character[];

describe('鹿芽迁移与真实 store 持久化边界', () => {
  beforeEach(() => {
    fixture.storage.clear(); fixture.writes.length = 0; fixture.chats.clear(); fixture.issues.length = 0;
    fixture.failBackup = false; fixture.failCharacters = false;
  });
  it('fresh data creates v2 layers and runtime without fabricating shared history', async () => {
    const store = await freshStore(); await store.getState().loadCharacters();
    const luya = store.getState().getCharacter('qingning')!;
    expect(luya.luyaPersona?.schemaVersion).toBe(2);
    expect(luya.luyaPersona?.userOverrides).toEqual({});
    expect(luya.luyaRuntime?.relationship.stage).toBe('visitor');
    expect(luya.luyaRuntime?.understandings).toEqual([]);
    expect(luya.memories).toEqual([]);
    expect(persisted().map(c => c.id)).toEqual(['qingning', 'sakura', 'luna']);
  });
  it('backs up the exact stored bytes before first migration; user edits and others survive', async () => {
    const store = await freshStore(); const input = await legacyFixture(); const original = JSON.stringify(input);
    fixture.storage.set('@bcmp_characters', original);
    await store.getState().loadCharacters();
    expect(fixture.writes[0]).toEqual({ key: '@bcmp_luya_pre_v2_characters', value: original });
    expect(fixture.writes[1].key).toBe('@bcmp_characters');
    const luya = persisted()[0];
    expect(luya.id).toBe('qingning');
    expect(luya.greeting).not.toContain('终于冒泡');
    expect(luya.systemPrompt).toBe(input[0].systemPrompt);
    expect(luya.profile?.hobbies).toEqual(['用户自定义：做陶器']);
    expect(luya.luyaPersona?.snapshot.greeting).toBe(input[0].greeting);
    expect(luya.luyaPersona?.userOverrides.systemPrompt).toBe(input[0].systemPrompt);
    expect(luya.relationshipStage).toBe('sharedRoutine');
    expect(luya.emotionalState?.intimacy).toBe(88);
    expect(luya.memories).toEqual(input[0].memories);
    expect(luya.anniversaries).toEqual(input[0].anniversaries);
    expect(persisted().slice(1)).toEqual(input.slice(1));
  });
  it('aborts upgrade if write-ahead backup cannot be written', async () => {
    const store = await freshStore(); const original = JSON.stringify(await legacyFixture());
    fixture.storage.set('@bcmp_characters', original); fixture.failBackup = true;
    await store.getState().loadCharacters();
    expect(fixture.storage.get('@bcmp_characters')).toBe(original);
    expect(fixture.writes).toEqual([]);
    expect(store.getState().charactersLoaded).toBe(false);
    expect(fixture.issues).toContain('角色加载');
  });
  it('does not overwrite malformed persisted input with fresh defaults', async () => {
    const store = await freshStore(); fixture.storage.set('@bcmp_characters', '{broken JSON');
    await store.getState().loadCharacters();
    expect(fixture.storage.get('@bcmp_characters')).toBe('{broken JSON');
    expect(store.getState().charactersLoaded).toBe(false);
    expect(fixture.writes).toEqual([]);
  });
  it('keeps more than 130 memories, relationship events and diaries through additive updates', async () => {
    const store = await freshStore(); const input = await legacyFixture(); fixture.storage.set('@bcmp_characters', JSON.stringify(input));
    await store.getState().loadCharacters();
    await store.getState().addMemory('qingning', '一条新的已确认记忆', [], 7, { sourceMessageId: 'u_new' });
    await store.getState().addRelationshipEvent('qingning', { id: 'new_event', type: 'promise', title: '新的约定', detail: '来源于真实对话', timestamp: fixture.now, sourceMessageIds: ['u_new'] });
    await store.getState().addMessage('qingning', { id: 'u_new', role: 'user', content: '今天认真完成一个工作', timestamp: fixture.now - 100 });
    await store.getState().addMessage('qingning', { id: 'a_new', role: 'assistant', content: '这一段做完了。', timestamp: fixture.now });
    await store.getState().generateDiariesForCharacter('qingning');
    const luya = persisted()[0];
    expect(luya.memories).toHaveLength(136);
    expect(luya.relationshipEvents).toHaveLength(142);
    expect(luya.diaries).toHaveLength(148);
    expect(luya.memories?.slice(0, 135)).toEqual(input[0].memories);
    expect(luya.relationshipEvents?.slice(0, 140)).toEqual(input[0].relationshipEvents);
    for (const old of input[0].diaries!) expect(luya.diaries).toContainEqual(old);
  });
  it('concurrent runtime and memory updates both persist and survive a fresh module restart', async () => {
    const store = await freshStore(); fixture.storage.set('@bcmp_characters', JSON.stringify(await legacyFixture()));
    await store.getState().loadCharacters();
    const backup = fixture.storage.get('@bcmp_luya_pre_v2_characters');
    const candidate = observeLuyaUnderstanding([], { id: 'u_pref', role: 'user', content: '先听我说', timestamp: fixture.now });
    await Promise.all([
      store.getState().updateLuyaRuntime(runtime => ({ ...runtime, understandings: candidate, room: { ...runtime.room, wallColor: 'blue' } })),
      store.getState().addMemory('qingning', '并发时保存的新记忆', [], 8, { sourceMessageId: 'u_new' }),
      store.getState().addAnniversary('qingning', '并发时保存的日期', '2026-10-01', 'custom'),
    ]);
    const snapshot = persisted()[0];
    expect(snapshot.luyaRuntime?.room.wallColor).toBe('blue');
    expect(snapshot.luyaRuntime?.understandings).toEqual(candidate);
    expect(snapshot.memories?.at(-1)?.content).toBe('并发时保存的新记忆');
    expect(snapshot.anniversaries?.at(-1)?.title).toBe('并发时保存的日期');
    const restarted = await freshStore(); await restarted.getState().loadCharacters();
    const loaded = restarted.getState().getCharacter('qingning')!;
    expect(loaded.luyaRuntime?.room.wallColor).toBe('blue');
    expect(loaded.luyaRuntime?.understandings).toEqual(candidate);
    expect(loaded.memories).toEqual(snapshot.memories);
    expect(loaded.diaries).toEqual(snapshot.diaries);
    expect(loaded.relationshipEvents).toEqual(snapshot.relationshipEvents);
    expect(fixture.storage.get('@bcmp_luya_pre_v2_characters')).toBe(backup);
  });
  it('explicit edits after migration are saved in user overrides and not replaced on restart', async () => {
    const store = await freshStore(); await store.getState().loadCharacters();
    const luya = store.getState().getCharacter('qingning')!;
    await store.getState().saveCharacter({ ...luya, greeting: '这是用户写的新开场', profile: { ...luya.profile!, hobbies: ['陶器', '散步'] } });
    const restart = await freshStore(); await restart.getState().loadCharacters();
    const restored = restart.getState().getCharacter('qingning')!;
    expect(restored.greeting).toBe('这是用户写的新开场');
    expect(restored.luyaPersona?.userOverrides.greeting).toBe('这是用户写的新开场');
    expect(restored.profile?.hobbies).toEqual(['陶器', '散步']);
    expect(restored.luyaPersona?.userOverrides.profile?.hobbies).toEqual(['陶器', '散步']);
  });

  it('new memories and anniversaries remain uniquely addressable under frozen debug time', async () => {
    const store = await freshStore(); await store.getState().loadCharacters();
    await Promise.all([
      store.getState().addMemory('qingning', '第一条独立记忆', [], 7),
      store.getState().addMemory('qingning', '第二条独立记忆', [], 7),
      store.getState().addAnniversary('qingning', '第一个日子', '2026-10-01', 'custom'),
      store.getState().addAnniversary('qingning', '第二个日子', '2026-10-02', 'custom'),
    ]);
    const luya = persisted()[0];
    expect(new Set(luya.memories?.map(m => m.id)).size).toBe(2);
    expect(new Set(luya.anniversaries?.map(m => m.id)).size).toBe(2);
    expect(new Set(luya.relationshipEvents?.map(m => m.id)).size).toBe(4);
  });
  it('runtime update surfaces disk failure and rolls back the unsaved in-memory state', async () => {
    const store = await freshStore(); await store.getState().loadCharacters();
    const before = store.getState().getCharacter('qingning')!.luyaRuntime;
    const persistedBefore = fixture.storage.get('@bcmp_characters');
    fixture.failCharacters = true;
    await expect(store.getState().updateLuyaRuntime(runtime => ({ ...runtime, room: { ...runtime.room, wallColor: 'blue' } }))).rejects.toThrow('characters disk full');
    expect(store.getState().getCharacter('qingning')!.luyaRuntime).toEqual(before);
    expect(fixture.storage.get('@bcmp_characters')).toBe(persistedBefore);
    expect(fixture.issues).toContain('角色保存');
  });
  it('preserves migration backup and original data when migrated write fails', async () => {
    const store = await freshStore(); const original = JSON.stringify(await legacyFixture());
    fixture.storage.set('@bcmp_characters', original); fixture.failCharacters = true;
    await store.getState().loadCharacters();
    expect(fixture.storage.get('@bcmp_luya_pre_v2_characters')).toBe(original);
    expect(fixture.storage.get('@bcmp_characters')).toBe(original);
    expect(store.getState().charactersLoaded).toBe(false);
  });
});
