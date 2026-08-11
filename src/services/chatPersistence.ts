import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { Message } from '../types';
import { clearSqliteMessages, readSqliteMessages, saveSqliteMessages } from './sqliteChatStorage';
import { newestFirst } from '../utils/chatHistory';

const LEGACY_MESSAGES_KEY = '@bcmp_messages_';
const CHAT_DB_INDEX_KEY = '@bcmp_chat_db_index_v1';
const CHAT_DB_RECORD_KEY_PREFIX = '@bcmp_chat_db_v1_';
const CHAT_BACKUP_DIR = 'bcmp-chat-backups';
const CHAT_BACKUP_SNAPSHOT_DIR = 'snapshots';
const SCHEMA_VERSION = 1;
const MAX_BACKUP_SNAPSHOTS_PER_CHARACTER = 20;

type ChatDbRecord = {
  schemaVersion: typeof SCHEMA_VERSION;
  characterId: string;
  messages: Message[];
  updatedAt: number;
};

type ChatDbIndex = {
  schemaVersion: typeof SCHEMA_VERSION;
  conversations: Record<
    string,
    {
      characterId: string;
      storageKey: string;
      backupUri?: string;
      messageCount: number;
      updatedAt: number;
    }
  >;
};

function getRecordKey(characterId: string) {
  return `${CHAT_DB_RECORD_KEY_PREFIX}${characterId}`;
}

function getLegacyKey(characterId: string) {
  return `${LEGACY_MESSAGES_KEY}${characterId}`;
}

function dedupeMessages(messages: Message[]) {
  const byId = new Map<string, Message>();
  for (const message of messages) {
    byId.set(message.id, { ...byId.get(message.id), ...message });
  }
  return newestFirst(Array.from(byId.values()));
}

function parseMessages(raw: string | null): Message[] {
  if (!raw) return [];

  const parsed = JSON.parse(raw) as unknown;
  if (Array.isArray(parsed)) return parsed as Message[];

  if (
    parsed &&
    typeof parsed === 'object' &&
    typeof (parsed as Partial<Message>).id === 'string' &&
    typeof (parsed as Partial<Message>).role === 'string' &&
    typeof (parsed as Partial<Message>).content === 'string' &&
    typeof (parsed as Partial<Message>).timestamp === 'number'
  ) {
    return [parsed as Message];
  }

  if (
    parsed &&
    typeof parsed === 'object' &&
    Array.isArray((parsed as Partial<ChatDbRecord>).messages)
  ) {
    return (parsed as ChatDbRecord).messages;
  }

  return [];
}

async function readStorageMessages(key: string): Promise<Message[]> {
  try {
    return parseMessages(await AsyncStorage.getItem(key));
  } catch {
    return [];
  }
}

async function getBackupUri(characterId: string): Promise<string | undefined> {
  if (!FileSystem.documentDirectory) return undefined;

  const dirUri = `${FileSystem.documentDirectory}${CHAT_BACKUP_DIR}/`;
  try {
    await FileSystem.makeDirectoryAsync(dirUri, { intermediates: true });
  } catch {}

  return `${dirUri}${encodeURIComponent(characterId)}.json`;
}

async function getBackupSnapshotDir(characterId: string): Promise<string | undefined> {
  if (!FileSystem.documentDirectory) return undefined;

  const dirUri = `${FileSystem.documentDirectory}${CHAT_BACKUP_DIR}/${CHAT_BACKUP_SNAPSHOT_DIR}/${encodeURIComponent(characterId)}/`;
  try {
    await FileSystem.makeDirectoryAsync(dirUri, { intermediates: true });
  } catch {}

  return dirUri;
}

async function readBackupMessages(characterId: string): Promise<Message[]> {
  const backupUri = await getBackupUri(characterId);
  if (!backupUri) return [];

  try {
    const info = await FileSystem.getInfoAsync(backupUri);
    if (!info.exists) return [];
    return parseMessages(await FileSystem.readAsStringAsync(backupUri));
  } catch {
    return [];
  }
}

async function readBackupSnapshotMessages(characterId: string): Promise<Message[]> {
  const snapshotDir = await getBackupSnapshotDir(characterId);
  if (!snapshotDir) return [];

  try {
    const fileNames = await FileSystem.readDirectoryAsync(snapshotDir);
    const snapshotFileNames = fileNames
      .filter((fileName) => fileName.endsWith('.json'))
      .sort()
      .reverse()
      .slice(0, MAX_BACKUP_SNAPSHOTS_PER_CHARACTER);
    const snapshots = await Promise.all(
      snapshotFileNames.map((fileName) => readStorageFileMessages(`${snapshotDir}${fileName}`))
    );
    return snapshots.flat();
  } catch {
    return [];
  }
}

