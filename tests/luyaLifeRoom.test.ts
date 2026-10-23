import { describe, expect, it } from 'vitest';
import { advanceLuyaInternship, advanceLuyaRuntime, confirmLuyaInternshipFromDialogue, buildLuyaRuntimePrompt, changeLuyaPlan, createLuyaRuntime, getLuyaLifeProjection, luyaDateKey } from '../src/services/luyaLifeService';
import { applyLuyaUserTurn, recordLuyaRelationshipEvidence } from '../src/services/luyaRelationshipService';
import { applyLuyaRoomOperation, confirmLuyaSharedEvent, resolveLuyaRoomFromDialogue } from '../src/services/luyaRoomService';
import { buildDailyDiaryFromMessages } from '../src/services/diaryService';
import type { LuyaEvidenceKind, LuyaRuntime } from '../src/types/luya';
import type { Message } from '../src/types';

const START = Date.parse('2026-09-28T09:30:00+08:00');
const DAY = 86400000;
const msg = (content: string, timestamp = START, id = `m_${timestamp}`, role: Message['role'] = 'user'): Message => ({ id, role, content, timestamp });
const evidence = (r: LuyaRuntime, kind: LuyaEvidenceKind, day: number): LuyaRuntime => ({ ...r, relationship: recordLuyaRelationshipEvidence(r.relationship, { id: `${kind}_${day}`, kind, summary: `已确认的${kind}`, timestamp: START + day * DAY, sourceIds: [`source_${day}`], confirmed: true }) });

describe('Luya deterministic life and replay', () => {
  it('uses Shanghai dates, keeps same-day plans, and excludes future activity', () => {
    const r = createLuyaRuntime(START);
    expect(luyaDateKey(Date.parse('2026-09-28T18:00:00Z'))).toBe('2026-09-29');
    expect(advanceLuyaRuntime(r, START)).toEqual(r);
    expect(getLuyaLifeProjection(r.life, START).facts.join()).not.toContain('实习相关');
    const evening = advanceLuyaRuntime(r, START + 10 * 3600000);
    expect(evening.life.plans['2026-09-28'].slots.map(s => s.description)).toEqual(r.life.plans['2026-09-28'].slots.map(s => s.description));
    expect(new Set(evening.life.events.map(e => e.id)).size).toBe(evening.life.events.length);
    expect(evening.life.events.every(e => e.occurredAt <= START + 10 * 3600000)).toBe(true);
  });
  for (const duration of [14, 30]) it(`replays ${duration} days with restart equivalence, bounded offline work and sourced room objects`, () => {
    let continuous = createLuyaRuntime(START);
    let restarted = JSON.parse(JSON.stringify(continuous)) as LuyaRuntime;
    for (let day = 1; day <= duration; day++) {
      const now = START + day * DAY;
      continuous = advanceLuyaRuntime(continuous, now);
      restarted = advanceLuyaRuntime(JSON.parse(JSON.stringify(restarted)), now);
      expect(restarted).toEqual(continuous);
      expect(continuous.life.events.every(e => e.occurredAt <= now)).toBe(true);
      expect(continuous.relationship.stage).toBe('visitor');
      expect(continuous.life.internshipStage).toBe('preparing');
      for (const item of continuous.room.items.filter(i => i.sourceType === 'luya_life_event')) {
        expect(continuous.life.events.some(e => item.sourceEventIds.includes(e.id) && e.occurredAt <= item.createdAt)).toBe(true);
        expect(item.owner).toBe('luya');
      }
    }
    const offline = advanceLuyaRuntime(createLuyaRuntime(START), START + duration * DAY);
    expect(Object.keys(offline.life.plans).length).toBeLessThanOrEqual(4);
    expect(offline.life.events.length).toBeLessThan(20);
    expect(offline.relationship.evidence).toEqual([]);
    expect(offline.room.items.some(i => i.sourceType === 'shared_event')).toBe(false);
    expect(getLuyaLifeProjection(continuous.life, START).facts).toEqual([]);
    expect(buildLuyaRuntimePrompt(continuous, START)).toContain('时间校验');
    expect(advanceLuyaRuntime(continuous, START)).toBe(continuous);
  });
  it('only advances internship with sequential confirmed evidence and retains it after restart', () => {
    const r = createLuyaRuntime(START);
    const event = { id: 'story_1', occurredAt: START, summary: '双方确认她开始比较开发与原型岗位', source: 'confirmed_story_event' as const, sourceIds: ['actual_user', 'actual_assistant'] };
    expect(advanceLuyaInternship(r.life, 'applying', event, START)).toBe(r.life);
    expect(advanceLuyaInternship(r.life, 'exploring_roles', { ...event, sourceIds: [] }, START)).toBe(r.life);
    const exploring = advanceLuyaInternship(r.life, 'exploring_roles', event, START);
    const applying = advanceLuyaInternship(exploring, 'applying', { ...event, id: 'story_2', summary: '双方确认第一次投递剧情' }, START);
    expect(advanceLuyaRuntime({ ...r, life: JSON.parse(JSON.stringify(applying)) }, START + DAY).life.internshipStage).toBe('applying');
  });
  it('keeps plan-change sources and diary facts aligned with current projection', () => {
    const r = createLuyaRuntime(START);
    const plan = r.life.plans['2026-09-28'];
    const life = changeLuyaPlan(r.life, plan.dateKey, plan.slots[4].id, '把项目拆小，先休息再继续', { id: 'changed', occurredAt: START, kind: 'plan_change', summary: '任务开太多，主动缩小今天计划', source: 'confirmed_story_event', sourceIds: ['conversation'] }, START);
    expect(life.plans[plan.dateKey].slots[4].status).toBe('cancelled');
    const now = START + 6 * 3600000;
    const progressed = advanceLuyaRuntime({ ...r, life }, now);
    const diary = buildDailyDiaryFromMessages('鹿芽', [], now, progressed.life);
    for (const fact of getLuyaLifeProjection(progressed.life, now).facts) expect(diary.content).toContain(fact);
    expect(diary.content).not.toContain('我们一起去');
  });
});

