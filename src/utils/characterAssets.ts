import { Character, CharacterAssetSet } from '../types';

export type DefaultCharacterAssetKey = 'qingning' | 'sakura' | 'luna';

type CharacterAssetBundle = {
  assetSet: CharacterAssetSet;
  aliases: string[];
};

const LEGACY_ROOT_CHARACTER_IDS: Record<DefaultCharacterAssetKey, string[]> = {
  qingning: ['qingning'],
  sakura: ['xiaoying'],
  luna: ['yuehua'],
};

const LEGACY_ROOT_CHARACTER_EXTENSION = 'png';
const LEGACY_ROOT_CHARACTER_DIRS = [
  'assets/characters',
  'docs/assets/characters',
];

function normalizeCharacterAssetAlias(value?: string) {
  return value
    ?.trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
}

function normalizeAssetPath(value?: string) {
  return value
    ?.trim()
    .toLowerCase()
    .replace(/\\/g, '/')
    .replace(/^file:\/\//, '')
    .replace(/^(\.\/|\.\.\/)+/, '');
}

function buildLegacyRootAssetFragments(id: string) {
  return LEGACY_ROOT_CHARACTER_DIRS.map((dir) => `${dir}/${id}.${LEGACY_ROOT_CHARACTER_EXTENSION}`);
}

export const DEFAULT_CHARACTER_ASSETS: Record<DefaultCharacterAssetKey, CharacterAssetBundle> = {
  qingning: {
    assetSet: {
      main: require('../../assets/characters/v2/qingning/main.png'),
      avatar: require('../../assets/characters/v2/qingning/avatar.png'),
      headshot: require('../../assets/characters/v2/qingning/headshot.png'),
      idleFrames: [
        require('../../assets/characters/v2/qingning/main.png'),
        require('../../assets/characters/v2/qingning/expression-happy.png'),
        require('../../assets/characters/v2/qingning/expression-soft.png'),
        require('../../assets/characters/v2/qingning/expression-low-energy.png'),
        require('../../assets/characters/v2/qingning/action-wave.png'),
        require('../../assets/characters/v2/qingning/action-waiting.png'),
      ],
      memoryScene: require('../../assets/characters/v2/qingning/scene-memory.png'),
    },
    aliases: ['qingning', '鹿芽', 'luya', 'luyao', 'deer'],
  },
  sakura: {
    assetSet: {
      main: require('../../assets/characters/v2/sakura/main.png'),
      avatar: require('../../assets/characters/v2/sakura/avatar.png'),
      headshot: require('../../assets/characters/v2/sakura/headshot.png'),
      idleFrames: [
        require('../../assets/characters/v2/sakura/main.png'),
        require('../../assets/characters/v2/sakura/expression-happy.png'),
        require('../../assets/characters/v2/sakura/expression-soft.png'),
        require('../../assets/characters/v2/sakura/expression-low-energy.png'),
        require('../../assets/characters/v2/sakura/action-wave.png'),
        require('../../assets/characters/v2/sakura/action-waiting.png'),
      ],
      memoryScene: require('../../assets/characters/v2/sakura/scene-memory.png'),
    },
    aliases: ['sakura', 'xiaoying', '小樱', '纪遥', 'jiyao', 'jiyou', 'jiyu', 'book'],
  },
  luna: {
    assetSet: {
      main: require('../../assets/characters/v2/luna/main.png'),
      avatar: require('../../assets/characters/v2/luna/avatar.png'),
      headshot: require('../../assets/characters/v2/luna/headshot.png'),
      idleFrames: [
        require('../../assets/characters/v2/luna/main.png'),
        require('../../assets/characters/v2/luna/expression-happy.png'),
        require('../../assets/characters/v2/luna/expression-soft.png'),
        require('../../assets/characters/v2/luna/expression-low-energy.png'),
        require('../../assets/characters/v2/luna/action-wave.png'),
        require('../../assets/characters/v2/luna/action-waiting.png'),
      ],
      memoryScene: require('../../assets/characters/v2/luna/scene-memory.png'),
    },
    aliases: ['luna', 'yuehua', '月华', '凛夜', 'linye', 'rinye', 'midnight'],
  },
};

const DEFAULT_CHARACTER_ALIAS_MAP = Object.fromEntries(
  (Object.entries(DEFAULT_CHARACTER_ASSETS) as [DefaultCharacterAssetKey, CharacterAssetBundle][])
    .flatMap(([key, bundle]) => bundle.aliases.map((alias) => [normalizeCharacterAssetAlias(alias), key]))
) as Record<string, DefaultCharacterAssetKey>;

export function resolveDefaultCharacterAssetKey(
  characterOrId?: Pick<Character, 'id' | 'name' | 'avatar' | 'theme' | 'imageUri'> | string
): DefaultCharacterAssetKey | undefined {
  if (!characterOrId) return undefined;
  const id = typeof characterOrId === 'string' ? characterOrId : characterOrId.id;
  const name = typeof characterOrId === 'string' ? undefined : characterOrId.name;
  const avatar = typeof characterOrId === 'string' ? undefined : characterOrId.avatar;
  const theme = typeof characterOrId === 'string' ? undefined : characterOrId.theme;
  const imageUri =
    typeof characterOrId === 'string' ? undefined : characterOrId.imageUri;
  const directMatch =
    DEFAULT_CHARACTER_ALIAS_MAP[normalizeCharacterAssetAlias(id) ?? ''] ??
    DEFAULT_CHARACTER_ALIAS_MAP[normalizeCharacterAssetAlias(name) ?? ''];
  if (directMatch) return directMatch;

  const normalizedImageUri = typeof imageUri === 'string' ? normalizeAssetPath(imageUri) : undefined;
  if (normalizedImageUri) {
    const imagePathMatch = (Object.entries(LEGACY_ROOT_CHARACTER_IDS) as [DefaultCharacterAssetKey, string[]][])
      .find(([, ids]) =>
        ids.some((legacyId) =>
          buildLegacyRootAssetFragments(legacyId).some((fragment) => normalizedImageUri.endsWith(fragment))
        )
      )?.[0];
    if (imagePathMatch) return imagePathMatch;
  }

  if (avatar === '🦌' || theme === 'softSweet') return 'qingning';
  if (avatar === '📖' || theme === 'urbanClear' || theme === 'blue' || theme === 'purple') return 'sakura';
  if (avatar === '⚡' || theme === 'midnight') return 'luna';
  return undefined;
}

export function getDefaultCharacterAssetSet(
  characterOrId?: Pick<Character, 'id' | 'name' | 'avatar' | 'theme' | 'imageUri'> | string
) {
  const key = resolveDefaultCharacterAssetKey(characterOrId);
  return key ? DEFAULT_CHARACTER_ASSETS[key].assetSet : undefined;
}
