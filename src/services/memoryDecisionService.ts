import { AdvancedConfig, Character, DebugAgentSurface, MemoryConfig, Message, ServiceConfig } from '../types';
import { PROVIDER_CONFIGS } from '../store/settingsStore';
import { evaluateMemoryDecision, MemoryDecision } from './relationshipService';
import { recentChronological } from '../utils/chatHistory';

type LlmMemoryDecision = {
  action?: unknown;
  content?: unknown;
  tags?: unknown;
  importance?: unknown;
  question?: unknown;
};

export type MemoryDecisionInput = {
  character: Character;
  userMessage: Message;
  assistantMessage: Message;
  recentMessages: Message[];
  service: ServiceConfig;
  memory: MemoryConfig;
  advanced: AdvancedConfig;
};

const DEFAULT_MEMORY_CONTEXT_RANGE = 24;
const MAX_MEMORY_CONTEXT_RANGE = 200;
const DEFAULT_MEMORY_LIBRARY_RANGE = 8;

function getBaseUrl(config: ServiceConfig): string {
  if (config.provider === 'custom') return config.baseUrl?.trim() || '';
  return PROVIDER_CONFIGS[config.provider].baseUrl;
}

function getApiKey(config: ServiceConfig): string {
  return config.apiKey.trim();
}

function extractAssistantContent(data: { choices?: Array<{ message?: { content?: string } }> }): string {
  return data.choices?.[0]?.message?.content || '';
}

function extractJsonObject(text: string): unknown | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] ?? trimmed;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start < 0 || end <= start) return null;

  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}

function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 4);
}

function normalizeImportance(value: unknown): number {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return 6;
  return Math.max(1, Math.min(10, Math.round(num)));
}

function normalizeMemoryDecision(raw: unknown): MemoryDecision | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as LlmMemoryDecision;
  if (data.action === 'none') return { action: 'none' };
  if (data.action !== 'ask' && data.action !== 'save') return null;
  if (typeof data.content !== 'string' || !data.content.trim()) return { action: 'none' };

  const base = {
    content: data.content.trim().slice(0, 120),
    tags: normalizeTags(data.tags),
    importance: normalizeImportance(data.importance),
  };

  if (data.action === 'save') return { action: 'save', ...base };
  return {
    action: 'ask',
    ...base,
    question:
      typeof data.question === 'string' && data.question.trim()
        ? data.question.trim().slice(0, 32)
        : '发现一条可能值得长期记忆的内容',
  };
}

function normalizeRange(value: number | undefined, fallback: number): number {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return fallback;
  return Math.min(MAX_MEMORY_CONTEXT_RANGE, Math.max(2, Math.round(num)));
}

function shouldRunDuringChatAutoMemory(memory: MemoryConfig): boolean {
  return (
    memory.enabled &&
    memory.autoSummarize &&
    (memory.autoSummarizeTrigger === 'during' || memory.autoSummarizeTrigger === 'both')
  );
}

function getMemoryContextMessages(input: MemoryDecisionInput): Message[] {
  const currentTurn = [input.userMessage, input.assistantMessage];
  if (!input.memory.alwaysRetainHistory) return currentTurn;

  return recentChronological(
    input.recentMessages,
    normalizeRange(input.memory.retentionRange, DEFAULT_MEMORY_CONTEXT_RANGE)
  );
}

function getExistingMemoryText(input: MemoryDecisionInput): string {
  const memories = (input.character.memories ?? []).filter((memory) => memory.status !== 'superseded');
  const scopedMemories = input.memory.alwaysProvideFullMemory
    ? memories
    : memories.slice(-DEFAULT_MEMORY_LIBRARY_RANGE);

  return scopedMemories
    .map((memory) => `- ${memory.content}`)
    .join('\n') || '暂无';
}

function evaluateLocalFallback(input: MemoryDecisionInput): MemoryDecision {
  const localDecision = evaluateMemoryDecision(input.character, input.userMessage.content);
  if (localDecision.action !== 'ask') return localDecision;
  return shouldRunDuringChatAutoMemory(input.memory) ? localDecision : { action: 'none' };
}

