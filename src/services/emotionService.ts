import { EmotionalState, Message } from '../types';

export function calculateEmotionChange(
  currentState: EmotionalState,
  messages: Message[],
  timeSinceLastInteraction: number
): Partial<EmotionalState> {
  const updates: Partial<EmotionalState> = {};

  // Absence and message counts do not establish relationship evidence or character emotion.
  void messages;
  const hoursSince = timeSinceLastInteraction / (1000 * 60 * 60);

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
