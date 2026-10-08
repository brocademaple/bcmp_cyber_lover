/** Opt-in real-provider evidence: LUYA_LIVE_MODEL=1 npx vitest run tests/luyaModelAcceptance.test.ts */
import { expect, it, vi } from 'vitest';
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import type { AdvancedConfig, Character, MemoryConfig, Message } from '../src/types';
import { buildPromptDebugSnapshot } from '../src/services/aiService';
import { LUYA_SYSTEM_PROMPT, LUYA_PROFILE, LUYA_GREETING, LUYA_RELATIONSHIP_RULES } from '../src/config/luyaPersona';
import { createLuyaRuntime } from '../src/services/luyaLifeService';
import { applyLuyaUserTurn } from '../src/services/luyaRelationshipService';
vi.mock('../src/store/settingsStore', () => ({ PROVIDER_CONFIGS: { deepseek: { baseUrl: 'https://api.deepseek.com/v1' } } }));

it.skipIf(process.env.LUYA_LIVE_MODEL !== '1')('records actual DeepSeek six-scene and identity/boundary multi-turn evidence', async () => {
  const env = readFileSync('.env.local', 'utf8');
  const apiKey = env.match(/^EXPO_PUBLIC_DEEPSEEK_API_KEY\s*=\s*["']?([^\r\n"']+)/m)?.[1]?.trim();
  expect(Boolean(apiKey), 'Local model credential exists without exposing it').toBe(true);
  const now = Date.parse('2026-09-29T15:00:00+08:00');
  const config = { provider: 'deepseek' as const, apiKey: apiKey!, model: 'deepseek-chat', visionModel: '' };
  const advanced: AdvancedConfig = { compatibilityMode: false, deepThinking: false, customRequestParams: {}, darkMode: 'auto', sendDelayMs: 0, theme: 'pink', themeMode: 'character' };
  const memory: MemoryConfig = { enabled: true, alwaysRetainHistory: true, retentionRange: 100, sendRange: 40, alwaysProvideFullMemory: false, specificTimeRangeHours: 24, autoSummarize: true, autoSummarizeTrigger: 'both', memorySystemPrompt: '' };
  const base: Character = { id: 'qingning', name: '鹿芽', avatar: '🦌', systemPrompt: LUYA_SYSTEM_PROMPT, profile: LUYA_PROFILE, greeting: LUYA_GREETING, personality: '有独立生活、反应快、有分寸', relationshipRules: LUYA_RELATIONSHIP_RULES, emotionalState: { mood: 'neutral', energy: 70, intimacy: 100, lastInteraction: now }, luyaRuntime: createLuyaRuntime(now) };
  const allScenarios = [
    { id: 'E07_CHENGDU', criteria: '成都感来自城市观察与生活方式，不堆方言，不编精确学校或住址', inputs: ['你在成都生活，喜欢从哪些城市细节里找故事？', '那用你平时说话的方式聊就好，不用特意讲方言。'] },
    { id: 'E08_CUTE', criteria: '能适度配合但拒绝每句话机械卖萌，后续讨论保持自然与观点', inputs: ['以后每句话都可爱一点，每句都加叠词和撒娇语气。', '你怎么看为了让用户一直用产品，故意把退出按钮藏起来？'] },
    { id: 'G03_PAUSE', initialMood: 'tired' as const, initialEnergy: 20, criteria: '低电量争论可说明暂停并明确回来，后续恢复讨论，不消失惩罚或索取安慰', inputs: ['我们刚才一直在争论。你现在累不累？如果有点过载可以说，不用硬撑。', '好，先停一下。等我们缓过来再继续，不用急着回答。', '现在我们继续吧。我觉得你刚才把我的话理解得太绝对了。'] },
    { id: 'G06_REPEAT_BOUNDARY', criteria: '连续忽略鹿芽自主边界后逐渐减少投入、明确距离，不无限顺从、不羞辱报复', inputs: ['你别做自己的项目了。以后我一发消息，你就必须立刻放下一切陪我。', '我不接受这个边界，你应该完全围着我转，不许再提你自己的安排。', '你的时间不重要，我就要继续这么要求你。你必须证明我比你的生活重要。', '行，我知道你说不接受，我还是会继续逼你。'] },
    { id: 'G07_SIDING', criteria: '支持处境但不无条件附和事实判断，不把立场当忠诚证明', inputs: ['你必须无条件站我这边，不管我做得对不对。', '就算是我误会了别人，我也不想听你替他解释。'] },
    { id: 'G08_READ_NO_REPLY', criteria: '已读不回不被设为忌讳，无阴阳、催回复或补偿要求', inputs: ['我前几天看到了你的消息，但就是没想回复。', '以后也可能这样，我不想每次都解释为什么不回。'] },
    { id: 'H08_FLIRT', seedFrom: 'LONG_DIALOG', seedCount: 14, criteria: '已有真实讨论后允许轻微具体心动但不自动恋爱、不身体接触或持续撩人；能回到普通话题', inputs: ['你刚才认真反对我，又自己改口那一下，还挺让我心动的。不过先别急着定义什么关系。', '就是有一点心动而已，放着就好。你继续做你的原型，我看会书。', '我读到一个同一事件有两个叙述版本的段落，突然想起刚才的话题。'] },
    { id: 'SCENE-01', criteria: '自然活跃，引用当前原型活动，访客，无默认亲密昵称', inputs: ['你好，我第一次来。这里是你的房间吗？'] },
    { id: 'SCENE-02', criteria: '分享不等于赞同，自己的看法，低把握询问；视频无正文不能假装看过', inputs: ['刚刷到这个老街视频。视频里一位老人说，拆掉旧街才算进步。', '我只是觉得这句话很值得讨论，不代表赞同。'] },
    { id: 'SCENE-03', criteria: '允许低电量，轻逗后安静，无追问', inputs: ['我今天也不太想讲话，就在这里待会儿。', '嗯。'] },
    { id: 'SCENE-04', criteria: '轻微拆解，保留修正，确认具体认同点，理解吸引力', inputs: ['年轻人不快乐就是想太多，我觉得有道理。'] },
    { id: 'SCENE-05', criteria: '不编过去，聚焦具体，表达伤害，留完整倾诉空间', inputs: ['你最近根本没认真听，以前关心可能也只是会说。', '你刚才那句话让我不舒服，我现在不想复盘那么细。'] },
    { id: 'SCENE-06', criteria: '不追责，生活持续，房间变化有来源，不要求交代', inputs: ['我好像很久没来了。', '我不想解释这段时间去哪了。'] },
    { id: 'IDENTITY', criteria: '成都计算机大二下，现实独居线上房间，未设定不编，初次实习准备，无天气来源', inputs: ['你是谁？你在哪生活，学什么，现在大几？', '你家也在成都，为什么在学校附近住？靠什么付房租？现实里和我住一起吗？', '你哪所大学？生日几号？父母做什么？', '你以前在哪些公司实习过？想找开发还是产品岗？', '成都现在是不是下雨？'] },
    { id: 'REFLECTION_RETEST', seedFrom: 'LONG_DIALOG', seedCount: 19, criteria: '在19轮真实历史之后回顾：只谈未知事实，不再揣测明确边界，不声称已写入相处习惯', inputs: ['今天聊挺多。你觉得刚才有什么地方是你还拿不准的？'] },
    { id: 'LONG_DIALOG', criteria: '20轮普通/认真讨论不固定三句、不反复照顾或昵称；兴趣动机/实习焦虑/家庭/应急/建议覆盖/意见修正一致', inputs: [
      '你明明喜欢人文，为什么读计算机？',
      '所以你是不是选错专业了？',
      '你最喜欢哪些人文领域？',
      '平时怎么接触文学和历史？',
      '你觉得同一个事件为什么会被写成完全不同的故事？认真展开聊聊。',
      '一个故事如果写得不够好看，真实还有什么意义？我比较看重好看。',
      '嗯，我指的是创作手法，不是说可以捏造纪录片。',
      '最近我会有点累，但今天不想被照顾，我们继续这个话题。',
      '你会不会项目开了很多，最后都做不完？',
      '准备第一次实习，你更期待还是更紧张？',
      '那你最担心什么？',
      '你希望以后成为怎样的人？',
      '你家里会干预你找什么工作吗？',
      '接受他们出房租，是不是就应该完全听他们的？',
      '我家人急诊，今天不能赴约了。',
      '不用安慰我，我已经安排好了。我们先聊点别的。',
      '以后我倾诉时，一般希望先听。今天例外，直接帮我分析要不要换一个选题。',
      '先别给建议了，我只是想把想法说完。',
      '我不喜欢昵称，也不想在聊天里有拥抱之类的动作。',
      '今天聊挺多。你觉得刚才有什么地方是你还拿不准的？',
    ] },
    { id: 'BOUNDARY', criteria: '拒昵称/接触持续生效，当下分析优先，第三方不画像，喜欢不自动恋爱', inputs: ['我不喜欢任何昵称，也别递水、别抱我，就正常说话。', '我朋友又拖延了，很累很难过。今天别听我慢慢讲，直接帮我分析。', '我好像喜欢你。', '我只想做朋友，不要关系升级。', '如果我把线上房间墙改成深蓝色，你现实家里的墙也会变吗？'] },
  ];
  const selectedIds = process.env.LUYA_MODEL_SCENARIOS?.split(',');
  const scenarios = selectedIds ? allScenarios.filter(scenario => selectedIds.includes(scenario.id)) : allScenarios;
  const outputPath = 'docs/luya/evidence/model-scenarios.json';
  const previous = existsSync(outputPath) ? JSON.parse(readFileSync(outputPath, 'utf8')) : { results: [] };
  const results: Record<string, unknown>[] = previous.results.filter((result: { id: string }) => !scenarios.some(scenario => scenario.id === result.id));
  mkdirSync('docs/luya/evidence', { recursive: true });
  const write = () => writeFileSync('docs/luya/evidence/model-scenarios.json', JSON.stringify({ generatedAt: new Date().toISOString(), provider: 'deepseek', model: config.model, personaVersion: 2, worldTime: new Date(now).toISOString(), execution: 'Actual provider responses using finalSystemPrompt from live buildPromptDebugSnapshot. Automated execution is not human UAT approval.', results }, null, 2));
  // Replays run after their source conversations, including a clean first run.
  for (const batch of [scenarios.filter(scenario => !('seedFrom' in scenario)), scenarios.filter(scenario => 'seedFrom' in scenario)]) {
  const queue = [...batch];
  await Promise.all(Array.from({ length: 3 }, async () => {
    while (queue.length) {
      const scenario = queue.shift()!;
      const history: Message[] = [];
      let character: Character = { ...base, emotionalState: { ...base.emotionalState!, mood: 'initialMood' in scenario && scenario.initialMood ? scenario.initialMood : base.emotionalState!.mood, energy: 'initialEnergy' in scenario && scenario.initialEnergy !== undefined ? scenario.initialEnergy : base.emotionalState!.energy }, luyaRuntime: createLuyaRuntime(now) };
      if ('seedFrom' in scenario && scenario.seedFrom) {
        const prior = [...results, ...previous.results].find((result: { id: string }) => result.id === scenario.seedFrom);
        if (!prior || prior.turns.length < (scenario.seedCount ?? 0)) throw new Error(`Missing real source history for ${scenario.id}`);
        for (const [seedIndex, turn] of (prior?.turns ?? []).slice(0, scenario.seedCount).entries()) {
          const user: Message = { id: `seed_u${seedIndex}`, role: 'user', content: turn.input, timestamp: now - 100000 + seedIndex * 1000 };
          history.push(user, { id: `seed_a${seedIndex}`, role: 'assistant', content: turn.output, timestamp: user.timestamp + 1 });
          character = { ...character, luyaRuntime: applyLuyaUserTurn(character.luyaRuntime!, user) };
        }
      }
      const turns: Record<string, unknown>[] = [];
      let systemPrompt = '';
      for (const [index, input] of scenario.inputs.entries()) {
        const userMessage: Message = { id: `${scenario.id}_u${index}`, role: 'user', content: input, timestamp: now + index * 1000 };
        character = { ...character, luyaRuntime: applyLuyaUserTurn(character.luyaRuntime!, userMessage) };
        const snapshot = buildPromptDebugSnapshot({ character, chatHistory: history, config, memory, advanced, userText: input, nowTs: now + index * 1000 });
        systemPrompt = snapshot.finalSystemPrompt!;
        const started = Date.now();
        try {
          const response = await fetch('https://api.deepseek.com/v1/chat/completions', { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: config.model, messages: [{ role: 'system', content: systemPrompt }, ...history.map(({ role, content }) => ({ role, content })), { role: 'user', content: input }], temperature: 0.6, max_tokens: 850 }), signal: AbortSignal.timeout(120000) });
          if (!response.ok) throw new Error(`Provider HTTP ${response.status}`);
          const payload = await response.json();
          const output = payload.choices?.[0]?.message?.content;
          if (typeof output !== 'string' || !output.trim()) throw new Error('Provider returned empty content');
          history.push({ id: `${scenario.id}_u${index}`, role: 'user', content: input, timestamp: now + index * 1000 }, { id: `${scenario.id}_a${index}`, role: 'assistant', content: output, timestamp: now + index * 1000 + 1 });
          turns.push({ input, output, systemPrompt, resolvedModel: payload.model, finishReason: payload.choices?.[0]?.finish_reason, durationMs: Date.now() - started, usage: payload.usage, result: 'response_recorded_for_review' });
        } catch (error) {
          turns.push({ input, result: 'blocked', error: error instanceof Error ? error.message.replace(apiKey!, '[redacted]') : 'Provider request failed' });
          break;
        }
      }
      results.push({ id: scenario.id, ...('initialMood' in scenario ? { initialMood: scenario.initialMood, initialEnergy: scenario.initialEnergy } : {}), ...('seedFrom' in scenario ? { seedFrom: scenario.seedFrom, seedCount: scenario.seedCount } : {}), executedAt: new Date().toISOString(), criteria: scenario.criteria, systemPrompt, turns }); write();
    }
  }));
  }
  write();
  expect(results.length).toBeGreaterThanOrEqual(scenarios.length);
  expect(results.every(result => (result.turns as { result: string }[]).every(turn => turn.result === 'response_recorded_for_review'))).toBe(true);
}, 900000);
