import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import type { UserUnderstanding } from '../types/luyaUnderstanding';
import type { LuyaLifeEvent, LuyaRelationshipEvidence } from '../types/luya';
import { Character, Message, RelationshipEvent } from '../types';
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

export type DataExportMode = 'full' | 'confirmed';
export interface ConfirmedCharacterContent {
  characterId: string;
  understandings: UserUnderstanding[];
  lifeEvents: LuyaLifeEvent[];
  sharedEvents: LuyaRelationshipEvidence[];
  relationshipEvents: RelationshipEvent[];
}

function isNotDeleted(value: object): boolean {
  const record = value as Record<string, unknown>;
  return !record.deleted && record.deletedAt == null;
}
function isConfirmedEvent(value: object): boolean {
  const record = value as Record<string, unknown>;
  return isNotDeleted(value) && (record.source === 'confirmed_story_event' || record.confirmed === true);
}
export function selectConfirmedContent(characters: Character[]): ConfirmedCharacterContent[] {
  return characters.map(character => ({
    characterId: character.id,
    understandings: (character.luyaRuntime?.understandings ?? []).filter(card => card.status === 'confirmed' && isNotDeleted(card)),
    lifeEvents: (character.luyaRuntime?.life.events ?? []).filter(isConfirmedEvent),
    sharedEvents: (character.luyaRuntime?.relationship.evidence ?? []).filter(event => event.kind === 'shared_event' && isConfirmedEvent(event)),
    relationshipEvents: (character.relationshipEvents ?? []).filter(isConfirmedEvent),
  })).filter(content => content.understandings.length + content.lifeEvents.length + content.sharedEvents.length + content.relationshipEvents.length > 0);
}

