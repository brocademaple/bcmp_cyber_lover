import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parseReadingSnapshot, readStoryProgress, resumeStoryPage, saveStoryProgress, STORY_READING_KEY } from '../src/services/storyReadingProgress';

const storage = vi.hoisted(() => ({ value: null as string | null, getItem: vi.fn(), setItem: vi.fn() }));
vi.mock('@react-native-async-storage/async-storage', () => ({ default: { getItem: storage.getItem, setItem: storage.setItem } }));

beforeEach(() => {
  storage.value = null;
  storage.getItem.mockReset().mockImplementation(async () => storage.value);
  storage.setItem.mockReset().mockImplementation(async (_key: string, value: string) => { storage.value = value; });
});

describe('story reading progress is isolated and recoverable', () => {
  it('adds precise scene progress while preserving old page-only bookmarks', async () => {
    storage.value = '{"version":1,"entries":{"older":{"pageIndex":1,"updatedAt":5}}}';
    expect((await readStoryProgress()).entries.older).toEqual({ pageIndex: 1, updatedAt: 5 });
    expect(await saveStoryProgress('newer', 1, { sceneId: 'page:scene', lineIndex: 2 })).toBe(true);
    const snapshot = await readStoryProgress();
    expect(snapshot.entries.older).toEqual({ pageIndex: 1, updatedAt: 5 });
    expect(snapshot.entries.newer.sceneId).toBe('page:scene');
    expect(snapshot.entries.newer.lineIndex).toBe(2);
  });
  it('preserves damaged fine-grained progress and refuses invalid writes', async () => {
    const raw = '{"version":1,"entries":{"first":{"pageIndex":1,"updatedAt":5,"lineIndex":-1}}}';
    storage.value = raw;
    expect(await saveStoryProgress('first', 1, { sceneId: 'valid', lineIndex: 0 })).toBe(false);
    expect(storage.value).toBe(raw);
    expect(await saveStoryProgress('first', 1, { sceneId: '', lineIndex: 0 })).toBe(false);
  });
  it('waits for an in-flight bookmark when reopening immediately', async () => {
    const saving = saveStoryProgress('quick-reopen', 1);
    expect((await readStoryProgress()).entries['quick-reopen'].pageIndex).toBe(1);
    expect(await saving).toBe(true);
  });
  it('serializes rapid changes without losing another book or reading chat keys', async () => {
    const results = await Promise.all([saveStoryProgress('first', 0), saveStoryProgress('second', 1), saveStoryProgress('first', 1)]);
    expect(results).toEqual([true, true, true]);
    const snapshot = await readStoryProgress();
    expect(snapshot.entries.first.pageIndex).toBe(1);
    expect(snapshot.entries.second.pageIndex).toBe(1);
    expect(storage.getItem.mock.calls.every(([key]) => key === STORY_READING_KEY)).toBe(true);
    expect(storage.setItem.mock.calls.every(([key]) => key === STORY_READING_KEY)).toBe(true);
  });

  it.each(['broken-json', '{"version":2,"entries":{"future":{"pageIndex":7}}}', '{"version":1,"entries":{"bad":{"pageIndex":-1,"updatedAt":1}}}'])('preserves unknown or damaged storage: %s', async (raw) => {
    storage.value = raw;
    expect(await saveStoryProgress('first', 1)).toBe(false);
    expect(storage.value).toBe(raw);
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('keeps readable entries when one entry is damaged and prevents a lossy write', () => {
    const parsed = parseReadingSnapshot('{"version":1,"entries":{"good":{"pageIndex":1,"updatedAt":5},"bad":null}}');
    expect(parsed.entries.good.pageIndex).toBe(1);
    expect(parsed.writable).toBe(false);
  });

  it('clamps an old bookmark when a chapter has fewer pages', () => {
    expect(resumeStoryPage({ pageIndex: 7, updatedAt: 1 }, 2)).toBe(1);
    expect(resumeStoryPage(undefined, 2)).toBe(0);
    expect(resumeStoryPage({ pageIndex: 1, updatedAt: 1 }, 0)).toBe(0);
  });

  it('recovers from storage failures without overwriting any stored content', async () => {
    storage.getItem.mockRejectedValueOnce(new Error('read unavailable'));
    expect(await saveStoryProgress('first', 1)).toBe(false);
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(await saveStoryProgress('first', 1)).toBe(true);
  });

  it('rejects invalid navigation positions before accessing storage', async () => {
    expect(await saveStoryProgress('first', NaN)).toBe(false);
    expect(await saveStoryProgress('', 0)).toBe(false);
    expect(storage.getItem).not.toHaveBeenCalled();
  });
});
