import type { UnderstandingDecayConfig, UnderstandingEvidence, UnderstandingMessage, UnderstandingObservation, UnderstandingTopic, UserUnderstanding } from '../types/luyaUnderstanding';

const DAY = 86400000;
export const DEFAULT_UNDERSTANDING_DECAY: UnderstandingDecayConfig = { downgradeAfterMs: 30 * DAY, archiveAfterMs: 90 * DAY };
const SENSITIVE = /抑郁症|焦虑症|诊断|创伤|性取向|同性恋|异性恋|种族|民族|宗教|信仰|政治|政党|收入|负债|家庭经济|缺爱|依恋|控制欲|人格障碍/;
const THIRD_PARTY = /(?:我|我的)?朋友|博主|小说|角色|同事|同学|室友|老师|妈妈|爸爸|父亲|母亲|我妈|我爸|弟弟|妹妹|姐姐|哥哥|某人|别人|他们|她们|他(?:说|觉得|希望|不想)|她(?:说|觉得|希望|不想)|转发|[“「『][^”」』]+[”」』]/;
const TEMPORARY = /今天|这次|现在|这一回|这会儿|暂时/;
const CORRECTION = /你理解(?:反|错)了|你弄(?:反|错)了|不是这个意思|撤销(?:这条|那个|理解)|别再这样理解我/;
const TOPIC_END = /(?:先|就)?聊到这|换个话题|先这样|改天聊|回头聊|晚安|我先去(?:忙|睡|做饭|上课)|不聊这个了|说点别的|这个话题(?:结束|到此)/;
const TOPIC_RELEVANCE: Record<UnderstandingTopic, RegExp> = {
  listening: /难过|烦|累|倾诉|听|分析|建议|方案|办法|压力|心情|说说|委屈/,
  directness: /直接|委婉|缓冲|讨论|意见|反馈|开门见山/,
  sharing: /分享|视频|帖子|链接|看看|观点|刷到|https?:/,
  quiet: /安静|不想说|不想讲|低电量|待会|陪|沉默|累/,
  humor: /玩笑|逗|认真|严肃|难过|笑话/,
};
interface Clue { topic: UnderstandingTopic; preference: string; statement: string; alternative: string }

/** Conservative, auditable rules only inspect a user's own communication request. */
export function extractUnderstandingClues(message: UnderstandingMessage): Clue[] {
  const text = message.content;
  if (message.role !== 'user' || SENSITIVE.test(text) || THIRD_PARTY.test(text)) return [];
  const clues: Clue[] = [];
  const asksAnalysis = /直接(?:帮我|给我|给|一起|帮忙)?(?:分析|方案|建议)|(?:想|希望|需要).*一起分析|帮我(?:分析|想办法)/.test(text) && !/(?:不要|别|不用)(?:你)?(?:急着)?直接(?:帮我|给我|给)?(?:分析|方案|建议)/.test(text);
  if (!asksAnalysis && /先听|听我(?:说|讲)|只是想说说|不要建议|别(?:急着|给我).*建议|不需要.*(?:方案|建议)|(?:不要|别|不用)(?:你)?直接(?:给我|给)?(?:方案|建议|分析)/.test(text)) {
    clues.push({ topic: 'listening', preference: 'listen_first', statement: '倾诉时，我通常希望先被听见，等我需要时再一起分析。', alternative: '也可能只是这一次不需要建议。' });
  } else if (asksAnalysis) {
    clues.push({ topic: 'listening', preference: 'analyze_together', statement: '谈到困扰时，我通常希望一起分析；是否需要建议仍以当次表达为准。', alternative: '也可能这次的问题更需要具体办法。' });
  }
  if (/直接说|开门见山|不用委婉|不必委婉/.test(text)) clues.push({ topic: 'directness', preference: 'direct', statement: '讨论意见时，我倾向于直接说明重点。', alternative: '也可能只是这个问题不需要铺垫。' });
  else if (/委婉一点|给我.*缓冲|别太直接/.test(text)) clues.push({ topic: 'directness', preference: 'gentle', statement: '讨论分歧时，我倾向于先有一点缓冲。', alternative: '也可能是这次的话题比较难受。' });
  if (/只(?:是)?想(?:一起)?看看|一起看就好|不用分析.*(?:视频|帖子)|分享.*不用分析/.test(text)) clues.push({ topic: 'sharing', preference: 'watch_together', statement: '分享内容时，我有时只想一起看看，不急着分析。', alternative: '也可能只是这条内容不适合展开。' });
  else if (/想听(?:听)?你的(?:观点|看法)|分享.*(?:讨论|交换观点)/.test(text)) clues.push({ topic: 'sharing', preference: 'exchange_views', statement: '分享内容时，我愿意交换彼此的看法，也允许意见不同。', alternative: '也可能只是这一次想听不同角度。' });
  if (/不太想(?:说|讲)话|不想(?:说|讲)话|安静.*(?:待|陪)|各做各的/.test(text)) clues.push({ topic: 'quiet', preference: 'quiet_company', statement: '不想说话时，我愿意安静共处，不需要被追问原因。', alternative: '安静也可能只是这一次需要休息。' });
  if (/别(?:开玩笑|逗我)|不要(?:开玩笑|逗我)|认真.*别.*玩笑/.test(text)) clues.push({ topic: 'humor', preference: 'pause_jokes', statement: '我认真或难过的时候，希望先停下玩笑。', alternative: '也可能只是这次玩笑不合适。' });
  else if (/可以逗我|可以开玩笑|讲个笑话/.test(text)) clues.push({ topic: 'humor', preference: 'allow_jokes', statement: '合适的时候，我接受轻微玩笑；明确说停时就停。', alternative: '这一次想听笑话不等于任何时候都合适。' });
  return clues;
}

