import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { Character, Message } from '../types';
import { loadChatMessages, saveChatMessages } from './chatPersistence';

const EXPORT_SCHEMA_VERSION = 1;
const EXPORT_DIR_NAME = 'bcmp-data-exports';
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

export function validateAppDataBundle(value: unknown): AppDataBundle {
  if (!value || typeof value !== 'object') throw new Error('备份文件不是有效对象');
  const bundle = value as Partial<AppDataBundle>;
  if (bundle.kind !== 'heartbeat-companion-backup') throw new Error('备份文件类型不匹配');
  if (bundle.schemaVersion !== EXPORT_SCHEMA_VERSION) throw new Error(`暂不支持 schema v${bundle.schemaVersion ?? 'unknown'}`);
  if (!bundle.storage || typeof bundle.storage !== 'object') throw new Error('备份缺少设置数据');
  if (!Array.isArray(bundle.characters)) throw new Error('备份缺少角色数据');
  if (!bundle.messagesByCharacter || typeof bundle.messagesByCharacter !== 'object') throw new Error('备份缺少聊天数据');
  return bundle as AppDataBundle;
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

  for (const characterId of characterIds) {
    const messages = await loadChatMessages(characterId);
    if (messages.length > 0) messagesByCharacter[characterId] = messages;
  }

  const bundle: AppDataBundle = {
    kind: 'heartbeat-companion-backup',
    schemaVersion: EXPORT_SCHEMA_VERSION,
    appVersion: '1.5.0',
    exportedAt: now,
    storage,
    characters,
    messagesByCharacter,
  };
  const uri = `${directory}heartbeat-companion-${reason}-${fileStamp(now)}.json`;
  await FileSystem.writeAsStringAsync(uri, JSON.stringify(bundle, null, 2));

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

export async function restoreAppDataExport(uri: string): Promise<DataExportResult> {
  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists) throw new Error('找不到所选备份文件');
  const bundle = validateAppDataBundle(JSON.parse(await FileSystem.readAsStringAsync(uri)));

  // Always preserve the state that existed immediately before a restore.
  await exportAppData('pre-restore');

  const safePairs = Object.entries(bundle.storage).filter(([key]) => isPortableStorageKey(key));
  if (safePairs.length > 0) await AsyncStorage.multiSet(safePairs);

  for (const [characterId, messages] of Object.entries(bundle.messagesByCharacter)) {
    if (!Array.isArray(messages)) continue;
    await saveChatMessages(characterId, messages);
  }

  return {
    uri,
    characterCount: bundle.characters.length,
    messageCount: Object.values(bundle.messagesByCharacter).reduce((sum, messages) => sum + messages.length, 0),
    exportedAt: bundle.exportedAt,
  };
}
