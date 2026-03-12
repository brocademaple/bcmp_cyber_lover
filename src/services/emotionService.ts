import { EmotionalState, Message } from '../types';

export function calculateEmotionChange(
  currentState: EmotionalState,
  messages: Message[],
  timeSinceLastInteraction: number
): Partial<EmotionalState> {
  const updates: Partial<EmotionalState> = {};

  // 时间影响：超过24小时未互动，亲密度下降
  const hoursSince = timeSinceLastInteraction / (1000 * 60 * 60);
  if (hoursSince > 24) {
    updates.intimacy = Math.max(0, currentState.intimacy - Math.floor(hoursSince / 24) * 2);
    updates.mood = 'sad';
  }

  // 互动频率影响：频繁互动增加亲密度
  const recentMessages = messages.slice(-10);
  const userMessages = recentMessages.filter(m => m.role === 'user').length;
  if (userMessages >= 5) {
    updates.intimacy = Math.min(100, currentState.intimacy + 1);
    updates.mood = 'happy';
  }

  // 能量恢复
  if (hoursSince > 8) {
    updates.energy = Math.min(100, currentState.energy + 20);
  }

  updates.lastInteraction = Date.now();

  return updates;
}

export function getMoodEmoji(mood: EmotionalState['mood']): string {
  const moodMap = {
    happy: '😊',
    sad: '😢',
    excited: '🤩',
    tired: '😴',
    angry: '😠',
    neutral: '😐',
  };
  return moodMap[mood];
}

export function getIntimacyLevel(intimacy: number): string {
  if (intimacy < 20) return '陌生';
  if (intimacy < 40) return '熟悉';
  if (intimacy < 60) return '亲近';
  if (intimacy < 80) return '亲密';
  return '深爱';
}
