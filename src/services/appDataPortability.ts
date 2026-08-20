import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { Character, Message } from '../types';
import { clearChatMessages, loadChatMessages, saveChatMessages } from './chatPersistence';
import {
  collectPortableMedia,
  PortableMediaFile,
  restorePortableMedia,
} from './messageMedia';
import { fnv1aChecksum } from './dataIntegrity';

const EXPORT_SCHEMA_VERSION = 2;
const LEGACY_EXPORT_SCHEMA_VERSION = 1;
const EXPORT_DIR_NAME = 'bcmp-data-exports';
const MAX_LOCAL_EXPORTS = 20;
const RESTORE_MARKER_KEY = '@bcmp_restore_in_progress_v1';
const CHARACTERS_KEY = '@bcmp_characters';
const SETTINGS_KEY = '@bcmp_settings';
const CHAT_RECORD_PREFIX = '@bcmp_chat_db_v1_';
const LEGACY_CHAT_PREFIX = '@bcmp_messages_';

export interface AppDataBundle {
  kind: 'heartbeat-companion-backup';
  schemaVersion: number;
  appVersion: string;
  exportedAt: number;
  storage: Record<string, string>;
  characters: Character[];
  messagesByCharacter: Record<string, Message[]>;
  mediaFiles?: Record<string, PortableMediaFile>;
  checksum?: string;
}
export interface DataExportResult {
  uri: string;
  characterCount: number;
  messageCount: number;
  exportedAt: number;
}

function getExportDirectory(): string {
  if (!FileSystem.documentDirectory) {
    throw new Error('当前平台没有可写的应用文档目录');
  }
  return `${FileSystem.documentDirectory}${EXPORT_DIR_NAME}/`;
}

function isPortableStorageKey(key: string): boolean {
  if (key.startsWith('@bcmp_secure_')) return false;
  if (key.startsWith(CHAT_RECORD_PREFIX) || key.startsWith(LEGACY_CHAT_PREFIX)) return false;
  return (
    key === SETTINGS_KEY ||
    key === CHARACTERS_KEY ||
    key === '@bcmp_onboardingCompleted' ||
    key.startsWith('@bcmp_chat_archives_') ||
    key.startsWith('@bcmp_character_revisions_v1_')
  );
}

function parseCharacters(raw: string | null): Character[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function uniqueCharacterIds(keys: readonly string[], characters: Character[]): string[] {
  const ids = new Set(characters.map((character) => character.id));
  for (const key of keys) {
    if (key.startsWith(CHAT_RECORD_PREFIX)) ids.add(key.slice(CHAT_RECORD_PREFIX.length));
    if (key.startsWith(LEGACY_CHAT_PREFIX)) ids.add(key.slice(LEGACY_CHAT_PREFIX.length));
  }
  return [...ids].filter(Boolean);
}

function fileStamp(timestamp: number): string {
  const date = new Date(timestamp);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isMessage(value: unknown): value is Message {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    (value.role === 'user' || value.role === 'assistant' || value.role === 'system') &&
    typeof value.content === 'string' &&
    typeof value.timestamp === 'number' &&
    Number.isFinite(value.timestamp)
  );
}

function isCharacter(value: unknown): value is Character {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.avatar === 'string' &&
    typeof value.systemPrompt === 'string' &&
    typeof value.greeting === 'string' &&
    typeof value.personality === 'string'
  );
}

function bundleChecksum(bundle: Omit<AppDataBundle, 'checksum'>): string {
  return fnv1aChecksum(JSON.stringify(bundle));
}

export function calculateAppDataBundleChecksum(bundle: AppDataBundle): string {
  const { checksum: _checksum, ...payload } = bundle;
  return bundleChecksum(payload);
}

function normalizePortableMessage(message: Message): Message {
  if (message.status !== 'queued' && message.status !== 'sending') return message;
  return {
    ...message,
    status: 'failed',
    errorMessage: '这条消息来自备份中的未完成请求，请手动重试。',
  };
}

