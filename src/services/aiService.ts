import {
  Message,
  ServiceConfig,
  Character,
  EmotionalState,
  MemoryConfig,
  AdvancedConfig,
  DebugPromptMessage,
  DebugPromptSnapshot,
} from '../types';
import { PROVIDER_CONFIGS } from '../store/settingsStore';
import { getRelationshipPrompt } from './relationshipService';
import { recentChronological } from '../utils/chatHistory';
import {
  buildCharacterPromptLayers,
  buildMoodEntryGreetingPrompt,
  getMoodEntryGreetingFallback,
  renderCharacterPromptLayers,
} from './characterPromptArchitectureService';
import { messageImageToProviderUrl } from './messageMedia';
import {
  createRequestScope,
  fetchWithTimeout,
  normalizeRequestError,
} from './requestTimeout';

interface ChatCompletionRequest {
  messages: { role: string; content: string | ContentPart[] }[];
  model: string;
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  [key: string]: unknown;
}

interface ContentPart {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: { url: string };
}

function getBaseUrl(config: ServiceConfig): string {
  if (config.provider === 'custom') {
    return config.baseUrl?.trim() || '';
  }
  return PROVIDER_CONFIGS[config.provider].baseUrl;
}

function getApiKey(config: ServiceConfig): string {
  return config.apiKey.trim();
}

function supportsStreamingResponse(): boolean {
  return !(
    typeof navigator !== 'undefined' &&
    (navigator as Navigator & { product?: string }).product === 'ReactNative'
  );
}

function extractAssistantContent(data: { choices?: { message?: { content?: string } }[] }): string {
  return data.choices?.[0]?.message?.content || '';
}

function getApiErrorText(status: number, text: string): string {
  if (status === 401 || status === 403) return '密钥无法通过验证，请检查 API Key 或模型权限。';
  if (status === 404) return '服务地址或模型接口不可用，请检查 Base URL 是否兼容 OpenAI /v1。';
  if (status >= 500) return '服务端暂时不可用，请稍后重试或切换服务。';
  return text ? `服务返回 ${status}: ${text}` : `服务返回 ${status}`;
}

function buildTimeContext(nowTs = Date.now()): { timeStr: string; periodLabel: string; periodGuide: string } {
  const now = new Date(nowTs);
  const hour = now.getHours();
  const timeStr = now.toLocaleString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'long',
  });

  if (hour >= 23 || hour < 5) {
    return {
      timeStr,
      periodLabel: '深夜',
      periodGuide: '用户可能已经疲惫、失眠或情绪更柔软。回复要放低音量、更短、更轻，优先关心休息、陪伴和安全感；不要用白天式高能量开场。',
    };
  }
  if (hour < 9) {
    return {
      timeStr,
      periodLabel: '清晨',
      periodGuide: '回复可以带一点醒来的轻柔感，关心睡得好不好、今天是否需要慢慢开始。',
    };
  }
  if (hour < 12) {
    return {
      timeStr,
      periodLabel: '上午',
      periodGuide: '回复可以自然关心今天的安排、精神状态和早餐，不要过度夜间化。',
    };
  }
  if (hour < 18) {
    return {
      timeStr,
      periodLabel: '白天',
      periodGuide: '回复可以更清醒、稳定，关心正在进行的事和用户的精力消耗。',
    };
  }
  return {
    timeStr,
    periodLabel: '晚上',
    periodGuide: '回复可以更松弛，关心用户今天过得怎么样、有没有吃饭休息，语气适合收束一天。',
  };
}

export { getCharacterStateLabel } from './characterPromptArchitectureService';

const CORE_REPLY_RULES = `
【回复规范】
1. 每次回复不超过3句话
2. 必须包含对用户当下状态的关心或共情
3. 语气温柔自然，像一个真正在意对方的朋友
4. 禁止使用"作为AI"、"我无法"等机械表述
5. 不要在聊天正文里询问“要不要写进记忆”，也不要主动声称已经写入记忆；记忆写入会由系统在回复后通过独立控件处理`;

const DISABLED_MEMORY_CONFIG: MemoryConfig = {
  enabled: false,
  alwaysRetainHistory: true,
  retentionRange: 0,
  sendRange: 0,
  alwaysProvideFullMemory: false,
  specificTimeRangeHours: 0,
  autoSummarize: false,
  autoSummarizeTrigger: 'on_exit',
  memorySystemPrompt: '',
};

