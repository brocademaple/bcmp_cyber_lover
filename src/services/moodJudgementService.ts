import { AdvancedConfig, Character, EmotionalState, Message, ServiceConfig } from '../types';
import { PROVIDER_CONFIGS } from '../store/settingsStore';
import { recentChronological } from '../utils/chatHistory';
import { resolveDefaultCharacterAssetKey } from '../utils/characterAssets';
import { fetchWithTimeout } from './requestTimeout';

type Mood = EmotionalState['mood'];

export interface MoodJudgementResult {
  mood: Mood;
  score: number;
  label: string;
  bandLabel: string;
  reason: string;
  confidence: number;
  currentMood: Mood;
  suggestedMood: Mood;
  shouldSync: boolean;
  evidence: string[];
  isStateContinuation: boolean;
}

interface MoodJudgementInput {
  character: Character;
  messages: Message[];
  service: ServiceConfig;
  advanced: AdvancedConfig;
  nowTs?: number;
  preferLocal?: boolean;
}

type LlmMoodJudgement = {
  mood?: unknown;
  score?: unknown;
  reason?: unknown;
  confidence?: unknown;
  evidence?: unknown;
};

type MoodSignal = {
  assistant: RegExp[];
  user: RegExp[];
  any: RegExp[];
  evidence: string;
};

type CalibrationDraft = {
  scores: Record<Mood, number>;
  evidenceByMood: Record<Mood, string[]>;
  assistantHits: Record<Mood, number>;
  messageCount: number;
  assistantCount: number;
  modelConflict: boolean;
};

type LlmCandidate = {
  mood: Mood;
  score: number;
  reason: string;
  confidence: number;
  evidence: string[];
};

const SYNC_CONFIDENCE_THRESHOLD = 0.68;
const GENERAL_SWITCH_DELTA = 3;
const TIRED_TO_BRIGHT_SWITCH_DELTA = 5;

const MOOD_META: Record<Mood, { homeLabel: string; bandLabel: string; fallbackScore: number }> = {
  neutral: { homeLabel: '自然待机', bandLabel: '平稳适中', fallbackScore: 56 },
  happy: { homeLabel: '开心营业', bandLabel: '情绪上扬', fallbackScore: 76 },
  sad: { homeLabel: '安静陪着', bandLabel: '情绪偏低', fallbackScore: 36 },
  tired: { homeLabel: '低电量关心', bandLabel: '能量偏低', fallbackScore: 42 },
  excited: { homeLabel: '靠近一下', bandLabel: '亲近高昂', fallbackScore: 88 },
  angry: { homeLabel: '坐着等你', bandLabel: '别扭在意', fallbackScore: 48 },
};

const CHARACTER_MOOD_LABELS: Record<string, Partial<Record<Mood, string>>> = {
  qingning: {
    neutral: '自然待机 · 甜甜待机',
    happy: '开心营业 · 亮晶晶上扬',
    sad: '安静陪着 · 声音放软',
    tired: '低电量关心 · 零食毯子模式',
    excited: '靠近一下 · 凑近屏幕',
    angry: '坐着等你 · 嘴上哼哼',
  },
  sakura: {
    neutral: '自然待机 · 书页停在这里',
    happy: '开心营业 · 雨后微亮',
    sad: '安静陪着 · 留一盏灯',
    tired: '低电量关心 · 灯调暗一点',
    excited: '靠近一下 · 合上书认真听',
    angry: '坐着等你 · 温柔等你开口',
  },
  luna: {
    neutral: '自然待机 · 屏幕微光',
    happy: '开心营业 · 嘴硬偷笑',
    sad: '安静陪着 · 摘下一边耳机',
    tired: '低电量关心 · 按下暂停',
    excited: '靠近一下 · 准备陪你通关',
    angry: '坐着等你 · 啧一声给台阶',
  },
};

