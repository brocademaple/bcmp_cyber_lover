import type { ImageSourcePropType } from 'react-native';
import { LUYA_PROFILE } from './luyaPersona';

/** These paragraphs reuse official facts; story events remain authored fiction. */
export const LUYA_BACKGROUND = [
  { title: '现在的生活', text: LUYA_PROFILE.backstory },
  { title: '她在意的事情', text: `她喜欢${LUYA_PROFILE.hobbies?.join('、')}。最初选择计算机有就业与稳定的考量，后来逐渐喜欢它能把想法做出来，也更在意技术最终由谁使用。` },
  { title: '正在往哪里走', text: `她希望${LUYA_PROFILE.goals?.join('；')}。第一次暑期实习偏向 AI 应用开发，以及能够亲手做技术原型的交互与产品体验方向。` },
  { title: '还在学的事', text: '她反应快，会接梗，也容易同时开太多任务、发起快而跟进松。疲惫时指出问题会像拆台；她正在学着先听完、承认具体影响，再处理分歧。轮到自己受伤时，她有时会先淡化，之后才发现需要说出来。' },
  { title: '家人与自己的空间', text: '家庭温暖、务实且支持，也容易参与职业、安全和社交的决定。她愿意接受帮助，同时希望亲自承担选择的风险。学校附近的现实住处与应用里的线上房间分别存在；线上房间从做客、慢慢熟悉开始。' },
];

export type StoryPage = {
  id: string;
  image: ImageSourcePropType;
  /** Width / height of the complete illustration, never cropped. */
  aspectRatio: number;
  title: string;
  paragraphs: string[];
};
export type CharacterStory = {
  id: string;
  characterId: 'qingning';
  title: string;
  subtitle: string;
  format: '漫画' | '绘本';
  provenance: '虚构人物故事';
  source: string;
  tags: string[];
  pages: StoryPage[];
};
export type CharacterArtwork = {
  id: string;
  title: string;
  category: '造型' | '三视图' | '场景';
  image: ImageSourcePropType;
  aspectRatio: number;
  description: string;
};

/** Authored works only. Never merge this catalog into memories, world events or AI prompts. */
export const LUYA_STORIES: CharacterStory[] = [
  {
    id: 'luya-unknown-year-v1', characterId: 'qingning', title: '年份不详',
    subtitle: '有些空格，可以诚实地留着。', format: '漫画', provenance: '虚构人物故事',
    source: '改编自《鹿芽小传：年份不详》', tags: ['城市观察', '做一个小工具'],
    pages: [
      { id: 'unknown-year-01', image: require('../../assets/luya-ip-v1/stories/unknown-year-01.png'), aspectRatio: 3 / 4, title: '一个必填项', paragraphs: [
        '她想给拍过的旧招牌做一个小小的存放处。照片、地点、日期，再加几句当时的记录。',
        '录入页面有一个必填项：年份。拿自己的照片一试，卡住了。',
        '她知道拍摄日期，却不知道那家店什么时候开的。备忘录里只有一句：“下次问问老板。”',
      ] },
      { id: 'unknown-year-02', image: require('../../assets/luya-ip-v1/stories/unknown-year-02.png'), aspectRatio: 3 / 4, title: '下次再问', paragraphs: [
        '随便填一个，也能进去。她盯着空格，最后删掉了必填限制。',
        '她加了一个选项：“年份不详。”照片存进去了，页面比刚才顺眼。',
        '第二天，她带着照片又去那条街。店门关着，下午还有课。“下次问问老板”暂时留着。',
      ] },
    ],
  },
  {
    id: 'luya-blue-tomorrow-v1', characterId: 'qingning', title: '蓝色明天改',
    subtitle: '先让它跑起来，再慢慢变好。', format: '漫画', provenance: '虚构人物故事',
    source: '改编自《鹿芽小传：年份不详》', tags: ['项目', '有点得意'],
    pages: [
      { id: 'blue-tomorrow-01', image: require('../../assets/luya-ip-v1/stories/blue-tomorrow-01.png'), aspectRatio: 3 / 4, title: '它能用了', paragraphs: [
        '她写的小工具终于跑起来。功能很少，界面也不好看。',
        '她来回点了几遍，关闭，再打开。东西还在。',
        '她给朋友发了一张截图。',
      ] },
      { id: 'blue-tomorrow-02', image: require('../../assets/luya-ip-v1/stories/blue-tomorrow-02.png'), aspectRatio: 3 / 4, title: '你先点', paragraphs: [
        '朋友说：“这个蓝色有点丑。”',
        '鹿芽：“蓝色明天改。你先点。”朋友点完，说能用。',
        '她高兴了一阵，又把那个蓝色改了。',
      ] },
    ],
  },
  {
    id: 'luya-listen-first-v1', characterId: 'qingning', title: '先合上电脑',
    subtitle: '这回，她把那一小块字也看到了。', format: '绘本', provenance: '虚构人物故事',
    source: '改编自《鹿芽小传：年份不详》', tags: ['朋友', '学着听完'],
    pages: [
      { id: 'listen-first-01', image: require('../../assets/luya-ip-v1/stories/listen-first-01.png'), aspectRatio: 3 / 4, title: '我还没讲完', paragraphs: [
        '朋友给她看展览记录页面的草图。她正在改项目，听了几句便指出一个问题，接着又指出一个。',
        '朋友把图收回去：“我还没讲完。”',
        '过了一阵，她想起那张图上有一小块字，自己根本没读到。',
      ] },
      { id: 'listen-first-02', image: require('../../assets/luya-ip-v1/stories/listen-first-02.png'), aspectRatio: 3 / 4, title: '明天我听', paragraphs: [
        '她发消息：“刚才我有点急，你还没讲完，我就开始挑问题了。”解释自己的话打了又删。',
        '“你还愿意讲的话，明天我听。”第二天，她先合上了电脑。',
        '听到一半仍想插话，手指敲了一下，又停了。这回，她把那一小块字也看到了。',
      ] },
    ],
  },
];

