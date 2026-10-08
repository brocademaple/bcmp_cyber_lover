import type { LuyaDailyPlan, LuyaInternshipStage, LuyaLifeEvent, LuyaLifeSlot, LuyaLifeState, LuyaRuntime } from '../types/luya';
import { createLuyaRelationship, LUYA_RELATIONSHIP_LABELS } from './luyaRelationshipService';
import { createLuyaRoom, ROOM_SOURCE_LABELS } from './luyaRoomService';

const DAY = 86400000;
export const LUYA_INTERNSHIP_LABELS: Record<LuyaInternshipStage, string> = { preparing: '准备第一次暑期实习', exploring_roles: '了解岗位并整理方向', applying: '已开始投递', interviewing: '正在面试', offer_decision: '比较录用选择', pre_onboarding: '入职前准备', onboarded: '已开始实习' };
const INTERNSHIP_STAGES: LuyaInternshipStage[] = ['preparing', 'exploring_roles', 'applying', 'interviewing', 'offer_decision', 'pre_onboarding', 'onboarded'];
export function luyaDateKey(now: number): string { return new Date(now + 8 * 3600000).toISOString().slice(0, 10); }
export function luyaSlotTime(dateKey: string, time: string): number { return Date.parse(`${dateKey}T${time}:00+08:00`); }
export function createLuyaDailyPlan(dateKey: string): LuyaDailyPlan {
  const date = new Date(`${dateKey}T12:00:00+08:00`);
  const weekDay = new Date(date.getTime() + 8 * 3600000).getUTCDay();
  const day = Math.floor(date.getTime() / DAY);
  const weekend = weekDay === 0 || weekDay === 6;
  const sprint = !weekend && day % 5 === 0;
  const slot = (start: string, end: string, activityType: LuyaLifeSlot['activityType'], locationType: LuyaLifeSlot['locationType'], description: string): LuyaLifeSlot => ({ id: `life_${dateKey}_${start.replace(':', '')}`, start, end, activityType, locationType, description, status: 'planned', source: 'generated_character_life' });
  return { characterId: 'qingning', dateKey, timezone: 'Asia/Shanghai', version: 1, slots: [
    slot('00:00', '08:00', 'rest', 'home', '在住处休息，留出独处时间'),
    slot('08:00', '09:00', 'rest', 'home', weekend ? '慢慢开始今天，暂时不赶日程' : '整理今天要带的东西和待办'),
    slot('09:00', '12:00', weekend ? 'study' : 'class', weekend ? 'home' : 'campus', weekend ? '读一点文学和历史，记下没想明白的问题' : '在校园上课，整理计算机相关课程笔记'),
    slot('12:00', '14:00', 'rest', 'home', '午间吃饭和休息，暂时不安排新任务'),
    slot('14:00', '17:00', weekend ? 'city_walk' : 'project', weekend ? 'city' : 'home', weekend ? '在熟悉的街区走走，留意旧招牌和普通人的生活' : sprint ? '给原型收尾，发现自己同时开了太多任务，先把支线放下' : '把一个小原型拆成能完成的步骤，边做边测试'),
    slot('17:00', '19:00', weekend ? 'social' : 'internship_prep', weekend ? 'campus' : 'home', weekend ? '和朋友聊最近看到的故事，保留不同看法' : '回看实习相关材料，整理技术实现与用户体验的问题'),
    slot('19:00', '22:00', sprint ? 'project' : 'study', 'home', sprint ? '收窄手上的任务，注意力有些切碎，今晚少聊一点' : '翻看阅读笔记，把一个问题留在备忘录里'),
    slot('22:00', '23:59', 'rest', 'home', '慢慢收尾，给自己留一段不社交的时间'),
  ] };
}
export function projectLuyaPlan(plan: LuyaDailyPlan, now: number): LuyaDailyPlan {
  return { ...plan, slots: plan.slots.map(s => s.status === 'cancelled' ? s : { ...s, status: now >= luyaSlotTime(plan.dateKey, s.end) ? 'completed' : now >= luyaSlotTime(plan.dateKey, s.start) ? 'ongoing' : 'planned' }) };
}
export function advanceLuyaLife(state: LuyaLifeState, now: number): LuyaLifeState {
  const plans = { ...state.plans }; const events = [...state.events]; const ids = new Set(events.map(e => e.id));
  const currentKey = luyaDateKey(now);
  // Lazy catch-up is bounded to three days. No timers, network calls, or fictitious shared history.
  const elapsed = Math.max(0, Math.floor((now - state.lastAdvancedAt) / DAY));
  for (let delta = Math.min(2, elapsed); delta >= 0; delta--) {
    const key = luyaDateKey(now - delta * DAY);
    const plan = projectLuyaPlan(plans[key] ?? createLuyaDailyPlan(key), now);
    plans[key] = plan;
    for (const slot of plan.slots) {
      if (slot.status !== 'completed' || ['rest', 'class'].includes(slot.activityType) || ids.has(slot.id)) continue;
      events.push({ id: slot.id, kind: 'activity', occurredAt: luyaSlotTime(key, slot.end), summary: slot.description, source: slot.source, sourceIds: [slot.id] }); ids.add(slot.id);
    }
  }
  plans[currentKey] = projectLuyaPlan(plans[currentKey], now);
  return { ...state, plans, events, lastAdvancedAt: Math.max(now, state.lastAdvancedAt) };
}
export function advanceLuyaInternship(state: LuyaLifeState, stage: LuyaInternshipStage, event: Omit<LuyaLifeEvent, 'kind' | 'internshipStage'>, now: number): LuyaLifeState {
  const before = INTERNSHIP_STAGES.indexOf(state.internshipStage), after = INTERNSHIP_STAGES.indexOf(stage);
  if (after !== before + 1 || event.source !== 'confirmed_story_event' || !event.sourceIds.length || !event.summary.trim() || event.occurredAt > now || state.events.some(e => e.id === event.id)) return state;
  return { ...state, internshipStage: stage, events: [...state.events, { ...event, kind: 'internship', internshipStage: stage }] };
}
export function changeLuyaPlan(state: LuyaLifeState, dateKey: string, slotId: string, description: string, event: LuyaLifeEvent, now: number): LuyaLifeState {
  const plan = state.plans[dateKey];
  if (!plan || !description.trim() || event.kind !== 'plan_change' || !event.sourceIds.length || event.occurredAt > now || state.events.some(e => e.id === event.id)) return state;
  const slot = plan.slots.find(s => s.id === slotId);
  if (!slot || luyaSlotTime(dateKey, slot.end) <= now) return state;
  // Retain the cancelled original so a change cannot silently rewrite earlier facts.
  return { ...state, plans: { ...state.plans, [dateKey]: { ...plan, version: plan.version + 1, slots: [...plan.slots.map(s => s.id === slotId ? { ...s, status: 'cancelled' as const } : s), { ...slot, id: `${slotId}_${event.id}`, description, source: 'confirmed_story_event', status: 'planned' }] } }, events: [...state.events, event] };
}
export function getLuyaLifeProjection(state: LuyaLifeState, now: number) {
  const key = luyaDateKey(now);
  const plan = projectLuyaPlan(state.plans[key] ?? createLuyaDailyPlan(key), now);
  const rewound = now < state.lastAdvancedAt;
  const current = rewound ? undefined : plan.slots.find(s => s.status === 'ongoing');
  const tired = current?.activityType === 'rest' || Boolean(current?.description.includes('注意力'));
  const facts = (rewound ? [] : plan.slots).filter(s => s.status === 'completed' || s.status === 'ongoing').map(s => `${s.status === 'ongoing' ? '正在' : '已结束'}（${s.start}–${s.end}，角色生活日程）：${s.description}`);
  const relevantEvents = (rewound ? [] : state.events).filter(e => e.occurredAt <= now && luyaDateKey(e.occurredAt) === key && e.kind !== 'activity');
  facts.push(...relevantEvents.map(e => `已记录事件：${e.summary}`));
  return { dateKey: key, plan, currentActivity: rewound ? '调试时间早于已保存的生活记录，请恢复到最近记录之后' : current?.description ?? '今天的日程正在收尾', status: tired ? 'tired' as const : current?.activityType === 'city_walk' || current?.activityType === 'social' ? 'happy' as const : 'neutral' as const, energy: tired ? 35 : current?.activityType === 'project' ? 56 : 72, facts };
}
export function createLuyaRuntime(now: number): LuyaRuntime {
  const life = advanceLuyaLife({ plans: {}, events: [], internshipStage: 'preparing', lastAdvancedAt: now }, now);
  return { schemaVersion: 1, life, relationship: createLuyaRelationship(), room: createLuyaRoom(now), boundaries: { nicknames: 'ask_first', imaginedTouch: 'ask_first', careActions: 'ask_first', advice: 'ask_first', quietUntilNextUserTurn: false, sources: [] }, understandings: [], understandingObservations: [], createdAt: now, updatedAt: now };
}
export function advanceLuyaRuntime(runtime: LuyaRuntime, now: number): LuyaRuntime {
  if (now < runtime.updatedAt) return runtime;
  const life = advanceLuyaLife(runtime.life, now);
  let room = runtime.room;
  const sourceEvent = [...life.events].reverse().find(e => e.occurredAt <= now && e.kind === 'activity' && e.summary.includes('旧招牌'));
  // One small object per actual completed city observation; it belongs to her, never to a fictitious shared outing.
  if (sourceEvent && !room.items.some(i => i.sourceEventIds.includes(sourceEvent.id))) {
    const id = `luya_note_${sourceEvent.id}`;
    room = { ...room, items: [...room.items, { id, name: '一页街区观察笔记', owner: 'luya', zone: 'luya_private', sourceType: 'luya_life_event', sourceEventIds: [sourceEvent.id], editableBy: 'luya', requiresConsultation: true, important: false, createdAt: sourceEvent.occurredAt, updatedAt: sourceEvent.occurredAt }], changes: [...room.changes, { id, timestamp: sourceEvent.occurredAt, actor: 'luya', description: '鹿芽把街区观察笔记放进自己的角落', sourceIds: [sourceEvent.id] }] };
  }
  return { ...runtime, life, room, updatedAt: Math.max(runtime.updatedAt, now) };
}
export function buildLuyaRuntimePrompt(runtime: LuyaRuntime, now: number): string {
  if (now < runtime.updatedAt) return '【时间校验】调试时间早于最近保存的运行记录。没有该历史时刻的完整快照，禁止引用当前日程、实习阶段、关系身份、房间变化或权限作为当时事实。请恢复到最近记录之后再验收。昵称、肢体动作、现实操作一律不推定许可。';
  const p = getLuyaLifeProjection(runtime.life, now);
  const boundaries = runtime.boundaries;
  const evidence = runtime.relationship.evidence.filter(e => e.timestamp <= now);
  return [
    `【鹿芽统一生活事实｜${p.dateKey} Asia/Shanghai】`,
    '以下是持久化的角色生活日程，不是真实世界传感数据，也不是用户共同经历。只能引用已结束/正在进行的活动；未来计划不可讲成发生过。没有实时天气来源。',
    ...p.facts,
    `实习阶段：${LUYA_INTERNSHIP_LABELS[runtime.life.internshipStage]}。不得编造公司、Offer或未经记录的阶段推进。`,
    `鹿芽自己的状态：${p.status}；${p.currentActivity}。用户的情绪不会自动改写鹿芽的生活能量。`,
    `【关系】${LUYA_RELATIONSHIP_LABELS[runtime.relationship.stage]}；路线：${runtime.relationship.route === 'friends' ? '用户明确只做朋友，不推恋爱或暧昧' : '亲密朋友为底色，不预设恋爱'}；信任边界：${runtime.relationship.trustAdjustment}。`,
    `关系证据：${evidence.slice(-8).map(e => `${e.summary} [${e.id}]`).join('；') || '尚无共同经历，不预设熟悉'}`,
    '【共同房间】鹿芽原有的线上空间，现实中双方未合租。墙面和装饰变化只在应用内生效。想象动作不等于现实送达或执行。',
    `线上墙面=${runtime.room.wallColor}；主灯=${runtime.room.light}。${runtime.room.light === 'bright' ? '鹿芽觉得主灯刺眼，提出暖光与局部阅读灯的替代方案，不惩罚用户。' : ''}`,
    ...runtime.room.items.filter(i => i.createdAt <= now).map(i => `${i.name}｜归属=${i.owner}｜区域=${i.zone}｜来源=${ROOM_SOURCE_LABELS[i.sourceType]} ${i.sourceEventIds.join(',')}｜${i.requiresConsultation ? '调整前要商量' : '可基础调整'}`),
    ...runtime.room.consultations.filter(c => c.status === 'pending').map(c => `待商量：${c.action} ${runtime.room.items.find(i => i.id === c.itemId)?.name ?? c.itemId} [${c.id}]。请给出理由和真实意见；未经双方确认不要声称已改。`),
    `【持续边界】昵称=${boundaries.nicknames}；想象肢体接触=${boundaries.imaginedTouch}；照顾动作=${boundaries.careActions}；建议=${boundaries.advice}。ask_first 表示未取得持续许可，declined 必须停止；本轮明确需要可覆盖建议偏好但不会自动授权未来。`,
    boundaries.quietUntilNextUserTurn ? '本轮用户要求安静：简短回应后停下，不追问、不发催促消息。' : '',
  ].filter(Boolean).join('\n');
}