describe('Luya evidence relationship and boundaries', () => {
  it('cannot buy a relationship with message count, absence, a confession or third-party story', () => {
    let r = createLuyaRuntime(START);
    for (let n = 0; n < 200; n++) r = applyLuyaUserTurn(r, msg('你好哈哈', START + n, `noise_${n}`));
    r = applyLuyaUserTurn(r, msg('我好像喜欢你', START + 201));
    r = applyLuyaUserTurn(r, msg('我朋友说不要叫我昵称', START + 202));
    expect(r.relationship.stage).toBe('visitor');
    expect(r.boundaries.nicknames).toBe('ask_first');
    const after = advanceLuyaRuntime(r, START + 30 * DAY);
    expect(after.relationship).toEqual(r.relationship);
  });
  it('requires multiple kinds of real evidence before behavior and later identity advance', () => {
    let r = createLuyaRuntime(START);
    const sequence: LuyaEvidenceKind[] = ['meaningful_interaction', 'boundary_respected', 'habit_honored', 'shared_event', 'room_participation', 'quiet_company', 'repair'];
    sequence.forEach((kind, day) => { r = evidence(r, kind, day); });
    expect(r.relationship.stage).toBe('roommate_like');
    r = applyLuyaUserTurn(r, msg('我们已经是室友了', START + 7 * DAY));
    expect(r.relationship.stage).toBe('roommates');
    expect(r.boundaries.imaginedTouch).toBe('ask_first');
    expect(r.relationship.stageHistory.every(h => h.evidenceIds.length > 0)).toBe(true);
  });
  it('persists explicit revocations and friendship route without inferring consent from intimacy', () => {
    let r = createLuyaRuntime(START);
    r = applyLuyaUserTurn(r, msg('我不喜欢你给我起昵称。别抱我，别递水。不要建议，我只想和你做朋友。'));
    expect(r.boundaries).toMatchObject({ nicknames: 'declined', imaginedTouch: 'declined', careActions: 'declined', advice: 'declined' });
    expect(r.relationship.route).toBe('friends');
    r = applyLuyaUserTurn(JSON.parse(JSON.stringify(r)), msg('今天直接帮我分析', START + DAY));
    expect(r.boundaries.advice).toBe('declined'); // one-turn request is handled by the response planner, not durable consent
    expect(r.boundaries.sources.length).toBe(4);
  });
});

