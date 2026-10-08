import { Message } from '../types';

export async function readSqliteMessages(_characterId: string): Promise<Message[]> {
  return [];
}

export async function saveSqliteMessages(_characterId: string, _messages: Message[]): Promise<void> {}

export async function clearSqliteMessages(_characterId: string): Promise<void> {}
