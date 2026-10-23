import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { useChatStore } from '../store/chatStore';
import { useSettingsStore } from '../store/settingsStore';
import { useThemeColors } from '../utils/theme';
import { confirmLuyaInternshipFromDialogue, getLuyaLifeProjection, LUYA_INTERNSHIP_LABELS } from '../services/luyaLifeService';
import { LUYA_RELATIONSHIP_LABELS } from '../services/luyaRelationshipService';
import { applyLuyaRoomOperation, confirmLuyaSharedEvent, ROOM_SOURCE_LABELS, type RoomOperation, type RoomOperationResult } from '../services/luyaRoomService';
import type { LuyaInternshipStage, LuyaRoomItem, LuyaRoomState } from '../types/luya';
import LuyaRoomScene, { ROOM_WALL_NAMES, ROOM_WALLS, ROOM_ZONES, RoomOrnament, type RoomOrnamentKind } from '../components/LuyaRoomScene';
import ExperienceSheet from '../components/ExperienceSheet';
import { LUYA_ART } from '../utils/luyaArt';

const stages: LuyaInternshipStage[] = ['preparing', 'exploring_roles', 'applying', 'interviewing', 'offer_decision', 'pre_onboarding', 'onboarded'];
const PRESETS: { kind: RoomOrnamentKind; name: string }[] = [{ kind: 'plant', name: '一盆绿植' }, { kind: 'books', name: '我的书与笔记' }, { kind: 'lamp', name: '小阅读灯' }, { kind: 'frame', name: '小相框' }];
type Sheet = 'decorate' | 'add' | 'items' | 'item' | 'records' | 'sources' | null;
type Navigation = { goBack: () => void; navigate: (name: 'Chat', params: { characterId: string; roomContext?: { itemName: string; action: 'move' | 'remove' } }) => void };
export default function LuyaRoomScreen({ navigation }: { navigation: Navigation }) {
  const C = useThemeColors();
  const character = useChatStore(s => s.characters.find(c => c.id === 'qingning'));
  const runtime = character?.luyaRuntime;
  const messages = useChatStore(s => s.messages.qingning ?? []);
  const ensure = useChatStore(s => s.ensureLuyaRuntime);
  const update = useChatStore(s => s.updateLuyaRuntime);
  const loadMessages = useChatStore(s => s.loadMessages);
  const settings = useSettingsStore(s => s.settings);
  const now = useCallback(() => settings.advanced.debugNowTs ?? Date.now(), [settings.advanced.debugNowTs]);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [notice, setNotice] = useState('');
  const [toast, setToast] = useState('');
  const [loadingError, setLoadingError] = useState('');
  const [sourceError, setSourceError] = useState('');
  const [name, setName] = useState('');
  const [zone, setZone] = useState<LuyaRoomItem['zone']>('shared');
  const [itemZone, setItemZone] = useState<LuyaRoomItem['zone']>('shared');
  const [selectedItemId, setSelectedItemId] = useState<string>();
  const [confirmation, setConfirmation] = useState<RoomOperation>();
  const [decoration, setDecoration] = useState<Pick<LuyaRoomState, 'wallColor' | 'light'>>({ wallColor: 'cream', light: 'warm' });
  const [sourceIds, setSourceIds] = useState<string[]>([]);
  const [summary, setSummary] = useState('');
  const [selectedShared, setSelectedShared] = useState<string>();
  const [memorial, setMemorial] = useState(false);
  const [search, setSearch] = useState('');
  const [sourceLimit, setSourceLimit] = useState(40);
  const [saving, setSaving] = useState(false);
  const [screenNow, setScreenNow] = useState(() => Date.now());
  const viewNow = settings.advanced.debugNowTs ?? screenNow;
  const load = useCallback(async () => {
    setLoadingError('');
    setScreenNow(Date.now());
    try {
      if (!useChatStore.getState().charactersLoaded) await useChatStore.getState().loadCharacters();
      await ensure(settings.advanced.debugNowTs ?? Date.now());
      if (!useChatStore.getState().characters.find(c => c.id === 'qingning')?.luyaRuntime) setLoadingError('没有找到鹿芽的生活记录。现有存档未改动，请返回检查角色或重试。');
    } catch { setLoadingError('共同房间暂时无法读取，现有存档仍然保留。'); }
    try { await loadMessages('qingning'); setSourceError(''); } catch { setSourceError('来源对话暂时无法读取，请重试。'); }
    setScreenNow(Date.now());
  }, [ensure, loadMessages, settings.advanced.debugNowTs]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 3500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    const timer = setInterval(() => setScreenNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  const open = (target: Sheet) => { setScreenNow(Date.now()); setNotice(''); setConfirmation(undefined); setSheet(target); };
  const close = () => { if (!saving) { setSheet(null); setNotice(''); setConfirmation(undefined); } };
  const button = (label: string, onPress: () => void, selected = false, disabled = false) => <TouchableOpacity accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected, disabled: disabled || saving }} disabled={disabled || saving} onPress={onPress} style={[styles.button, { borderColor: selected ? C.primary : C.border, backgroundColor: selected ? C.primary : C.surface, opacity: disabled || saving ? 0.5 : 1 }]}><Text style={{ color: selected ? '#fff' : C.text, fontSize: 14, lineHeight: 21 }}>{label}</Text></TouchableOpacity>;
  const run = async (operation: RoomOperation): Promise<boolean> => {
    if (!runtime || saving) return false;
    setSaving(true); setNotice('');
    let result: RoomOperationResult | undefined;
    try {
      await update(r => { result = applyLuyaRoomOperation(r, operation, now()); return result.runtime; });
      if (!result) { setNotice('没有找到房间记录，请返回重试。'); return false; }
      const outcome = result as RoomOperationResult;
      if (outcome.needsConfirmation) setConfirmation(operation);
      if (!outcome.ok) { setNotice(outcome.message); return false; }
      setConfirmation(undefined);
      setToast(operation.type === 'decorate' ? '布置已保存' : operation.type === 'add' ? '物品已放进房间' : operation.type === 'remove' ? '物品已收起，原记录保留' : outcome.message);
      return true;
    } catch { setNotice('保存没有完成。草稿已保留，请重试。'); return false; }
    finally { setScreenNow(Date.now()); setSaving(false); }
  };
  const confirmShared = async (story = false) => {
    if (saving) return;
    setSaving(true); setNotice('');
    let changed = false; let message = '';
    try {
      await update(r => {
        if (now() < r.updatedAt) { message = '调试时间早于最近记录，请恢复时间后再确认。'; return r; }
        if (story) { const result = confirmLuyaInternshipFromDialogue(r, useChatStore.getState().messages.qingning ?? [], sourceIds, summary, now()); message = result.message; changed = result.runtime !== r; return result.runtime; }
        const next = confirmLuyaSharedEvent(r, useChatStore.getState().messages.qingning ?? [], sourceIds, summary, now()); changed = next !== r; return next;
      });
      if (changed) { setToast(story ? message : '共同记录已保存，原对话保留'); setSheet('records'); setSummary(''); setSourceIds([]); }
      else setNotice(message || '请填写摘要，并选中真实的一条你的消息和一条鹿芽回复。');
    } catch { setNotice('记录保存没有完成。摘要和选择已保留，请重试。'); }
    finally { setScreenNow(Date.now()); setSaving(false); }
  };
  const openItem = (item: LuyaRoomItem) => { setSelectedItemId(item.id); open('item'); };
  const goChat = (item: LuyaRoomItem, action: 'move' | 'remove') => { close(); navigation.navigate('Chat', { characterId: 'qingning', roomContext: { itemName: item.name, action } }); };
  if (!runtime || loadingError) return <SafeAreaView style={[styles.loading, { backgroundColor: C.background }]}><Text style={[styles.heading, { color: C.text }]}>共同房间</Text>{!loadingError && <ActivityIndicator color={C.primary} />}<Text style={[styles.body, { color: C.text }]}>{loadingError || '正在打开共同房间…'}</Text><View style={styles.wrap}>{button('返回', navigation.goBack)}{loadingError && button('重试读取', () => void load())}</View></SafeAreaView>;
  const life = getLuyaLifeProjection(runtime.life, viewNow);
  const debugTimeReversed = settings.advanced.debugNowTs !== undefined && viewNow < runtime.updatedAt;
  const fixedCorner = ['trusted_companion', 'roommate_like', 'roommates'].includes(runtime.relationship.stage);
  const shared = runtime.relationship.evidence.filter(e => e.kind === 'shared_event' && e.confirmed).slice().sort((a, b) => b.timestamp - a.timestamp);
  const selected = runtime.room.items.find(item => item.id === selectedItemId);
  const pending = selected && runtime.room.consultations.filter(c => c.itemId === selected.id && c.status === 'pending');
  const sourceMessages = messages.filter(m => (m.role === 'user' || m.role === 'assistant') && m.timestamp <= viewNow && (!search.trim() || m.content.toLowerCase().includes(search.trim().toLowerCase()))).slice().sort((a, b) => b.timestamp - a.timestamp);
  const title = sheet === 'decorate' ? '布置公共区域' : sheet === 'add' ? memorial ? '留下一件纪念物' : '留下一件东西' : sheet === 'items' ? ROOM_ZONES[itemZone] : sheet === 'item' ? selected?.name ?? '物品详情' : sheet === 'sources' ? '核对共同记录' : '房间里的记录';
  const requestAction = async (item: LuyaRoomItem, action: 'move' | 'remove') => {
    const agreement = runtime.room.consultations.find(c => c.itemId === item.id && c.action === action && c.status === 'agreed' && c.sourceIds.length >= 2);
    const existing = runtime.room.consultations.find(c => c.itemId === item.id && c.action === action && c.status === 'pending');
    if (existing) { goChat(item, action); return; }
    const requiresConsent = item.zone === 'luya_private' || item.editableBy === 'luya' || (action === 'move' && item.requiresConsultation);
    if (requiresConsent && !agreement) { await run({ type: 'consult', itemId: item.id, action }); return; }
    const ok = await run(action === 'remove' ? { type: 'remove', itemId: item.id, consultationId: agreement?.id } : { type: 'move', itemId: item.id, zone: item.zone === 'shared' ? 'user_private' : 'shared', consultationId: agreement?.id });
    if (ok && action === 'remove') close();
  };
  return <View style={[styles.container, { backgroundColor: C.background }]}>
    <LuyaRoomScene room={sheet === 'decorate' ? { ...runtime.room, ...decoration } : runtime.room} daySource={LUYA_ART.roomDay} nightSource={LUYA_ART.roomNight} portraitDaySource={LUYA_ART.roomDayPortrait} portraitNightSource={LUYA_ART.roomNightPortrait} now={viewNow} onSelectItem={openItem} onSelectZone={z => { setItemZone(z); open('items'); }} />
    <LinearGradient pointerEvents="none" colors={['rgba(25,30,24,0.68)', 'transparent']} style={styles.topShade} />
    <SafeAreaView pointerEvents="box-none" style={styles.overlay}>
      <View style={styles.header}><TouchableOpacity accessibilityRole="button" accessibilityLabel="返回首页" onPress={navigation.goBack} style={styles.back}><Text style={styles.backText}>‹</Text></TouchableOpacity><View style={styles.headerText}><Text style={styles.roomTitle}>共同房间</Text><Text style={styles.roomSubtitle}>{LUYA_RELATIONSHIP_LABELS[runtime.relationship.stage]} · 线上空间</Text></View><View style={styles.dayBadge}><Text style={styles.dayText}>{sheet === 'decorate' ? '布置预览' : runtime.room.light === 'warm' ? '暖灯亮着' : '明亮主灯'}</Text></View></View>
      <View style={styles.bottom}><LinearGradient pointerEvents="none" colors={['transparent', 'rgba(28,34,28,0.82)']} style={StyleSheet.absoluteFill} /><Text numberOfLines={2} style={styles.lifeText}>{life.currentActivity}</Text><View style={styles.actions}>
        {([{ icon: '◒', label: '布置', press: () => { setDecoration({ wallColor: runtime.room.wallColor, light: runtime.room.light }); open('decorate'); } }, { icon: '＋', label: '添加', press: () => { setMemorial(false); setSelectedShared(undefined); open('add'); } }, { icon: '◇', label: '纪念物', press: () => { setMemorial(true); open('add'); } }, { icon: '≡', label: '记录', press: () => open('records') }]).map(action => <TouchableOpacity key={action.label} accessibilityRole="button" accessibilityLabel={action.label} onPress={action.press} style={styles.sceneAction}><Text style={styles.actionIcon}>{action.icon}</Text><Text style={styles.actionText}>{action.label}</Text></TouchableOpacity>)}
      </View></View>
    </SafeAreaView>
    {!!toast && <View pointerEvents="none" accessibilityLiveRegion="polite" style={styles.toast}><Text style={styles.toastText}>{toast}</Text></View>}
    <ExperienceSheet visible={sheet !== null} title={title} onClose={close} subtitle={sheet === 'decorate' ? '调整右侧墙面的色调和房间灯光；应用才会保存。' : undefined}>
      <View style={styles.sheetBody}>
        {saving && <View accessibilityLiveRegion="polite" style={styles.wrap}><ActivityIndicator color={C.primary} /><Text style={[styles.body, { color: C.text }]}>正在保存…</Text></View>}
        {!!notice && <View accessibilityLiveRegion="polite" style={[styles.notice, { backgroundColor: C.surface }]}><Text style={[styles.body, { color: C.text }]}>{notice}</Text></View>}
        {debugTimeReversed && <Text style={[styles.body, { color: C.textSecondary }]}>调试时间早于最近存档。当前展示已保存布置，请恢复时间后再修改。</Text>}
        {sheet === 'decorate' && <><Text style={[styles.title, { color: C.text }]}>右侧墙面色调</Text><View style={styles.wrap}>{(['cream', 'blue', 'sage'] as const).map(color => <TouchableOpacity disabled={saving} accessibilityRole="button" accessibilityLabel={ROOM_WALL_NAMES[color]} accessibilityState={{ selected: decoration.wallColor === color }} key={color} onPress={() => setDecoration(d => ({ ...d, wallColor: color }))} style={[styles.swatchCard, { borderColor: decoration.wallColor === color ? C.primary : C.border, backgroundColor: C.surface }]}><View style={[styles.swatch, { backgroundColor: ROOM_WALLS[color] }]} /><Text style={{ color: C.text }}>{ROOM_WALL_NAMES[color]}{decoration.wallColor === color ? ' ✓' : ''}</Text></TouchableOpacity>)}</View><Text style={[styles.title, { color: C.text }]}>灯光</Text><View style={styles.wrap}>{button('柔和暖灯', () => setDecoration(d => ({ ...d, light: 'warm' })), decoration.light === 'warm')}{button('明亮主灯', () => setDecoration(d => ({ ...d, light: 'bright' })), decoration.light === 'bright')}</View><Text style={[styles.body, { color: C.textSecondary }]}>{decoration.light === 'bright' ? '主灯让房间更明亮。鹿芽读书久了更喜欢柔和暖灯。' : '暖灯照着公共区域，可以安静坐一会儿。'}</Text><View style={styles.wrap}>{button('应用布置', () => void run({ type: 'decorate', ...decoration }).then(ok => { if (ok) close(); }), true)}{button('取消预览', close)}</View></>}
        {sheet === 'add' && <><Text style={[styles.body, { color: C.textSecondary }]}>{memorial ? '选择实际聊过的共同记录，给纪念物起名。来源会一起保存。' : '先选一件小物，也可以为它起自己的名字。'}</Text><View style={styles.wrap}>{PRESETS.map(preset => <TouchableOpacity key={preset.kind} disabled={saving} accessibilityRole="button" accessibilityLabel={`选择${preset.name}`} onPress={() => setName(preset.name)} style={[styles.preset, { borderColor: name === preset.name ? C.primary : C.border, backgroundColor: C.surface }]}><RoomOrnament kind={preset.kind} /><Text style={[styles.body, { color: C.text }]}>{preset.name}</Text></TouchableOpacity>)}</View><TextInput editable={!saving} accessibilityLabel="物品名称" placeholder="物品名称" placeholderTextColor={C.textSecondary} value={name} onChangeText={setName} maxLength={60} style={[styles.input, { color: C.text, borderColor: C.border }]} /><View style={styles.wrap}>{button('公共区域', () => setZone('shared'), zone === 'shared')}{button('我的角落', () => setZone('user_private'), zone === 'user_private', !fixedCorner)}</View>{!fixedCorner && <Text style={[styles.meta, { color: C.textSecondary }]}>你的固定角落会随着彼此信任逐渐开放。</Text>}{memorial && <><Text style={[styles.title, { color: C.text }]}>选择共同记录</Text>{shared.length === 0 ? <><Text style={[styles.body, { color: C.textSecondary }]}>还没有核对过的共同记录。先从双方实际对话中留下一条。</Text>{button('核对一条共同记录', () => open('sources'))}</> : shared.map(event => <View key={event.id}>{button(event.summary, () => setSelectedShared(event.id), selectedShared === event.id)}</View>)}</>}<Text style={[styles.meta, { color: C.textSecondary }]}>有限预设有对应外观；其他名称以小纪念盒呈现。已有记录和自定义名称继续保留。</Text>{button('放进房间', () => void run({ type: 'add', name, zone, sharedEventId: memorial ? selectedShared : undefined }).then(ok => { if (ok) { setName(''); close(); } }), true, !name.trim() || (memorial && !selectedShared))}</>}
        {sheet === 'items' && <>{runtime.room.items.filter(i => i.zone === itemZone).length === 0 && <Text style={[styles.body, { color: C.textSecondary }]}>这个角落还没有留下物品。</Text>}{runtime.room.items.filter(i => i.zone === itemZone).map(item => <TouchableOpacity key={item.id} accessibilityRole="button" accessibilityLabel={`查看${item.name}`} onPress={() => openItem(item)} style={[styles.listItem, { borderColor: C.border }]}><Text style={[styles.body, { color: C.text }]}>{item.name} ›</Text><Text style={[styles.meta, { color: C.textSecondary }]}>{ROOM_SOURCE_LABELS[item.sourceType]}{item.requiresConsultation ? ' · 改动前先商量' : ''}</Text></TouchableOpacity>)}</>}
        {sheet === 'item' && selected && <><Text style={[styles.body, { color: C.textSecondary }]}>{ROOM_ZONES[selected.zone]} · {ROOM_SOURCE_LABELS[selected.sourceType]}</Text><Text style={[styles.title, { color: C.text }]}>它的来处</Text>{selected.sourceEventIds.length ? selected.sourceEventIds.map(id => <Text key={id} style={[styles.body, { color: C.textSecondary }]}>{runtime.life.events.find(e => e.id === id)?.summary ?? runtime.relationship.evidence.find(e => e.id === id)?.summary ?? '由你在应用内添加'}</Text>) : <Text style={[styles.body, { color: C.textSecondary }]}>鹿芽原有的物品，保留着她自己的生活痕迹。</Text>}{pending && pending.length > 0 ? <><Text style={[styles.body, { color: C.text }]}>这件事正在等双方聊过再决定。物品会留在原处。</Text>{pending.map(c => <View key={c.id}>{button(`去聊聊${c.action === 'move' ? '移动' : '收起'}这件物品`, () => goChat(selected, c.action), true)}</View>)}</> : <View style={styles.wrap}>{button(selected.zone === 'luya_private' || selected.editableBy === 'luya' ? '商量收起' : selected.important ? '收起纪念物' : '收起', () => void requestAction(selected, 'remove'))}{(selected.zone !== 'shared' || fixedCorner) && button(selected.zone === 'shared' ? '移到我的角落' : selected.requiresConsultation ? '商量移到公共区' : '移到公共区', () => void requestAction(selected, 'move'))}</View>}{confirmation?.type === 'remove' && <View style={styles.notice}><Text style={[styles.body, { color: C.text }]}>只将这件重要物品从房间收起，原共同经历与来源继续保留。</Text><View style={styles.wrap}>{button('确认收起', () => void run({ ...confirmation, confirmed: true } as RoomOperation).then(ok => { if (ok) close(); }), true)}{button('先保留', () => setConfirmation(undefined))}</View></View>}<Text selectable style={[styles.meta, { color: C.textSecondary }]}>保存于 {new Date(selected.createdAt).toLocaleDateString()}</Text></>}
        {sheet === 'records' && <><Text style={[styles.body, { color: C.textSecondary }]}>这里的布置发生在线上；现实中，我们各自生活。</Text>{button('核对并留下共同记录', () => { setSearch(''); setSourceLimit(40); open('sources'); }, true)}<Text style={[styles.title, { color: C.text }]}>共同记录</Text>{shared.length === 0 && <Text style={[styles.body, { color: C.textSecondary }]}>还没有核对过的共同经历，慢慢来。</Text>}{shared.map(e => <View key={e.id} style={[styles.listItem, { borderColor: C.border }]}><Text style={[styles.body, { color: C.text }]}>{e.summary}</Text><Text style={[styles.meta, { color: C.textSecondary }]}>{new Date(e.timestamp).toLocaleDateString()} · {e.sourceIds.length} 条真实对话来源</Text></View>)}<Text style={[styles.title, { color: C.text }]}>商量记录</Text>{runtime.room.consultations.length === 0 && <Text style={[styles.body, { color: C.textSecondary }]}>当前没有待商量事项。</Text>}{runtime.room.consultations.slice().reverse().map(c => <Text key={c.id} style={[styles.body, { color: C.textSecondary }]}>{runtime.room.items.find(i => i.id === c.itemId)?.name ?? '已收起的物品'} · {c.action === 'move' ? '移动' : '收起'} · {({ pending: '等双方聊过再决定', agreed: '双方已同意', declined: '先保留原样' })[c.status]}</Text>)}<Text style={[styles.title, { color: C.text }]}>房间变化</Text>{runtime.room.changes.length === 0 && <Text style={[styles.body, { color: C.textSecondary }]}>这里保留着鹿芽原来的布置。</Text>}{runtime.room.changes.slice().reverse().map(change => <Text key={change.id} style={[styles.body, { color: C.textSecondary }]}>{new Date(change.timestamp).toLocaleDateString()} · {change.description}</Text>)}<Text style={[styles.title, { color: C.text }]}>各自的生活</Text><Text style={[styles.body, { color: C.textSecondary }]}>{life.currentActivity} · {LUYA_INTERNSHIP_LABELS[runtime.life.internshipStage]}</Text><Text style={[styles.title, { color: C.text }]}>关系的足迹</Text>{runtime.relationship.evidence.slice().reverse().map(e => <Text key={e.id} style={[styles.body, { color: C.textSecondary }]}>{e.summary} · {new Date(e.timestamp).toLocaleDateString()}</Text>)}</>}
        {sheet === 'sources' && <><Text style={[styles.body, { color: C.textSecondary }]}>选中双方真实对话，核对摘要。演示或想象中的外出不会自动成为现实共同经历。</Text>{!!sourceError && <View><Text style={[styles.body, { color: C.text }]}>{sourceError}</Text>{button('重试来源对话', () => void load())}</View>}<TextInput editable={!saving} accessibilityLabel="搜索来源对话" value={search} onChangeText={value => { setSearch(value); setSourceLimit(40); }} placeholder="搜索更早的对话" placeholderTextColor={C.textSecondary} style={[styles.input, { color: C.text, borderColor: C.border }]} /><Text style={[styles.meta, { color: C.textSecondary }]}>已选择 {sourceIds.length} 条 · 最新优先 · 找到 {sourceMessages.length} 条</Text>{sourceMessages.slice(0, sourceLimit).map(message => <TouchableOpacity disabled={saving} accessibilityRole="checkbox" accessibilityState={{ checked: sourceIds.includes(message.id) }} key={message.id} onPress={() => setSourceIds(ids => ids.includes(message.id) ? ids.filter(id => id !== message.id) : [...ids, message.id])} style={[styles.listItem, { borderColor: sourceIds.includes(message.id) ? C.primary : C.border, borderWidth: sourceIds.includes(message.id) ? 2 : 1 }]}><Text style={[styles.meta, { color: C.textSecondary }]}>{sourceIds.includes(message.id) ? '✓ ' : '○ '}{message.role === 'user' ? '你' : '鹿芽'} · {new Date(message.timestamp).toLocaleString()}</Text><Text style={[styles.body, { color: C.text }]}>{message.content}</Text></TouchableOpacity>)}{sourceMessages.length > sourceLimit && button('加载更早的对话', () => setSourceLimit(limit => limit + 40))}{sourceMessages.length === 0 && <Text style={[styles.body, { color: C.textSecondary }]}>{search ? '没有找到这段文字，可以换个关键词。' : '还没有可核对的双方对话。'}</Text>}<TextInput editable={!saving} accessibilityLabel="共同事件摘要" value={summary} onChangeText={setSummary} placeholder="这次实际发生了什么？" placeholderTextColor={C.textSecondary} multiline maxLength={200} style={[styles.input, { color: C.text, borderColor: C.border }]} />{button('我核对过，保存共同记录', () => void confirmShared(), true, !summary.trim() || sourceIds.length < 2)}{settings.appMode === 'admin' && <><Text style={[styles.title, { color: C.text }]}>开发者 · 确认剧情</Text><Text style={[styles.meta, { color: C.textSecondary }]}>复用选中的真实对话与摘要。保留来源，不执行外部投递或入职。</Text>{button(`确认下一阶段：${LUYA_INTERNSHIP_LABELS[stages[stages.indexOf(runtime.life.internshipStage) + 1]] ?? '已到最后阶段'}`, () => void confirmShared(true), false, runtime.life.internshipStage === 'onboarded' || debugTimeReversed)}{runtime.life.events.filter(e => e.kind === 'internship').map(e => <Text selectable key={e.id} style={[styles.meta, { color: C.textSecondary }]}>{e.summary} · {e.sourceIds.join(', ')}</Text>)}</>}</>}
      </View>
    </ExperienceSheet>
  </View>;
}
const styles = StyleSheet.create({
  container: { flex: 1 }, loading: { flex: 1, padding: 28, justifyContent: 'center', gap: 18 }, heading: { fontSize: 26, fontWeight: '600' }, overlay: { ...StyleSheet.absoluteFill, justifyContent: 'space-between' }, topShade: { position: 'absolute', top: 0, left: 0, right: 0, height: 190 }, header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingTop: 8, gap: 12 }, back: { height: 48, width: 44, borderRadius: 22, backgroundColor: '#FAF6ECE6', alignItems: 'center', justifyContent: 'center' }, backText: { fontSize: 37, color: '#3E493A', lineHeight: 40 }, headerText: { flex: 1 }, roomTitle: { color: '#FFF8ED', fontSize: 24, fontWeight: '600' }, roomSubtitle: { color: '#ECE3D3', fontSize: 12, marginTop: 5 }, dayBadge: { borderRadius: 18, padding: 10, backgroundColor: '#FBF5E9E6' }, dayText: { color: '#536048', fontSize: 12 }, bottom: { paddingHorizontal: 18, paddingTop: 28, paddingBottom: 12, gap: 13 }, lifeText: { color: '#FFF9EF', textAlign: 'center', fontSize: 14, lineHeight: 21 }, actions: { flexDirection: 'row', gap: 9 }, sceneAction: { flex: 1, height: 65, borderRadius: 18, backgroundColor: '#FAF5EBEE', borderWidth: 1, borderColor: '#FFF9EEE6', alignItems: 'center', justifyContent: 'center', gap: 3 }, actionIcon: { fontSize: 23, color: '#6E795E', lineHeight: 25 }, actionText: { color: '#3F483A', fontSize: 13, fontWeight: '600' }, toast: { position: 'absolute', top: '19%', left: 28, right: 28, borderRadius: 16, padding: 14, backgroundColor: '#293B2FEE' }, toastText: { color: '#FFF9ED', textAlign: 'center', fontSize: 14, lineHeight: 21 },
  sheetBody: { gap: 15 }, body: { fontSize: 15, lineHeight: 24 }, title: { fontSize: 17, fontWeight: '600', marginTop: 5 }, meta: { fontSize: 13, lineHeight: 21 }, button: { minHeight: 46, paddingVertical: 11, paddingHorizontal: 15, borderWidth: 1, borderRadius: 14, alignSelf: 'flex-start', justifyContent: 'center', maxWidth: '100%' }, wrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 9 }, input: { borderWidth: 1, borderRadius: 13, padding: 13, minHeight: 49, fontSize: 16 }, notice: { padding: 14, borderRadius: 13, gap: 12 }, listItem: { padding: 14, borderWidth: 1, borderRadius: 13, gap: 5 }, swatchCard: { width: '30%', flexGrow: 1, padding: 10, alignItems: 'center', gap: 9, borderWidth: 2, borderRadius: 13 }, swatch: { height: 44, width: '100%', borderRadius: 7 }, preset: { minWidth: '45%', flexGrow: 1, padding: 12, minHeight: 100, alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderRadius: 14 },
});
