import type { UserUnderstanding, UnderstandingObservation } from './luyaUnderstanding';

export type LuyaInternshipStage = 'preparing' | 'exploring_roles' | 'applying' | 'interviewing' | 'offer_decision' | 'pre_onboarding' | 'onboarded';
export type LuyaRelationshipStage = 'visitor' | 'frequent_visitor' | 'trusted_companion' | 'roommate_like' | 'roommates';
export interface LuyaLifeSlot {
  id: string;
  start: string;
  end: string;
  locationType: 'home' | 'campus' | 'city' | 'family_home' | 'online_room';
  activityType: 'class' | 'study' | 'project' | 'part_time' | 'social' | 'city_walk' | 'rest' | 'internship_prep';
  description: string;
  status: 'planned' | 'ongoing' | 'completed' | 'cancelled';
  source: 'generated_character_life' | 'confirmed_story_event';
}
export interface LuyaDailyPlan {
  characterId: 'qingning';
  dateKey: string;
  timezone: 'Asia/Shanghai';
  version: number;
  slots: LuyaLifeSlot[];
}
export interface LuyaLifeEvent {
  id: string;
  occurredAt: number;
  summary: string;
  kind: 'activity' | 'plan_change' | 'internship';
  source: 'generated_character_life' | 'confirmed_story_event';
  sourceIds: string[];
  internshipStage?: LuyaInternshipStage;
}
export interface LuyaLifeState {
  plans: Record<string, LuyaDailyPlan>;
  events: LuyaLifeEvent[];
  internshipStage: LuyaInternshipStage;
  lastAdvancedAt: number;
}
export type LuyaEvidenceKind = 'meaningful_interaction' | 'boundary_respected' | 'habit_honored' | 'room_participation' | 'shared_event' | 'repair' | 'quiet_company' | 'identity_confirmed' | 'boundary_violation';
export interface LuyaRelationshipEvidence {
  id: string;
  kind: LuyaEvidenceKind;
  summary: string;
  timestamp: number;
  sourceIds: string[];
  confirmed: boolean;
}
export interface LuyaRelationshipState {
  stage: LuyaRelationshipStage;
  evidence: LuyaRelationshipEvidence[];
  stageHistory: { stage: LuyaRelationshipStage; timestamp: number; evidenceIds: string[] }[];
  route: 'open' | 'friends';
  trustAdjustment: 'steady' | 'careful' | 'distance';
}
export interface LuyaRoomItem {
  id: string;
  name: string;
  owner: 'luya' | 'user' | 'shared';
  zone: 'luya_private' | 'user_private' | 'shared';
  sourceType: 'default_luya' | 'luya_life_event' | 'user_added' | 'shared_event';
  sourceEventIds: string[];
  editableBy: 'luya' | 'user' | 'both';
  requiresConsultation: boolean;
  important: boolean;
  createdAt: number;
  updatedAt: number;
}
export interface LuyaRoomChange {
  id: string;
  timestamp: number;
  actor: 'user' | 'luya';
  description: string;
  sourceIds: string[];
}
export interface LuyaRoomState {
  wallColor: 'cream' | 'blue' | 'sage';
  light: 'warm' | 'bright';
  items: LuyaRoomItem[];
  changes: LuyaRoomChange[];
  consultations: { id: string; itemId: string; action: 'move' | 'remove'; status: 'pending' | 'agreed' | 'declined'; sourceIds: string[]; createdAt: number }[];
}
export interface LuyaBoundaries {
  nicknames: 'ask_first' | 'allowed' | 'declined';
  imaginedTouch: 'ask_first' | 'allowed' | 'declined';
  careActions: 'ask_first' | 'allowed' | 'declined';
  advice: 'ask_first' | 'allowed' | 'declined';
  quietUntilNextUserTurn: boolean;
  sources: { key: string; sourceMessageId: string; timestamp: number; value: string }[];
}
export interface LuyaRuntime {
  schemaVersion: 1;
  life: LuyaLifeState;
  relationship: LuyaRelationshipState;
  room: LuyaRoomState;
  boundaries: LuyaBoundaries;
  understandings: UserUnderstanding[];
  understandingObservations: UnderstandingObservation[];
  createdAt: number;
  updatedAt: number;
}