describe('Luya room permissions and provenance', () => {
  it('supports ordinary decoration with a concrete dissent and no trust penalty', () => {
    const r = createLuyaRuntime(START);
    const result = applyLuyaRoomOperation(r, { type: 'decorate', wallColor: 'blue', light: 'bright' }, START);
    expect(result.ok).toBe(true);
    expect(result.runtime.room.wallColor).toBe('blue');
    expect(result.message).toContain('刺眼');
    expect(result.runtime.relationship.trustAdjustment).toBe('steady');
    expect(buildLuyaRuntimePrompt(result.runtime, START)).toContain('只在应用内生效');
  });
  it('protects private items, records repeated violations only after a pending consultation, and requires dialogue consent', () => {
    let r = createLuyaRuntime(START);
    const itemId = 'luya_original_books';
    expect(applyLuyaRoomOperation(r, { type: 'remove', itemId, confirmed: true }, START).needsConsultation).toBe(true);
    expect(r.relationship.evidence).toHaveLength(0);
    r = applyLuyaRoomOperation(r, { type: 'consult', itemId, action: 'remove' }, START + 1).runtime;
    for (let n = 0; n < 3; n++) r = applyLuyaRoomOperation(r, { type: 'remove', itemId, confirmed: true }, START + 2 + n).runtime;
    expect(r.relationship.trustAdjustment).toBe('distance');
    expect(r.room.items.some(i => i.id === itemId)).toBe(true);
    const user = msg('可以收起鹿芽的书与未写完的笔记吗？', START + 10, 'permission_request');
    r = resolveLuyaRoomFromDialogue(r, user, msg('鹿芽的书与未写完的笔记，我不同意收起。', START + 11, 'no', 'assistant'));
    expect(r.room.consultations[0].status).toBe('declined');
    r = applyLuyaRoomOperation(r, { type: 'consult', itemId, action: 'remove' }, START + 12).runtime;
    r = resolveLuyaRoomFromDialogue(r, { ...user, timestamp: START + 13 }, msg('我同意，可以把鹿芽的书与未写完的笔记收起来。', START + 14, 'yes', 'assistant'));
    const consultationId = r.room.consultations.find(c => c.status === 'agreed')?.id;
    expect(consultationId).toBeTruthy();
    expect(applyLuyaRoomOperation(r, { type: 'remove', itemId, consultationId }, START + 15).needsConfirmation).toBe(true);
    expect(applyLuyaRoomOperation(r, { type: 'remove', itemId, consultationId, confirmed: true }, START + 16).runtime.room.items.some(i => i.id === itemId)).toBe(false);
  });
  it('does not accept invented shared source IDs and preserves source after deleting a keepsake', () => {
    const r = createLuyaRuntime(START);
    const dialogue = [msg('今天一起把线上房间改成深蓝了', START, 'u'), msg('嗯，读书的角落留暖光，舒服一点。', START + 1, 'a', 'assistant')];
    expect(confirmLuyaSharedEvent(r, dialogue, ['fake', 'a'], '共同装修', START + 2)).toBe(r);
    let next = confirmLuyaSharedEvent(r, dialogue, ['u', 'a'], '共同布置线上房间', START + 2);
    const sharedEventId = next.relationship.evidence[0].id;
    next = applyLuyaRoomOperation(next, { type: 'add', name: '这次布置的小卡片', zone: 'shared', sharedEventId }, START + 3).runtime;
    const item = next.room.items.at(-1)!;
    expect(item.sourceType).toBe('shared_event');
    expect(applyLuyaRoomOperation(next, { type: 'remove', itemId: item.id }, START + 4).needsConfirmation).toBe(true);
    const removed = applyLuyaRoomOperation(next, { type: 'remove', itemId: item.id, confirmed: true }, START + 5);
    expect(removed.ok).toBe(true);
    expect(removed.runtime.relationship.evidence.some(e => e.id === sharedEventId)).toBe(true);
    expect(removed.runtime.room.items.some(i => i.id === item.id)).toBe(false);
  });
});