export function observeLuyaSharing(observations: UnderstandingObservation[], message: UnderstandingMessage): UnderstandingObservation[] {
  if (message.role !== 'user' || !/分享|刷到|视频|帖子|链接|https?:/.test(message.content) || observations.some(o => o.sourceMessageId === message.id)) return observations;
  return [...observations, {
    id: `observation_${message.id}`, sourceMessageId: message.id, timestamp: message.timestamp,
    sharedContent: message.content, hadExplanation: /因为|我觉得|我想|我的看法/.test(message.content),
    hypothesis: '可能只是想一起看看；我拿不准这是否代表你的看法。',
    alternatives: ['也可能希望交换观点。', '也可能在表达疑问或反对。', '内容中的人物经历不等于你的经历。'],
  }];
}

function revise(item: UserUnderstanding, patch: Partial<UserUnderstanding>, now: number, reason: string): UserUnderstanding {
  return { ...item, ...patch, version: item.version + 1, updatedAt: now, versionHistory: [...item.versionHistory, { version: item.version, statement: item.statement, changedAt: now, reason }] };
}

export function observeLuyaUnderstanding(items: UserUnderstanding[], message: UnderstandingMessage, now = message.timestamp): UserUnderstanding[] {
  if (message.role !== 'user') return items;
  if (CORRECTION.test(message.content) && !THIRD_PARTY.test(message.content)) {
    // The same saved user message is processed before and after generation.
    if (items.some(item => item.counterEvidence.some(e => e.messageId === message.id))) return items;
    const active = items.filter(item => !item.deletedAt && !['revoked', 'archived'].includes(item.status));
    const named = active.filter(item => TOPIC_RELEVANCE[item.topic].test(message.content));
    const lastQuestion = active.filter(item => item.naturalQuestionAt !== undefined).sort((a, b) => (b.naturalQuestionAt ?? 0) - (a.naturalQuestionAt ?? 0))[0];
    // An ambiguous correction without a current question needs clarification, never a random revocation.
    const affected = named.length === 1 ? named[0] : lastQuestion ?? (active.length === 1 ? active[0] : undefined);
    if (affected) items = items.map(item => item.id === affected.id ? revise(item, {
      status: 'revoked', revokedAt: now, cardDismissedAt: now,
      sourceMessageIds: [...item.sourceMessageIds, message.id],
      counterEvidence: [...item.counterEvidence, { messageId: message.id, summary: message.content, timestamp: message.timestamp }],
    }, now, `用户明确纠正：${message.content}`) : item);
  }
  for (const clue of extractUnderstandingClues(message)) {
    const existing = items.find(item => item.topic === clue.topic);
    if (existing?.sourceMessageIds.includes(message.id)) continue;
    const evidence: UnderstandingEvidence = { messageId: message.id, summary: message.content, timestamp: message.timestamp };
    if (!existing) {
      items = [...items, {
        id: `understanding_${clue.topic}_${message.id}`, characterId: 'qingning', category: 'communication_style',
        topic: clue.topic, preference: clue.preference, statement: clue.statement, status: 'low_confidence', confidence: 0.25,
        sourceMessageIds: [message.id], supportEvidence: [evidence], counterEvidence: [], alternatives: [clue.alternative],
        version: 1, versionHistory: [], affects: clue.topic === 'quiet' ? ['reply_style', 'proactive_style', 'room_interaction'] : ['reply_style'],
        createdAt: now, updatedAt: now, lastEvidenceAt: now,
      }];
      continue;
    }
    // A rejection/deletion is a durable opt-out, not an invitation to repeat the same card.
    if (existing.status === 'revoked' || existing.cardDismissedAt || existing.deletedAt) continue;
    const same = existing.preference === clue.preference;
    const evidencePatch = { sourceMessageIds: [...existing.sourceMessageIds, message.id], lastEvidenceAt: now };
    if (!same) {
      // A one-off exception wins this turn without rewriting the user's confirmed default.
      const temporary = TEMPORARY.test(message.content) && !/以后|一直|改成|改为/.test(message.content);
      const statement = existing.status === 'confirmed' && temporary ? existing.statement : `${clue.statement} 不同情境下也可能需要另一种回应，先以当次表达为准。`;
      items = items.map(item => item.id === existing.id ? revise(item, {
        ...evidencePatch, counterEvidence: [...existing.counterEvidence, evidence], statement,
        preference: temporary && existing.status === 'confirmed' ? existing.preference : clue.preference,
        status: existing.status === 'confirmed' && temporary ? 'confirmed' : 'low_confidence',
        confidence: Math.max(0.15, existing.confidence - 0.2),
        ...(temporary && existing.status === 'confirmed' ? {} : { naturalQuestionAt: undefined, naturalQuestionMessageId: undefined, topicEndedAt: undefined, cardPresentedAt: undefined, confirmedAt: undefined }),
      }, now, temporary ? '本轮出现情境例外，当前请求优先' : '反证使原表述需要重新确认') : item);
    } else {
      const supports = [...existing.supportEvidence, evidence];
      const status = existing.status === 'confirmed' ? 'confirmed' : supports.length >= 2 ? 'pending_confirmation' : 'low_confidence';
      items = items.map(item => item.id === existing.id ? revise(item, { ...evidencePatch, supportEvidence: supports, status, confidence: Math.min(0.8, existing.confidence + 0.15), archivedAt: undefined }, now, '新增来自用户本人表达的支持线索') : item);
    }
  }
  return items;
}

