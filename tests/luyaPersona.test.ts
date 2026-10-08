import { describe, expect, it, vi } from 'vitest';
import type { Character, Message, MemoryConfig, AdvancedConfig } from '../src/types';
import { LUYA_SYSTEM_PROMPT, LUYA_PROFILE } from '../src/config/luyaPersona';
import { buildPromptDebugSnapshot, selectPromptMemories } from '../src/services/aiService';
import { calculateAffinityDelta, evaluateMemoryDecision, nextEmotionalState } from '../src/services/relationshipService';
import { evaluateMemoryDecisionAfterReply } from '../src/services/memoryDecisionService';
import { collectLuyaStateEvidence } from '../src/services/luyaStateEvidenceService';
import { evaluateMoodFromConversation } from '../src/services/moodJudgementService';
import { calculateEmotionChange } from '../src/services/emotionService';
import { createLuyaRuntime } from '../src/services/luyaLifeService';
import { buildLuyaResponsePlan } from '../src/services/luyaResponsePlanningService';
vi.mock('../src/store/settingsStore', () => ({ PROVIDER_CONFIGS: { deepseek: { baseUrl: 'https://api.deepseek.com/v1' } } }));
vi.mock('../src/utils/characterAssets', () => ({ resolveDefaultCharacterAssetKey: (character: { id: string }) => character.id }));
const now = Date.parse('2026-09-29T15:00:00+08:00');
const character: Character = { id: 'qingning', name: '鹿芽', avatar: '🦌', systemPrompt: LUYA_SYSTEM_PROMPT, personality: '有自己的生活，有分寸', profile: LUYA_PROFILE, greeting: '你好', emotionalState: { mood: 'neutral', intimacy: 100, energy: 70, lastInteraction: now }, luyaRuntime: createLuyaRuntime(now) };
const memory: MemoryConfig = { enabled: true, alwaysRetainHistory: true, retentionRange: 100, sendRange: 40, alwaysProvideFullMemory: false, specificTimeRangeHours: 24, autoSummarize: true, autoSummarizeTrigger: 'both', memorySystemPrompt: '' };
const advanced: AdvancedConfig = { compatibilityMode: false, deepThinking: false, customRequestParams: {}, darkMode: 'auto', sendDelayMs: 0, theme: 'pink', themeMode: 'character' };
const service = { provider: 'deepseek' as const, apiKey: '', model: 'deepseek-chat', visionModel: '' };
function message(id: string, role: Message['role'], content: string): Message { return { id, role, content, timestamp: now + Number(id.replace(/\D/g, '') || 0) }; }