export function validateAppDataBundle(value: unknown): AppDataBundle {
  if (!value || typeof value !== 'object') throw new Error('备份文件不是有效对象');
  const bundle = value as Partial<AppDataBundle>;
  if (bundle.kind !== 'heartbeat-companion-backup') throw new Error('备份文件类型不匹配');
  if (
    bundle.schemaVersion !== EXPORT_SCHEMA_VERSION &&
    bundle.schemaVersion !== LEGACY_EXPORT_SCHEMA_VERSION
  ) {
    throw new Error(`暂不支持 schema v${bundle.schemaVersion ?? 'unknown'}`);
  }
  if (!isRecord(bundle.storage)) throw new Error('备份缺少设置数据');
  if (!Object.entries(bundle.storage).every(([key, item]) => isPortableStorageKey(key) && typeof item === 'string')) {
    throw new Error('备份包含无效或不可移植的设置项');
  }
  if (!Array.isArray(bundle.characters) || !bundle.characters.every(isCharacter)) {
    throw new Error('备份包含无效角色数据');
  }
  if (!isRecord(bundle.messagesByCharacter)) throw new Error('备份缺少聊天数据');
  for (const [characterId, messages] of Object.entries(bundle.messagesByCharacter)) {
    if (!characterId || !Array.isArray(messages) || !messages.every(isMessage)) {
      throw new Error(`备份包含无效聊天数据：${characterId || 'unknown'}`);
    }
  }
  if (bundle.mediaFiles != null) {
    if (!isRecord(bundle.mediaFiles)) throw new Error('备份媒体清单无效');
    for (const [path, media] of Object.entries(bundle.mediaFiles)) {
      if (
        !path || path.includes('..') || !isRecord(media) ||
        typeof media.mimeType !== 'string' ||
        typeof media.dataBase64 !== 'string' ||
        typeof media.checksum !== 'string'
      ) {
        throw new Error('备份包含无效媒体文件');
      }
    }
  }
  const validated = bundle as AppDataBundle;
  if (validated.schemaVersion === EXPORT_SCHEMA_VERSION) {
    if (!validated.checksum || validated.checksum !== calculateAppDataBundleChecksum(validated)) {
      throw new Error('备份完整性校验失败');
    }
  }
  return validated;
}

export async function exportAppData(
  reason: 'manual' | 'pre-restore' = 'manual',
  now = Date.now()
): Promise<DataExportResult> {
  const directory = getExportDirectory();
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });

  const allKeys = await AsyncStorage.getAllKeys();
  const portableKeys = allKeys.filter(isPortableStorageKey);
  const pairs = await AsyncStorage.multiGet(portableKeys);
  const storage = Object.fromEntries(
    pairs.filter((pair): pair is [string, string] => typeof pair[1] === 'string')
  );
  const characters = parseCharacters(storage[CHARACTERS_KEY] ?? null);
  const characterIds = uniqueCharacterIds(allKeys, characters);
  const messagesByCharacter: Record<string, Message[]> = {};
  const mediaFiles: Record<string, PortableMediaFile> = {};

  for (const characterId of characterIds) {
    const messages = await loadChatMessages(characterId);
    if (messages.length > 0) {
      const portable = await collectPortableMedia(messages);
      messagesByCharacter[characterId] = portable.messages.map(normalizePortableMessage);
      Object.assign(mediaFiles, portable.mediaFiles);
      if (portable.messages.some((message, index) => message.imageUri !== messages[index]?.imageUri)) {
        await saveChatMessages(characterId, portable.messages, { checkpoint: false });
      }
    }
  }

  const payload: Omit<AppDataBundle, 'checksum'> = {
    kind: 'heartbeat-companion-backup',
    schemaVersion: EXPORT_SCHEMA_VERSION,
    appVersion: '1.5.0',
    exportedAt: now,
    storage,
    characters,
    messagesByCharacter,
    mediaFiles,
  };
  const bundle: AppDataBundle = { ...payload, checksum: bundleChecksum(payload) };
  const uri = `${directory}heartbeat-companion-${reason}-${fileStamp(now)}.json`;
  const temporaryUri = `${uri}.tmp`;
  await FileSystem.writeAsStringAsync(temporaryUri, JSON.stringify(bundle, null, 2));
  await FileSystem.moveAsync({ from: temporaryUri, to: uri });
  await pruneAppDataExports();

  return {
    uri,
    characterCount: characters.length,
    messageCount: Object.values(messagesByCharacter).reduce((sum, messages) => sum + messages.length, 0),
    exportedAt: now,
  };
}