function buildMemoryJudgePrompt(input: MemoryDecisionInput): Array<{ role: string; content: string }> {
  const contextMessages = getMemoryContextMessages(input);
  const recentText = contextMessages
    .filter((message) => message.role !== 'system' && message.content.trim())
    .map((message) => `${message.role === 'user' ? '用户' : input.character.name}: ${message.content}`)
    .join('\n');

  const existingMemoryText = getExistingMemoryText(input);
  const memoryRule = input.memory.memorySystemPrompt.trim() || '请根据以往聊天记录理解用户的稳定喜好、习惯、重要事件与关系约定。';
  const autoSummaryLabel = shouldRunDuringChatAutoMemory(input.memory)
    ? '已开启，当前触发时机为聊天中'
    : '未在聊天中开启，本 prompt 仅用于调试预览';
  const contextRangeLabel = input.memory.alwaysRetainHistory
    ? `最近 ${normalizeRange(input.memory.retentionRange, DEFAULT_MEMORY_CONTEXT_RANGE)} 条消息`
    : '仅本轮用户消息和角色回复';
  const memoryLibraryLabel = input.memory.alwaysProvideFullMemory
    ? '完整长期记忆库'
    : `最近 ${DEFAULT_MEMORY_LIBRARY_RANGE} 条长期记忆`;

  return [
    {
      role: 'system',
      content: `你是 AI 伴侣产品的长期记忆评估器。你的任务是在角色回复完成后，判断本轮对话是否值得写入长期记忆。

只输出一个 JSON 对象，不要输出 Markdown，不要解释。

可选 action:
- "none": 没有值得长期记忆的内容。
- "ask": 内容可能值得长期记忆，但用户没有明确要求记住，需要弹窗让用户确认。
- "save": 用户明确要求记住、别忘、帮我记住等，可以直接写入。

值得长期记忆的内容包括：
- 稳定偏好、厌恶、边界、习惯、身份信息、重要日期。
- 对用户未来有帮助的事件、计划、目标、压力源、关系约定。
- 在关系中反复出现或情绪强度较高的细节。

不要记录：
- 普通寒暄、一次性的短情绪、无上下文玩笑。
- 敏感或隐私过重但用户没有要求记住的内容。
- 已经存在于长期记忆中的重复内容。

当前记忆设置：
- 自动总结聊天记录：${autoSummaryLabel}。
- 本次判断可读取的聊天上下文：${contextRangeLabel}。
- 本次判断可读取的既有长期记忆：${memoryLibraryLabel}。

用户配置的记忆沉淀规则：
${memoryRule}

JSON schema:
{"action":"none"|"ask"|"save","content":"适合长期保存的一句话，主语用用户，不要写角色回复","tags":["偏好"|"重要日期"|"情绪事件"|"关系事件"|"计划安排"|"身份信息"],"importance":1-10,"question":"功能弹窗标题"}

如果 action 是 none，其他字段可以省略。`,
    },
    {
      role: 'user',
      content: `角色：${input.character.name}

最近长期记忆：
${existingMemoryText}

最近上下文：
${recentText || '暂无'}

本轮用户消息：
${input.userMessage.content}

本轮角色回复：
${input.assistantMessage.content}

请判断本轮用户消息是否应该进入长期记忆。`,
    },
  ];
}

export function buildMemoryDecisionDebugSnapshot(input: MemoryDecisionInput): DebugAgentSurface {
  const messages = buildMemoryJudgePrompt(input);
  const autoMemoryActive = shouldRunDuringChatAutoMemory(input.memory);
  return {
    title: '长期记忆 Agent',
    description: autoMemoryActive
      ? '角色回复完成后运行，判断本轮对话是否写入长期记忆；LLM 不可用时回退到本地规则。'
      : '当前聊天中自动总结未开启；只会响应用户明确要求“记住”的直接写入。',
    sections: [
      { title: 'LLM System Prompt', content: messages[0]?.content ?? '', active: autoMemoryActive },
      { title: 'LLM User Context', content: messages[1]?.content ?? '', active: autoMemoryActive },
      {
        title: '本地 fallback 规则',
        content: [
          '直接保存触发：帮我记住、记住这件事、不要忘记、别忘了、我想让你记住等。',
          autoMemoryActive
            ? '候选询问触发：我喜欢/讨厌/害怕/想要、生日、纪念日、第一次、约定、习惯、目标、重要情绪、今天很累等。'
            : '聊天中自动总结关闭时，候选询问不会弹出，只保留用户明确要求记住的直接写入。',
          '标签推断：偏好、重要日期、情绪事件、关系事件。',
        ].join('\n'),
        active: true,
      },
    ],
    requestSummary: [
      { label: 'Model', value: input.service.model || '未配置' },
      { label: 'Temperature', value: '0.1' },
      { label: 'Max Tokens', value: '360' },
      { label: 'Output', value: 'JSON only' },
      { label: 'Auto Summarize', value: autoMemoryActive ? 'during chat' : 'direct save only' },
      { label: 'Context Range', value: input.memory.alwaysRetainHistory ? String(normalizeRange(input.memory.retentionRange, DEFAULT_MEMORY_CONTEXT_RANGE)) : 'current turn' },
      { label: 'Memory Library', value: input.memory.alwaysProvideFullMemory ? 'full' : `latest ${DEFAULT_MEMORY_LIBRARY_RANGE}` },
    ],
    notes: ['API Key 不展示；action=ask 时由 UI 弹出确认，不会写进聊天正文。', '保留范围只限制判断上下文，不会删除本地聊天记录。'],
  };
}

async function evaluateWithLlm(input: MemoryDecisionInput): Promise<MemoryDecision | null> {
  if (!shouldRunDuringChatAutoMemory(input.memory)) return null;

  const baseUrl = getBaseUrl(input.service);
  const apiKey = getApiKey(input.service);
  if (!baseUrl || !apiKey || !input.service.model.trim()) return null;

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: input.service.model.trim(),
      messages: buildMemoryJudgePrompt(input),
      stream: false,
      temperature: 0.1,
      max_tokens: 360,
    }),
  });

  if (!response.ok) return null;
  const data = await response.json();
  const content = extractAssistantContent(data);
  return normalizeMemoryDecision(extractJsonObject(content));
}

export async function evaluateMemoryDecisionAfterReply(input: MemoryDecisionInput): Promise<MemoryDecision> {
  try {
    const llmDecision = await evaluateWithLlm(input);
    if (llmDecision) return llmDecision;
  } catch {}

  return evaluateLocalFallback(input);
}
