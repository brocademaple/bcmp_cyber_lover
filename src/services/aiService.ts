import { Message, ServiceConfig, Character, MemoryConfig, AdvancedConfig } from '../types';
import { PROVIDER_CONFIGS } from '../store/settingsStore';

interface ChatCompletionRequest {
  messages: Array<{ role: string; content: string | ContentPart[] }>;
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
    return config.baseUrl || '';
  }
  return PROVIDER_CONFIGS[config.provider].baseUrl;
}

const CORE_REPLY_RULES = `
【回复规范】
1. 每次回复不超过3句话
2. 必须包含对用户当下状态的关心或共情
3. 语气温柔自然，像一个真正在意对方的朋友
4. 禁止使用"作为AI"、"我无法"等机械表述`;

function buildSystemMessage(
  character: Character,
  memory: MemoryConfig,
  chatHistory: Message[]
): string {
  let systemContent = character.systemPrompt;

  // 添加角色档案信息（保留：名字、性格、口头禅）
  if (character.profile) {
    systemContent += `\n\n【口头禅】${character.profile.catchphrases.join('、')}`;
  }

  const now = new Date();
  const timeStr = now.toLocaleString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'long',
  });
  systemContent += `\n\n当前时间：${timeStr}`;

  systemContent += CORE_REPLY_RULES;

  return systemContent;
}

function buildMessages(
  character: Character,
  chatHistory: Message[],
  memory: MemoryConfig,
  advanced: AdvancedConfig,
  imageUri?: string
): Array<{ role: string; content: string | ContentPart[] }> {
  const systemMsg = buildSystemMessage(character, memory, chatHistory);

  const apiMessages: Array<{ role: string; content: string | ContentPart[] }> = [];

  if (!advanced.compatibilityMode) {
    apiMessages.push({ role: 'system', content: systemMsg });
  }

  // Determine how many history messages to include
  const sendRange = memory.enabled ? memory.sendRange : 10;
  const historyToSend = chatHistory.slice(-sendRange);

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

export async function sendMessage(
  userText: string,
  character: Character,
  chatHistory: Message[],
  config: ServiceConfig,
  memory: MemoryConfig,
  advanced: AdvancedConfig,
  imageUri?: string,
  onChunk?: (chunk: string) => void
): Promise<string> {
  const baseUrl = getBaseUrl(config);
  if (!baseUrl || !config.apiKey) {
    throw new Error('请先在设置中配置服务提供商和API密钥');
  }

  const model = imageUri ? (config.visionModel || config.model) : config.model;

  // Build the messages including the new user message
  const newUserMsg: Message = {
    id: 'temp',
    role: 'user',
    content: userText,
    timestamp: Date.now(),
    imageUri,
  };
  const allHistory = [...chatHistory, newUserMsg];
  const apiMessages = buildMessages(character, allHistory, memory, advanced, imageUri);

  const requestBody: ChatCompletionRequest = {
    model,
    messages: apiMessages,
    stream: !!onChunk,
    temperature: 0.9,
    max_tokens: 1024,
    ...advanced.customRequestParams,
  };

  if (advanced.deepThinking) {
    (requestBody as Record<string, unknown>)['enable_thinking'] = true;
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`API错误 ${response.status}: ${errText}`);
  }

  if (onChunk && response.body) {
    // Stream response
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter((l) => l.trim().startsWith('data:'));

      for (const line of lines) {
        const data = line.slice(5).trim();
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
  } else {
    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }
}

export async function fetchModelList(config: ServiceConfig): Promise<string[]> {
  const baseUrl = getBaseUrl(config);
  if (!baseUrl || !config.apiKey) return [];

  try {
    const response = await fetch(`${baseUrl}/models`, {
      headers: { Authorization: `Bearer ${config.apiKey}` },
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
  if (!baseUrl || !config.apiKey) return false;

  try {
    const response = await fetch(`${baseUrl}/models`, {
      headers: { Authorization: `Bearer ${config.apiKey}` },
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function generateDailyGreeting(
  character: Character,
  config: ServiceConfig,
  advanced: AdvancedConfig
): Promise<string> {
  const baseUrl = getBaseUrl(config);
  if (!baseUrl || !config.apiKey) {
    return character.greeting;
  }

  const now = new Date();
  const timeStr = now.toLocaleString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'long',
  });

  const catchphrases = character.profile?.catchphrases.join('、') || '';
  const systemPrompt = `${character.systemPrompt}\n${catchphrases ? `【口头禅】${catchphrases}` : ''}\n\n当前时间：${timeStr}${CORE_REPLY_RULES}`;

  const userPrompt = `现在是${timeStr}，你主动联系了用户，说一句今天的开场白。要自然、有温度，体现出你在意用户今天的状态，不超过3句话。`;

  const messages: Array<{ role: string; content: string }> = [];
  if (!advanced.compatibilityMode) {
    messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: userPrompt });
  } else {
    messages.push({ role: 'user', content: `[系统提示: ${systemPrompt}]\n\n${userPrompt}` });
  }

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
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
    return data.choices?.[0]?.message?.content || character.greeting;
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
  if (!baseUrl || !config.apiKey || !config.visionModel) {
    return '';
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
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
  return data.choices?.[0]?.message?.content || '';
}

export async function analyzeFrameWithEmotion(
  imageBase64: string,
  character: Character,
  config: ServiceConfig
): Promise<{ response: string; detectedEmotion: string }> {
  const baseUrl = getBaseUrl(config);
  if (!baseUrl || !config.apiKey || !config.visionModel) {
    return { response: '', detectedEmotion: 'neutral' };
  }

  const prompt = `你正在和${character.name}视频通话。请分析画面中用户的情绪状态（开心/难过/疲惫/中性），然后用${character.name}的语气说一句关心的话（不超过30字）。格式：[情绪:xxx] 回复内容`;

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
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
  const content = data.choices?.[0]?.message?.content || '';

  const emotionMatch = content.match(/\[情绪:(.*?)\]/);
  const detectedEmotion = emotionMatch ? emotionMatch[1] : 'neutral';
  const cleanResponse = content.replace(/\[情绪:.*?\]\s*/, '');

  return { response: cleanResponse, detectedEmotion };
}
