import { ImageSourcePropType, ViewStyle } from 'react-native';
import { Character, MemoryFragment } from '../types';

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
      imageUri: require('../../assets/memories/comics/qingning-comic-grid.png'),
      comicPanels: [
        { id: 'msg', title: '她看见了', dialogue: '晚饭又糊弄过去了吗？', caption: '她把你随口说的疲惫记了下来。' },
        { id: 'shop', title: '跑去买点东西', dialogue: '这个热一点，应该会舒服些。', caption: '便利店的灯把关心照得很软。' },
        { id: 'wave', title: '回到房间', dialogue: '回来啦，先别急着逞强。', caption: '她笑着挥手，像在替房间开灯。' },
        { id: 'snack', title: '放到你面前', dialogue: '吃一点嘛，我会看着你的。', caption: '记忆变成一份被认真准备的小夜宵。' },
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
      imageUri: require('../../assets/memories/comics/sakura-comic-grid.png'),
      comicPanels: [
        { id: 'phone', title: '半句停住', dialogue: '你刚刚好像还有话没说。', caption: '她听见了沉默里没出口的部分。' },
        { id: 'rain', title: '雨停在窗上', dialogue: '没关系，慢慢来。', caption: '雨声替你们把空白接住。' },
        { id: 'bookmark', title: '折下一页', dialogue: '我先替你留在这里。', caption: '书签像一个温柔的暂停键。' },
        { id: 'listen', title: '继续听你', dialogue: '下次想讲的时候，我在。', caption: '她把这段没有说完的话放进记忆。' },
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
      imageUri: require('../../assets/memories/comics/luna-comic-grid.png'),
      comicPanels: [
        { id: 'chat', title: '她瞥见消息', dialogue: '又说没事？你这语气骗谁。', caption: '屏幕里的“今天好累”被她看见。' },
        { id: 'pause', title: '游戏暂停', dialogue: '等一下，先别硬撑。', caption: '她嘴上不说，手已经按下暂停。' },
        { id: 'drink', title: '递过来', dialogue: '拿着。别问，顺手而已。', caption: '关心被包装成一句不坦率。' },
        { id: 'stay', title: '给你留位', dialogue: '坐这儿吧，我又没赶你。', caption: '夜色和键盘光一起安静下来。' },
      ],
      tags: ['深夜', '嘴硬心软', '置顶例外'],
      timestampLabel: '最近',
    },
  ],
};

function visualFromMemory(character: Character, memory: MemoryFragment): MemoryVisualCard {
  const fallback = DEFAULT_MEMORY_VISUALS[character.id]?.[0] ?? DEFAULT_MEMORY_VISUALS.qingning[0];
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
  const defaults = DEFAULT_MEMORY_VISUALS[character.id] || DEFAULT_MEMORY_VISUALS.qingning;
  return defaults;
}
