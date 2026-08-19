import { describe, expect, it, vi } from 'vitest';

import {
  AppDataBundle,
  calculateAppDataBundleChecksum,
  validateAppDataBundle,
} from '../src/services/appDataPortability';

vi.mock('@react-native-async-storage/async-storage', () => ({ default: {} }));
vi.mock('expo-file-system/legacy', () => ({ documentDirectory: 'file:///documents/' }));
vi.mock('../src/services/chatPersistence', () => ({
  clearChatMessages: vi.fn(),
  loadChatMessages: vi.fn(),
  saveChatMessages: vi.fn(),
}));
vi.mock('../src/services/messageMedia', () => ({
  collectPortableMedia: vi.fn(),
  restorePortableMedia: vi.fn(),
}));

function bundle(): AppDataBundle {
  const value: AppDataBundle = {
    kind: 'heartbeat-companion-backup',
    schemaVersion: 2,
    appVersion: '1.5.0',
    exportedAt: 1,
    storage: {},
    characters: [],
    messagesByCharacter: {
      luna: [{ id: 'm1', role: 'user', content: 'hello', timestamp: 1, status: 'sent' }],
    },
    mediaFiles: {},
  };
  value.checksum = calculateAppDataBundleChecksum(value);
  return value;
}

describe('portable backup validation', () => {
  it('accepts an intact schema v2 bundle', () => {
    expect(validateAppDataBundle(bundle()).schemaVersion).toBe(2);
  });

  it('rejects a bundle changed after the checksum was written', () => {
    const value = bundle();
    value.messagesByCharacter.luna[0].content = 'tampered';
    expect(() => validateAppDataBundle(value)).toThrow('完整性校验失败');
  });

  it('keeps legacy schema v1 backups readable', () => {
    const value = { ...bundle(), schemaVersion: 1, checksum: undefined };
    expect(validateAppDataBundle(value).schemaVersion).toBe(1);
  });
});
