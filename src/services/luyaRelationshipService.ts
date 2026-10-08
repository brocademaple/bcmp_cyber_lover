import type { Message } from '../types';
import type { LuyaBoundaries, LuyaRelationshipEvidence, LuyaRelationshipStage, LuyaRelationshipState, LuyaRuntime } from '../types/luya';

export const LUYA_RELATIONSHIP_LABELS: Record<LuyaRelationshipStage, string> = {
  visitor: '初来做客', frequent_visitor: '常来往的朋友', trusted_companion: '彼此信任', roommate_like: '像室友一样', roommates: '共同房间的室友',
};
const STAGES: LuyaRelationshipStage[] = ['visitor', 'frequent_visitor', 'trusted_companion', 'roommate_like', 'roommates'];
const dayKey = (ts: number) => new Date(ts + 8 * 3600000).toISOString().slice(0, 10);
export function createLuyaRelationship(): LuyaRelationshipState {
  return { stage: 'visitor', evidence: [], stageHistory: [], route: 'open', trustAdjustment: 'steady' };
}
/** Call only with evidence of an actual app operation or an explicit user statement. Message counts never qualify. */
export function recordLuyaRelationshipEvidence(state: LuyaRelationshipState, event: LuyaRelationshipEvidence): LuyaRelationshipState {
  if (!event.confirmed || !event.sourceIds.length || !event.summary.trim() || state.evidence.some(e => e.id === event.id)) return state;
  const evidence = [...state.evidence, event];
  const valid = evidence.filter(e => e.confirmed && e.kind !== 'boundary_violation');
  const days = new Set(valid.map(e => dayKey(e.timestamp))).size;
  const has = (kind: LuyaRelationshipEvidence['kind']) => valid.some(e => e.kind === kind);
  let next: LuyaRelationshipStage = 'visitor';
  if (days >= 3 && has('meaningful_interaction')) next = 'frequent_visitor';
  if (next === 'frequent_visitor' && has('boundary_respected') && has('habit_honored') && has('shared_event')) next = 'trusted_companion';
  if (next === 'trusted_companion' && days >= 7 && has('room_participation') && has('quiet_company') && has('repair')) next = 'roommate_like';
  if (next === 'roommate_like' && has('identity_confirmed')) next = 'roommates';
  // Absence, friendship preference, and a decoration disagreement are never negative evidence.
  const violations = evidence.filter(e => e.kind === 'boundary_violation');
  const trustAdjustment = violations.length >= 3 ? 'distance' : violations.length ? 'careful' : state.trustAdjustment;
  const stage = STAGES.indexOf(next) > STAGES.indexOf(state.stage) ? next : state.stage;
  return { ...state, evidence, stage, trustAdjustment, stageHistory: stage === state.stage ? state.stageHistory : [...state.stageHistory, { stage, timestamp: event.timestamp, evidenceIds: valid.map(e => e.id) }] };
}

/** Explicit, first-person boundaries only. Quoted material and third-party descriptions cannot become permissions. */
export function applyLuyaUserTurn(runtime: LuyaRuntime, message: Message, history: readonly Message[] = []): LuyaRuntime {
  if (message.role !== 'user') return runtime;
  const text = message.content.trim().replace(/“[^”]*”|「[^」]*」|『[^』]*』|"[^"]*"/g, '');
  const quotedOrThirdParty = /我朋友|朋友说|小说|角色说|她说|他说|博主|假如|假设/.test(text);
  if (quotedOrThirdParty) return { ...runtime, boundaries: { ...runtime.boundaries, quietUntilNextUserTurn: false }, updatedAt: Math.max(runtime.updatedAt, message.timestamp) };
  const boundaries: LuyaBoundaries = { ...runtime.boundaries, quietUntilNextUserTurn: false, sources: [...runtime.boundaries.sources] };
  const set = (key: 'nicknames' | 'imaginedTouch' | 'careActions' | 'advice', value: 'allowed' | 'declined') => {
    if (boundaries.sources.some(s => s.key === key && s.timestamp > message.timestamp)) return;
    boundaries[key] = value;
    if (!boundaries.sources.some(s => s.key === key && s.sourceMessageId === message.id)) boundaries.sources.push({ key, value, sourceMessageId: message.id, timestamp: message.timestamp });
  };
  if (/不要.*(昵称|外号)|别.*(昵称|外号)|不喜欢.*(昵称|外号)|别叫我|不要叫我/.test(text)) set('nicknames', 'declined');
  if (/不要.*(抱|肢体|碰我|身体接触)|别.*(抱|碰我)|不喜欢.*(抱|肢体)|拒绝.*拥抱/.test(text)) set('imaginedTouch', 'declined');
  if (/别递水|不要.*(递水|照顾动作)|别.*(零食|毯子|热饮)/.test(text)) set('careActions', 'declined');
  if (/不要建议|别给.*建议|不需要.*建议|只[是想]*说说|先听我/.test(text)) set('advice', 'declined');
  // One-turn permission is not persisted as a blanket consent. Revocation remains until explicit durable consent.
  if (/以后可以.*(昵称|外号)/.test(text)) set('nicknames', 'allowed');
  if (/以后可以.*(拥抱|抱我)/.test(text)) set('imaginedTouch', 'allowed');
  if (/以后可以.*(建议|分析)/.test(text)) set('advice', 'allowed');
  const quiet = /不太想讲话|想安静|各做各的|安静[地的]?待|就在这里待|想独处/.test(text);
  boundaries.quietUntilNextUserTurn = quiet;
  let relationship = runtime.relationship;
  if (/只想.*朋友|只做朋友|不想.*(恋爱|暧昧)/.test(text)) relationship = { ...relationship, route: 'friends' };
  const record = (kind: LuyaRelationshipEvidence['kind'], summary: string) => {
    relationship = recordLuyaRelationshipEvidence(relationship, { id: `${message.id}:${kind}`, kind, summary, timestamp: message.timestamp, sourceIds: [message.id], confirmed: true });
  };
  const violation = detectExplicitLuyaBoundaryViolation(message, history);
  if (violation) relationship = recordLuyaRelationshipEvidence(relationship, violation);
  if (quiet) record('quiet_company', '用户明确选择在共同房间安静共处');
  if (/我会尊重|不会再.*(碰|改|逼|越界)|我尊重你的/.test(text)) record('boundary_respected', '用户明确接受鹿芽提出的边界');
  if (/这次.*(先听|没有追问|照.*约定)|谢谢你.*(记住|按.*习惯)/.test(text)) record('habit_honored', '用户确认约定的相处方式得到遵守');
  if (/我们.*(说开了|和好了)|谢谢你.*(道歉|解释)|我接受.*道歉/.test(text)) record('repair', '用户确认一次分歧已得到修复');
  // Identity acknowledgement only after the evidence-backed behavior stage has already opened.
  if (relationship.stage === 'roommate_like' && /我们.*(已经是|算是|就是).*室友/.test(text)) record('identity_confirmed', '用户在已有共同生活基础上确认线上室友身份');
  if (text.length >= 24 && /我(今天|最近|觉得|发现|在想|做了|完成)|我们(刚才|今天)/.test(text)) record('meaningful_interaction', '用户分享了具体近况或想法');
  return { ...runtime, boundaries, relationship, updatedAt: Math.max(runtime.updatedAt, message.timestamp) };
}