export function decayLuyaUnderstandings(items: UserUnderstanding[], now: number, config = DEFAULT_UNDERSTANDING_DECAY): UserUnderstanding[] {
  return items.map(item => {
    if (item.status === 'confirmed' || item.status === 'revoked' || item.status === 'archived') return item;
    const elapsed = Math.max(0, now - item.lastEvidenceAt);
    if (elapsed >= Math.max(config.archiveAfterMs, config.downgradeAfterMs)) return revise(item, { status: 'archived', archivedAt: now, topicEndedAt: undefined }, now, '长期没有新支持线索，已归档且不影响互动');
    if (elapsed >= config.downgradeAfterMs && item.status === 'pending_confirmation') return revise(item, { status: 'low_confidence', confidence: Math.min(item.confidence, 0.2), naturalQuestionAt: undefined, topicEndedAt: undefined }, now, '一段时间没有新支持线索，先放回观察');
    return item;
  });
}

export function markNaturalUnderstandingQuestion(items: UserUnderstanding[], id: string, assistantMessageId: string, now: number): UserUnderstanding[] {
  return items.map(item => item.id === id && item.status === 'pending_confirmation' && !item.cardDismissedAt ? { ...item, naturalQuestionAt: now, naturalQuestionMessageId: assistantMessageId } : item);
}
export function finishUnderstandingTopic(items: UserUnderstanding[], now: number): UserUnderstanding[] {
  return items.map(item => item.naturalQuestionAt !== undefined && !item.topicEndedAt && item.status === 'pending_confirmation' ? { ...item, topicEndedAt: now } : item);
}
export function getUnderstandingCards(items: UserUnderstanding[]): UserUnderstanding[] {
  return items.filter(item => item.status === 'pending_confirmation' && item.naturalQuestionAt !== undefined && item.topicEndedAt !== undefined && !item.cardDismissedAt && !item.deletedAt && !item.cardPresentedAt);
}
export function markUnderstandingCardPresented(items: UserUnderstanding[], id: string, now: number): UserUnderstanding[] {
  return items.map(item => item.id === id ? { ...item, cardPresentedAt: now } : item);
}

