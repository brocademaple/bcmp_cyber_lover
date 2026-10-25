import type { LuyaRoomItem, LuyaRoomState, LuyaRuntime } from '../types/luya';
import { recordLuyaRelationshipEvidence } from './luyaRelationshipService';

export const ROOM_SOURCE_LABELS: Record<LuyaRoomItem['sourceType'], string> = { default_luya: '鹿芽原有物品', luya_life_event: '鹿芽生活记录', user_added: '用户添加', shared_event: '共同经历' };
export function createLuyaRoom(now: number): LuyaRoomState {
  return { wallColor: 'cream', light: 'warm', changes: [], consultations: [], items: [
    { id: 'luya_original_books', name: '鹿芽的书与未写完的笔记', owner: 'luya', zone: 'luya_private', sourceType: 'default_luya', sourceEventIds: [], editableBy: 'luya', requiresConsultation: true, important: true, createdAt: now, updatedAt: now },
    { id: 'luya_original_lamp', name: '公共区的暖光灯', owner: 'luya', zone: 'shared', sourceType: 'default_luya', sourceEventIds: [], editableBy: 'both', requiresConsultation: false, important: false, createdAt: now, updatedAt: now },
  ] };
}
export type RoomOperation = { type: 'decorate'; wallColor?: LuyaRoomState['wallColor']; light?: LuyaRoomState['light'] }
  | { type: 'add'; name: string; zone: LuyaRoomItem['zone']; sharedEventId?: string }
  | { type: 'remove'; itemId: string; confirmed?: boolean; consultationId?: string }
  | { type: 'move'; itemId: string; zone: LuyaRoomItem['zone']; consultationId?: string }
  | { type: 'consult'; itemId: string; action: 'move' | 'remove' };
export interface RoomOperationResult { runtime: LuyaRuntime; ok: boolean; message: string; needsConfirmation?: boolean; needsConsultation?: boolean }
export function applyLuyaRoomOperation(runtime: LuyaRuntime, operation: RoomOperation, now: number): RoomOperationResult {
  const room: LuyaRoomState = { ...runtime.room, items: [...runtime.room.items], changes: [...runtime.room.changes], consultations: [...runtime.room.consultations] };
  if (now < runtime.updatedAt) return { runtime, ok: false, message: '调试时间早于最近记录，请先恢复时间。' };
  const id = `room_${now}_${room.changes.length}`;
  const requireConsultation = (item: LuyaRoomItem, action: 'move' | 'remove'): RoomOperationResult => {
    const pending = room.consultations.find(c => c.itemId === item.id && c.action === action && c.status === 'pending');
    if (!pending) return { runtime, ok: false, needsConsultation: true, message: '这是私人区域或需要共同商量的物品，先商量再调整。' };
    const evidenceId = `boundary_attempt_${item.id}_${action}_${now}`;
    const relationship = recordLuyaRelationshipEvidence(runtime.relationship, { id: evidenceId, kind: 'boundary_violation', summary: `已提出商量、尚未同意时再次尝试${action === 'move' ? '移动' : '收起'}「${item.name}」`, timestamp: now, sourceIds: [pending.id, evidenceId], confirmed: true });
    return { runtime: { ...runtime, relationship, updatedAt: now }, ok: false, needsConsultation: true, message: '这件事还没有商量好。请先尊重已经说清的区域边界，物品会留在原处。' };
  };
  let message = ''; let description = '';
  if (operation.type === 'decorate') {
    room.wallColor = operation.wallColor ?? room.wallColor;
    room.light = operation.light ?? room.light;
    description = `${operation.wallColor ? `线上墙面改为${({ cream: '奶油白', blue: '深蓝', sage: '鼠尾草绿' })[operation.wallColor]}` : ''}${operation.light ? ` ${operation.light === 'bright' ? '选择明亮主灯' : '选择柔和暖灯'}` : ''}`.trim();
    message = operation.light === 'bright' ? '鹿芽：这盏主灯有点刺眼，我看书久了会累。要不要换成暖灯，再单独补一盏阅读灯？' : '鹿芽：这次布置我觉得能安静坐一会儿。墙色只改在线上房间。';
  } else if (operation.type === 'add') {
    if (!operation.name.trim()) return { runtime, ok: false, message: '给物品起一个名字。' };
    if (operation.zone === 'luya_private') return { runtime, ok: false, needsConsultation: true, message: '鹿芽的私人角落需要先商量，可以先放在公共区。' };
    const source = operation.sharedEventId ? runtime.relationship.evidence.find(e => e.id === operation.sharedEventId && e.confirmed && e.kind === 'shared_event' && e.timestamp <= now && e.sourceIds.length) : undefined;
    if (operation.sharedEventId && !source) return { runtime, ok: false, message: '共享纪念物需要一条已有来源的共同经历，不能用展示内容代替。' };
    if (operation.zone === 'user_private' && !['trusted_companion', 'roommate_like', 'roommates'].includes(runtime.relationship.stage)) return { runtime, ok: false, message: '先在公共区留下东西。彼此信任之后，会逐渐有你的固定角落。' };
    room.items.push({ id, name: operation.name.trim().slice(0, 60), owner: source ? 'shared' : 'user', zone: operation.zone, sourceType: source ? 'shared_event' : 'user_added', sourceEventIds: source ? [source.id] : [id], editableBy: 'both', requiresConsultation: Boolean(source), important: Boolean(source), createdAt: now, updatedAt: now });
    description = `用户在${operation.zone === 'shared' ? '公共区' : '自己的角落'}添加「${operation.name.trim().slice(0, 60)}」`; message = source ? '纪念物已保存，并保留共同经历来源。' : '物品已放好，来源标记为用户添加。';
  } else {
    const item = room.items.find(i => i.id === operation.itemId);
    if (!item) return { runtime, ok: false, message: '这件物品已不在房间里。' };
    if (operation.type === 'consult') {
      if (room.consultations.some(c => c.itemId === item.id && c.action === operation.action && c.status === 'pending')) return { runtime, ok: false, message: '这件事已经留在待商量区，等聊过之后再决定。' };
      room.consultations.push({ id, itemId: item.id, action: operation.action, status: 'pending', sourceIds: [id], createdAt: now });
      description = `用户提出商量${operation.action === 'remove' ? '收起' : '移动'}「${item.name}」`; message = '已经记下商量事项。先聊聊为什么想改，再由双方确认。';
    } else {
      const consent = operation.consultationId && room.consultations.find(c => c.id === operation.consultationId && c.itemId === item.id && c.action === operation.type && c.status === 'agreed' && c.sourceIds.length >= 2);
      if ((item.zone === 'luya_private' || item.editableBy === 'luya' || (operation.type === 'move' && item.requiresConsultation)) && !consent) return requireConsultation(item, operation.type);
      if (operation.type === 'remove') {
        if (item.important && !operation.confirmed) return { runtime, ok: false, needsConfirmation: true, message: '这是重要纪念物。确认只将它从房间收起？原共同经历会保留。' };
        room.items = room.items.filter(i => i.id !== item.id);
        description = `收起「${item.name}」，原来源记录保留`; message = '物品已收起，原共同经历仍然保留。';
      } else {
        if (operation.zone === 'luya_private' && !consent) return requireConsultation(item, 'move');
        if (operation.zone === 'user_private' && !['trusted_companion', 'roommate_like', 'roommates'].includes(runtime.relationship.stage)) return { runtime, ok: false, message: '你的固定角落会随着彼此信任逐渐开放。' };
        room.items = room.items.map(i => i.id === item.id ? { ...i, zone: operation.zone, updatedAt: now } : i);
        description = `移动「${item.name}」`; message = '物品已移动。';
      }
    }
  }
  room.changes.push({ id, timestamp: now, actor: 'user', description, sourceIds: [id] });
  const relationship = recordLuyaRelationshipEvidence(runtime.relationship, { id, kind: 'room_participation', summary: description, timestamp: now, sourceIds: [id], confirmed: true });
  return { runtime: { ...runtime, room, relationship, updatedAt: now }, ok: true, message };
}
/** Consent must reference both actual dialogue messages; a request alone cannot grant permission. */
export function resolveRoomConsultation(runtime: LuyaRuntime, consultationId: string, agreed: boolean, sourceIds: string[], now: number): LuyaRuntime {
  if (new Set(sourceIds).size < 2) return runtime;
  return { ...runtime, updatedAt: Math.max(runtime.updatedAt, now), room: { ...runtime.room, consultations: runtime.room.consultations.map(c => c.id === consultationId && c.status === 'pending' ? { ...c, status: agreed ? 'agreed' : 'declined', sourceIds: [...new Set([...c.sourceIds, ...sourceIds])] } : c) } };
}

