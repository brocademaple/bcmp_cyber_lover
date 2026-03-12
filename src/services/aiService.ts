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

function buildSystemMessage(
  character: Character,
  memory: MemoryConfig,
  chatHistory: Message[]
): string {
  let systemContent = character.systemPrompt;

  // 添加角色档案信息
  if (character.profile) {
    systemContent += `\n\n【你的背景】${character.profile.backstory}`;
    systemContent += `\n【兴趣爱好】${character.profile.hobbies.join('、')}`;
    systemContent += `\n【口头禅】${character.profile.catchphrases.join('、')}`;
  }

  // 添加情感状态
  if (character.emotionalState) {
    const { mood, intimacy, energy } = character.emotionalState;
    systemContent += `\n\n【当前状态】心情：${mood}，亲密度：${intimacy}/100，精力：${energy}/100`;
    systemContent += `\n请根据当前情感状态调整你的回复风格和语气。`;
  }

  // 添加关键记忆
  if (character.memories && character.memories.length > 0) {
    const importantMemories = character.memories
      .filter(m => m.importance >= 7)
      .slice(-5)
      .map(m => `- ${m.content} (${m.tags.join(', ')})`);
    if (importantMemories.length > 0) {
      systemContent += `\n\n【重要记忆】\n${importantMemories.join('\n')}`;
    }
  }

  if (memory.enabled && chatHistory.length > 0) {
    const memoryPrompt = memory.memorySystemPrompt;
    systemContent = `${systemContent}\n\n${memoryPrompt}`;
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
