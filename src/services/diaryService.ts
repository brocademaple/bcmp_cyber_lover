import { CharacterDiary, Message } from '../types';

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function getDailyKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function getMonthlyKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = (date.getDay() + 6) % 7; // Monday=0
  date.setDate(date.getDate() - day);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function getWeeklyKey(ts: number): string {
  const d = new Date(ts);
  const monday = getMonday(d);
  const yearStart = new Date(monday.getFullYear(), 0, 1);
  const week = Math.ceil((((monday.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${monday.getFullYear()}-W${pad2(week)}`;
}

export function buildDailyDiaryFromMessages(characterName: string, messages: Message[], now = Date.now()): CharacterDiary {
  const todayKey = getDailyKey(now);
  const todayMsgs = messages.filter((m) => getDailyKey(m.timestamp) === todayKey);
  const userMsgs = todayMsgs.filter((m) => m.role === 'user').slice(-8);
  const aiMsgs = todayMsgs.filter((m) => m.role === 'assistant').slice(-4);

  const userSummary = userMsgs
    .map((m) => m.content.trim())
    .filter(Boolean)
    .map((c) => `- 用户提到：${c.slice(0, 60)}${c.length > 60 ? '…' : ''}`)
    .slice(-4);
  const aiSummary = aiMsgs
    .map((m) => m.content.trim())
    .filter(Boolean)
    .map((c) => `- 我回应了：${c.slice(0, 60)}${c.length > 60 ? '…' : ''}`)
    .slice(-2);

  const lines = [
    `今天和TA聊了 ${todayMsgs.length} 句，我的心情有点起伏，但很充实。`,
    ...userSummary,
    ...aiSummary,
  ];

  return {
    id: `diary_daily_${todayKey}`,
    period: 'daily',
    periodKey: todayKey,
    title: `${characterName}的日记 · ${todayKey}`,
    content: lines.join('\n'),
    timestamp: now,
  };
}

export function buildRollupDiary(
  characterName: string,
  period: 'weekly' | 'monthly',
  periodKey: string,
  sourceDaily: CharacterDiary[],
  now = Date.now()
): CharacterDiary {
  const recent = sourceDaily
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, period === 'weekly' ? 7 : 31);
  const snippets = recent
    .map((d) => `- ${d.periodKey}: ${d.content.split('\n')[0]}`)
    .slice(0, period === 'weekly' ? 5 : 8);

  return {
    id: `diary_${period}_${periodKey}`,
    period,
    periodKey,
    title: `${characterName}${period === 'weekly' ? '周记' : '月记'} · ${periodKey}`,
    content: [
      `这${period === 'weekly' ? '一周' : '一个月'}里，我和TA持续在靠近。`,
      ...snippets,
    ].join('\n'),
    timestamp: now,
  };
}

