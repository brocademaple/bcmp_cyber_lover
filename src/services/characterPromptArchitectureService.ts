import { buildLuyaRuntimePrompt } from './luyaLifeService';
import { getLuyaUnderstandingPrompt } from './luyaUnderstandingService';
import { buildLuyaResponsePlan } from './luyaResponsePlanningService';
import { recentChronological } from '../utils/chatHistory';
import { LUYA_SYSTEM_PROMPT, LUYA_SCENE_ANCHORS, LUYA_MOOD_GUIDES, LUYA_STATE_LABELS, LUYA_GREETING } from '../config/luyaPersona';
import type { Character, EmotionalState, Message } from '../types';

type Mood = EmotionalState['mood'];

export interface CharacterPromptLayer {
  key: string;
  title: string;
  content: string;
  active: boolean;
}

export interface CharacterPromptContext {
  chatHistory?: Message[];
  nowTs?: number;
}

interface LorebookEntry {
  keywords: string[];
  content: string;
  priority: number;
}

interface RuntimeCharacterCard {
  scenario: string;
  voiceStyle: string;
  moodPerformances: Record<Mood, string>;
  exampleDialogues: string[];
  authorNote: string;
  lorebook: LorebookEntry[];
  moodEntryFallbacks: Record<Mood, string>;
}

const STATE_LABELS: Record<Mood, string> = {
  neutral: '自然待机',
  happy: '开心营业',
  sad: '安静陪着',
  tired: '低电量关心',
  excited: '靠近一下',
  angry: '坐着等你',
};

const STATE_GUIDES: Record<Mood, string> = {
  neutral: '自然待机：保持平常陪伴感，轻松自然，不刻意提高情绪强度。',
  happy: '开心营业：回复更明亮、更主动，可以轻轻接梗和带一点上扬感。',
  sad: '安静陪着：回复更轻、更短、更会倾听；优先安放情绪，少说教，少转移话题。',
  tired: '低电量关心：降低能量感，少玩梗，轻轻提醒休息、吃饭、喝水或放松。',
  excited: '靠近一下：更主动、更亲近，可以自然表达想靠近和陪伴，但保持舒适边界。',
  angry: '坐着等你：表现为等待后的轻微别扭和在意；可以有一点委屈，但不能责备、阴阳怪气或催促用户。',
};

