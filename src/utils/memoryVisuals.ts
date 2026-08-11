import { ImageSourcePropType, ViewStyle } from 'react-native';
import { Character, MemoryFragment } from '../types';
import { resolveDefaultCharacterAssetKey } from './characterAssets';

export type MemoryOverlayTheme = 'dark' | 'light';

export interface MemoryVisualCard {
  id: string;
  characterId: string;
  title: string;
  subtitle: string;
  content: string;
  imageUri: ImageSourcePropType;
  readerImageUri?: ImageSourcePropType;
  overlayTheme?: MemoryOverlayTheme;
  panelOverlayAreas?: Pick<ViewStyle, 'top' | 'right' | 'bottom' | 'left' | 'width' | 'height'>[];
  comicPanels: ComicPanel[];
  tags: string[];
  timestampLabel: string;
}

export interface ComicPanel {
  id: string;
  title: string;
  dialogue: string;
  caption: string;
}

const DEFAULT_MEMORY_VISUALS: Record<string, MemoryVisualCard[]> = {
  qingning: [
    {
      id: 'qingning-evening-snacks',
      characterId: 'qingning',
      title: '她记得你晚饭随便糊弄',
      subtitle: '20:00 · 便利店灯光',
      content: '鹿芽把你说过的“今天有点累”收进了心里，连同那句没讲完的晚饭。下次打开，她会先问你有没有好好吃饭。',
      imageUri: require('../../assets/memories/comics/qingning-comic-magazine.png'),
      comicPanels: [
        { id: 'title', title: '晚饭提醒', dialogue: '鹿芽的晚饭提醒', caption: '20:00，便利店灯光把房间照得很软。' },
        { id: 'phone', title: '她看见了', dialogue: '你又忘记吃饭啦？', caption: '她把你随口说的疲惫记了下来。' },
        { id: 'tease', title: '轻轻拆穿', dialogue: '诶诶，别装没看见！', caption: '关心被她说得像一场小小的恶作剧。' },
        { id: 'memory', title: '认真记住', dialogue: '她把你的随口一说记住了。', caption: '这件小事被收进了你们的关系里。' },
        { id: 'snack', title: '递到面前', dialogue: '先吃一口，再陪你发呆。', caption: '记忆变成一份被认真准备的小夜宵。' },
      ],
      tags: ['晚饭', '被惦记', '元气补给'],
      timestampLabel: '今天',
    },
  ],
  sakura: [
    {
      id: 'sakura-rainy-bookstore',
      characterId: 'sakura',
      title: '雨夜里，她把沉默也算作回答',
      subtitle: '23:18 · 旧书店窗边',
      content: '纪遥记下的是你没有继续说下去的那半句。她不会催，只把那页书折起来，等你下次愿意慢慢讲。',
      imageUri: require('../../assets/memories/comics/sakura-comic-magazine.png'),
      comicPanels: [
        { id: 'title', title: '雨夜书签', dialogue: '纪遥的雨夜书签', caption: '雨声把城市放轻了。' },
        { id: 'sentence', title: '半句停住', dialogue: '你说：今天有点累。', caption: '她听见了沉默里没出口的部分。' },
        { id: 'listen', title: '没有催促', dialogue: '嗯……不用急着解释。', caption: '雨声替你们把空白接住。' },
        { id: 'rain', title: '窗上的雨', dialogue: '雨停在玻璃上', caption: '她把等待留得很轻。' },
        { id: 'bookmark', title: '折下一页', dialogue: '她把没说完的话，夹进这一页。', caption: '书签像一个温柔的暂停键。' },
        { id: 'promise', title: '继续听你', dialogue: '等你想讲的时候，我在。', caption: '她把这段没有说完的话放进记忆。' },
      ],
      tags: ['雨夜', '倾听', '慢慢讲'],
      timestampLabel: '本周',
    },
  ],
  luna: [
    {
      id: 'luna-midnight-game',
      characterId: 'luna',
      title: '她嘴上嫌你麻烦，手里已经暂停游戏',
      subtitle: '01:04 · 城市夜光',
      content: '凛夜记住你硬撑时的语气。她不会立刻安慰得很甜，只会啧一声，然后把位置给你留好。',
      imageUri: require('../../assets/memories/comics/luna-comic-magazine.png'),
      comicPanels: [
        { id: 'title', title: '通宵存档', dialogue: '凛夜的通宵存档', caption: '00:43，城市还没睡。' },
        { id: 'pause', title: '暂停游戏', dialogue: '咔。', caption: '她听见你那句没什么精神的“没事”。' },
        { id: 'side-eye', title: '一眼拆穿', dialogue: '你说没事？骗谁呢。', caption: '嘴上嫌麻烦，眼神已经软了一点。' },
        { id: 'screen', title: '屏幕停住', dialogue: '她暂停了游戏。', caption: '关心被藏进一个很短的动作里。' },
        { id: 'drink', title: '递过来', dialogue: '拿着。别硬撑。', caption: '她把饮料推过来，假装只是顺手。' },
        { id: 'stay', title: '给你留位', dialogue: '坐这边，我不赶你。', caption: '夜色和键盘光一起安静下来。' },
      ],
      tags: ['深夜', '嘴硬心软', '置顶例外'],
      timestampLabel: '最近',
    },
  ],
};

function visualFromMemory(character: Character, memory: MemoryFragment): MemoryVisualCard {
  const visualKey = resolveDefaultCharacterAssetKey(character) ?? character.id;
  const fallback = DEFAULT_MEMORY_VISUALS[visualKey]?.[0] ?? DEFAULT_MEMORY_VISUALS.qingning[0];
  return {
    id: memory.id,
    characterId: character.id,
    title: memory.visualTitle || `${character.name}记住了这件小事`,
    subtitle: memory.visualCaption || `${new Date(memory.timestamp).toLocaleDateString()} · 重要度 ${memory.importance}/10`,
    content: memory.content,
    imageUri: memory.visualUri
      ? (typeof memory.visualUri === 'string' ? { uri: memory.visualUri } : memory.visualUri)
      : fallback.imageUri,
    comicPanels: fallback.comicPanels,
    tags: memory.tags.length > 0 ? memory.tags : fallback.tags,
    timestampLabel: '记忆',
  };
}

export function getMemoryVisualCards(character?: Character): MemoryVisualCard[] {
  if (!character) return DEFAULT_MEMORY_VISUALS.qingning;
  const memoryCards = (character.memories || [])
    .slice()
    .reverse()
    .map((memory) => visualFromMemory(character, memory));
  if (memoryCards.length > 0) return memoryCards;
  const visualKey = resolveDefaultCharacterAssetKey(character) ?? character.id;
  const defaults = DEFAULT_MEMORY_VISUALS[visualKey] || DEFAULT_MEMORY_VISUALS.qingning;
  return defaults;
}
