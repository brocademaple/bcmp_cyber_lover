import type { AppMode, Character } from '../types';
import { resolveDefaultCharacterAssetKey } from './characterAssets';

// Presentation policy only: never use this list to hydrate or persist characters.
export const PUBLIC_CHARACTER_IDS: readonly string[] = ['qingning'];

export function getVisibleCharacters(characters: Character[], mode: AppMode): Character[] {
  return mode === 'admin'
    ? characters
    : PUBLIC_CHARACTER_IDS.flatMap((id) => {
        const character = characters.find((item) => item.id === id)
          ?? characters.find((item) => resolveDefaultCharacterAssetKey(item) === id);
        return character ? [character] : [];
      });
}

export function getPresentedCharacter(
  characters: Character[],
  selectedId: string,
  mode: AppMode
): Character | undefined {
  const visible = getVisibleCharacters(characters, mode);
  return visible.find((character) => character.id === selectedId) ?? visible[0];
}