function buildSystemMessage(
  character: Character,
  memory: MemoryConfig,
  chatHistory: Message[],
  nowTs = Date.now()
): string {
  const promptLayers = buildCharacterPromptLayers(character, { chatHistory, nowTs });
  let systemContent = renderCharacterPromptLayers(promptLayers);

  const activeMemories = (character.memories ?? []).filter((item) => item.status !== 'superseded');
  if (memory.enabled && activeMemories.length > 0) {
    const memoriesToProvide = memory.alwaysProvideFullMemory
      ? activeMemories
      : activeMemories.slice(-8);
    const memoryLines = memoriesToProvide
      .map((item) => `- ${item.status === 'locked' ? '[用户锁定] ' : ''}${item.content}`)
      .join('\n');
    systemContent += `\n\n【你们已经确认写入的记忆】\n${memoryLines}`;
  }

  if (memory.enabled && memory.memorySystemPrompt.trim()) {
    systemContent += `\n\n【长期记忆使用规则】\n${memory.memorySystemPrompt.trim()}`;
  }

  systemContent += getRelationshipPrompt(character);

  const timeContext = buildTimeContext(nowTs);
  systemContent += `\n\n当前时间：${timeContext.timeStr}`;
  systemContent += `\n当前时段：${timeContext.periodLabel}`;
  systemContent += `\n时段语境：${timeContext.periodGuide}`;

  systemContent += CORE_REPLY_RULES;

  return systemContent;
}

function buildMessages(
  character: Character,
  chatHistory: Message[],
  memory: MemoryConfig,
  advanced: AdvancedConfig,
  imageUri?: string,
  nowTs = Date.now()
): { role: string; content: string | ContentPart[] }[] {
  const systemMsg = buildSystemMessage(character, memory, chatHistory, nowTs);

  const apiMessages: { role: string; content: string | ContentPart[] }[] = [];

  if (!advanced.compatibilityMode) {
    apiMessages.push({ role: 'system', content: systemMsg });
  }

  // Determine how many history messages to include
  const sendRange = memory.enabled ? memory.sendRange : 10;
  const historyToSend = recentChronological(
    chatHistory.filter((msg) => msg.status !== 'failed'),
    sendRange
  );

  // In compatibility mode, prepend system to first user message
  let systemPrepended = false;

  for (const msg of historyToSend) {
    if (msg.role === 'system') continue;

    let content: string | ContentPart[] = msg.content;

    if (msg.imageUri) {
      content = [
        { type: 'image_url', image_url: { url: msg.imageUri } },
        { type: 'text', text: msg.content || '请描述这张图片' },
      ];
    }

    if (advanced.compatibilityMode && !systemPrepended && msg.role === 'user') {
      if (typeof content === 'string') {
        content = `[系统提示: ${systemMsg}]\n\n${content}`;
      }
      systemPrepended = true;
    }

    apiMessages.push({ role: msg.role, content });
  }

  return apiMessages;
}

function previewMessageContent(content: string | ContentPart[]): { preview: string; hasImage?: boolean } {
  if (typeof content === 'string') {
    return { preview: content.slice(0, 520) };
  }

  const text = content
    .filter((part) => part.type === 'text' && part.text)
    .map((part) => part.text)
    .join('\n');
  return {
    preview: text.slice(0, 520) || '图片消息',
    hasImage: content.some((part) => part.type === 'image_url'),
  };
}

function toDebugMessages(messages: { role: string; content: string | ContentPart[] }[]): DebugPromptMessage[] {
  return messages.map((message) => {
    const preview = previewMessageContent(message.content);
    return {
      role: message.role,
      contentPreview: preview.preview,
      hasImage: preview.hasImage,
    };
  });
}

function buildSafeBaseRequestSummary(
  config: ServiceConfig,
  advanced: AdvancedConfig,
  model: string,
  extras: { label: string; value: string }[] = []
) {
  const customKeys = Object.keys(advanced.customRequestParams ?? {});
  return [
    { label: 'Provider', value: config.provider },
    { label: 'Base URL', value: getBaseUrl(config) || '未配置' },
    { label: 'Model', value: model || '未配置' },
    { label: 'Compatibility', value: advanced.compatibilityMode ? 'on' : 'off' },
    { label: 'Deep Thinking', value: advanced.deepThinking ? 'on' : 'off' },
    { label: 'Custom Params', value: customKeys.length ? customKeys.join(', ') : 'none' },
    ...extras,
  ];
}

