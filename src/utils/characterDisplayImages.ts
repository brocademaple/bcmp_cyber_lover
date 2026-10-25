import type { Character } from '../types';
import { getDefaultCharacterAssetSet } from './characterAssets';

/** Read-only image preferences: never persist a fallback over the user's source. */
export function getCharacterMainImage(character: Character): Character['imageUri'] {
  const defaults = getDefaultCharacterAssetSet(character);
  if (character.imageUri && character.imageUri !== defaults?.main && character.assetSet?.main === defaults?.main) {
    return character.imageUri;
  }
  return character.assetSet?.main ?? character.imageUri;
}

export function getCharacterAvatarImage(character: Character): Character['imageUri'] {
  const defaults = getDefaultCharacterAssetSet(character);
  const { headshot, avatar } = character.assetSet ?? {};
  if (headshot && headshot !== defaults?.headshot) return headshot;
  if (avatar && avatar !== defaults?.avatar) return avatar;
  const main = getCharacterMainImage(character);
  if (main && defaults && main !== defaults.main) return main;
  return headshot ?? avatar ?? main;
}