const MOOD_SIGNALS: Record<Mood, MoodSignal> = {
  neutral: {
    assistant: [/还好|平静|普通|日常|慢慢来|自然|我在这里|今天也在/],
    user: [/日常|随便聊聊|还好|普通/],
    any: [/自然待机|平稳|适中/],
    evidence: '语气平稳，节奏接近日常待机。',
  },
  happy: {
    assistant: [/哈哈|笑死|开心|高兴|好耶|嘿嘿|亮晶晶|玩梗|太好了|可爱|甜甜|冲呀/],
    user: [/哈哈|开心|太好了|好耶|喜欢/],
    any: [/情绪上扬|开心营业/],
    evidence: '出现明显笑意、玩梗或明亮回应。',
  },
  sad: {
    assistant: [/安静|不急|我在听|留一盏灯|声音放轻|慢慢说|可以不用笑|难过也可以|陪着你/],
    user: [/难过|低落|崩溃|委屈|焦虑|害怕|哭|孤单|失眠|不开心|受伤/],
    any: [/情绪偏低|安静陪着/],
    evidence: '回应更安静，重点在安放和陪伴情绪。',
  },
  tired: {
    assistant: [/累|困|疲惫|撑不住|低电量|休息|歇|别硬撑|暂停|毯子|小毯子|热可可|热饮|慢慢喝|先裹着|枕头|降噪/],
    user: [/累|困|疲惫|睡不着|撑不住|低电量|不想动|今天好累/],
    any: [/能量偏低|低电量关心/],
    evidence: '低电量、休息、热饮或毯子类照顾在稳定出现。',
  },
  excited: {
    assistant: [/抱|抱抱|靠近|贴贴|凑近|亲|撒娇|心动|靠过来|过来一点|认真看着你|想更靠近|黏着你/],
    user: [/想你|抱抱|爱你|陪我|贴贴|亲亲/],
    any: [/亲近高昂|靠近一下/],
    evidence: '角色有明确靠近、撒娇或强主动表达。',
  },
  angry: {
    assistant: [/哼|啧|别扭|等你回来|生气|不理你|已读|嘴硬|受不了你|给台阶|行吧|算了|别装没听见/],
    user: [/不理我|生气了吗|哄你|别气/],
    any: [/别扭在意|坐着等你/],
    evidence: '出现嘴硬、台阶、等待或别扭在意的表达。',
  },
};

const CHARACTER_SIGNAL_PATTERNS: Record<string, Partial<Record<Mood, RegExp[]>>> = {
  qingning: {
    happy: [/零食开趴|甜甜|诶诶|笨蛋啦|分你一杯|双倍快乐/],
    tired: [/芋泥|毯子|热可可|休息|慢点喝|别硬撑|零食毯子/],
    excited: [/凑近|一起嘛|贴贴|黏着你|扑过来/],
    angry: [/哼|嘴上|笨蛋|等你哄/],
  },
  sakura: {
    neutral: [/书页|旧书店|慢慢讲|雨声/],
    happy: [/雨后|笑意|窗边|微亮/],
    sad: [/不急|我在听|安静|留一盏灯/],
    tired: [/灯调暗|不用马上振作|先休息/],
    excited: [/合上书|认真看你|这次不绕弯|靠近一点/],
  },
  luna: {
    happy: [/偷笑|嘴角|心情不错|算你厉害/],
    tired: [/暂停|别硬撑|休息|按下暂停/],
    excited: [/通关|键盘|陪你|靠近屏幕/],
    angry: [/啧|行吧|受不了你|台阶|嘴硬/],
  },
};

function getBaseUrl(config: ServiceConfig): string {
  if (config.provider === 'custom') return config.baseUrl?.trim() || '';
  return PROVIDER_CONFIGS[config.provider].baseUrl;
}

function getApiKey(config: ServiceConfig): string {
  return config.apiKey.trim();
}

function extractAssistantContent(data: { choices?: { message?: { content?: string } }[] }): string {
  return data.choices?.[0]?.message?.content || '';
}

