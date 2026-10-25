import type { Character, CharacterDefinitionSnapshot } from '../types';

const DEFINITION_FIELDS: (keyof CharacterDefinitionSnapshot)[] = ['name', 'avatar', 'imageUri', 'assetSet', 'theme', 'systemPrompt', 'greeting', 'personality', 'relationshipRules', 'profile'];

/** Apply only definition fields to the latest character; a stale snapshot cannot replace runtime or history. */
export function mergeCurrentCharacterDefinition(current: Character, definition: Partial<CharacterDefinitionSnapshot>, version?: number): Character {
  const updated = { ...current, definitionVersion: version ?? (current.definitionVersion ?? 1) + 1 };
  for (const key of DEFINITION_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(definition, key)) Object.assign(updated, { [key]: definition[key] });
  }
  return updated;
}

/** The backup await is a concurrency boundary: always re-read live state afterwards. */
export async function saveCharacterDefinitionUpdate(options: {
  getCurrent: () => Character | undefined;
  backup: (character: Character) => Promise<unknown>;
  save: (character: Character) => Promise<void>;
  definition: Partial<CharacterDefinitionSnapshot>;
  version?: number;
}): Promise<Character> {
  const before = options.getCurrent();
  if (!before) throw new Error('角色已不在当前列表中，设定尚未保存。');
  await options.backup(before);
  const current = options.getCurrent();
  if (!current || current.id !== before.id) throw new Error('角色在备份期间发生变化，请重新打开后再保存。');
  const updated = mergeCurrentCharacterDefinition(current, options.definition, options.version);
  await options.save(updated);
  return updated;
}
