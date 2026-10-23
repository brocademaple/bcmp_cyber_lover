import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useChatStore } from '../store/chatStore';
import { useSettingsStore } from '../store/settingsStore';
import { useThemeColors } from '../utils/theme';
import LuyaUnderstandingCard from '../components/LuyaUnderstandingCard';
import { decideUnderstanding, UnderstandingDecision } from '../services/luyaUnderstandingService';
import type { UserUnderstanding } from '../types/luyaUnderstanding';

const GROUPS: { key: string; label: string; statuses: UserUnderstanding['status'][]; empty: string }[] = [
  { key: 'confirmed', label: '已确认', statuses: ['confirmed'], empty: '还没有需要长期保留的相处习惯。' },
  { key: 'pending', label: '待确认', statuses: ['pending_confirmation', 'low_confidence'], empty: '目前没有需要确认的理解，不用为了填满这里而聊天。' },
  { key: 'archived', label: '已归档', statuses: ['archived'], empty: '没有归档内容。' },
  { key: 'revoked', label: '已撤销', statuses: ['revoked'], empty: '没有撤销内容。' },
];
const affectLabels = { reply_style: '相关话题的回复方式', proactive_style: '主动互动的节奏', room_interaction: '线上房间里的互动方式' };
const dateText = (timestamp: number) => new Date(timestamp).toLocaleString('zh-CN', { hour12: false });

