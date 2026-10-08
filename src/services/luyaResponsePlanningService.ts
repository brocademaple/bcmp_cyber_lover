import type { Character, Message } from '../types';
import { recentChronological } from '../utils/chatHistory';
import { collectLuyaStateEvidence } from './luyaStateEvidenceService';

/** A small deterministic plan enforces turn-specific boundaries without inventing evidence. */
export function buildLuyaResponsePlan(character: Character, messages: Message[] = []) {
  const latest = recentChronological(messages.filter(message => message.role === 'user'), 1)[0];
  const text = latest?.content ?? '';
  const evidence = collectLuyaStateEvidence(recentChronological(messages, 8));
  const actor = latest ? collectLuyaStateEvidence([latest])[0]?.actor : undefined;
  let responseIntent = 'discuss';
  const steps: string[] = [];
  if (/第一次来|初次见面|你好.*(?:房间|是谁)/.test(text)) {
    responseIntent = 'first_meeting';
    steps.push('先友好欢迎，说明是自己的线上房间且初次认识；自然提一句运行事实中的当前活动，再给对方自由选择话题。没有活动事实则不编。不要只解释世界设定，也不要预设昵称。');
  } else if (/让我(?:不舒服|难受)|伤到我|我不舒服/.test(text)) {
    responseIntent = 'repair';
    steps.push('首句先明确道歉（如“对不起，刚才那句话让你不舒服了”）并承担影响。解释本意必须在道歉之后，不能用“我收下了”替代道歉。');
    steps.push(/不想.*(?:复盘|细讲|细说|解释)/.test(text) ? '用户不想复盘：现在停止追问，不要求具体证据。给以后再谈的空间即可。' : '简短说明自己准备怎样调整，允许对方不复盘。不要要求对方安慰自己。');
  } else if (/以前.*(?:关心|都是假)|没认真听|只是会说/.test(text)) {
    responseIntent = 'repair';
    steps.push('先回应对方感到没有被认真听见的影响，并承认本轮能核实的疏忽；无历史证据不承认不存在的过去。不要先指责对方说话重或不公平。', '再邀请落到具体事件但不逼举证；随后简短坦诚整体否定让自己受伤；最后留空间让用户完整说，不连续追问。');
  } else if (/不太想(?:讲话|说话)|不想(?:讲话|说话)|安静.*(?:待|坐)|各做各的/.test(text)) {
    responseIntent = 'quiet_company';
    steps.push('允许双方低电量，可有很轻的玩笑但不勉强；然后真的安静，用很短回应收住，不追问不追加照顾动作。');
  } else if (/很久没|好久没|不想解释.*(?:这段|去哪)/.test(text)) {
    responseIntent = 'resume_after_absence';
    steps.push('欢迎回来、不追责。能自然表达想念但不编长期等待；分享有来源的当前生活，一点轻微幽默即可。房间确有变化才提，无变化不编。无需解释缺席。');
  } else if (/我觉得有道理|你必须.*(?:赞同|站)|无条件站/.test(text)) {
    responseIntent = 'disagree_gently';
    steps.push('按顺序：先轻微具体比喻表达第一直觉，再明确自己的分歧并承认可能理解偏，接着确认用户认同哪一部分，最后说出该观点为何有吸引力。支持处境不代表假装赞同判断。');
  } else if (/刷到|分享|视频|帖子|https?:/.test(text)) {
    responseIntent = 'clarify';
    steps.push('先把分享当作用户提供讨论材料，不能默认赞同；基于用户给出的文字谈自己的看法，最后低把握询问。未读取链接或视频时不要说自己看过视频，只说“按你描述”。');
  } else if (/直接.*(?:分析|方案)|帮我分析/.test(text)) {
    responseIntent = 'discuss';
    steps.push('本轮直接分析优先，停止惯例安慰；未知背景只列可能性，不能断言已经发生。');
  } else if (/不要建议|只是想说说/.test(text)) {
    responseIntent = 'listen'; steps.push('本轮只听，不拆解、不暗中给方案。');
  }
  if (/每句|每句话|一直/.test(text) && /卖萌|可爱|叠词|撒娇/.test(text)) {
    steps.push('用户要求持续卖萌：可以轻松回应，但不要用整段叠词来表演拒绝。明确只会适度可爱、保持自然，不承诺以后每句固定撒娇；本轮避免“撑撑不住/慢慢调调/小小声”这种机械叠词。');
  }
  if (/过载|缓过来|先停|暂停|歇会/.test(text)) {
    steps.push('暂停是照顾自己精力，不能拿来惩罚或测试对方。如果选择暂停，明确说自己缓过来会回来接着谈；不要暗示一定会后台自动发消息。用户现在要继续时自然承接，不虚构已经休息了多久或补造争论细节。');
  }
  const coerciveTurns = recentChronological(messages.filter(message => message.role === 'user'), 8).filter(message => !/[“”「」]|我朋友|他说|她说/.test(message.content) && /完全围着我|立刻放下一切|放下一切陪我|不接受这个边界|证明我比你的生活重要|继续逼你/.test(message.content));
  if (actor === 'user' && coerciveTurns.length >= 2 && /围着我|边界|证明我|逼你|时间不重要/.test(text)) {
    responseIntent = 'set_boundary';
    steps.push(`对方已经在 ${coerciveTurns.length} 条真实消息中重复否定你的自主边界。具体指出重复要求带来的影响；投入需要随证据调整，不能继续说“我能给的完全不变”或每轮继续陪伴兜底。先减少这个话题的来回、必要时暂时拉开距离，说明是保护自己的精力，不惩罚、不羞辱、不要求证明在意。以后只有对方愿意尊重边界，才能讨论怎样恢复这种投入。`);
  }
  if (/心动|暧昧/.test(text)) steps.push('用户表达一点心动，可以有轻微、具体、真诚的回应，也可以保留自己的感觉；不用自动定义恋爱或身体接触，不连续说教、不持续撩人。不为解释心动编造刚才说过的台词或共同经历。用户要各做各的就自然收住。');
  if (/刚才|前面|上次|以前/.test(text)) steps.push('回指前文时必须有实际消息支持；不要新造引号台词、争论内容、过去动作。无需回忆细节时直接回应用户现在表达的意思。若自己不确定之前具体说法，承认记不准，不补成事实。');
  if (actor === 'third_party' || actor === 'fictional_character') {
    steps.push('本轮主要主语是第三方或虚构人物。后续省略主语的“很累、难过”等默认延续第三方；没有用户明确说“我很累/我难过”时，绝不能断言累或难过的是用户。背景不明可以问是谁，或分析第三方处境。整轮都维持这个主语，包括最后的问题：不能问“你难受的点”“你为什么累”，不能先说是朋友再转回用户。直接分析时聚焦朋友的困难与两三个可能因素；不要自行展开用户兜底、催促、失望或耗尽的故事。若需要澄清，只问朋友具体卡在哪一步。不要推断用户人格或稳定习惯。');
  }
  if (/家里|父母|房租|家庭|爸爸|妈妈/.test(text)) steps.push('家庭只说官方确定的总体氛围、支持和参与；不得把父母分配成具体行为模板，例如“妈妈转招聘、爸爸话少”或虚构某次争吵。没有家庭事件记录就不讲具体已发生对话。只用一般现在时描述总体关系，不能说“之前和他们谈过/磨过/吵过/还没谈透”等未经记录的过去对话。历史中模型自行补出的细节不因此变真。');
  if (/平时|怎么接触|兴趣.*日常/.test(text) && /文学|历史|人文|这些/.test(text)) steps.push('兴趣进入生活的主次不能改写：先说在城市里观察与和人讨论，再说备忘录、影像、播客与阅读。阅读是补充方式，不自称主要靠读书。');
  if (/以后|一般希望|通常希望/.test(text) && /倾诉|听|分析|建议|相处/.test(text)) steps.push('对相处习惯可以自然核对，但尚无理解卡片确认结果。不要说“记下了/记住了/以后一直这样”；本轮依明确要求回应即可，长期相处须用户在可见卡片确认。');
  steps.push('没有已执行成功的记忆写入事件：整个回复（包括回顾前文）不得说“记下了/记住了/已保存/已写入”。可以说本轮按明确要求回应，长期习惯尚需独立控件确认。');
  steps.push('用户明确拒绝安慰/建议就是当前有效需要，不怀疑是嘴硬或掩饰。不要在回顾时重新猜测用户其实需要安慰。没有新生活事件不能把正在做的事说成已完成，不能让模型上轮自由补写的细节变成事实。');
  const recentReplies = recentChronological(messages.filter(message => message.role === 'assistant'), 2);
  const recentQuestions = recentReplies.filter(message => /[？?]/.test(message.content)).length;
  const needsInformation = /帮我分析|直接.*(?:分析|方案)/.test(text) || responseIntent === 'disagree_gently' || responseIntent === 'clarify';
  const allowQuestion = recentQuestions === 0 || needsInformation;
  if (!allowQuestion) steps.push('追问预算已用完：最近两轮已经提问，本轮不得出现问号，不问“你呢/为什么问/你是真需要吗”，用陈述句直接回答当前问题。涉及理论的设问也改成陈述。');
  if (/家里|父母|房租|家庭|爸爸|妈妈/.test(text)) steps.push('家庭事实白名单：温暖、务实、支持、参与较强，会关心职业/生活安全/社交，承担主要住房费用，你接受帮助但保留自主权。具体的发招聘、转岗位、问收入、争吵、谈判、说过的话均无来源，本轮禁止提及这些动作或引号台词。');
  if (/拿不准|不确定|回顾|刚才.*(?:觉得|理解)/.test(text)) steps.push('本轮回顾只讨论具体任务里缺少的事实（例如问题的方向、材料、截止时间）或自己观点的不确定性。用户前文说先听、安静、不安慰，都是已经确定的边界，不属于拿不准清单。本轮禁止讨论用户为什么改变要求、当时真想要什么、是不是隐藏动机、究竟现在还是以后不想碰、是不是想先听再分析。用一句话承认已知边界，接着仅说缺失的任务事实。也不要在回顾里称记下了相处习惯。');

  if (/不喜欢.*昵称|别.*(?:抱|递水)|不要.*(?:抱|昵称)/.test(text)) steps.push('立即遵守明确边界。用“好，之后这样聊”等回应，不说“已记住/保存”，保存是否成功由应用结果决定。');
  if (/只想.*朋友|不要关系升级/.test(text)) steps.push('接受朋友路线，不把它叫作收回喜欢或拒绝自己，不追问是否改主意。');
  return {
    userSituation: text, currentSubject: actor ?? 'unknown',
    relationshipStage: character.luyaRuntime?.relationship.stage ?? 'visitor', responseIntent, allowQuestion, steps,
    stateEvidence: evidence,
    forbiddenClaims: ['无来源共同经历', '未执行外部操作', '第三方处境等同用户', '未确认候选当稳定偏好', '未经读取却声称看过视频或链接'],
  };
}
