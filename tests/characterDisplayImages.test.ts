import { describe, expect, it, vi } from 'vitest';
import type { Character } from '../src/types';
import { getCharacterAvatarImage, getCharacterMainImage } from '../src/utils/characterDisplayImages';

vi.mock('../src/utils/characterAssets', () => ({
  getDefaultCharacterAssetSet: (character: Character) => character.id === 'qingning'
    ? { main: 11, avatar: 12, headshot: 13 } : undefined,
}));

const defaults = { id: 'qingning', imageUri: 11, assetSet: { main: 11, avatar: 12, headshot: 13 } } as Character;

describe('read-only character display sources', () => {
  it('uses a smaller bundled headshot for ordinary identity images', () => {
    expect(getCharacterAvatarImage(defaults)).toBe(13);
  });

  it('preserves custom avatars ahead of the bundled headshot', () => {
    const edited = { ...defaults, assetSet: { ...defaults.assetSet!, avatar: 'file:///user-avatar.png' } };
    const before = JSON.stringify(edited);
    expect(getCharacterAvatarImage(edited)).toBe('file:///user-avatar.png');
    expect(JSON.stringify(edited)).toBe(before);
  });

  it('preserves a custom main image even when the saved asset set still contains defaults', () => {
    const edited = { ...defaults, imageUri: 'file:///custom-character.png' };
    expect(getCharacterMainImage(edited)).toBe(edited.imageUri);
    expect(getCharacterAvatarImage(edited)).toBe(edited.imageUri);
  });

  it('does not replace an unknown custom character with a default character', () => {
    const custom = { id: 'custom', imageUri: 'file:///my-character.png' } as Character;
    expect(getCharacterMainImage(custom)).toBe(custom.imageUri);
    expect(getCharacterAvatarImage(custom)).toBe(custom.imageUri);
  });
});
