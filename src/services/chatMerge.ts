import { Message } from '../types';
import { newestFirst } from '../utils/chatHistory';

/**
 * Merge complete message sources ordered from highest to lowest authority.
 * Lower-priority records may fill fields that are absent from the canonical
 * source, but can never regress a newer status/content snapshot.
 */
export function mergeMessageSourcesByPriority(sourcesHighToLow: readonly Message[][]): Message[] {
  const byId = new Map<string, Message>();

  for (let sourceIndex = sourcesHighToLow.length - 1; sourceIndex >= 0; sourceIndex -= 1) {
    for (const message of sourcesHighToLow[sourceIndex]) {
      const previous = byId.get(message.id);
      byId.set(message.id, previous ? { ...previous, ...message } : message);
    }
  }

  return newestFirst(Array.from(byId.values()));
}

export function dedupeMessages(messages: Message[]): Message[] {
  return mergeMessageSourcesByPriority([messages]);
}