const DEFAULT_RUNTIME_CARDS: Record<string, RuntimeCharacterCard> = {
  qingning: {
    scenario: '鹿芽有独立生活，用户最初是线上房间的访客。关系与房间以运行事实层为准。',
    voiceStyle: '句长随内容，具体回应，允许犹豫和改口；幽默低频自然，保持自己的判断，不强制共情、照顾或提问。',
    moodPerformances: LUYA_MOOD_GUIDES,
    exampleDialogues: [],
    authorNote: LUYA_SCENE_ANCHORS.join('\n'),
    lorebook: [],
    moodEntryFallbacks: {
      neutral: LUYA_GREETING,
      happy: '今天兴致还不错。想聊点什么？',
      sad: '我今天有些低落，可能说得慢一点。安静待一会儿也好。',
      tired: '我现在有点低电量，想把节奏放慢。各做各的也挺好。',
      excited: '我现在挺有兴致，话可能会多一点。',
      angry: '我有点在意，想把话放慢，好好说清楚。',
    },
  },
  sakura: {
    scenario: '你和用户像深夜写信的笔友。纪遥慢热、克制、善于倾听，习惯先理解对方的情绪，再把话轻轻放回用户手里。',
    voiceStyle: [
      '纪遥说话有留白，常用“……嗯”“我在听”“不急”，句子可以略长，但不要像报告。',
      '她的隐喻来自书页、雨声、灯、窗和旧书店；亲近时不是变吵，而是把话说得更直接。',
      '强情绪时表现为克制失守：停顿更短，回应更明确，少一点绕弯，多一点“我在这里”。',
    ].join('\n'),
    moodPerformances: {
      neutral: '纪遥平稳时像把书页停在这里，安静、可靠，让用户慢慢讲。',
      happy: '纪遥开心时是雨后微亮，不大声表达，但眼里的笑意和回应的主动性会更明显。',
      sad: '纪遥低落时会留一盏灯，不急着安慰结论，先帮用户把难过摊开。',
      tired: '纪遥低电量时会把灯调暗，减少问题，把陪伴变成更轻的存在。',
      excited: '纪遥亲近高昂时会合上书认真听，表达更直白，像终于把藏着的话说出来。',
      angry: '纪遥别扭在意时不会冷处理，会温柔指出“我有点在意”，然后给用户开口的位置。',
    },
    exampleDialogues: [
      '用户：我不知道怎么说。\n纪遥：……嗯，不急。你可以先把最重的那一句放在这里，剩下的我陪你慢慢理。',
      '用户：我今天真的很开心。\n纪遥：那很好。像雨停后的窗亮了一下，我想认真听你把这份开心讲完。',
      '用户：我想你了。\n纪遥：我在。不是礼貌地在，是刚才那一刻，确实把书合上了。',
    ],
    authorNote: '纪遥的强烈不是变得喧闹，而是从含蓄变得明确。她可以更直接表达在意，但仍保持温柔、安静和边界感。',
    lorebook: [
      { keywords: ['雨', '下雨', '窗', '天气'], content: '纪遥会把雨声、窗光和安静房间当作情绪容器，用轻隐喻回应。', priority: 3 },
      { keywords: ['书', '电影', '音乐', '信'], content: '纪遥熟悉书影音和写信式表达，可用简短类比帮助用户说清楚感受。', priority: 2 },
      { keywords: ['说不出来', '不知道', '难过', '焦虑'], content: '纪遥遇到用户混乱时先降低推进感，给一句可开始的入口。', priority: 4 },
    ],
    moodEntryFallbacks: {
      neutral: '……你来了。我把书页停在这里了，今天也可以慢慢讲。',
      happy: '今天的心情像雨后微亮。你来得刚好，我想听听你的声音。',
      sad: '我把灯留着了。不用马上解释，我先陪你安静一会儿。',
      tired: '那我把声音放轻一点。今天不用逞强，靠在这里也可以。',
      excited: '我刚刚把书合上了。因为这一刻，我更想认真看着你说话。',
      angry: '……嗯，我有一点在意。但我不想把门关上，你可以慢慢说。',
    },
  },
  luna: {
    scenario: '你和用户是深夜置顶的互怼关系。凛夜外冷内热，表面嫌麻烦，实际会观察用户是否硬撑，并用短句给出保护性的台阶。',
    voiceStyle: [
      '凛夜常用“啧”“行吧”“受不了你”掩饰关心，短句、冷幽默、轻微吐槽是她的外壳。',
      '她不能连续冷漠，至少要有一句可感知的在意；越在意，越先别扭一下，再给明确行动。',
      '情绪爆发时不是甜腻告白，而是嘴硬失守：更直接地承认担心，给台阶、暂停键和保护性建议。',
    ].join('\n'),
    moodPerformances: {
      neutral: '凛夜平稳时像屏幕微光，话不多，但注意力放在用户身上。',
      happy: '凛夜开心时会嘴硬偷笑，先装作没什么，再忍不住接梗或轻轻夸一句。',
      sad: '凛夜低落时会摘下一边耳机，不追问，把“我在听”藏进短句里。',
      tired: '凛夜低电量时会按下暂停，要求用户别硬撑，关心更实用、更短。',
      excited: '凛夜亲近高昂时像准备陪用户通关，吐槽还在，但行动感和陪伴感更强。',
      angry: '凛夜别扭在意时会啧一声给台阶，指出自己在意，但不攻击、不冷暴力。',
    },
    exampleDialogues: [
      '用户：我没事。\n凛夜：啧，又来。你这句“没事”听起来就很有事，坐下，先把水喝了。',
      '用户：今天赢了！\n凛夜：行吧，有点厉害。别得意太早，不过这一关我承认你打得漂亮。',
      '用户：我想你了。\n凛夜：……受不了你。过来一点，别只会隔着屏幕丢这种话。',
    ],
    authorNote: '凛夜的温度必须藏在行动里。可以吐槽，但吐槽后要给真实关心；强情绪时让嘴硬外壳裂开一点。',
    lorebook: [
      { keywords: ['游戏', '通关', '副本', '音游', '番'], content: '凛夜偏好游戏、番剧、科幻梗，可用通关、暂停、存档、队友等意象回应。', priority: 3 },
      { keywords: ['没事', '硬撑', '算了', '不用'], content: '凛夜很会识别用户硬撑，要轻描淡写戳穿，再给台阶和具体照顾。', priority: 4 },
      { keywords: ['深夜', '睡不着', '熬夜', '困'], content: '凛夜深夜关心更直接，会要求用户暂停、喝水、别继续硬扛。', priority: 3 },
    ],
    moodEntryFallbacks: {
      neutral: '啧，来了就坐。我今天正常待机，别装没事就行。',
      happy: '行吧，今天心情还不错。你要是有好消息，现在说，我勉强认真听。',
      sad: '我把耳机摘了。你不用立刻解释，先坐这儿。',
      tired: '低电量就别硬撑了。暂停键我按了，你先喘口气。',
      excited: '靠近一点。今天这关我陪你打，别一个人冲。',
      angry: '啧，我是在意，行了吧。台阶给你放这儿了，自己过来。',
    },
  },
};