const turnarounds = [
  ['l01', '熟悉日常', require('../../assets/luya-ip-v1/reference/l01-turnaround.png')],
  ['l02', '校园项目', require('../../assets/luya-ip-v1/reference/l02-turnaround.png')],
  ['l03', '城市散步', require('../../assets/luya-ip-v1/reference/l03-turnaround.png')],
  ['l04', '阅读看展', require('../../assets/luya-ip-v1/reference/l04-turnaround.png')],
  ['l05', '居家专注', require('../../assets/luya-ip-v1/reference/l05-turnaround.png')],
  ['l06', '暖季外出', require('../../assets/luya-ip-v1/reference/l06-turnaround.png')],
] as const;

export const LUYA_ARTWORKS: CharacterArtwork[] = [
  { id: 'looks', title: '六套日常造型', category: '造型', image: require('../../assets/luya-ip-v1/reference/approved-looks.png'), aspectRatio: 3 / 4, description: '校园、城市、阅读与居家，都是她生活的一部分。' },
  { id: 'hair', title: '六种扎发方式', category: '造型', image: require('../../assets/luya-ip-v1/reference/approved-hairstyles.png'), aspectRatio: 3 / 2, description: '栗棕发色和熟悉的刘海，换成不同的日常扎发。' },
  ...turnarounds.map(([id, title, image]) => ({ id: `turnaround-${id}`, title: `${id.toUpperCase()} · ${title}`, category: '三视图' as const, image, aspectRatio: 3 / 2, description: '同一套造型的正面、侧面与背面。' })),
  { id: 'campus', title: '把一个想法跑起来', category: '场景', image: require('../../assets/luya-ip-v1/scenes/campus-project.png'), aspectRatio: 3 / 4, description: '安静的学习空间，她在测试自己的小原型。' },
  { id: 'reading', title: '翻到另一种生活', category: '场景', image: require('../../assets/luya-ip-v1/scenes/home-reading.png'), aspectRatio: 3 / 4, description: '普通的下午，读一会儿文学与历史。' },
  { id: 'city', title: '街上还有细节', category: '场景', image: require('../../assets/luya-ip-v1/scenes/city-observation.png'), aspectRatio: 3 / 4, description: '一块旧招牌，也值得停下来看看。' },
];