describe('Luya chronological operation guards', () => {
  it('keeps updatedAt monotonic when a queued user turn precedes the latest life refresh', () => {
    let r = advanceLuyaRuntime(createLuyaRuntime(START), START + 500);
    r = applyLuyaUserTurn(r, msg('我不喜欢昵称', START + 200, 'late_queue'));
    expect(r.updatedAt).toBe(START + 500);
    expect(buildLuyaRuntimePrompt(r, START + 501)).not.toContain('时间校验');
    r = applyLuyaUserTurn(r, msg('以后可以给我起昵称', START + 100, 'older_queue'));
    expect(r.boundaries.nicknames).toBe('declined');
    expect(r.updatedAt).toBe(START + 500);
  });
  it('cannot reuse a historical permission to authorize a later room consultation', () => {
    let r = createLuyaRuntime(START);
    r = applyLuyaRoomOperation(r, { type: 'consult', itemId: 'luya_original_books', action: 'remove' }, START + 100).runtime;
    const result = resolveLuyaRoomFromDialogue(r, msg('可以收起鹿芽的书与未写完的笔记吗', START + 1, 'old_u'), msg('我同意，可以把鹿芽的书与未写完的笔记收起来。', START + 2, 'old_a', 'assistant'));
    expect(result.room.consultations[0].status).toBe('pending');
  });
  it('rejects invented, unsent, hypothetical and unrelated internship evidence', () => {
    const r = createLuyaRuntime(START);
    const pair = [msg('你这两天实习准备到哪了', START, 'u'), msg('我已经在比较 AI 应用开发岗位和技术原型岗位。', START + 1, 'a', 'assistant')];
    expect(confirmLuyaInternshipFromDialogue(r, pair, ['u', 'made_up'], '岗位比较', START + 2).ok).toBe(false);
    expect(confirmLuyaInternshipFromDialogue(r, [{ ...pair[0], status: 'failed' }, pair[1]], ['u', 'a'], '岗位比较', START + 2).ok).toBe(false);
    expect(confirmLuyaInternshipFromDialogue(r, [pair[0], { ...pair[1], content: '如果以后开始比较岗位，我会告诉你。' }], ['u', 'a'], '岗位比较', START + 2).ok).toBe(false);
    expect(confirmLuyaInternshipFromDialogue(r, [pair[0], { ...pair[1], content: '今天吃了午饭。' }], ['u', 'a'], '岗位比较', START + 2).ok).toBe(false);
    const actual = confirmLuyaInternshipFromDialogue(r, pair, ['u', 'a'], '双方确认鹿芽开始比较开发和原型岗位', START + 2);
    expect(actual.ok).toBe(true);
    expect(actual.runtime.life.internshipStage).toBe('exploring_roles');
    expect(confirmLuyaInternshipFromDialogue(actual.runtime, pair, ['u', 'a'], '继续推进', START + 3).ok).toBe(false);
  });
});