export function buildPromptDebugSnapshot({
  character,
  chatHistory,
  config,
  memory,
  advanced,
  userText = '（调试预览）今天有点累，想听你说句话。',
  imageUri,
  nowTs,
}: {
  character: Character;
  chatHistory: Message[];
  config: ServiceConfig;
  memory: MemoryConfig;
  advanced: AdvancedConfig;
  userText?: string;
  imageUri?: string;
  nowTs?: number;
}): DebugPromptSnapshot {
  const effectiveNowTs = nowTs ?? advanced.debugNowTs ?? Date.now();
  const model = imageUri ? (config.visionModel || config.model) : config.model;
  const timeContext = buildTimeContext(effectiveNowTs);
  const newUserMsg: Message = {
    id: 'debug_preview',
    role: 'user',
    content: userText,
    timestamp: effectiveNowTs,
    imageUri,
  };
  const allHistory = [...chatHistory, newUserMsg];
  const finalSystemPrompt = buildSystemMessage(character, memory, allHistory, effectiveNowTs);
  const apiMessages = buildMessages(character, allHistory, memory, advanced, imageUri, effectiveNowTs);
  const promptLayers = buildCharacterPromptLayers(character, { chatHistory: allHistory, nowTs: effectiveNowTs });
  const activeMemories = (character.memories ?? []).filter((item) => item.status !== 'superseded');
  const memoryLines = memory.enabled && activeMemories.length
    ? (memory.alwaysProvideFullMemory ? activeMemories : activeMemories.slice(-8))
      .map((item) => `- ${item.status === 'locked' ? '[用户锁定] ' : ''}${item.content}`)
      .join('\n')
    : '当前没有注入长期记忆，或记忆功能未开启。';
  const relationshipPrompt = getRelationshipPrompt(character).trim() || '该角色没有单独配置关系成长规则。';

  return {
    kind: 'chat',
    title: `${character.name} · 主聊天 Prompt`,
    provider: config.provider,
    model,
    baseUrl: getBaseUrl(config),
    sections: [
      ...promptLayers.map((layer) => ({ title: layer.title, content: layer.content, active: layer.active })),
      { title: '已确认记忆', content: memoryLines, active: memory.enabled },
      { title: '长期记忆使用规则', content: memory.memorySystemPrompt || '未配置', active: memory.enabled && !!memory.memorySystemPrompt.trim() },
      { title: '关系规则', content: relationshipPrompt, active: !!character.relationshipRules },
      { title: '时间语境', content: `${timeContext.timeStr}\n${timeContext.periodLabel}\n${timeContext.periodGuide}`, active: true },
      { title: '回复规范', content: CORE_REPLY_RULES.trim(), active: true },
    ],
    finalSystemPrompt,
    userPrompt: userText,
    apiMessagesPreview: toDebugMessages(apiMessages),
    requestSummary: buildSafeBaseRequestSummary(config, advanced, model, [
      { label: 'History Sent', value: String(recentChronological(allHistory.filter((msg) => msg.status !== 'failed'), memory.enabled ? memory.sendRange : 10).length) },
      { label: 'Send Range', value: String(memory.enabled ? memory.sendRange : 10) },
      { label: 'Memory Library', value: memory.alwaysProvideFullMemory ? 'full' : 'latest 8' },
      { label: 'Image Mode', value: imageUri ? 'vision model' : 'text model' },
      { label: 'Temperature', value: '0.9' },
      { label: 'Max Tokens', value: '1024' },
    ]),
    notes: [
      advanced.compatibilityMode
        ? '兼容模式开启：system prompt 会拼进第一条 user message。'
        : '标准模式：system prompt 作为独立 system message 发送。',
      'API Key 不会在调试台展示。',
    ],
  };
}

