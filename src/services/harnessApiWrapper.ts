/**
 * Harness API Wrapper
 * 
 * 简化的 API 调用封装，用于 Harness 服务（Ingest Distiller 和 Teahouse Session）
 */

import { ServiceProvider } from '../types';
import { PROVIDER_CONFIGS } from '../store/settingsStore';

interface ApiRequestParams {
  provider: ServiceProvider;
  apiKey: string;
  model: string;
  baseUrl?: string;
  messages: Array<{ role: string; content: string }>;
  temperature: number;
}

function getBaseUrl(provider: ServiceProvider, customBaseUrl?: string): string {
  if (provider === 'custom') {
    return customBaseUrl?.trim() || '';
  }
  return PROVIDER_CONFIGS[provider].baseUrl;
}

/**
 * 简化的 API 请求函数
 * 返回 assistant 的文本回复
 */
export async function makeLLMRequest(params: ApiRequestParams): Promise<string> {
  const { provider, apiKey, model, baseUrl, messages, temperature } = params;
  
  const url = `${getBaseUrl(provider, baseUrl)}/chat/completions`;
  
  const requestBody = {
    model,
    messages,
    temperature,
    stream: false,
  };
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }
    
    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  } catch (error) {
    console.error('[HarnessAPI] Request failed:', error);
    throw error;
  }
}