async function readStorageFileMessages(uri: string): Promise<Message[]> {
  try {
    return parseMessages(await FileSystem.readAsStringAsync(uri));
  } catch {
    return [];
  }
}

async function readIndex(): Promise<ChatDbIndex> {
  try {
    const raw = await AsyncStorage.getItem(CHAT_DB_INDEX_KEY);
    if (!raw) throw new Error('missing chat index');
    const parsed = JSON.parse(raw) as Partial<ChatDbIndex>;
    if (parsed.schemaVersion === SCHEMA_VERSION && parsed.conversations) {
      return parsed as ChatDbIndex;
    }
  } catch {}

  return { schemaVersion: SCHEMA_VERSION, conversations: {} };
}

async function writeIndex(index: ChatDbIndex) {
  await AsyncStorage.setItem(CHAT_DB_INDEX_KEY, JSON.stringify(index));
}

export async function loadChatMessages(characterId: string): Promise<Message[]> {
  const index = await readIndex();
  const indexedKey = index.conversations[characterId]?.storageKey;

  const candidates = await Promise.all([
    readSqliteMessages(characterId),
    indexedKey ? readStorageMessages(indexedKey) : Promise.resolve([]),
    readStorageMessages(getRecordKey(characterId)),
    readStorageMessages(getLegacyKey(characterId)),
    readBackupMessages(characterId),
    readBackupSnapshotMessages(characterId),
  ]);

  const messages = dedupeMessages(candidates.flat());
  if (messages.length > 0) {
    await saveChatMessages(characterId, messages);
  }

  return messages;
}

export async function saveChatMessages(characterId: string, messages: Message[]) {
  const normalized = dedupeMessages(messages);
  const updatedAt = normalized[0]?.timestamp ?? Date.now();
  const storageKey = getRecordKey(characterId);
  const backupUri = await getBackupUri(characterId);
  const record: ChatDbRecord = {
    schemaVersion: SCHEMA_VERSION,
    characterId,
    messages: normalized,
    updatedAt,
  };
  const serialized = JSON.stringify(record);

  try {
    await saveSqliteMessages(characterId, normalized);
  } catch {}

  await AsyncStorage.setItem(storageKey, serialized);
  await AsyncStorage.setItem(getLegacyKey(characterId), JSON.stringify(normalized));

  if (backupUri) {
    try {
      await FileSystem.writeAsStringAsync(backupUri, serialized);
      await writeBackupSnapshot(characterId, serialized);
    } catch {}
  }

  const index = await readIndex();
  index.conversations[characterId] = {
    characterId,
    storageKey,
    backupUri,
    messageCount: normalized.length,
    updatedAt,
  };
  await writeIndex(index);
}

async function writeBackupSnapshot(characterId: string, serialized: string) {
  const snapshotDir = await getBackupSnapshotDir(characterId);
  if (!snapshotDir) return;

  const snapshotUri = `${snapshotDir}${Date.now()}.json`;
  try {
    await FileSystem.writeAsStringAsync(snapshotUri, serialized);
    const fileNames = await FileSystem.readDirectoryAsync(snapshotDir);
    const staleFileNames = fileNames
      .filter((fileName) => fileName.endsWith('.json'))
      .sort()
      .reverse()
      .slice(MAX_BACKUP_SNAPSHOTS_PER_CHARACTER);
    await Promise.all(
      staleFileNames.map((fileName) =>
        FileSystem.deleteAsync(`${snapshotDir}${fileName}`, { idempotent: true }).catch(() => undefined)
      )
    );
  } catch {}
}

export async function clearChatMessages(characterId: string) {
  await clearSqliteMessages(characterId);

  await AsyncStorage.removeItem(getRecordKey(characterId));
  await AsyncStorage.removeItem(getLegacyKey(characterId));

  const backupUri = await getBackupUri(characterId);
  if (backupUri) {
    try {
      const info = await FileSystem.getInfoAsync(backupUri);
      if (info.exists) await FileSystem.deleteAsync(backupUri, { idempotent: true });
    } catch {}
  }

  const snapshotDir = await getBackupSnapshotDir(characterId);
  if (snapshotDir) {
    try {
      const info = await FileSystem.getInfoAsync(snapshotDir);
      if (info.exists) await FileSystem.deleteAsync(snapshotDir, { idempotent: true });
    } catch {}
  }

  const index = await readIndex();
  delete index.conversations[characterId];
  await writeIndex(index);
}