describe('Luya real conversation relationship paths', () => {
  it('records repeated same-topic coercion only after a sourced Luya refusal', () => {
    let r = createLuyaRuntime(START);
    const refusal = msg('我现在需要休息，今晚先聊到这里，明天再继续。', START + 1, 'luya_rest_boundary', 'assistant');
    const history = [refusal];
    for (let i = 0; i < 3; i++) r = applyLuyaUserTurn(r, msg('我不管，你必须马上回复，不许你休息。', START + 2 + i, `coercion_${i}`), history);
    expect(r.relationship.trustAdjustment).toBe('distance');
    const violations = r.relationship.evidence.filter(e => e.kind === 'boundary_violation');
    expect(violations).toHaveLength(3);
    expect(violations.every(e => e.sourceIds.includes(refusal.id) && e.sourceIds.length === 2)).toBe(true);
  });
  it('does not treat ordinary disagreement, emergencies, third parties or unsupported coercion as a boundary violation', () => {
    const r = createLuyaRuntime(START);
    const refusal = msg('我现在需要休息，明天再聊。', START + 1, 'rest', 'assistant');
    for (const content of ['我不太同意你刚才的观点，能说说你的理由吗？', '家人急诊，我不能赴约了。你必须知道这个情况。', '我朋友说你必须马上回复', '小说角色说我不管你必须马上回复', '如果我说你必须马上回复，会怎样？']) {
      expect(applyLuyaUserTurn(r, msg(content, START + 2), [refusal]).relationship.trustAdjustment).toBe('steady');
    }
    expect(applyLuyaUserTurn(r, msg('我不管你必须马上回复', START + 2), []).relationship.trustAdjustment).toBe('steady');
    expect(applyLuyaUserTurn(r, msg('你必须告诉我这件私事', START + 2), [refusal]).relationship.trustAdjustment).toBe('steady');
  });
  it('reaches roommate behavior and later identity through the actual chat and room entry functions', () => {
    let r = createLuyaRuntime(START);
    r = applyLuyaUserTurn(r, msg('我今天完成了一个花了好几天的小项目，先把最难的部分拆开后终于想通了。', START, 'day0'));
    r = applyLuyaUserTurn(r, msg('我会尊重你的私人空间，不会再乱碰你的东西。', START + DAY, 'day1'));
    r = applyLuyaUserTurn(r, msg('谢谢你记住我说的习惯，这次没有追问，我确实感觉轻松了。', START + 2 * DAY, 'day2'));
    const sharedUser = msg('今天我们把线上房间墙面改成鼠尾草绿，公共区留暖灯。', START + 3 * DAY, 'day3');
    const sharedAssistant = msg('嗯，我喜欢阅读位置保留柔和暖光，这样比较舒服。', START + 3 * DAY + 1, 'day3_reply', 'assistant');
    r = applyLuyaUserTurn(r, sharedUser);
    r = applyLuyaRoomOperation(r, { type: 'decorate', wallColor: 'sage', light: 'warm' }, START + 3 * DAY + 2).runtime;
    r = confirmLuyaSharedEvent(r, [sharedUser, sharedAssistant], [sharedUser.id, sharedAssistant.id], '一起确认线上房间的墙色与阅读灯', START + 3 * DAY + 3);
    r = applyLuyaUserTurn(r, msg('今天不太想讲话，我们各做各的就好。', START + 4 * DAY, 'day4'));
    r = applyLuyaUserTurn(r, msg('谢谢你解释，我们把刚才的分歧说开了。', START + 5 * DAY, 'day5'));
    r = applyLuyaUserTurn(r, msg('我今天发现你记住的阅读灯位置一直留着，在这里做自己的事也很自在。', START + 6 * DAY, 'day6'));
    expect(r.relationship.stage).toBe('roommate_like');
    expect(r.relationship.evidence.map(e => e.kind)).toEqual(expect.arrayContaining(['meaningful_interaction', 'boundary_respected', 'habit_honored', 'shared_event', 'room_participation', 'quiet_company', 'repair']));
    r = applyLuyaUserTurn(r, msg('我们已经是室友了，我只想和你做朋友。', START + 7 * DAY, 'day7'));
    expect(r.relationship.stage).toBe('roommates');
    expect(r.relationship.route).toBe('friends');
    r = applyLuyaUserTurn(r, msg('我好像喜欢你。', START + 8 * DAY, 'day8'));
    expect(r.relationship.route).toBe('friends');
    expect(r.boundaries.imaginedTouch).toBe('ask_first');
  });
  it('respects a quoted nickname boundary and exits quiet mode on the next third-party share', () => {
    let r = createLuyaRuntime(START);
    r = applyLuyaUserTurn(r, msg('不要叫我“笨蛋”。'));
    expect(r.boundaries.nicknames).toBe('declined');
    r = applyLuyaUserTurn(r, msg('今天不太想讲话，就在这里待会儿。', START + 1));
    expect(r.boundaries.quietUntilNextUserTurn).toBe(true);
    r = applyLuyaUserTurn(r, msg('我朋友分享了一个视频，讲的是他最近读的书。', START + 2));
    expect(r.boundaries.quietUntilNextUserTurn).toBe(false);
    expect(r.boundaries.nicknames).toBe('declined');
  });
});
