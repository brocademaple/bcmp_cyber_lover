import { describe, expect, it, vi } from 'vitest';
import type { Character } from '../src/types';
import { getPresentedCharacter, getVisibleCharacters } from '../src/utils/characterRelease';

// Native image requires are handled by Expo; isolate its existing alias registry here.
vi.mock('../src/utils/characterAssets', () => ({
  resolveDefaultCharacterAssetKey: (character: Character) => character.id === 'luya' ? 'qingning' : undefined,
}));

const characters = ['qingning', 'sakura', 'luna', 'custom_1'].map((id) => ({
  id,
  name: id,
  memories: [{ id: `memory_${id}`, content: '保留原有共同经历' }],
})) as Character[];

describe('staged character release', () => {
  it('presents Luya to the public while preserving the complete roster and memories', () => {
    const before = JSON.stringify(characters);
    expect(getVisibleCharacters(characters, 'explore').map((item) => item.id)).toEqual(['qingning']);
    expect(JSON.stringify(characters)).toBe(before);
    expect(getVisibleCharacters(characters, 'admin')).toBe(characters);
  });

  it('keeps a previous selection recoverable when returning to developer mode', () => {
    const selectedId = 'sakura';
    expect(getPresentedCharacter(characters, selectedId, 'explore')?.id).toBe('qingning');
    expect(getPresentedCharacter(characters, selectedId, 'admin')).toBe(characters[1]);
    expect(getPresentedCharacter(characters, 'custom_1', 'admin')).toBe(characters[3]);
  });

  it('does not expose another character if the public character has not loaded', () => {
    expect(getVisibleCharacters(characters.slice(1), 'explore')).toEqual([]);
    expect(getPresentedCharacter([], 'sakura', 'explore')).toBeUndefined();
  });

  it('uses the existing alias registry without replacing the persisted id or memories', () => {
    const legacy = { ...characters[0], id: 'luya' };
    expect(getVisibleCharacters([legacy, characters[1]], 'explore')).toEqual([legacy]);
    expect(getVisibleCharacters([characters[0], legacy], 'explore')).toEqual([characters[0]]);
    expect(legacy.id).toBe('luya');
    expect(legacy.memories).toBe(characters[0].memories);
  });
});
