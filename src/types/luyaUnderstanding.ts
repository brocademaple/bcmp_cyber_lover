/** User-approved communication preferences. Never populated from model assertions. */
export type UnderstandingStatus = 'low_confidence' | 'pending_confirmation' | 'confirmed' | 'archived' | 'revoked';
export type UnderstandingTopic = 'listening' | 'directness' | 'sharing' | 'quiet' | 'humor';
export interface UnderstandingEvidence { messageId: string; summary: string; timestamp: number }
export interface UnderstandingObservation {
  id: string;
  sourceMessageId: string;
  timestamp: number;
  sharedContent: string;
  hadExplanation: boolean;
  hypothesis: string;
  alternatives: string[];
}
export interface UserUnderstanding {
  id: string;
  characterId: 'qingning';
  category: 'communication_style';
  topic: UnderstandingTopic;
  preference: string;
  statement: string;
  status: UnderstandingStatus;
  confidence: number;
  sourceMessageIds: string[];
  supportEvidence: UnderstandingEvidence[];
  counterEvidence: UnderstandingEvidence[];
  alternatives: string[];
  version: number;
  versionHistory: { version: number; statement: string; changedAt: number; reason: string }[];
  affects: ('reply_style' | 'proactive_style' | 'room_interaction')[];
  createdAt: number;
  updatedAt: number;
  lastEvidenceAt: number;
  confirmedAt?: number;
  archivedAt?: number;
  revokedAt?: number;
  naturalQuestionAt?: number;
  naturalQuestionMessageId?: string;
  topicEndedAt?: number;
  /** A declined card remains suppressed even when more evidence arrives. */
  cardDismissedAt?: number;
  cardPresentedAt?: number;
  /** Deleted understanding is a tombstone to suppress repetition; source messages are untouched. */
  deletedAt?: number;
}
export interface UnderstandingMessage { id: string; content: string; timestamp: number; role: 'user' | 'assistant' | 'system' }
export interface UnderstandingDecayConfig { downgradeAfterMs: number; archiveAfterMs: number }