export default function LuyaUnderstandingScreen({ navigation }: { navigation: { goBack: () => void } }) {
  const C = useThemeColors();
  const runtime = useChatStore(s => s.characters.find(c => c.id === 'qingning')?.luyaRuntime);
  const messages = useChatStore(s => s.messages.qingning);
  const debugNow = useSettingsStore(s => s.settings.advanced.debugNowTs);
  const [selected, setSelected] = useState<string>();
  const [error, setError] = useState('');
  useEffect(() => {
    void useChatStore.getState().ensureLuyaRuntime(debugNow ?? Date.now()).catch(() => setError('理解记录暂时未能读取，请稍后重试。'));
    void useChatStore.getState().loadMessages('qingning').catch(() => setError('来源对话暂时未能读取，原文摘录仍可查看。'));
  }, [debugNow]);
  const decide = async (id: string, decision: UnderstandingDecision, editedText?: string) => {
    const now = debugNow ?? Date.now();
    await useChatStore.getState().updateLuyaRuntime(current => ({ ...current, understandings: decideUnderstanding(current.understandings, id, decision, now, editedText) }));
  };
  const items = runtime?.understandings.filter(item => !item.deletedAt) ?? [];
  const detail = items.find(item => item.id === selected);
  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.page, { backgroundColor: C.background }]}>
      <View style={styles.header}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="返回" onPress={() => detail ? setSelected(undefined) : navigation.goBack()} style={styles.back}><Text style={{ color: C.text, fontSize: 23 }}>‹</Text></TouchableOpacity>
        <Text style={[styles.title, { color: C.text }]}>{detail ? '这条理解怎样变化' : '鹿芽怎样理解我'}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.intro, { color: C.textSecondary }]}>这里只记录你们的相处与沟通方式。你可以随时修改或撤销，你当下说的话始终更重要。</Text>
        {error ? <Text accessibilityRole="alert" style={{ color: C.danger }}>{error}</Text> : null}
        {detail ? <>
          <LuyaUnderstandingCard key={detail.id} item={detail} onDecision={decide} />
          <View style={[styles.panel, { backgroundColor: C.surface }]}>
            <Text style={[styles.heading, { color: C.text }]}>当前影响范围</Text>
            <Text style={[styles.body, { color: C.textSecondary }]}>{detail.status === 'confirmed' ? detail.affects.map(a => affectLabels[a]).join('、') : '尚未生效，或已停止影响互动。'}</Text>
            <Text style={[styles.body, { color: C.textSecondary }]}>不获得外部操作权限，不替你决定，也不推断敏感身份。</Text>
            <Text style={[styles.heading, { color: C.text }]}>来源对话</Text>
            {detail.sourceMessageIds.map(id => {
              const message = messages?.find(item => item.id === id);
              const saved = [...detail.supportEvidence, ...detail.counterEvidence].find(item => item.messageId === id);
              return <View key={id} style={styles.evidence}><Text selectable style={[styles.body, { color: C.text }]}>{message?.content ?? saved?.summary ?? '原文暂未载入；来源标识仍保留。'}</Text><Text selectable style={[styles.meta, { color: C.textSecondary }]}>{saved ? dateText(saved.timestamp) : ''} · {id}</Text></View>;
            })}
            {detail.naturalQuestionMessageId && <>
              <Text style={[styles.heading, { color: C.text }]}>当时怎样确认</Text>
              <Text selectable style={[styles.body, { color: C.textSecondary }]}>{messages?.find(message => message.id === detail.naturalQuestionMessageId)?.content ?? '自然确认已经发生；该轮对话暂未加载。'}</Text>
              <Text selectable style={[styles.meta, { color: C.textSecondary }]}>{detail.naturalQuestionAt !== undefined ? dateText(detail.naturalQuestionAt) : ''} · {detail.naturalQuestionMessageId}</Text>
            </>}
            <Text style={[styles.heading, { color: C.text }]}>支持线索 · {detail.supportEvidence.length}</Text>
            {detail.supportEvidence.map(e => <Text key={e.messageId} style={[styles.body, { color: C.textSecondary }]}>{dateText(e.timestamp)} · {e.summary}</Text>)}
            <Text style={[styles.heading, { color: C.text }]}>反证 · {detail.counterEvidence.length}</Text>
            {detail.counterEvidence.length ? detail.counterEvidence.map(e => <Text key={e.messageId} style={[styles.body, { color: C.textSecondary }]}>{dateText(e.timestamp)} · {e.summary}</Text>) : <Text style={[styles.body, { color: C.textSecondary }]}>还没有记录到相反线索。</Text>}
            <Text style={[styles.heading, { color: C.text }]}>其他可能</Text>
            {detail.alternatives.map(text => <Text key={text} style={[styles.body, { color: C.textSecondary }]}>{text}</Text>)}
            <Text style={[styles.heading, { color: C.text }]}>历史版本</Text>
            <Text style={[styles.body, { color: C.text }]}>当前 v{detail.version} · {detail.statement}</Text>
            {[...detail.versionHistory].reverse().map(version => <View key={version.version} style={styles.evidence}><Text style={[styles.body, { color: C.text }]}>v{version.version} · {version.statement}</Text><Text style={[styles.meta, { color: C.textSecondary }]}>{dateText(version.changedAt)} · {version.reason}</Text></View>)}
            <TouchableOpacity accessibilityRole="button" onPress={() => void decide(detail.id, 'delete').then(() => setSelected(undefined)).catch(() => setError('删除未完成，请重试。'))} style={styles.delete}><Text style={{ color: C.danger }}>删除这条理解</Text></TouchableOpacity>
            <Text style={[styles.meta, { color: C.textSecondary }]}>删除仅移除这条理解。原聊天和共同经历仍然保留；同一候选不会重新弹出。</Text>
          </View>
        </> : <>
          {GROUPS.map(group => {
            const entries = items.filter(item => group.statuses.includes(item.status));
            return <View key={group.key} style={styles.group}><Text style={[styles.heading, { color: C.text }]}>{group.label} · {entries.length}</Text>{entries.length ? entries.map(item => <LuyaUnderstandingCard key={item.id} item={item} onDecision={decide} onDetails={() => setSelected(item.id)} />) : <Text style={[styles.empty, { color: C.textSecondary }]}>{group.empty}</Text>}</View>;
          })}
          {!!runtime?.understandingObservations.length && <View style={[styles.panel, { backgroundColor: C.surface }]}><Text style={[styles.heading, { color: C.text }]}>只是分享过的内容</Text><Text style={[styles.body, { color: C.textSecondary }]}>分享没有自动变成兴趣、立场或你的经历。</Text>{runtime.understandingObservations.slice(-8).map(observation => <View key={observation.id} style={styles.evidence}><Text style={[styles.body, { color: C.text }]}>{observation.sharedContent}</Text><Text style={[styles.meta, { color: C.textSecondary }]}>{dateText(observation.timestamp)} · {observation.hypothesis}</Text>{observation.alternatives.map(text => <Text key={text} style={[styles.meta, { color: C.textSecondary }]}>{text}</Text>)}</View>)}</View>}
        </>}
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  page: { flex: 1 }, header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8 },
  back: { padding: 10, minWidth: 44, minHeight: 44 }, title: { fontSize: 20, fontWeight: '600', flex: 1 },
  content: { padding: 20, paddingTop: 8, paddingBottom: 48, width: '100%', maxWidth: 760, alignSelf: 'center' },
  intro: { fontSize: 14, lineHeight: 23, marginBottom: 18 }, group: { marginBottom: 18 },
  heading: { fontSize: 16, fontWeight: '600', marginTop: 16, marginBottom: 8 }, empty: { fontSize: 14, lineHeight: 23, paddingVertical: 12 },
  body: { fontSize: 14, lineHeight: 23, marginBottom: 6 }, meta: { fontSize: 12, lineHeight: 20 },
  panel: { borderRadius: 18, padding: 18, marginVertical: 8 }, evidence: { marginVertical: 9 }, delete: { paddingVertical: 16, minHeight: 44, marginTop: 18 },
});
