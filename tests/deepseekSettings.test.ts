import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDeepSeekRequestParams } from '../src/services/deepseekRequest';
import type { ServiceConfig } from '../src/types';

const storage = vi.hoisted(() => ({
  getItem: vi.fn(), setItem: vi.fn(), getSecure: vi.fn(),
}));
vi.mock('@react-native-async-storage/async-storage', () => ({ default: storage }));
vi.mock('../src/services/secureStorage', () => ({
  getSecure: storage.getSecure, saveSecure: vi.fn(), deleteSecure: vi.fn(),
}));

afterEach(() => vi.unstubAllEnvs());

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubEnv('EXPO_PUBLIC_DEEPSEEK_API_KEY', 'test-env-key');
  storage.getItem.mockResolvedValue(null);
  storage.getSecure.mockResolvedValue(null);
});

describe('DeepSeek Flash settings', () => {
  it('configures a new phone using the local key and Flash', async () => {
    const { useSettingsStore } = await import('../src/store/settingsStore');
    await useSettingsStore.getState().loadSettings();
    expect(useSettingsStore.getState().settings.service).toMatchObject({
      provider: 'deepseek', model: 'deepseek-flash', visionModel: 'deepseek-flash', apiKey: 'test-env-key',
    });
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('updates the previous default while retaining the saved key and unrelated preferences', async () => {
    const saved = {
      service: { provider: 'deepseek', model: 'deepseek-chat', visionModel: 'deepseek-chat' },
      selectedCharacterId: 'my-character', memory: { sendRange: 7 },
    };
    storage.getItem.mockResolvedValue(JSON.stringify(saved));
    storage.getSecure.mockResolvedValue('saved-key');
    const { useSettingsStore } = await import('../src/store/settingsStore');
    await useSettingsStore.getState().loadSettings();
    const loaded = useSettingsStore.getState().settings;
    expect(loaded.service).toMatchObject({ model: 'deepseek-flash', visionModel: 'deepseek-flash', apiKey: 'saved-key' });
    expect(loaded.selectedCharacterId).toBe(saved.selectedCharacterId);
    expect(loaded.memory.sendRange).toBe(7);
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('preserves an explicitly selected model and another provider', async () => {
    for (const provider of ['deepseek', 'custom']) {
      storage.getItem.mockResolvedValue(JSON.stringify({ service: { provider, model: 'chosen-model', visionModel: 'chosen-vision', baseUrl: 'https://example.com/v1' } }));
      storage.getSecure.mockResolvedValue('saved-key');
      const { useSettingsStore } = await import('../src/store/settingsStore');
      await useSettingsStore.getState().loadSettings();
      expect(useSettingsStore.getState().settings.service).toMatchObject({ provider, model: 'chosen-model', visionModel: 'chosen-vision', apiKey: 'saved-key' });
    }
  });

  it('disables server-default thinking for economical calls and respects the chat switch', () => {
    const config = { provider: 'deepseek' } as ServiceConfig;
    expect(getDeepSeekRequestParams(config)).toEqual({ thinking: { type: 'disabled' } });
    expect(getDeepSeekRequestParams(config, true)).toEqual({ thinking: { type: 'enabled' } });
    expect(getDeepSeekRequestParams({ provider: 'custom' } as ServiceConfig)).toEqual({});
  });
});