export function buildDailyGreetingDebugSnapshot(
  character: Character,
  config: ServiceConfig,
  advanced: AdvancedConfig,
  nowTs?: number
): DebugPromptSnapshot {
  const effectiveNowTs = nowTs ?? advanced.debugNowTs ?? Date.now();
  const timeContext = buildTimeContext(effectiveNowTs);
  const promptLayers = buildCharacterPromptLayers(character, { chatHistory: [], nowTs: effectiveNowTs });
  const systemPrompt = buildSystemMessage(character, DISABLED_MEMORY_CONFIG, [], effectiveNowTs);
  const userPrompt = `现在是${timeContext.timeStr}（${timeContext.periodLabel}），你主动联系了用户，说一句今天的开场白。要自然、有温度，体现出你在意用户今天的状态，不超过3句话，并符合这个时段的语境。`;
  const messages = advanced.compatibilityMode
    ? [{ role: 'user', content: `[系统提示: ${systemPrompt}]\n\n${userPrompt}` }]
    : [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ];

  return {
    kind: 'dailyGreeting',
    title: `${character.name} · 每日主动问候`,
    provider: config.provider,
    model: config.model,
    baseUrl: getBaseUrl(config),
    sections: [
      ...promptLayers.map((layer) => ({ title: layer.title, content: layer.content, active: layer.active })),
      { title: 'System Prompt', content: systemPrompt, active: true },
      { title: 'User Prompt', content: userPrompt, active: true },
      { title: 'Fallback Greeting', content: character.greeting, active: true },
    ],
    finalSystemPrompt: systemPrompt,
    userPrompt,
    apiMessagesPreview: messages.map((message) => ({ role: message.role, contentPreview: message.content.slice(0, 520) })),
    requestSummary: buildSafeBaseRequestSummary(config, advanced, config.model, [
      { label: 'Temperature', value: '0.95' },
      { label: 'Max Tokens', value: '200' },
    ]),
    notes: ['服务不可用时直接回退到角色 greeting。'],
  };
}

export function buildVisionAgentDebugSnapshot(character: Character, config: ServiceConfig): DebugPromptSnapshot {
  const emotionPrompt = `你正在和${character.name}视频通话。请分析画面中用户的情绪状态（开心/难过/疲惫/中性），然后用${character.name}的语气说一句关心的话（不超过30字）。格式：[情绪:xxx] 回复内容`;
  const framePrompt = '请描述你在视频画面中看到的内容，用温柔自然的语气回应。';
  return {
    kind: 'vision',
    title: `${character.name} · 视觉/视频 Agent`,
    provider: config.provider,
    model: config.visionModel,
    baseUrl: getBaseUrl(config),
    sections: [
      { title: '视频情绪识别 Prompt', content: emotionPrompt, active: true },
      { title: '通用画面理解 Prompt', content: framePrompt, active: true },
      { title: '回退状态', content: !config.visionModel ? '未配置 visionModel 时返回空响应/neutral。' : 'visionModel 已配置。', active: true },
    ],
    userPrompt: emotionPrompt,
    apiMessagesPreview: [
      { role: 'user', contentPreview: emotionPrompt, hasImage: true },
    ],
    requestSummary: [
      { label: 'Provider', value: config.provider },
      { label: 'Base URL', value: getBaseUrl(config) || '未配置' },
      { label: 'Vision Model', value: config.visionModel || '未配置' },
      { label: 'Max Tokens', value: '256' },
    ],
    notes: ['图片以 data:image/jpeg;base64 形式发送；API Key 不展示。'],
  };
}

export function buildServiceTestDebugSnapshot(config: ServiceConfig): DebugPromptSnapshot {
  return {
    kind: 'serviceTest',
    title: '服务连接测试 Prompt',
    provider: config.provider,
    model: config.model,
    baseUrl: getBaseUrl(config),
    sections: [
      { title: 'System', content: '你是连接测试助手，只回复一句简短中文。', active: true },
      { title: 'User', content: '请回复“连接正常”。', active: true },
    ],
    userPrompt: '请回复“连接正常”。',
    apiMessagesPreview: [
      { role: 'system', contentPreview: '你是连接测试助手，只回复一句简短中文。' },
      { role: 'user', contentPreview: '请回复“连接正常”。' },
    ],
    requestSummary: [
      { label: 'Provider', value: config.provider },
      { label: 'Base URL', value: getBaseUrl(config) || '未配置' },
      { label: 'Model', value: config.model || '未配置' },
      { label: 'Temperature', value: '0' },
      { label: 'Max Tokens', value: '32' },
    ],
    notes: ['用于验证 /chat/completions，不展示 API Key。'],
  };
}