function extractJsonObject(text: string): unknown | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] ?? trimmed;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start < 0 || end <= start) return null;

  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeScore(value: unknown, fallback: number): number {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return fallback;
  return clamp(Math.round(num), 0, 100);
}

function normalizeConfidence(value: unknown, fallback: number): number {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return fallback;
  return clamp(Number(num.toFixed(2)), 0, 1);
}

function normalizeMood(value: unknown): Mood | null {
  if (
    value === 'neutral' ||
    value === 'happy' ||
    value === 'sad' ||
    value === 'tired' ||
    value === 'excited' ||
    value === 'angry'
  ) {
    return value;
  }
  return null;
}

function getCharacterLabelKey(character: Character): string {
  return resolveDefaultCharacterAssetKey(character) ?? character.id;
}

function getMoodLabel(character: Character, mood: Mood): string {
  const key = getCharacterLabelKey(character);
  return CHARACTER_MOOD_LABELS[key]?.[mood] ?? `${MOOD_META[mood].homeLabel} · ${MOOD_META[mood].bandLabel}`;
}

function formatContextMessages(messages: Message[]): string {
  return messages
    .filter((message) => message.role !== 'system' && message.status !== 'failed' && message.content.trim())
    .map((message) => `${message.role === 'user' ? '用户' : '角色'}: ${message.content.trim()}`)
    .join('\n');
}

function buildMoodJudgePrompt(input: MoodJudgementInput): { role: string; content: string }[] {
  const state = input.character.emotionalState;
  const currentMood = state?.mood ?? 'neutral';
  const contextMessages = recentChronological(input.messages, 24);
  const contextText = formatContextMessages(contextMessages) || '暂无有效聊天上下文';
  const allowedMoodText = Object.entries(MOOD_META)
    .map(([mood, meta]) => `${mood}: ${meta.homeLabel} / ${meta.bandLabel}`)
    .join('\n');

  return [
    {
      role: 'system',
      content: `你是 AI 伴侣产品的“会话状态校准器”。你判断的是“当前角色状态是否需要从主页状态切换”，不是重新给整段聊天贴标签，也不是判断用户心情。

只输出一个 JSON 对象，不要输出 Markdown，不要解释。

当前主页 mood 是强锚点，默认建议维持。只有角色自己的回复出现清晰、持续的反向证据时，才建议切换。
温柔照顾、想念、递热饮、盖毯子在 tired 状态下优先视为“低电量关心”的表现，不能直接判 happy。
excited 需要角色明确靠近、撒娇或强主动表达，不能只靠用户说“想你了”。
angry 在本产品里偏“别扭在意”，不是攻击性愤怒。

可选 mood 必须只来自以下枚举：
${allowedMoodText}

JSON schema:
{"mood":"neutral|happy|sad|tired|excited|angry","score":0-100,"reason":"一句中文依据","confidence":0-1,"evidence":["证据1","证据2"]}`,
    },
    {
      role: 'user',
      content: `角色：${input.character.name}
人设：${input.character.personality}
当前主页状态：${currentMood} / ${MOOD_META[currentMood].homeLabel} / ${MOOD_META[currentMood].bandLabel}
当前亲密度与精力：${state ? `${state.intimacy}/100, ${state.energy}/100` : '暂无'}

最近上下文：
${contextText}

请只给出候选建议，最终是否切换会由本地校准器决定。`,
    },
  ];
}

function normalizeLlmCandidate(raw: unknown): LlmCandidate | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as LlmMoodJudgement;
  const mood = normalizeMood(data.mood);
  if (!mood) return null;
  const rawEvidence = Array.isArray(data.evidence)
    ? data.evidence.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).slice(0, 3)
    : [];

  return {
    mood,
    score: normalizeScore(data.score, MOOD_META[mood].fallbackScore),
    reason: typeof data.reason === 'string' ? data.reason : '模型给出了一个会话状态候选。',
    confidence: normalizeConfidence(data.confidence, 0.62),
    evidence: rawEvidence,
  };
}

