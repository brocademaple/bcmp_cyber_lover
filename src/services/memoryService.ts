import { Message, ServiceConfig, Character, MemoryConfig } from '../types';
import { sendMessage } from './aiService';

const SUMMARY_PROMPT = `请将以下聊天记录进行简洁的总结，提取关键信息：用户的喜好、重要事件、情感状态等。用第三人称描述用户。总结要简短，不超过300字。

聊天记录：
`;

export async function summarizeHistory(
  messages: Message[],
  character: Character,
  config: ServiceConfig,
  memory: MemoryConfig
): Promise<string> {
  if (messages.length === 0) return '';

  const historyText = messages
    .filter((m) => m.role !== 'system')
    .map((m) => `${m.role === 'user' ? '用户' : character.name}: ${m.content}`)
    .join('\n');

  const summaryCharacter: Character = {
    ...character,
    systemPrompt: '你是一个专业的对话总结助手。',
  };

  try {
    const summary = await sendMessage(
      SUMMARY_PROMPT + historyText,
      summaryCharacter,
      [],
      config,
      { ...memory, enabled: false },
      { compatibilityMode: false, deepThinking: false, customRequestParams: {}, darkMode: 'auto', sendDelayMs: 0 }
    );
    return summary;
  } catch {
    return '';
  }
}

export function getMessagesInRange(
  messages: Message[],
  range: number
): Message[] {
  return messages.slice(-range);
}

export function getMessagesInTimeRange(
  messages: Message[],
  hours: number
): Message[] {
  const cutoff = Date.now() - hours * 60 * 60 * 1000;
  return messages.filter((m) => m.timestamp >= cutoff);
}
