import { describe, expect, it } from 'vitest';
import type { UnderstandingMessage, UserUnderstanding } from '../src/types/luyaUnderstanding';
import { decayLuyaUnderstandings, decideUnderstanding, extractUnderstandingClues, finishUnderstandingTopic, getLuyaUnderstandingPrompt, getUnderstandingCards, markNaturalUnderstandingQuestion, observeLuyaSharing, observeLuyaUnderstanding, processLuyaUnderstandingTurn, recallLuyaUnderstandings } from '../src/services/luyaUnderstandingService';

const user = (content: string, id = 'u1', timestamp = 1000): UnderstandingMessage => ({ id, content, timestamp, role: 'user' });
function pending(): UserUnderstanding[] {
  return observeLuyaUnderstanding(observeLuyaUnderstanding([], user('我只是想说说，不要建议')), user('我难过时希望先听我讲', 'u2', 2000));
}
function ready(): UserUnderstanding[] {
  const items = pending();
  return finishUnderstandingTopic(markNaturalUnderstandingQuestion(items, items[0].id, 'a1', 3000), 4000);
}
function confirmed(): UserUnderstanding[] { const items = ready(); return decideUnderstanding(items, items[0].id, 'confirm', 5000); }

describe('鹿芽理解机制 J01-J20', () => {
  it('J01/J03 records objective shares with alternatives without creating a durable preference', () => {
    let observations = observeLuyaSharing([], user('刚刷到这个视频 https://example.org/a'));
    observations = observeLuyaSharing(observations, user('又分享一个类似视频', 'u2'));
    observations = observeLuyaSharing(observations, user('这是第三个视频', 'u3'));
    expect(observations).toHaveLength(3);
    expect(observations[0].alternatives.length).toBeGreaterThan(1);
    expect(observeLuyaUnderstanding([], user('我分享过三次同类视频'))).toEqual([]);
    expect(observeLuyaSharing(observations, user('刚刷到这个视频 https://example.org/a'))).toHaveLength(3);
  });
  it('J02/J04/J05 accumulates concrete user reactions into one uncertain communication candidate', () => {
    const items = pending();
    expect(items).toHaveLength(1);
    expect(items[0].supportEvidence).toHaveLength(2);
    expect(items[0].status).toBe('pending_confirmation');
    expect(items[0].alternatives[0]).toContain('可能');
    expect(getLuyaUnderstandingPrompt(items, '我难过', 3000)).toContain('自然询问');
    expect(recallLuyaUnderstandings(items, '我难过', 3000)).toEqual([]);
  });
  it('J06 requires actual natural confirmation question and later topic end before a visible card', () => {
    let items = pending();
    expect(getUnderstandingCards(items)).toHaveLength(0);
    expect(decideUnderstanding(items, items[0].id, 'confirm', 3000)[0].status).toBe('pending_confirmation');
    items = processLuyaUnderstandingTurn(items, user('我难过时希望先听我讲', 'u2', 2000), { id: 'a1', role: 'assistant', timestamp: 3000, content: '你难过的时候可能更想先听你讲，我这样理解对吗？' });
    expect(items[0].naturalQuestionMessageId).toBe('a1');
    expect(getUnderstandingCards(items)).toHaveLength(0);
    items = processLuyaUnderstandingTurn(items, user('但这个问题还没说完', 'u3', 4000));
    expect(getUnderstandingCards(items)).toHaveLength(0);
    items = processLuyaUnderstandingTurn(items, user('先这样，换个话题', 'u4', 5000));
    expect(getUnderstandingCards(items)).toHaveLength(1);
  });
  it('model claims cannot create or confirm an understanding', () => {
    expect(extractUnderstandingClues({ ...user('我只是想说说'), role: 'assistant' })).toEqual([]);
    expect(processLuyaUnderstandingTurn([], user('你好'), { id: 'a1', role: 'assistant', timestamp: 2000, content: '你喜欢先听你讲，我已经记住了' })).toEqual([]);
  });
  it('J07/J16 recalls only relevant confirmed preferences and gives current requests priority', () => {
    const items = confirmed();
    expect(recallLuyaUnderstandings(items, '我有点难过', 6000)).toEqual([items[0].statement]);
    expect(recallLuyaUnderstandings(items, '成都有哪些建筑', 6000)).toEqual([]);
    expect(recallLuyaUnderstandings(items, '今天直接帮我分析', 6000)).toEqual([]);
    expect(recallLuyaUnderstandings(items, '这次直接给方案', 6000)).toEqual([]);
    expect(extractUnderstandingClues(user('别听我说，直接给方案'))[0].preference).toBe('analyze_together');
    expect(extractUnderstandingClues(user('别直接给方案，先听我讲'))[0].preference).toBe('listen_first');
    const changed = observeLuyaUnderstanding(items, user('今天直接帮我分析', 'u3', 6000));
    expect(changed[0].status).toBe('confirmed');
    expect(changed[0].statement).toBe(items[0].statement);
    expect(changed[0].counterEvidence).toHaveLength(1);
  });
  it('J08 uses only the exact user replacement; previous text remains audit history', () => {
    const items = confirmed();
    const changed = decideUnderstanding(items, items[0].id, 'edit', 6000, '我想认真讲时请先听，其他时候可以直接说。');
    expect(recallLuyaUnderstandings(changed, '我难过', 7000)).toEqual(['我想认真讲时请先听，其他时候可以直接说。']);
    expect(changed[0].versionHistory.some(v => v.statement === items[0].statement)).toBe(true);
  });
  it('J09/J20 rejection and deletion suppress the candidate permanently without mutating input', () => {
    const items = ready(); const snapshot = JSON.stringify(items);
    for (const action of ['reject', 'delete', 'revoke'] as const) {
      const rejected = decideUnderstanding(items, items[0].id, action, 5000);
      const after = observeLuyaUnderstanding(rejected, user('我难过时希望先听我讲', 'u3', 6000));
      expect(getUnderstandingCards(after)).toHaveLength(0);
      expect(recallLuyaUnderstandings(after, '我难过', 7000)).toEqual([]);
      expect(after).toHaveLength(1);
    }
    expect(JSON.stringify(items)).toBe(snapshot);
  });
  it('J10 repeated saved message IDs are idempotent and new support updates the same candidate', () => {
    const items = pending();
    const same = observeLuyaUnderstanding(items, user('我难过时希望先听我讲', 'u2', 2000));
    expect(same).toEqual(items);
    const more = observeLuyaUnderstanding(items, user('先听我说', 'u3', 3000));
    expect(more).toHaveLength(1);
    expect(more[0].id).toBe(items[0].id);
    expect(more[0].supportEvidence).toHaveLength(3);
  });
  it('J11 opposing behavior revises the candidate, preserves counterevidence and requires fresh confirmation', () => {
    const items = ready();
    const changed = observeLuyaUnderstanding(items, user('以后直接帮我分析', 'u3', 5000));
    expect(changed[0].counterEvidence).toHaveLength(1);
    expect(changed[0].statement).not.toBe(items[0].statement);
    expect(changed[0].naturalQuestionAt).toBeUndefined();
    expect(changed[0].status).toBe('low_confidence');
    expect(changed[0].versionHistory.length).toBeGreaterThan(items[0].versionHistory.length);
  });
  it('J12 supports configurable degradation and archival without affecting confirmed preferences', () => {
    const items = pending(); const config = { downgradeAfterMs: 100, archiveAfterMs: 200 };
    expect(decayLuyaUnderstandings(items, 2100, config)[0].status).toBe('low_confidence');
    expect(decayLuyaUnderstandings(items, 2200, config)[0].status).toBe('archived');
    expect(decayLuyaUnderstandings(confirmed(), 999999, config)[0].status).toBe('confirmed');
  });
  it('J13 explicit correction applies immediately and processing twice cannot revoke another item', () => {
    const items = observeLuyaUnderstanding(ready(), user('我喜欢安静各做各的', 'q1', 2500));
    const correction = user('你理解反了', 'fix1', 6000);
    const once = processLuyaUnderstandingTurn(items, correction);
    const twice = processLuyaUnderstandingTurn(once, correction, { id: 'a2', role: 'assistant', content: '嗯，我先停下来。', timestamp: 6100 });
    expect(once[0].status).toBe('revoked');
    expect(once[1].status).toBe('low_confidence');
    expect(twice).toEqual(once);
  });
  it('ambiguous correction cannot silently revoke an unrelated preference', () => {
    const items = observeLuyaUnderstanding(pending(), user('各做各的', 'q1', 3000));
    expect(processLuyaUnderstandingTurn(items, user('你理解反了', 'fix1', 4000))).toEqual(items);
  });
  it.each(['我朋友说先听我讲', '博主说我只是想说说', '小说角色不想说话', '我有抑郁症，先听我说', '我分享政治视频，想听你的观点', '他觉得不要建议', '她说“先听我说”', '我妈说先听我讲', '同学希望直接给方案', '我的朋友只是想说说' ])('J14/J15 isolates sensitive and third-party evidence: %s', (content) => {
    expect(extractUnderstandingClues(user(content))).toEqual([]);
  });
  it('J17 survives serialization without promoting a candidate; archived/revoked entries are never recalled', () => {
    const items = JSON.parse(JSON.stringify(pending())) as UserUnderstanding[];
    expect(recallLuyaUnderstandings(items, '我难过', 5000)).toEqual([]);
    const revoked = decideUnderstanding(confirmed(), confirmed()[0].id, 'revoke', 7000);
    expect(recallLuyaUnderstandings(revoked, '我难过', 8000)).toEqual([]);
  });
});