async function evaluateWithLlm(input: MoodJudgementInput): Promise<LlmCandidate | null> {
  if (input.preferLocal) return null;

  const baseUrl = getBaseUrl(input.service);
  const apiKey = getApiKey(input.service);
  const model = input.service.model.trim();
  if (!baseUrl || !apiKey || !model) return null;

  const response = await fetchWithTimeout(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: buildMoodJudgePrompt(input),
      stream: false,
      temperature: 0.1,
      max_tokens: 300,
      ...input.advanced.customRequestParams,
    }),
  });

  if (!response.ok) return null;
  const data = await response.json();
  const content = extractAssistantContent(data);
  return normalizeLlmCandidate(extractJsonObject(content));
}

function createEmptyMoodRecord<T>(value: T): Record<Mood, T> {
  return {
    neutral: Array.isArray(value) ? ([...value] as T) : value,
    happy: Array.isArray(value) ? ([...value] as T) : value,
    sad: Array.isArray(value) ? ([...value] as T) : value,
    tired: Array.isArray(value) ? ([...value] as T) : value,
    excited: Array.isArray(value) ? ([...value] as T) : value,
    angry: Array.isArray(value) ? ([...value] as T) : value,
  };
}

function addEvidence(record: Record<Mood, string[]>, mood: Mood, text: string) {
  if (!record[mood].includes(text)) record[mood].push(text);
}

function countPatternHits(text: string, patterns: RegExp[] = []): number {
  return patterns.reduce((total, pattern) => {
    const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
    const matcher = new RegExp(pattern.source, flags);
    return total + (text.match(matcher)?.length ?? 0);
  }, 0);
}

function collectLocalDraft(input: MoodJudgementInput, llmCandidate: LlmCandidate | null): CalibrationDraft {
  const currentMood = input.character.emotionalState?.mood ?? 'neutral';
  const recentMessages = recentChronological(input.messages, 18)
    .filter((message) => message.role !== 'system' && message.status !== 'failed' && message.content.trim());
  const assistantMessages = recentMessages.filter((message) => message.role === 'assistant');
  const assistantText = assistantMessages.map((message) => message.content).join('\n');
  const userText = recentMessages.filter((message) => message.role === 'user').map((message) => message.content).join('\n');
  const combinedText = `${assistantText}\n${userText}`;
  const characterKey = getCharacterLabelKey(input.character);
  const scores = createEmptyMoodRecord(0);
  const evidenceByMood = createEmptyMoodRecord<string[]>([]);
  const assistantHits = createEmptyMoodRecord(0);

  scores[currentMood] = 4.5;
  addEvidence(evidenceByMood, currentMood, `当前主页状态是「${MOOD_META[currentMood].homeLabel}」，默认先维持。`);

  (Object.keys(MOOD_SIGNALS) as Mood[]).forEach((mood) => {
    const signal = MOOD_SIGNALS[mood];
    const assistantHit = countPatternHits(assistantText, signal.assistant);
    const userHit = countPatternHits(userText, signal.user);
    const anyHit = countPatternHits(combinedText, signal.any);
    const characterHit = countPatternHits(combinedText, CHARACTER_SIGNAL_PATTERNS[characterKey]?.[mood]);

    if (assistantHit > 0) {
      scores[mood] += assistantHit * 2.2;
      assistantHits[mood] += assistantHit;
      addEvidence(evidenceByMood, mood, signal.evidence);
    }
    if (userHit > 0) {
      scores[mood] += userHit * 0.9;
      addEvidence(evidenceByMood, mood, `用户文本有「${MOOD_META[mood].bandLabel}」相关触发，但不会单独决定角色状态。`);
    }
    if (anyHit > 0) {
      scores[mood] += anyHit * 1.2;
      addEvidence(evidenceByMood, mood, `上下文直接出现「${MOOD_META[mood].homeLabel}」类状态词。`);
    }
    if (characterHit > 0) {
      scores[mood] += characterHit * 1.4;
      addEvidence(evidenceByMood, mood, `${input.character.name} 的角色化口癖命中了「${MOOD_META[mood].homeLabel}」。`);
    }
  });

  if (currentMood === 'tired' && /热可可|热饮|毯子|小毯子|慢慢喝|先裹着|摸头|别硬撑|休息/.test(combinedText)) {
    scores.tired += 2.5;
    addEvidence(evidenceByMood, 'tired', '热饮、毯子、摸头和慢慢休息更像低电量关心，不直接等于开心高昂。');
    scores.happy = Math.max(0, scores.happy - 1.5);
    scores.excited = Math.max(0, scores.excited - 1.5);
  }

  if (/想你|想你了|抱抱|陪我/.test(userText) && assistantHits.excited === 0) {
    scores.excited = Math.max(0, scores.excited - 1.2);
    addEvidence(evidenceByMood, currentMood, '只有用户表达想念，角色没有强靠近动作，先不强判亲近高昂。');
  }

  let modelConflict = false;
  if (llmCandidate) {
    const hasLocalEvidence = evidenceByMood[llmCandidate.mood].length > 0 || assistantHits[llmCandidate.mood] > 0;
    if (hasLocalEvidence) {
      scores[llmCandidate.mood] += clamp(llmCandidate.confidence, 0.2, 0.8);
      addEvidence(evidenceByMood, llmCandidate.mood, `模型候选为「${MOOD_META[llmCandidate.mood].homeLabel}」：${llmCandidate.reason}`);
      llmCandidate.evidence.forEach((item) => addEvidence(evidenceByMood, llmCandidate.mood, item));
    } else if (llmCandidate.mood !== currentMood) {
      modelConflict = true;
      addEvidence(evidenceByMood, currentMood, `模型候选与本地证据不足冲突，先以当前状态为准。`);
    }
  }

  return {
    scores,
    evidenceByMood,
    assistantHits,
    messageCount: recentMessages.length,
    assistantCount: assistantMessages.length,
    modelConflict,
  };
}

