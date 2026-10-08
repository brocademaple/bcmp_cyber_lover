import * as SQLite from 'expo-sqlite';
import { Message } from '../types';

const SQLITE_DB_NAME = 'bcmp_local_data.db';
const SCHEMA_VERSION = 1;

type SqliteMessageRow = {
  payload_json: string;
};

let sqliteDbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function getSqliteDb() {
  if (!sqliteDbPromise) {
    sqliteDbPromise = SQLite.openDatabaseAsync(SQLITE_DB_NAME).then(async (db) => {
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        PRAGMA foreign_keys = ON;
        CREATE TABLE IF NOT EXISTS conversations (
          character_id TEXT PRIMARY KEY NOT NULL,
          message_count INTEGER NOT NULL DEFAULT 0,
          updated_at INTEGER NOT NULL DEFAULT 0,
          schema_version INTEGER NOT NULL DEFAULT ${SCHEMA_VERSION}
        );
        CREATE TABLE IF NOT EXISTS messages (
          character_id TEXT NOT NULL,
          id TEXT NOT NULL,
          role TEXT NOT NULL,
          content TEXT NOT NULL,
          timestamp INTEGER NOT NULL,
          status TEXT,
          error_message TEXT,
          image_uri TEXT,
          audio_uri TEXT,
          is_thinking INTEGER NOT NULL DEFAULT 0,
          payload_json TEXT NOT NULL,
          updated_at INTEGER NOT NULL,
          PRIMARY KEY (character_id, id)
        );
        CREATE INDEX IF NOT EXISTS idx_messages_character_timestamp
          ON messages (character_id, timestamp DESC);
      `);
      return db;
    });
  }

  return sqliteDbPromise;
}

function parseSqliteMessage(raw: string): Message[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
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
  } catch {}

  return [];
}

export async function readSqliteMessages(characterId: string): Promise<Message[]> {
  try {
    const db = await getSqliteDb();
    const rows = await db.getAllAsync<SqliteMessageRow>(
      'SELECT payload_json FROM messages WHERE character_id = ? ORDER BY timestamp DESC',
      [characterId]
    );
    return rows.flatMap((row) => parseSqliteMessage(row.payload_json));
  } catch {
    return [];
  }
}

export async function saveSqliteMessages(characterId: string, messages: Message[]): Promise<void> {
  const db = await getSqliteDb();
  const updatedAt = messages[0]?.timestamp ?? Date.now();

  await db.withTransactionAsync(async () => {
    for (const message of messages) {
      await db.runAsync(
        `INSERT OR REPLACE INTO messages (
          character_id,
          id,
          role,
          content,
          timestamp,
          status,
          error_message,
          image_uri,
          audio_uri,
          is_thinking,
          payload_json,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          characterId,
          message.id,
          message.role,
          message.content,
          message.timestamp,
          message.status ?? null,
          message.errorMessage ?? null,
          message.imageUri ?? null,
          message.audioUri ?? null,
          message.isThinking ? 1 : 0,
          JSON.stringify(message),
          updatedAt,
        ]
      );
    }
    const countRow = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) AS count FROM messages WHERE character_id = ?',
      [characterId]
    );
    await db.runAsync(
      `INSERT OR REPLACE INTO conversations (
        character_id,
        message_count,
        updated_at,
        schema_version
      ) VALUES (?, ?, ?, ?)`,
      [characterId, countRow?.count ?? messages.length, updatedAt, SCHEMA_VERSION]
    );
  });
}

export async function clearSqliteMessages(characterId: string): Promise<void> {
  try {
    const db = await getSqliteDb();
    await db.withTransactionAsync(async () => {
      await db.runAsync('DELETE FROM messages WHERE character_id = ?', [characterId]);
      await db.runAsync('DELETE FROM conversations WHERE character_id = ?', [characterId]);
    });
  } catch {}
}