// Redact credential fields even in older settings or custom request headers.
function redactCredentials(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactCredentials);
  if (!isRecord(value)) return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !/^(?:api[_-]?key|authorization|x-api-key|access[_-]?token|secret|password)$/i.test(key))
    .map(([key, item]) => [key, redactCredentials(item)]));
}
function sanitizePortableStorage(storage: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(storage).map(([key, raw]) => {
    try { return [key, JSON.stringify(redactCredentials(JSON.parse(raw)))]; }
    catch { throw new Error('无法读取备份数据，原数据保持不变'); }
  }));
}

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
  exportMode?: DataExportMode;
  confirmedContent?: ConfirmedCharacterContent[];
}
export interface DataExportResult {
  uri: string;
  characterCount: number;
  messageCount: number;
  exportedAt: number;
  mode?: DataExportMode;
  confirmedCount?: number;
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
    key === '@bcmp_luya_pre_v2_characters' ||
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
  if (bundle.exportMode != null && bundle.exportMode !== 'full' && bundle.exportMode !== 'confirmed') {
    throw new Error('未知导出模式');
  }
  if (bundle.exportMode === 'confirmed') {
    if (Object.keys(bundle.storage).length || bundle.characters.length || Object.keys(bundle.messagesByCharacter).length || Object.keys(bundle.mediaFiles ?? {}).length) {
      throw new Error('确认内容备份不能包含聊天或完整档案');
    }
    if (!Array.isArray(bundle.confirmedContent) || !bundle.confirmedContent.every(content =>
      isRecord(content) && typeof content.characterId === 'string' &&
      Array.isArray(content.understandings) && content.understandings.every(card => isRecord(card) && typeof card.id === 'string' && card.status === 'confirmed' && isNotDeleted(card)) &&
      Array.isArray(content.lifeEvents) && content.lifeEvents.every(event => isRecord(event) && typeof event.id === 'string' && isConfirmedEvent(event)) &&
      Array.isArray(content.sharedEvents) && content.sharedEvents.every(event => isRecord(event) && typeof event.id === 'string' && event.kind === 'shared_event' && isConfirmedEvent(event)) &&
      Array.isArray(content.relationshipEvents) && content.relationshipEvents.every(event => isRecord(event) && typeof event.id === 'string' && isConfirmedEvent(event))
    )) throw new Error('确认内容备份包含未确认或无效记录');
  } else if (bundle.confirmedContent != null) {
    throw new Error('确认内容缺少导出模式');
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
  now = Date.now(),
  mode: DataExportMode = 'full'
): Promise<DataExportResult> {
  const directory = getExportDirectory();
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });

  const allKeys = await AsyncStorage.getAllKeys();
  const portableKeys = allKeys.filter(isPortableStorageKey);
  const pairs = await AsyncStorage.multiGet(portableKeys);
  const rawStorage = Object.fromEntries(
    pairs.filter((pair): pair is [string, string] => typeof pair[1] === 'string')
  );
  const characters = parseCharacters(rawStorage[CHARACTERS_KEY] ?? null);
  const storage = mode === 'full' ? sanitizePortableStorage(rawStorage) : {};
  const confirmedContent = mode === 'confirmed' ? redactCredentials(selectConfirmedContent(characters)) as ConfirmedCharacterContent[] : undefined;
  const characterIds = uniqueCharacterIds(allKeys, characters);
  const messagesByCharacter: Record<string, Message[]> = {};
  const mediaFiles: Record<string, PortableMediaFile> = {};

  for (const characterId of mode === 'full' ? characterIds : []) {
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
    characters: mode === 'full' ? redactCredentials(characters) as Character[] : [],
    messagesByCharacter,
    exportMode: mode,
    ...(confirmedContent ? { confirmedContent } : {}),
    mediaFiles,
  };
  const bundle: AppDataBundle = { ...payload, checksum: bundleChecksum(payload) };
  const uri = `${directory}yinzhi-${reason}-${mode}-${fileStamp(now)}.json`;
  const temporaryUri = `${uri}.tmp`;
  await FileSystem.writeAsStringAsync(temporaryUri, JSON.stringify(bundle, null, 2));
  await FileSystem.moveAsync({ from: temporaryUri, to: uri });
  await pruneAppDataExports();

  return {
    uri,
    characterCount: mode === 'full' ? characters.length : confirmedContent?.length ?? 0,
    mode,
    confirmedCount: confirmedContent?.reduce((sum, item) => sum + item.understandings.length + item.lifeEvents.length + item.sharedEvents.length + item.relationshipEvents.length, 0),
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

function appendMissing<T extends { id: string }>(existing: T[], incoming: T[]): T[] {
  const ids = new Set(existing.map(item => item.id));
  return [...existing, ...incoming.filter(item => {
    if (ids.has(item.id)) return false;
    ids.add(item.id);
    return true;
  })];
}
export function mergeConfirmedContent(characters: Character[], content: ConfirmedCharacterContent[]): Character[] {
  return characters.map(character => {
    const incoming = content.find(item => item.characterId === character.id);
    if (!incoming) return character;
    const runtime = character.luyaRuntime;
    if (!runtime && incoming.understandings.length + incoming.lifeEvents.length + incoming.sharedEvents.length > 0) {
      throw new Error('请先打开鹿芽的房间，再恢复确认内容。原数据保持不变。');
    }
    return {
      ...character,
      relationshipEvents: appendMissing(character.relationshipEvents ?? [], incoming.relationshipEvents),
      ...(runtime ? { luyaRuntime: {
        ...runtime,
        understandings: appendMissing(runtime.understandings, incoming.understandings),
        life: { ...runtime.life, events: appendMissing(runtime.life.events, incoming.lifeEvents) },
        relationship: { ...runtime.relationship, evidence: appendMissing(runtime.relationship.evidence, incoming.sharedEvents) },
      } } : {}),
    };
  });
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

  const restoredStorage = sanitizePortableStorage(bundle.storage);
  if (bundle.exportMode === 'confirmed') {
    const current = parseCharacters(await AsyncStorage.getItem(CHARACTERS_KEY));
    const content = bundle.confirmedContent ?? [];
    if (content.some(item => !current.some(character => character.id === item.characterId))) {
      throw new Error('找不到确认内容对应的角色。请先恢复完整备份；原数据保持不变。');
    }
    restoredStorage[CHARACTERS_KEY] = JSON.stringify(mergeConfirmedContent(current, content));
  }
  const safePairs = Object.entries(restoredStorage).filter(([key]) => isPortableStorageKey(key));
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
    characterCount: bundle.exportMode === 'confirmed' ? bundle.confirmedContent?.length ?? 0 : bundle.characters.length,
    mode: bundle.exportMode ?? 'full',
    confirmedCount: bundle.confirmedContent?.reduce((sum, item) => sum + item.understandings.length + item.lifeEvents.length + item.sharedEvents.length + item.relationshipEvents.length, 0),
    messageCount: Object.values(bundle.messagesByCharacter).reduce((sum, messages) => sum + messages.length, 0),
    exportedAt: bundle.exportedAt,
  };
}
