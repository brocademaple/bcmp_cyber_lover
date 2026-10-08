export type StoryLine = { kind: 'narration' | 'speech' | 'thought' | 'message'; text: string; speaker?: string };
export type SceneScript = {
  id: string;
  title: string;
  setting: string;
  /** Normalized vertical bounds of an existing illustrated panel. Source art stays intact. */
  crop: { top: number; height: number };
  lines: StoryLine[];
  screenNote?: string;
};

/** Dialogue is edited from the existing authored story, never from the user's chat. */
export const LUYA_SCENE_SCRIPT: Record<string, SceneScript[]> = {
  'unknown-year-01': [
    { id: 'photos', title: '想留住的细节', setting: '住处 · 书桌', crop: { top: 0, height: 591 / 1448 }, lines: [
      { kind: 'narration', text: '她想给拍过的旧招牌，做一个小小的存放处。' },
      { kind: 'narration', text: '照片、地点、日期，再加几句当时的记录。' },
    ] },
    { id: 'required-year', title: '卡在一个空格', setting: '住处 · 录入页面', crop: { top: 602 / 1448, height: 360 / 1448 }, screenNote: '年份 · 必填', lines: [
      { kind: 'narration', text: '拿自己的照片一试，卡住了。年份是必填项，页面不让保存。' },
    ] },
    { id: 'ask-later', title: '知道的与不知道的', setting: '住处 · 翻看街区照片', crop: { top: 973 / 1448, height: 475 / 1448 }, lines: [
      { kind: 'narration', text: '她知道拍摄日期，却不知道这家店什么时候开的。' },
      { kind: 'thought', speaker: '鹿芽', text: '下次问问老板。' },
    ] },
  ],
  'unknown-year-02': [
    { id: 'leave-blank', title: '可以诚实地空着', setting: '住处 · 书桌', crop: { top: 0, height: 477 / 1448 }, lines: [
      { kind: 'narration', text: '随便填一个，也能进去。她盯着空格，最后删掉了必填限制。' },
    ] },
    { id: 'saved', title: '年份不详', setting: '住处 · 录入页面', crop: { top: 485 / 1448, height: 420 / 1448 }, screenNote: '年份不详 · 可以保存', lines: [
      { kind: 'narration', text: '她加了一个选项：“年份不详。”照片存进去了，页面比刚才顺眼。' },
    ] },
    { id: 'closed-shop', title: '还没有答案', setting: '第二天 · 那条街', crop: { top: 914 / 1448, height: 534 / 1448 }, lines: [
      { kind: 'narration', text: '第二天，她带着照片又去那条街。店门关着，下午还有课。' },
      { kind: 'thought', speaker: '鹿芽', text: '下次问问老板。' },
      { kind: 'narration', text: '备忘录里的这句话，暂时留着。' },
    ] },
  ],
  'blue-tomorrow-01': [
    { id: 'runs', title: '终于跑起来了', setting: '傍晚 · 书桌', crop: { top: 0, height: 525 / 1448 }, lines: [
      { kind: 'narration', text: '她写的小工具终于跑起来。功能很少，界面也不好看。' },
    ] },
    { id: 'reopen', title: '关闭，再打开', setting: '傍晚 · 测试原型', crop: { top: 535 / 1448, height: 355 / 1448 }, lines: [
      { kind: 'narration', text: '她来回点了几遍。关闭，再打开——东西还在。' },
    ] },
    { id: 'send', title: '给朋友看看', setting: '傍晚 · 一条消息', crop: { top: 901 / 1448, height: 547 / 1448 }, lines: [
      { kind: 'narration', text: '她给朋友发了一张截图。' },
    ] },
  ],
  'blue-tomorrow-02': [
    { id: 'friend-blue', title: '朋友的第一反应', setting: '手机 · 消息', crop: { top: 0, height: 411 / 1448 }, lines: [
      { kind: 'message', speaker: '朋友', text: '这个蓝色有点丑。' },
    ] },
    { id: 'try-first', title: '你先点', setting: '傍晚 · 书桌', crop: { top: 420 / 1448, height: 547 / 1448 }, lines: [
      { kind: 'speech', speaker: '鹿芽', text: '蓝色明天改。你先点。' },
      { kind: 'message', speaker: '朋友', text: '能用。' },
    ] },
    { id: 'change-blue', title: '还是改了', setting: '稍后 · 书桌', crop: { top: 975 / 1448, height: 473 / 1448 }, lines: [
      { kind: 'narration', text: '她高兴了一阵，又把那个蓝色改了。' },
    ] },
  ],
  'listen-first-01': [
    { id: 'interruption', title: '我还没讲完', setting: '公共学习空间 · 一次讨论', crop: { top: 0, height: 1 }, lines: [
      { kind: 'narration', text: '朋友给她看展览记录页面的草图。她正在改项目，听了几句便指出一个问题，接着又指出一个。' },
      { kind: 'speech', speaker: '朋友', text: '我还没讲完。' },
      { kind: 'narration', text: '朋友把图收回去了。过了一阵，她才想起：图上有一小块字，自己根本没读到。' },
    ] },
  ],
  'listen-first-02': [
    { id: 'listen', title: '这回，我听', setting: '第二天 · 同一张桌子', crop: { top: 0, height: 1 }, lines: [
      { kind: 'narration', text: '前一天，她发消息道歉：“刚才我有点急，你还没讲完，我就开始挑问题了。”解释自己的话打了又删。' },
      { kind: 'message', speaker: '鹿芽 · 前一天的消息', text: '你还愿意讲的话，明天我听。' },
      { kind: 'narration', text: '第二天，她先合上了电脑。' },
      { kind: 'narration', text: '听到一半仍想插话，手指敲了一下，又停了。这回，她把那一小块字也看到了。' },
    ] },
  ],
};
