import AsyncStorage from '@react-native-async-storage/async-storage';

/** Additive reading-only storage. No character or chat key is read or written here. */
export const STORY_READING_KEY = '@bcmp_story_reader_v1';
export type StoryPosition = { sceneId?: string; lineIndex?: number };
export type StoryBookmark = StoryPosition & { pageIndex: number; updatedAt: number };
export function createStoryBookmark(pageIndex: number, position: StoryPosition = {}): StoryBookmark {
  return { pageIndex, ...position, updatedAt: Date.now() };
}
type ReadingState = { version: 1; entries: Record<string, StoryBookmark> };
export type ReadingSnapshot = { entries: Record<string, StoryBookmark>; writable: boolean };

export function parseReadingSnapshot(raw: string | null): ReadingSnapshot {
  if (raw === null) return { entries: {}, writable: true };
  try {
    const parsed = JSON.parse(raw) as Partial<ReadingState>;
    if (!parsed || parsed.version !== 1 || !parsed.entries || typeof parsed.entries !== 'object' || Array.isArray(parsed.entries)) return { entries: {}, writable: false };
    const entries: Record<string, StoryBookmark> = {};
    let writable = true;
    for (const [id, value] of Object.entries(parsed.entries)) {
      if (!value || !Number.isSafeInteger(value.pageIndex) || value.pageIndex < 0 || !Number.isFinite(value.updatedAt) || value.updatedAt < 0
        || (value.sceneId !== undefined && (typeof value.sceneId !== 'string' || !value.sceneId))
        || (value.lineIndex !== undefined && (!Number.isSafeInteger(value.lineIndex) || value.lineIndex < 0))) {
        writable = false;
        continue;
      }
      Object.defineProperty(entries, id, { value, enumerable: true, writable: true, configurable: true });
    }
    return { entries, writable };
  } catch { return { entries: {}, writable: false }; }
}

export function resumeStoryPage(bookmark: StoryBookmark | undefined, pageCount: number): number {
  return Math.max(0, Math.min(bookmark?.pageIndex ?? 0, Math.max(0, pageCount - 1)));
}

async function readStoredProgress(): Promise<ReadingSnapshot> {
  try { return parseReadingSnapshot(await AsyncStorage.getItem(STORY_READING_KEY)); }
  catch { return { entries: {}, writable: false }; }
}

let writes: Promise<boolean> = Promise.resolve(true);
export async function readStoryProgress(): Promise<ReadingSnapshot> {
  // A quick close/reopen waits for the previous bookmark instead of resuming stale data.
  await writes.catch(() => false);
  return readStoredProgress();
}
export function saveStoryProgress(storyId: string, pageIndex: number, position: StoryPosition = {}): Promise<boolean> {
  if (!storyId || !Number.isSafeInteger(pageIndex) || pageIndex < 0
    || (position.sceneId !== undefined && (typeof position.sceneId !== 'string' || !position.sceneId))
    || (position.lineIndex !== undefined && (!Number.isSafeInteger(position.lineIndex) || position.lineIndex < 0))) return Promise.resolve(false);
  writes = writes.catch(() => false).then(async () => {
    try {
      const current = await readStoredProgress();
      // Preserve unrecognized, future-version or damaged data for recovery.
      if (!current.writable) return false;
      const next: ReadingState = { version: 1, entries: { ...current.entries, [storyId]: createStoryBookmark(pageIndex, position) } };
      await AsyncStorage.setItem(STORY_READING_KEY, JSON.stringify(next));
      return true;
    } catch { return false; }
  });
  return writes;
}