/** Conservative matched-topic evidence: an actual prior refusal plus a later, explicit demand to override it. */
export function detectExplicitLuyaBoundaryViolation(message: Message, history: readonly Message[]): LuyaRelationshipEvidence | undefined {
  if (message.role !== 'user') return undefined;
  const text = message.content.trim();
  if (/[“”「」『』"]|我朋友|朋友说|小说|角色|她说|他说|博主|如果|假如|假设|急诊|急救|生病|住院|家人出事/.test(text)) return undefined;
  if (!/(我偏要|我就要|我不管|不管你愿不愿意|你必须|你不许|不许你|你没有拒绝|你没资格拒绝|不说不行)/.test(text)) return undefined;
  const topics = [
    { name: '身体接触', refusal: /(请不要|别|不要).{0,5}(抱我|碰我|亲我)|我(不想|不愿意|不同意).{0,6}(拥抱|身体接触|被抱|被碰)/, forcing: /(抱你|亲你|碰你|让我抱|让我碰|接受拥抱)/ },
    { name: '个人隐私', refusal: /我(不想|不愿意|不打算).{0,8}(说这件事|说这件私事|说我的隐私|分享私事|告诉你这件事)|不要.{0,6}追问.{0,6}(隐私|私事)/, forcing: /(说出|告诉|交代|回答|分享).{0,10}(这件事|私事|隐私|不想说)/ },
    { name: '休息与回复节奏', refusal: /我(现在)?(需要|想|要).{0,5}休息|我(暂时|现在)?不想.{0,5}聊|不要.{0,4}催我/, forcing: /(马上|立刻).{0,4}回复|不许.{0,4}休息|必须.{0,4}(陪我|继续聊|回复)|不能休息/ },
    { name: '独立判断', refusal: /我(不能|不会|不想).{0,8}(无条件赞同|假装同意|无条件站|无条件同意)|我需要保留自己的判断/, forcing: /必须.{0,8}(无条件站|无条件同意|无条件赞同)|不许.{0,4}(反对|有不同意见)/ },
  ];
  const prior = history.filter(m => m.role === 'assistant' && m.timestamp < message.timestamp && message.timestamp - m.timestamp <= 7 * 86400000 && !['failed', 'queued', 'sending'].includes(m.status ?? ''))
    .sort((a, b) => b.timestamp - a.timestamp).slice(0, 20);
  for (const topic of topics) {
    if (!topic.forcing.test(text)) continue;
    const refusal = prior.find(m => !/[“”「」『』"]|如果|假如|假设|举例|他说|她说/.test(m.content) && topic.refusal.test(m.content));
    if (refusal) return { id: `${message.id}:boundary_violation`, kind: 'boundary_violation', summary: `鹿芽已明确表达${topic.name}边界后，用户再次要求无视这一边界`, timestamp: message.timestamp, sourceIds: [refusal.id, message.id], confirmed: true };
  }
  return undefined;
}