/** A visible, explicit review step ties a keepsake to existing user AND assistant messages. */
export function confirmLuyaSharedEvent(runtime: LuyaRuntime, messages: { id: string; role: string; timestamp: number; content: string }[], sourceIds: string[], summary: string, now: number): LuyaRuntime {
  const source = messages.filter(m => sourceIds.includes(m.id) && m.timestamp <= now && m.content.trim());
  if (!summary.trim() || !source.some(m => m.role === 'user') || !source.some(m => m.role === 'assistant') || source.length !== new Set(sourceIds).size) return runtime;
  const canonical = [...new Set(sourceIds)].sort();
  const id = `shared_${canonical.join('_')}`;
  const relationship = recordLuyaRelationshipEvidence(runtime.relationship, { id, kind: 'shared_event', summary: summary.trim().slice(0, 200), timestamp: now, sourceIds: canonical, confirmed: true });
  return { ...runtime, relationship, updatedAt: now };
}

/** Only actual dialogue can resolve a pending consultation; the request button never self-authorizes it. */
export function resolveLuyaRoomFromDialogue(runtime: LuyaRuntime, userMessage: { id: string; content: string; timestamp: number; role: string }, assistantMessage: { id: string; content: string; timestamp: number; role: string }): LuyaRuntime {
  if (userMessage.role !== 'user' || assistantMessage.role !== 'assistant' || assistantMessage.timestamp < userMessage.timestamp) return runtime;
  let result = runtime;
  for (const c of runtime.room.consultations.filter(c => c.status === 'pending' && c.createdAt <= userMessage.timestamp)) {
    const item = runtime.room.items.find(i => i.id === c.itemId);
    if (!item || !userMessage.content.includes(item.name)) continue;
    const action = c.action === 'remove' ? /(收起|删除|拿走)/ : /(移动|挪|搬)/;
    if (!action.test(userMessage.content) || !assistantMessage.content.includes(item.name)) continue;
    // Negation or conditional language wins, so "not yet" and "if..." cannot grant permission.
    const refusal = /(不同意|不可以|不能|先别|不想|不愿意|暂时不|先不|如果|等.*再|还没|商量后|不要|别动|不行|不答应|不过|但是|再说)/.test(assistantMessage.content);
    const agreed = !refusal && /(我同意|可以[把将挪移收]|愿意[把将]|就这样[挪移收]|没问题)/.test(assistantMessage.content);
    if (agreed || refusal) result = resolveRoomConsultation(result, c.id, agreed, [userMessage.id, assistantMessage.id], assistantMessage.timestamp);
  }
  return result;
}