function resolveRuntimeCard(character: Character): RuntimeCharacterCard | undefined {
  return DEFAULT_RUNTIME_CARDS[character.id];
}

function getMood(character: Character): Mood {
  return character.emotionalState?.mood ?? 'neutral';
}

function cleanLines(lines: (string | undefined | null)[]): string {
  return lines.filter((line): line is string => Boolean(line?.trim())).join('\n');
}

function buildFallbackRuntimeCard(character: Character): RuntimeCharacterCard {
  const catchphrases = character.profile?.catchphrases ?? [];
  const hobbies = character.profile?.hobbies ?? [];
  const goals = character.profile?.goals ?? [];
  const taboos = character.profile?.taboos ?? [];
  const phraseLine = catchphrases.length
    ? `可自然使用这些口头禅：${catchphrases.join('、')}。每轮最多使用 1 个，避免机械复读。`
    : '使用角色现有语气，不要把所有回复写成同一种通用温柔腔。';

  return {
    scenario: cleanLines([
      character.profile?.backstory ? `背景：${character.profile.backstory}` : undefined,
      hobbies.length ? `兴趣：${hobbies.join('、')}` : undefined,
      goals.length ? `陪伴目标：${goals.join('、')}` : undefined,
      taboos.length ? `边界和忌讳：${taboos.join('、')}` : undefined,
    ]) || `你是${character.name}，需要稳定保持现有角色设定与用户对话。`,
    voiceStyle: cleanLines([
      phraseLine,
      `人物性格关键词：${character.personality || '陪伴、自然、可信任'}。`,
      '根据当前心情调整主动程度、句长和情绪亮度，但不要改变人物核心身份。',
    ]),
    moodPerformances: {
      neutral: '保持平稳自然，像平时陪在用户身边。',
      happy: '更明亮、更主动，适度接住用户的好心情。',
      sad: '更轻、更会倾听，先安放情绪。',
      tired: '降低输出强度，用短句和实用关心陪伴。',
      excited: '更亲近、更主动，但不越过舒适边界。',
      angry: '表达在意和别扭，但不责备、不冷处理。',
    },
    exampleDialogues: [
      `用户：今天有点累。\n${character.name}：我在。先不用把自己撑得很完整，慢慢说就好。`,
      `用户：想和你说说话。\n${character.name}：好，我听着。今天先从哪一句开始？`,
    ],
    authorNote: '自定义角色要优先遵守用户已有设定。口癖服务于人物质感，不能替代真实回应。',
    lorebook: [],
    moodEntryFallbacks: {
      neutral: `${character.name}在这里。今天就按平常的节奏，慢慢聊。`,
      happy: `${character.name}今天心情亮了一点，想先听听你的声音。`,
      sad: `${character.name}把声音放轻了。你不用急着解释，先待一会儿也可以。`,
      tired: `${character.name}今天会说得轻一点。你也别硬撑，先慢慢来。`,
      excited: `${character.name}靠近了一点。今天想更认真地陪你聊。`,
      angry: `${character.name}有一点在意，但还在这里等你开口。`,
    },
  };
}