export async function sendMessage(
  userText: string,
  character: Character,
  chatHistory: Message[],
  config: ServiceConfig,
  memory: MemoryConfig,
  advanced: AdvancedConfig,
  imageUri?: string,
  onChunk?: (chunk: string) => void,
  nowTs?: number,
  signal?: AbortSignal
): Promise<string> {
  const baseUrl = getBaseUrl(config);
  const apiKey = getApiKey(config);
  if (!baseUrl || !apiKey) {
    throw new Error('请先在设置中配置服务提供商和API密钥');
  }

  const effectiveNowTs = nowTs ?? advanced.debugNowTs ?? Date.now();
  const model = imageUri ? (config.visionModel || config.model) : config.model;

  // Build the messages including the new user message
  const newUserMsg: Message = {
    id: 'temp',
    role: 'user',
    content: userText,
    timestamp: effectiveNowTs,
    imageUri,
  };
  const allHistory = [...chatHistory, newUserMsg];
  const preparedHistory = await Promise.all(
    allHistory.map(async (message) =>
      message.imageUri
        ? { ...message, imageUri: await messageImageToProviderUrl(message.imageUri) }
        : message
    )
  );
  const preparedImageUri = imageUri ? await messageImageToProviderUrl(imageUri) : undefined;
  const apiMessages = buildMessages(
    character,
    preparedHistory,
    memory,
    advanced,
    preparedImageUri,
    effectiveNowTs
  );

  const shouldStream = !!onChunk && supportsStreamingResponse();
  const requestBody: ChatCompletionRequest = {
    model,
    messages: apiMessages,
    stream: shouldStream,
    temperature: 0.9,
    max_tokens: 1024,
    ...advanced.customRequestParams,
  };

  if (advanced.deepThinking) {
    (requestBody as Record<string, unknown>)['enable_thinking'] = true;
  }

  const requestScope = createRequestScope(45_000, signal);
  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
      signal: requestScope.signal,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`API错误 ${response.status}: ${errText}`);
    }

    if (shouldStream && response.body) {
    // Stream response
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;

        const data = trimmed.slice(5).trim();
        if (data === '[DONE]') break;
        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta?.content || '';
          if (delta) {
            fullContent += delta;
            onChunk(delta);
          }
        } catch {}
      }
    }

      return fullContent;
    }

    const data = await response.json();
    return extractAssistantContent(data);
  } catch (error) {
    throw normalizeRequestError(error, requestScope);
  } finally {
    requestScope.dispose();
  }
}

export async function fetchModelList(config: ServiceConfig): Promise<string[]> {
  const baseUrl = getBaseUrl(config);
  const apiKey = getApiKey(config);
  if (!baseUrl || !apiKey) return [];

  try {
    const response = await fetchWithTimeout(`${baseUrl}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!response.ok) return [];
    const data = await response.json();
    return (data.data || []).map((m: { id: string }) => m.id);
  } catch {
    return [];
  }
}

export async function testConnection(config: ServiceConfig): Promise<boolean> {
  const baseUrl = getBaseUrl(config);
  const apiKey = getApiKey(config);
  if (!baseUrl || !apiKey) return false;

  try {
    const response = await fetchWithTimeout(`${baseUrl}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function testChatCompletion(
  config: ServiceConfig,
  model = config.model
): Promise<{ ok: boolean; message: string; sample?: string; status?: number }> {
  const baseUrl = getBaseUrl(config);
  const apiKey = getApiKey(config);
  if (!baseUrl || !apiKey) {
    return { ok: false, message: '缺少服务地址或 API Key。' };
  }
  if (!model.trim()) {
    return { ok: false, message: '缺少聊天模型名称。' };
  }

  try {
    const response = await fetchWithTimeout(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model.trim(),
        messages: [
          { role: 'system', content: '你是连接测试助手，只回复一句简短中文。' },
          { role: 'user', content: '请回复“连接正常”。' },
        ],
        stream: false,
        temperature: 0,
        max_tokens: 32,
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      return {
        ok: false,
        status: response.status,
        message: getApiErrorText(response.status, errText),
      };
    }

    const data = await response.json();
    const sample = extractAssistantContent(data).trim();
    return {
      ok: sample.length > 0,
      message: sample.length > 0 ? '聊天模型已完成真实生成。' : '服务响应成功，但没有返回可用文本。',
      sample,
    };
  } catch {
    return { ok: false, message: '没有连到聊天生成接口，请检查网络、Base URL 或服务平台状态。' };
  }
}

export async function generateMoodEntryGreeting(
  character: Character,
  mood: EmotionalState['mood'],
  config: ServiceConfig,
  advanced: AdvancedConfig,
  nowTs?: number
): Promise<string> {
  const baseUrl = getBaseUrl(config);
  const apiKey = getApiKey(config);
  const moodCharacter: Character = {
    ...character,
    emotionalState: {
      mood,
      intimacy: character.emotionalState?.intimacy ?? 50,
      energy: character.emotionalState?.energy ?? 80,
      lastInteraction: character.emotionalState?.lastInteraction ?? nowTs ?? advanced.debugNowTs ?? Date.now(),
    },
  };
  const fallback = getMoodEntryGreetingFallback(moodCharacter, mood);
  if (!baseUrl || !apiKey) {
    return fallback;
  }

  const effectiveNowTs = nowTs ?? advanced.debugNowTs ?? Date.now();
  const systemPrompt = buildSystemMessage(moodCharacter, DISABLED_MEMORY_CONFIG, [], effectiveNowTs);
  const userPrompt = buildMoodEntryGreetingPrompt(moodCharacter, mood);
  const messages: { role: string; content: string }[] = advanced.compatibilityMode
    ? [{ role: 'user', content: `[系统提示: ${systemPrompt}]\n\n${userPrompt}` }]
    : [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ];

  try {
    const response = await fetchWithTimeout(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        stream: false,
        temperature: 0.85,
        max_tokens: 120,
      }),
    });

    if (!response.ok) return fallback;
    const data = await response.json();
    return extractAssistantContent(data).trim() || fallback;
  } catch {
    return fallback;
  }
}