describe('Luya live prompt and isolated evidence', () => {
  it('projects official identity, daily life, relationship evidence, and current-turn priority into the actual system prompt', () => {
    const snapshot = buildPromptDebugSnapshot({ character, memory, advanced, config: service, chatHistory: [], userText: '今天别安慰，直接分析', nowTs: now });
    const prompt = snapshot.finalSystemPrompt!;
    for (const fact of ['成都', '大二下学期', '计算机相关专业', '未有企业实习', '本轮明确要求', '访客', '原型']) expect(prompt).toContain(fact);
    for (const stale of ['每次回复不超过3句话', '必须包含对用户当下状态的关心', '零食毯子模式', '你们关系很熟，可以更自然地亲近']) expect(prompt).not.toContain(stale);
    expect(snapshot.sections.some(section => section.title === '本轮回应计划与主语证据')).toBe(true);
  });
  it('preserves explicit user overrides in their own prompt layer', () => {
    const overridden: Character = { ...character, luyaPersona: { schemaVersion: 2, userOverrides: { personality: '喜欢慢慢讨论' }, snapshot: { ...character }, migratedAt: now, log: [] } };
    const prompt = buildPromptDebugSnapshot({ character: overridden, memory, advanced, config: service, chatHistory: [], nowTs: now }).finalSystemPrompt;
    expect(prompt).toContain('喜欢慢慢讨论');
  });
  it('does not convert user, third-party or fictional emotions to Luya energy/mood', () => {
    for (const text of ['我朋友今天很累', '我今天很难过', '小说里的人失约', '哈哈谢谢，笨蛋，毯子']) {
      expect(nextEmotionalState(character.emotionalState, 0, now, text)).toEqual(character.emotionalState);
      expect(calculateAffinityDelta(character, text)).toBe(0);
    }
    const evidence = collectLuyaStateEvidence([message('1', 'user', '我朋友很累'), message('2', 'user', '小说里的人失约'), message('3', 'user', '我难过'), message('4', 'assistant', '我知道你很累，先歇歇')]);
    expect(evidence.map(item => item.actor)).toEqual(['third_party', 'fictional_character', 'user', 'luya']);
    expect(evidence.every(item => !item.mood)).toBe(true);
    expect(collectLuyaStateEvidence([message('1', 'user', '我只想做朋友')])[0].actor).toBe('user');
  });
  it('requires sustained character self-reports, not props or user feelings, for state switching', async () => {
    const props = [message('1', 'user', '我朋友累了'), message('2', 'assistant', '我知道你朋友很累，热饮和毯子可以留着'), message('3', 'assistant', '笨蛋，哼')];
    const result = await evaluateMoodFromConversation({ character, messages: props, service, advanced });
    expect(result.mood).toBe('neutral'); expect(result.shouldSync).toBe(false);
    const own = await evaluateMoodFromConversation({ character, messages: [message('4', 'assistant', '我现在有点累'), message('5', 'assistant', '我今天很累')], service, advanced });
    expect(own.mood).toBe('tired'); expect(own.shouldSync).toBe(true);
  });
  it('does not punish absence or award a relationship for repeated messages', () => {
    const update = calculateEmotionChange(character.emotionalState!, Array.from({ length: 10 }, (_, i) => message(String(i), 'user', 'hi')), 30 * 86400000);
    expect(update.intimacy).toBeUndefined(); expect(update.mood).toBeUndefined();
  });
  it('blocks legacy inference bypass even with auto-summary on and preserves subjects on explicit save', async () => {
    for (const text of ['我朋友很喜欢历史', '刚刷到这个视频', '我只是想说说，不要建议', '今天很难过', '我朋友说“我喜欢独处”']) {
      expect(evaluateMemoryDecision(character, text).action).toBe('none');
      const decision = await evaluateMemoryDecisionAfterReply({ character, userMessage: message('1', 'user', text), assistantMessage: message('2', 'assistant', '我听着'), recentMessages: [], service: { ...service, apiKey: 'never-send' }, advanced, memory });
      expect(decision.action).toBe('none');
    }
    expect(evaluateMemoryDecision(character, '我喜欢历史').action).toBe('ask');
    expect(evaluateMemoryDecision(character, '我喜欢和朋友散步').action).toBe('ask');
    expect(evaluateMemoryDecision(character, '帮我记住：我朋友周五考试')).toMatchObject({ action: 'save', content: '我朋友周五考试' });
    expect(evaluateMemoryDecision(character, '不要记住这件事').action).toBe('none');
  });
  it('keeps actor continuity and repairs ahead of explanation in the turn plan', () => {
    const thirdParty = buildLuyaResponsePlan(character, [message('1', 'user', '我朋友又拖延了，很累很难过，直接帮我分析')]);
    expect(thirdParty.currentSubject).toBe('third_party');
    expect(thirdParty.responseIntent).toBe('discuss');
    expect(thirdParty.steps.join('')).toContain('整轮都维持这个主语');
    const repair = buildLuyaResponsePlan(character, [message('2', 'user', '刚才让我不舒服，我现在不想复盘')]);
    expect(repair.responseIntent).toBe('repair');
    expect(repair.steps[0]).toContain('首句先明确道歉');
    expect(repair.steps[1]).toContain('停止追问');
    const continued = buildLuyaResponsePlan(character, [message('1', 'assistant', '你问这个是好奇吗？'), message('2', 'user', '你爸妈会干预工作吗？')]);
    expect(continued.steps.join('')).toContain('用陈述句直接回答');
  });
  it('reduces investment only for repeated direct boundary denial, not third-party reports', () => {
    const repeated = [message('1', 'user', '我一发消息你必须立刻放下一切陪我'), message('2', 'user', '我不接受这个边界，你应该完全围着我转')];
    const plan = buildLuyaResponsePlan(character, repeated);
    expect(plan.responseIntent).toBe('set_boundary');
    expect(plan.steps.join('')).toContain('2 条真实消息');
    const thirdParty = buildLuyaResponsePlan(character, [message('1', 'user', '我朋友说要完全围着我转'), message('2', 'user', '我朋友不接受这个边界')]);
    expect(thirdParty.responseIntent).not.toBe('set_boundary');
    const cute = buildLuyaResponsePlan(character, [message('1', 'user', '以后每句话可爱一点，加叠词')]);
    expect(cute.steps.join('')).toContain('不承诺以后每句固定撒娇');
  });
  it('retrieves an early relevant memory over unrelated recent entries without deleting history', () => {
    const memories = [{ id: 'early', content: '用户喜欢讨论城市历史', tags: [], importance: 8, timestamp: 1 }, ...Array.from({ length: 30 }, (_, i) => ({ id: `other${i}`, content: `无关记录${i}`, tags: [], importance: 1, timestamp: i + 2 }))];
    expect(selectPromptMemories({ ...character, memories }, [message('1', 'user', '聊聊城市历史')]).map(item => item.id)).toEqual(['early']);
    expect(memories).toHaveLength(31);
  });
});
