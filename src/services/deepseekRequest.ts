import type { ServiceConfig } from '../types';

// Flash enables thinking on the server by default. Specify it explicitly so
// short chat, memory, and connection requests can return within their budgets.
export function getDeepSeekRequestParams(config: ServiceConfig, deepThinking = false) {
  return config.provider === 'deepseek'
    ? { thinking: { type: deepThinking ? 'enabled' : 'disabled' } }
    : {};
}