export type UnderstandingDecision = 'confirm' | 'edit' | 'reject' | 'revoke' | 'delete';
export function decideUnderstanding(items: UserUnderstanding[], id: string, decision: UnderstandingDecision, now: number, editedText?: string): UserUnderstanding[] {
  return items.map(item => {
    if (item.id !== id) return item;
    if (decision === 'confirm') {
      if (item.deletedAt || item.naturalQuestionAt === undefined || item.topicEndedAt === undefined || item.status !== 'pending_confirmation') return item;
      return revise(item, { status: 'confirmed', confirmedAt: now, cardPresentedAt: now }, now, '用户在可见卡片中确认准确');
    }
    if (decision === 'edit') {
      const statement = editedText?.trim();
      if (!statement || SENSITIVE.test(statement) || THIRD_PARTY.test(statement)) throw new Error('请只填写你本人的沟通与相处需要。');
      const replacement = extractUnderstandingClues({ id: 'user_edit', role: 'user', content: statement, timestamp: now }).find(clue => clue.topic === item.topic);
      // A user-written replacement is explicit consent; only its exact text is recalled.
      return revise(item, { statement, preference: replacement?.preference ?? item.preference, status: 'confirmed', confirmedAt: now, revokedAt: undefined, archivedAt: undefined, cardDismissedAt: undefined, cardPresentedAt: now, deletedAt: undefined }, now, '用户亲自修改并保存，旧表述停止生效');
    }
    return revise(item, { status: 'revoked', revokedAt: now, cardDismissedAt: now, ...(decision === 'delete' ? { deletedAt: now } : {}) }, now, decision === 'reject' ? '用户选择这次不要记，同一候选不再弹卡' : decision === 'delete' ? '用户删除理解，保留抑制标记；原聊天不变' : '用户撤销，立即停止影响互动');
  });
}

export function recallLuyaUnderstandings(items: UserUnderstanding[], currentText: string, now: number): string[] {
  if (CORRECTION.test(currentText)) return [];
  const overrides = new Set(extractUnderstandingClues({ id: 'current', role: 'user', content: currentText, timestamp: now }).map(clue => clue.topic));
  return decayLuyaUnderstandings(items, now).filter(item => item.status === 'confirmed' && !item.deletedAt && !overrides.has(item.topic) && TOPIC_RELEVANCE[item.topic].test(currentText)).slice(0, 4).map(item => item.statement);
}

export function getLuyaUnderstandingPrompt(items: UserUnderstanding[], currentText: string, now: number): string {
  const confirmed = recallLuyaUnderstandings(items, currentText, now);
  const candidate = decayLuyaUnderstandings(items, now).find(item => item.status === 'pending_confirmation' && !item.naturalQuestionAt && !item.cardDismissedAt && TOPIC_RELEVANCE[item.topic].test(currentText));
  return [
    '理解边界：本轮明确要求优先；未确认候选不改变默认相处方式。只用用户本人表达作证据。转发、第三人故事、敏感内容不得变成用户画像。',
    ...(CORRECTION.test(currentText) ? ['用户正在纠正理解：立即停止引用被质疑的理解；指向不明确时先用自然语言确认具体哪一条，不维护旧结论。'] : []),
    ...confirmed.map(text => `本情境相关且由用户确认的相处习惯：${text}`),
    ...(candidate ? [`可在本话题自然询问一次（尚未确认，不能断言）：可能「${candidate.statement}」；也可能「${candidate.alternatives[0]}」。用口语问「我这样理解对吗」，不提画像、置信度或数据库。不要代替用户确认或声称已保存。`] : []),
  ].join('\n');
}

/** Call on the saved user turn and again after the real assistant message is saved. Idempotent on message IDs. */
export function processLuyaUnderstandingTurn(items: UserUnderstanding[], userMessage: UnderstandingMessage, assistantMessage?: UnderstandingMessage, now = userMessage.timestamp): UserUnderstanding[] {
  let next = decayLuyaUnderstandings(observeLuyaUnderstanding(items, userMessage, now), now);
  if (TOPIC_END.test(userMessage.content)) next = finishUnderstandingTopic(next, now);
  if (assistantMessage?.role === 'assistant' && /(?:对吗|是吗|是不是|你觉得呢|这样理解[^。！]*[?？]|我理解得[^。！]*[?？])/.test(assistantMessage.content)) {
    const candidate = next.find(item => item.status === 'pending_confirmation' && !item.naturalQuestionAt && TOPIC_RELEVANCE[item.topic].test(assistantMessage.content));
    if (candidate) next = markNaturalUnderstandingQuestion(next, candidate.id, assistantMessage.id, assistantMessage.timestamp);
  }
  return next;
}