export async function generateDailyGreeting(
  character: Character,
  config: ServiceConfig,
  advanced: AdvancedConfig,
  nowTs?: number
): Promise<string> {
  const baseUrl = getBaseUrl(config);
  const apiKey = getApiKey(config);
  if (!baseUrl || !apiKey) {
    return character.greeting;
  }

  const effectiveNowTs = nowTs ?? advanced.debugNowTs ?? Date.now();
  const timeContext = buildTimeContext(effectiveNowTs);
  const systemPrompt = buildSystemMessage(character, DISABLED_MEMORY_CONFIG, [], effectiveNowTs);

  const userPrompt = `现在是${timeContext.timeStr}（${timeContext.periodLabel}），你主动联系了用户，说一句今天的开场白。要自然、有温度，体现出你在意用户今天的状态，不超过3句话，并符合这个时段的语境。`;

  const messages: { role: string; content: string }[] = [];
  if (!advanced.compatibilityMode) {
    messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: userPrompt });
  } else {
    messages.push({ role: 'user', content: `[系统提示: ${systemPrompt}]\n\n${userPrompt}` });
  }

  try {
    const response = await fetchWithTimeout(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        stream: false,
        temperature: 0.95,
        max_tokens: 200,
      }),
    });

    if (!response.ok) return character.greeting;
    const data = await response.json();
    return extractAssistantContent(data) || character.greeting;
  } catch {
    return character.greeting;
  }
}

export async function analyzeFrame(
  imageBase64: string,
  context: string,
  config: ServiceConfig
): Promise<string> {
  const baseUrl = getBaseUrl(config);
  const apiKey = getApiKey(config);
  if (!baseUrl || !apiKey || !config.visionModel) {
    return '';
  }

  const response = await fetchWithTimeout(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: config.visionModel,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: `data:image/jpeg;base64,${imageBase64}` },
            },
            {
              type: 'text',
              text: context || '请描述你在视频画面中看到的内容，用温柔自然的语气回应。',
            },
          ],
        },
      ],
      max_tokens: 256,
    }),
  });

  if (!response.ok) return '';
  const data = await response.json();
  return extractAssistantContent(data) || '';
}

export async function analyzeFrameWithEmotion(
  imageBase64: string,
  character: Character,
  config: ServiceConfig
): Promise<{ response: string; detectedEmotion: string }> {
  const baseUrl = getBaseUrl(config);
  const apiKey = getApiKey(config);
  if (!baseUrl || !apiKey || !config.visionModel) {
    return { response: '', detectedEmotion: 'neutral' };
  }

  const prompt = `你正在和${character.name}视频通话。请分析画面中用户的情绪状态（开心/难过/疲惫/中性），然后用${character.name}的语气说一句关心的话（不超过30字）。格式：[情绪:xxx] 回复内容`;

  const response = await fetchWithTimeout(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: config.visionModel,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: `data:image/jpeg;base64,${imageBase64}` },
            },
            {
              type: 'text',
              text: prompt,
            },
          ],
        },
      ],
      max_tokens: 256,
    }),
  });

  if (!response.ok) return { response: '', detectedEmotion: 'neutral' };
  const data = await response.json();
  const content = extractAssistantContent(data);

  const emotionMatch = content.match(/\[情绪:(.*?)\]/);
  const detectedEmotion = emotionMatch ? emotionMatch[1] : 'neutral';
  const cleanResponse = content.replace(/\[情绪:.*?\]\s*/, '');

  return { response: cleanResponse, detectedEmotion };
}