function getDominantMood(scores: Record<Mood, number>, fallbackMood: Mood): Mood {
  const preference: Mood[] = [fallbackMood, 'tired', 'angry', 'sad', 'excited', 'happy', 'neutral'];
  return (Object.keys(scores) as Mood[]).sort((a, b) => {
    const scoreDelta = scores[b] - scores[a];
    if (scoreDelta !== 0) return scoreDelta;
    return preference.indexOf(a) - preference.indexOf(b);
  })[0] ?? fallbackMood;
}

function getResultScore(mood: Mood, evidenceCount: number, shouldSync: boolean): number {
  const fallback = MOOD_META[mood].fallbackScore;
  if (mood === 'sad') return clamp(fallback + evidenceCount, 24, 48);
  if (mood === 'tired') return clamp(fallback + evidenceCount * 2, 32, shouldSync ? 64 : 58);
  if (mood === 'angry') return clamp(fallback + evidenceCount * 2, 36, 66);
  if (mood === 'neutral') return clamp(fallback + evidenceCount, 48, 66);
  return clamp(fallback + evidenceCount * 3, 66, 96);
}

function buildResult(
  character: Character,
  currentMood: Mood,
  suggestedMood: Mood,
  score: number,
  reason: string,
  confidence: number,
  evidence: string[]
): MoodJudgementResult {
  const normalizedConfidence = normalizeConfidence(confidence, 0.56);
  const shouldSync = suggestedMood !== currentMood && normalizedConfidence >= SYNC_CONFIDENCE_THRESHOLD;
  const finalMood = shouldSync ? suggestedMood : currentMood;
  const homeLabel = getMoodLabel(character, finalMood);

  return {
    mood: finalMood,
    score: clamp(Math.round(score), 0, 100),
    label: shouldSync ? `建议切到${homeLabel}` : `维持${getMoodLabel(character, currentMood)}`,
    bandLabel: shouldSync ? `建议切换 · ${MOOD_META[suggestedMood].bandLabel}` : `延续当前 · ${MOOD_META[currentMood].bandLabel}`,
    reason: reason.trim().slice(0, 180) || '当前上下文还不够明显，建议先维持主页状态。',
    confidence: normalizedConfidence,
    currentMood,
    suggestedMood: finalMood,
    shouldSync,
    evidence: evidence.slice(0, 3),
    isStateContinuation: !shouldSync,
  };
}

