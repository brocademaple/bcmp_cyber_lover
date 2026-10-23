import AsyncStorage from '@react-native-async-storage/async-storage';
import { Message } from '../types';

const SEND_QUEUE_KEY = '@bcmp_pending_sends_v1';

export type PendingSendRecord = {
  characterId: string;
  userMsg: Message;
  enqueuedAt: number;
  attempts: number;
};

let queueWriteTail: Promise<void> = Promise.resolve();

function isPendingSendRecord(value: unknown): value is PendingSendRecord {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<PendingSendRecord>;
  return (
    typeof record.characterId === 'string' &&
    typeof record.enqueuedAt === 'number' &&
    typeof record.attempts === 'number' &&
    !!record.userMsg &&
    typeof record.userMsg.id === 'string' &&
    record.userMsg.role === 'user' &&
    typeof record.userMsg.content === 'string' &&
    typeof record.userMsg.timestamp === 'number'
  );
}

async function readQueue(): Promise<PendingSendRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(SEND_QUEUE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter(isPendingSendRecord) : [];
  } catch {
    return [];
  }
}

function mutateQueue(
  mutation: (records: PendingSendRecord[]) => PendingSendRecord[]
): Promise<void> {
  const operation = queueWriteTail.then(async () => {
    const next = mutation(await readQueue());
    await AsyncStorage.setItem(SEND_QUEUE_KEY, JSON.stringify(next));
  });
  queueWriteTail = operation.catch(() => undefined);
  return operation;
}

export async function loadPendingSends(characterId: string): Promise<PendingSendRecord[]> {
  await queueWriteTail;
  return (await readQueue())
    .filter((record) => record.characterId === characterId)
    .sort((left, right) => left.enqueuedAt - right.enqueuedAt);
}

export function enqueuePendingSend(record: PendingSendRecord): Promise<void> {
  return mutateQueue((records) => [
    ...records.filter((item) => item.userMsg.id !== record.userMsg.id),
    record,
  ]);
}

export function markPendingSendAttempt(messageId: string): Promise<void> {
  return mutateQueue((records) =>
    records.map((record) =>
      record.userMsg.id === messageId
        ? { ...record, attempts: record.attempts + 1 }
        : record
    )
  );
}

export function removePendingSend(messageId: string): Promise<void> {
  return mutateQueue((records) => records.filter((record) => record.userMsg.id !== messageId));
}
