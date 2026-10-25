import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Character,
  CharacterDefinitionSnapshot,
  CharacterRevision,
} from '../types';

const REVISION_KEY_PREFIX = '@bcmp_character_revisions_v1_';
const MAX_REVISIONS_PER_CHARACTER = 20;

function revisionKey(characterId: string): string {
  return `${REVISION_KEY_PREFIX}${characterId}`;
}

export function getCharacterDefinition(character: Character): CharacterDefinitionSnapshot {
  return {
    name: character.name,
    avatar: character.avatar,
    imageUri: character.imageUri,
    assetSet: character.assetSet,
    theme: character.theme,
    systemPrompt: character.systemPrompt,
    greeting: character.greeting,
    personality: character.personality,
    relationshipRules: character.relationshipRules,
    profile: character.profile,
  };
}

export function applyCharacterDefinition(
  character: Character,
  definition: CharacterDefinitionSnapshot,
  version?: number
): Character {
  return {
    ...character,
    ...definition,
    definitionVersion: version ?? character.definitionVersion,
  };
}

export async function listCharacterRevisions(characterId: string): Promise<CharacterRevision[]> {
  try {
    const raw = await AsyncStorage.getItem(revisionKey(characterId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.slice().sort((a, b) => b.createdAt - a.createdAt)
      : [];
  } catch {
    return [];
  }
}

export async function saveCharacterRevision(
  character: Character,
  label: string,
  now = Date.now()
): Promise<CharacterRevision> {
  const current = await listCharacterRevisions(character.id);
  const currentVersion = character.definitionVersion ?? 1;
  const revision: CharacterRevision = {
    id: `character_revision_${character.id}_${now}`,
    characterId: character.id,
    version: currentVersion,
    label,
    createdAt: now,
    definition: getCharacterDefinition(character),
  };
  await AsyncStorage.setItem(
    revisionKey(character.id),
    JSON.stringify([revision, ...current].slice(0, MAX_REVISIONS_PER_CHARACTER))
  );
  return revision;
}

export async function removeCharacterRevisions(characterId: string): Promise<void> {
  await AsyncStorage.removeItem(revisionKey(characterId));
}