function evaluateLocal(input: MoodJudgementInput, llmCandidate: LlmCandidate | null): MoodJudgementResult {
  const currentMood = input.character.emotionalState?.mood ?? 'neutral';
  const draft = collectLocalDraft(input, llmCandidate);

  if (draft.messageCount < 2 || draft.assistantCount < 1) {
    return buildResult(
      input.character,
      currentMood,
      currentMood,
      getResultScore(currentMood, 1, false),
      '上下文还不够明显，或角色回复不足，建议先维持当前主页状态。',
      0.42,
      [
        `有效会话 ${draft.messageCount} 条，角色回复 ${draft.assistantCount} 条。`,
        `当前主页状态是「${MOOD_META[currentMood].homeLabel}」。`,
      ]
    );
  }

  const dominantMood = getDominantMood(draft.scores, currentMood);
  const currentScore = draft.scores[currentMood];
  const dominantScore = draft.scores[dominantMood];
  const delta = dominantScore - currentScore;
  const needsStrongBrightEvidence =
    currentMood === 'tired' && (dominantMood === 'happy' || dominantMood === 'excited');
  const switchDelta = needsStrongBrightEvidence ? TIRED_TO_BRIGHT_SWITCH_DELTA : GENERAL_SWITCH_DELTA;
  const candidateEvidence = draft.evidenceByMood[dominantMood];
  const hasEnoughEvidence = candidateEvidence.length >= 2;
  const hasExcitedAssistantEvidence = dominantMood !== 'excited' || draft.assistantHits.excited >= 1;
  const rawConfidence =
    0.48 +
    Math.min(draft.messageCount, 12) * 0.015 +
    Math.max(0, delta) * 0.045 +
    Math.min(candidateEvidence.length, 4) * 0.04 -
    (draft.modelConflict ? 0.12 : 0);
  const confidence = clamp(rawConfidence, 0.36, 0.86);
  const canSwitch =
    dominantMood !== currentMood &&
    delta >= switchDelta &&
    hasEnoughEvidence &&
    hasExcitedAssistantEvidence &&
    confidence >= SYNC_CONFIDENCE_THRESHOLD;
  const suggestedMood = canSwitch ? dominantMood : currentMood;
  const selectedEvidence = canSwitch
    ? candidateEvidence
    : draft.evidenceByMood[currentMood].length > 0
      ? draft.evidenceByMood[currentMood]
      : [`当前证据不足以从「${MOOD_META[currentMood].homeLabel}」切换。`];
  const resultScore = getResultScore(suggestedMood, selectedEvidence.length, canSwitch);
  const reason = canSwitch
    ? `当前会话已有足够证据从「${MOOD_META[currentMood].homeLabel}」切到「${MOOD_META[suggestedMood].homeLabel}」。`
    : dominantMood !== currentMood
      ? `出现了「${MOOD_META[dominantMood].homeLabel}」候选，但证据或置信度未过切换门槛，建议维持当前状态。`
      : `当前表现与主页状态「${MOOD_META[currentMood].homeLabel}」一致，建议维持。`;

  return buildResult(
    input.character,
    currentMood,
    suggestedMood,
    resultScore,
    reason,
    canSwitch ? confidence : Math.min(confidence, 0.67),
    selectedEvidence
  );
}

export async function evaluateMoodFromConversation(input: MoodJudgementInput): Promise<MoodJudgementResult> {
  let llmCandidate: LlmCandidate | null = null;
  try {
    llmCandidate = await evaluateWithLlm(input);
  } catch {}

  return evaluateLocal(input, llmCandidate);
}
