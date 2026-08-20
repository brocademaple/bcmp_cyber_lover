import { describe, expect, it } from 'vitest';
import { mergeMessageSourcesByPriority } from '../src/services/chatMerge';
import { Message } from '../src/types';

function message(id: string, status: Message['status'], content = id): Message {
  return { id, role: 'user', content, timestamp: Number(id.replace(/\D/g, '')) || 1, status };
}

describe('chat recovery source priority', () => {
  it('keeps the canonical status when an older snapshot contains the same message', () => {
    const sqlite = [message('m2', 'sent', 'current')];
    const newestSnapshot = [message('m2', 'sending', 'snapshot')];
    const oldestSnapshot = [message('m2', 'queued', 'oldest')];

    const merged = mergeMessageSourcesByPriority([sqlite, newestSnapshot, oldestSnapshot]);

    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ status: 'sent', content: 'current' });
  });

  it('recovers messages that only exist in a lower-priority backup', () => {
    const merged = mergeMessageSourcesByPriority([
      [message('m3', 'sent')],
      [message('m2', 'sent')],
      [message('m1', 'sent')],
    ]);

    expect(merged.map((item) => item.id)).toEqual(['m3', 'm2', 'm1']);
  });
});
