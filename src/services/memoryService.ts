import { Message, ServiceConfig, Character, MemoryConfig, DebugAgentSurface } from '../types';
import { sendMessage } from './aiService';
import { oldestFirst, recentChronological } from '../utils/chatHistory';

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

  const historyText = oldestFirst(messages)
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
      {
        compatibilityMode: false,
        deepThinking: false,
        customRequestParams: {},
        darkMode: 'auto',
        sendDelayMs: 0,
        theme: 'pink',
        themeMode: 'character',
      }
    );
    return summary;
  } catch {
    return '';
  }
}

export function buildMemorySummaryDebugSurface(
  messages: Message[],
  character: Character,
  memory: MemoryConfig
): DebugAgentSurface {
  const historyText = oldestFirst(messages)
    .filter((m) => m.role !== 'system')
    .map((m) => `${m.role === 'user' ? '用户' : character.name}: ${m.content}`)
    .join('\n') || '暂无聊天记录';

  return {
    title: '历史总结 Agent',
    description: '旧的聊天总结能力；主聊天链路现在使用长期记忆判断 Agent 处理弹窗与写入。',
    sections: [
      { title: 'Summary Prompt', content: SUMMARY_PROMPT, active: false },
      { title: 'Memory System Prompt 配置', content: memory.memorySystemPrompt, active: true },
      { title: 'History Preview', content: historyText.slice(0, 1200), active: false },
    ],
    requestSummary: [
      { label: 'Current Usage', value: '总结函数未直接调用；规则已进入主聊天和长期记忆判断' },
      { label: 'Auto Summarize', value: memory.autoSummarize ? 'on' : 'off' },
      { label: 'Trigger', value: memory.autoSummarizeTrigger },
      { label: 'Range', value: String(memory.retentionRange) },
    ],
    notes: ['这块保留给后续批量总结；当前真实聊天链路使用已确认 memories 列表、记忆使用规则和长期记忆评估 Agent。'],
  };
}

export function getMessagesInRange(
  messages: Message[],
  range: number
): Message[] {
  return recentChronological(messages, range);
}

export function getMessagesInTimeRange(
  messages: Message[],
  hours: number
): Message[] {
  const cutoff = Date.now() - hours * 60 * 60 * 1000;
  return oldestFirst(messages.filter((m) => m.timestamp >= cutoff));
}
