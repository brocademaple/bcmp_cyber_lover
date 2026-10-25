import { ChatArchive, Message, MessageRole } from '../types';

export type MessageSearchRole = Extract<MessageRole, 'user' | 'assistant'> | 'all';

function pad2(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

export function getDateKey(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function newestFirst(messages: Message[]): Message[] {
  return messages.slice().sort((a, b) => b.timestamp - a.timestamp);
}

export function oldestFirst(messages: Message[]): Message[] {
  return messages.slice().sort((a, b) => a.timestamp - b.timestamp);
}

export function isNewestFirst(messages: Message[]): boolean {
  return messages.every((message, index) => index === 0 || messages[index - 1].timestamp >= message.timestamp);
}

export function recentChronological(messages: Message[], count: number): Message[] {
  if (count <= 0) return [];
  return oldestFirst(newestFirst(messages).slice(0, count));
}

export function filterByDate(messages: Message[], dateKey: string): Message[] {
  return oldestFirst(messages.filter((message) => getDateKey(message.timestamp) === dateKey));
}

export function searchMessages(
  messages: Message[],
  query: string,
  role: MessageSearchRole = 'all'
): Message[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery && role === 'all') return oldestFirst(messages);

  return oldestFirst(
    messages.filter((message) => {
      if (role !== 'all' && message.role !== role) return false;
      if (!normalizedQuery) return true;
      return message.content.toLowerCase().includes(normalizedQuery);
    })
  );
}

function getArchiveTitle(messages: Message[]): string {
  const firstUserMessage = messages.find((message) => message.role === 'user' && message.content.trim());
  const source = firstUserMessage ?? messages.find((message) => message.content.trim());
  const text = source?.content.trim() || '今天的聊天';
  return text.length > 18 ? `${text.slice(0, 18)}...` : text;
}

export function buildChatArchives(characterId: string, messages: Message[]): ChatArchive[] {
  const validMessages = oldestFirst(messages).filter(
    (message) => message.status !== 'failed' && message.content.trim()
  );
  const grouped = new Map<string, Message[]>();

  for (const message of validMessages) {
    const dateKey = getDateKey(message.timestamp);
    grouped.set(dateKey, [...(grouped.get(dateKey) || []), message]);
  }

  return Array.from(grouped.entries())
    .map(([dateKey, items]) => {
      const last = items[items.length - 1];
      return {
        id: `${characterId}_${dateKey}`,
        characterId,
        dateKey,
        title: getArchiveTitle(items),
        lastMessage: last.content,
        messageCount: items.length,
        userMessageCount: items.filter((message) => message.role === 'user').length,
        assistantMessageCount: items.filter((message) => message.role === 'assistant').length,
        startedAt: items[0].timestamp,
        updatedAt: last.timestamp,
      };
    })
    .sort((a, b) => b.updatedAt - a.updatedAt);
}