/** Developer confirmation uses actual conversation records, not arbitrary typed source IDs or a future plan. */
export function confirmLuyaInternshipFromDialogue(
  runtime: LuyaRuntime,
  messages: { id: string; role: string; content: string; timestamp: number; status?: string }[],
  sourceIds: string[],
  summary: string,
  now: number
): { runtime: LuyaRuntime; ok: boolean; message: string } {
  if (now < runtime.updatedAt) return { runtime, ok: false, message: '调试时间早于最近记录，请恢复时间后再确认。' };
  const stage = INTERNSHIP_STAGES[INTERNSHIP_STAGES.indexOf(runtime.life.internshipStage) + 1];
  if (!stage) return { runtime, ok: false, message: '已到当前最后阶段。' };
  const ids = [...new Set(sourceIds)];
  const selected = messages.filter(m => ids.includes(m.id) && m.timestamp <= now && m.content.trim() && !['failed', 'queued', 'sending'].includes(m.status ?? ''));
  const user = selected.find(m => m.role === 'user');
  const assistant = selected.find(m => m.role === 'assistant' && m.timestamp >= (user?.timestamp ?? Infinity));
  if (!summary.trim() || selected.length !== ids.length || !user || !assistant) return { runtime, ok: false, message: '请选择真实已发送的双方对话，并填写已发生的剧情摘要。' };
  const latestStory = runtime.life.events.filter(e => e.kind === 'internship').at(-1);
  if (latestStory && (selected.some(m => m.timestamp < latestStory.occurredAt) || selected.some(m => latestStory.sourceIds.includes(m.id)))) return { runtime, ok: false, message: '下一阶段需要新的剧情依据，不能重复使用上一阶段的对话。' };
  const descriptions: Record<LuyaInternshipStage, RegExp> = {
    preparing: /准备/, exploring_roles: /(了解|比较|整理|筛选|研究|看).{0,16}(岗位|招聘|方向)|(岗位|招聘|方向).{0,16}(了解|比较|整理|筛选|研究)/,
    applying: /(已|刚|今天).{0,12}(投递|投了|发了简历)|投递了|投了.{0,12}(简历|岗位|公司)/,
    interviewing: /(收到|约好|参加|开始|正在).{0,12}面试|面试.{0,12}(通知|邀约)/,
    offer_decision: /(收到|拿到|拿到了).{0,12}(offer|Offer|录用)/,
    pre_onboarding: /(接受|决定接受|确认).{0,12}(offer|Offer|录用)|入职.{0,12}(日期.*确定|安排.*确认)/,
    onboarded: /(已经|今天|正式).{0,10}(入职|开始实习)|入职第一天/,
  };
  const negatedOrHypothetical = /如果|假如|假设|举个例子|演示|还没|尚未|没有|没投|准备投|打算|计划|以后|到时候|可能会|将会/;
  const assertiveSentences = assistant.content.split(/[。！？!?\n]/).filter(sentence => !negatedOrHypothetical.test(sentence));
  if (!assertiveSentences.some(sentence => descriptions[stage].test(sentence))) return { runtime, ok: false, message: `所选鹿芽回复还没有明确记录「${LUYA_INTERNSHIP_LABELS[stage]}」已经发生，不能把计划或假设当作推进依据。` };
  const life = advanceLuyaInternship(runtime.life, stage, { id: `internship_${stage}_${assistant.id}`, occurredAt: now, summary: summary.trim().slice(0, 200), source: 'confirmed_story_event', sourceIds: ids }, now);
  if (life === runtime.life) return { runtime, ok: false, message: '剧情记录未发生变化，请核对阶段与来源。' };
  return { runtime: { ...runtime, life, updatedAt: Math.max(runtime.updatedAt, now) }, ok: true, message: `已保存剧情依据，进入「${LUYA_INTERNSHIP_LABELS[stage]}」。没有执行任何外部投递或入职操作。` };
}