export async function listAppDataExports(): Promise<string[]> {
  const directory = getExportDirectory();
  const info = await FileSystem.getInfoAsync(directory);
  if (!info.exists) return [];
  const files = await FileSystem.readDirectoryAsync(directory);
  return files
    .filter((name) => name.endsWith('.json'))
    .sort()
    .reverse()
    .map((name) => `${directory}${name}`);
}

async function pruneAppDataExports(): Promise<void> {
  const exports = await listAppDataExports();
  await Promise.all(
    exports.slice(MAX_LOCAL_EXPORTS).map((uri) =>
      FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined)
    )
  );
}

type RestoreMarker = {
  startedAt: number;
  sourceUri: string;
  safetyBackupUri: string;
};

function parseRestoreMarker(raw: string | null): RestoreMarker | null {
  if (!raw) return null;
  try {
    const marker = JSON.parse(raw) as Partial<RestoreMarker>;
    return typeof marker.startedAt === 'number' &&
      typeof marker.sourceUri === 'string' &&
      typeof marker.safetyBackupUri === 'string'
      ? marker as RestoreMarker
      : null;
  } catch {
    return null;
  }
}

export async function recoverInterruptedRestore(): Promise<boolean> {
  const marker = parseRestoreMarker(await AsyncStorage.getItem(RESTORE_MARKER_KEY));
  if (!marker) return false;
  await restoreAppDataExportInternal(marker.safetyBackupUri, false);
  return true;
}

export async function restoreAppDataExport(uri: string): Promise<DataExportResult> {
  return restoreAppDataExportInternal(uri, true);
}

async function restoreAppDataExportInternal(
  uri: string,
  createSafetyBackup: boolean
): Promise<DataExportResult> {
  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists) throw new Error('找不到所选备份文件');
  const bundle = validateAppDataBundle(JSON.parse(await FileSystem.readAsStringAsync(uri)));

  // Manual restores always preserve the immediately preceding state. Startup
  // recovery reuses the already-created safety backup to avoid recursion.
  const safetyBackupUri = createSafetyBackup
    ? (await exportAppData('pre-restore')).uri
    : uri;

  const safePairs = Object.entries(bundle.storage).filter(([key]) => isPortableStorageKey(key));
  const safeKeys = safePairs.map(([key]) => key);
  const previousPairs = await AsyncStorage.multiGet(safeKeys);
  const previousMessages: Record<string, Message[]> = {};
  for (const characterId of Object.keys(bundle.messagesByCharacter)) {
    previousMessages[characterId] = await loadChatMessages(characterId);
  }

  await AsyncStorage.setItem(
    RESTORE_MARKER_KEY,
    JSON.stringify({ startedAt: Date.now(), sourceUri: uri, safetyBackupUri })
  );

  try {
    await restorePortableMedia(bundle.mediaFiles ?? {});
    if (safePairs.length > 0) await AsyncStorage.multiSet(safePairs);

    for (const [characterId, messages] of Object.entries(bundle.messagesByCharacter)) {
      await saveChatMessages(characterId, messages.map(normalizePortableMessage));
    }
    await AsyncStorage.removeItem(RESTORE_MARKER_KEY);
  } catch (error) {
    const previousExisting = previousPairs.filter((pair): pair is [string, string] => pair[1] != null);
    const previousMissing = previousPairs.filter((pair) => pair[1] == null).map(([key]) => key);
    if (previousExisting.length > 0) await AsyncStorage.multiSet(previousExisting);
    if (previousMissing.length > 0) await AsyncStorage.multiRemove(previousMissing);
    for (const [characterId, messages] of Object.entries(previousMessages)) {
      await clearChatMessages(characterId);
      if (messages.length > 0) await saveChatMessages(characterId, messages);
    }
    await AsyncStorage.removeItem(RESTORE_MARKER_KEY);
    throw error;
  }

  return {
    uri,
    characterCount: bundle.characters.length,
    messageCount: Object.values(bundle.messagesByCharacter).reduce((sum, messages) => sum + messages.length, 0),
    exportedAt: bundle.exportedAt,
  };
}
