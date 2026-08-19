import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  enqueuePendingSend,
  loadPendingSends,
  markPendingSendAttempt,
  removePendingSend,
} from '../src/services/sendQueuePersistence';

const { storage } = vi.hoisted(() => ({ storage: new Map<string, string>() }));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => storage.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => { storage.set(key, value); }),
  },
}));

describe('durable send queue', () => {
  beforeEach(() => storage.clear());

  it('survives a module-level enqueue/load cycle and tracks attempts', async () => {
    await enqueuePendingSend({
      characterId: 'luna',
      userMsg: { id: 'm1', role: 'user', content: 'hello', timestamp: 1, status: 'queued' },
      enqueuedAt: 10,
      attempts: 0,
    });
    await markPendingSendAttempt('m1');

    expect(await loadPendingSends('luna')).toMatchObject([
      { characterId: 'luna', attempts: 1, userMsg: { id: 'm1', status: 'queued' } },
    ]);

    await removePendingSend('m1');
    expect(await loadPendingSends('luna')).toEqual([]);
  });
});