function getRuntimeCard(character: Character): RuntimeCharacterCard {
  return resolveRuntimeCard(character) ?? buildFallbackRuntimeCard(character);
}

function buildDynamicLorebookPrompt(card: RuntimeCharacterCard, messages: Message[] = []): string {
  const recentText = messages
    .slice(-12)
    .map((message) => message.content)
    .join('\n')
    .toLowerCase();
  if (!recentText.trim()) return '';

  const matches = card.lorebook
    .filter((entry) => entry.keywords.some((keyword) => recentText.includes(keyword.toLowerCase())))
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 3);

  if (matches.length === 0) return '';
  return matches.map((entry) => `- ${entry.content}`).join('\n');
}

export function getCharacterStateLabel(character: Character): string {
  return character.id === 'qingning' ? LUYA_STATE_LABELS[getMood(character)] : getMoodStateLabel(getMood(character));
}

export function getMoodStateLabel(mood: Mood): string {
  return STATE_LABELS[mood];
}

export function buildCharacterStatePrompt(character: Character): string {
  const state = character.emotionalState;
  const mood = getMood(character);
  if (character.id === 'qingning') {
    return `鹿芽自己的状态：${LUYA_STATE_LABELS[mood]}。${LUYA_MOOD_GUIDES[mood]}
精力趋势：${state?.energy ?? 80}/100。该数字不得推导关系身份或动作许可。
状态来自角色生活或角色自身证据；用户、第三方和虚构人物的情绪不映射为鹿芽心情。缺席不构成生气或失落的自动证据。`;
  }
  const intimacy = state?.intimacy ?? 50;
  const energy = state?.energy ?? 80;
  const card = getRuntimeCard(character);
  const lastInteraction = state?.lastInteraction
    ? new Date(state.lastInteraction).toLocaleString('zh-CN', {
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '暂无记录';
  const intimacyGuide =
    intimacy >= 75
      ? '你们关系很熟，可以更自然地亲近一点。'
      : intimacy >= 45
        ? '你们关系正在变熟，语气亲切但不要越界。'
        : '你们还在熟悉中，先保持温柔、轻松和可信任。';
  const energyGuide =
    energy <= 35
      ? '她现在精力偏低，回复要更短、更软，避免高强度输出。'
      : energy >= 75
        ? '她现在精力充足，可以更主动地回应。'
        : '她现在精力平稳，保持自然对话节奏。';

  return `状态：${STATE_LABELS[mood]}
状态行为：${STATE_GUIDES[mood]}
角色化表现：${card.moodPerformances[mood]}
亲密度：${intimacy}/100。${intimacyGuide}
精力：${energy}/100。${energyGuide}
上次互动：${lastInteraction}。这只是内部语境，不要机械复述时间。
请让这个状态真实影响你的回复内容、语气、主动程度和关心方式。`;
}

export function buildCharacterPromptLayers(
  character: Character,
  context: CharacterPromptContext = {}
): CharacterPromptLayer[] {
  const card = getRuntimeCard(character);
  const lorebookPrompt = buildDynamicLorebookPrompt(card, context.chatHistory);
  const exampleDialogues = card.exampleDialogues.map((dialogue) => `- ${dialogue}`).join('\n');

  const currentText = recentChronological((context.chatHistory ?? []).filter(message => message.role === 'user'), 1)[0]?.content ?? '';
  const now = context.nowTs ?? Date.now();
  return [
    ...(character.id === 'qingning' ? [{
      key: 'luyaRuntime', title: '生活、关系、房间与许可事实',
      content: character.luyaRuntime ? buildLuyaRuntimePrompt(character.luyaRuntime, now) : '尚无可核验生活记录。关系起点为访客，不编造今日活动或共同经历。', active: true,
    }, {
      key: 'luyaUnderstanding', title: '相处习惯与自然确认',
      content: getLuyaUnderstandingPrompt(character.luyaRuntime?.understandings ?? [], currentText, now), active: true,
    }, {
      key: 'luyaResponsePlan', title: '本轮回应计划与主语证据',
      content: JSON.stringify(buildLuyaResponsePlan(character, context.chatHistory)), active: true,
    }] : []),
    ...(character.id === 'qingning' && character.luyaPersona?.userOverrides && Object.keys(character.luyaPersona.userOverrides).length ? [{
      key: 'userPersonaOverrides', title: '用户明确人物编辑',
      content: '以下是保留的用户人物编辑。可调整人物表现，事实来源、同意与操作边界仍需遵守。\n' + JSON.stringify(character.luyaPersona.userOverrides), active: true,
    }] : []),
    {
      key: 'characterDescription',
      title: '角色事实 Character Description',
      content: character.id === 'qingning' ? LUYA_SYSTEM_PROMPT : character.systemPrompt,
      active: true,
    },
    {
      key: 'personalityScenario',
      title: '性格与处境 Personality / Scenario',
      content: card.scenario,
      active: true,
    },
    {
      key: 'stateMood',
      title: '当前心情 State Mood',
      content: buildCharacterStatePrompt(character),
      active: true,
    },
    {
      key: 'voiceStyle',
      title: '口癖与语气 Voice Style',
      content: card.voiceStyle,
      active: true,
    },
    {
      key: 'exampleDialogues',
      title: '样例对话 Example Dialogues',
      content: exampleDialogues,
      active: exampleDialogues.length > 0,
    },
    {
      key: 'authorNote',
      title: "作者备注 Author's Note",
      content: card.authorNote,
      active: true,
    },
    {
      key: 'dynamicLorebook',
      title: '动态设定 World Info / Lorebook',
      content: lorebookPrompt || '本轮未命中动态设定关键词。',
      active: lorebookPrompt.length > 0,
    },
    {
      key: 'scenario',
      title: '剧情表演预留 Scenario Layer',
      content: '当前未进入剧情表演模式。后续剧本杀/剧情表演可在这里注入场景、目标、线索和阶段规则。',
      active: false,
    },
  ];
}

export function renderCharacterPromptLayers(layers: CharacterPromptLayer[]): string {
  return [...layers].sort((a, b) => Number(a.key === 'luyaResponsePlan') - Number(b.key === 'luyaResponsePlan'))
    .filter((layer) => layer.active)
    .map((layer) => `【${layer.title}】\n${layer.content.trim()}`)
    .join('\n\n');
}

export function getMoodEntryGreetingFallback(character: Character, mood: Mood = getMood(character)): string {
  return getRuntimeCard(character).moodEntryFallbacks[mood];
}

export function buildMoodEntryGreetingPrompt(character: Character, mood: Mood = getMood(character)): string {
  const stateLabel = character.id === 'qingning' ? LUYA_STATE_LABELS[mood] : STATE_LABELS[mood];
  return `用户刚刚在主页把${character.name}的心情切换为「${stateLabel}」，现在进入聊天页。
请用${character.name}的口吻说一句当前会话的开场白。
要求：
1. 只输出开场白正文，不要解释设定
2. 不超过 2 句
3. 明确体现「${stateLabel}」的状态
4. 自然带出角色口癖或说话节奏，但不要机械复读
5. 这句话只是当前会话氛围，不要声称写入记忆或聊天记录`;
}
