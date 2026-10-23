import { RelationshipEvent, RelationshipStage } from '../types';

const STAGE_ORDER: RelationshipStage[] = ['firstMeeting', 'familiar', 'trusted', 'sharedRoutine'];

export const RELATIONSHIP_STAGE_LABELS: Record<RelationshipStage, string> = {
  firstMeeting: '初次相识',
  familiar: '逐渐熟悉',
  trusted: '彼此信任',
  sharedRoutine: '共同日常',
};

export function deriveRelationshipStage(intimacy: number): RelationshipStage {
  if (intimacy >= 85) return 'sharedRoutine';
  if (intimacy >= 70) return 'trusted';
  if (intimacy >= 55) return 'familiar';
  return 'firstMeeting';
}
export function didRelationshipStageAdvance(
  previous: RelationshipStage | undefined,
  next: RelationshipStage
): boolean {
  const previousIndex = STAGE_ORDER.indexOf(previous ?? 'firstMeeting');
  const nextIndex = STAGE_ORDER.indexOf(next);
  return nextIndex > previousIndex;
}

export function createRelationshipStageEvent(
  stage: RelationshipStage,
  timestamp: number,
  sourceMessageIds: string[] = []
): RelationshipEvent {
  return {
    id: `relationship_stage_${stage}_${timestamp}`,
    type: 'chapter',
    title: `关系进入「${RELATIONSHIP_STAGE_LABELS[stage]}」`,
    detail: '这次变化来自持续互动与被确认的共同经历。',
    timestamp,
    sourceMessageIds,
    verified: true,
  };
}
