import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { UserUnderstanding } from '../types/luyaUnderstanding';
import type { UnderstandingDecision } from '../services/luyaUnderstandingService';
import { useThemeColors } from '../utils/theme';

interface Props {
  item: UserUnderstanding;
  onDecision: (id: string, decision: UnderstandingDecision, editedText?: string) => void | Promise<void>;
  onDetails?: () => void;
}

export default function LuyaUnderstandingCard({ item, onDecision, onDetails }: Props) {
  const C = useThemeColors();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(item.statement);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const decide = async (decision: UnderstandingDecision) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try { await onDecision(item.id, decision, decision === 'edit' ? text : undefined); setEditing(false); }
    catch { setError('保存没有完成，请重试。'); }
    finally { setBusy(false); }
  };
  const statusLabel = { confirmed: '你确认过的相处习惯', pending_confirmation: '待确认 · 一条可以改写的理解', low_confidence: '待确认 · 还在观察', archived: '已归档 · 不再影响互动', revoked: '已撤销 · 不再影响互动' }[item.status];
  const inactive = item.status === 'archived' || item.status === 'revoked';
  const canConfirm = item.status === 'pending_confirmation' && item.naturalQuestionAt !== undefined && item.topicEndedAt !== undefined;
  return (
    <View style={[styles.card, { backgroundColor: C.surface, borderColor: C.border }]}>
      <Text style={[styles.eyebrow, { color: C.textSecondary }]}>{statusLabel}</Text>
      {editing ? <TextInput accessibilityLabel="修改这条理解" multiline value={text} onChangeText={setText} style={[styles.input, { color: C.text, borderColor: C.border }]} /> : <Text style={[styles.statement, { color: C.text }]}>{item.statement}</Text>}
      <Text style={[styles.note, { color: C.textSecondary }]}>{item.status === 'confirmed' ? '只在相关情境使用，你当下的需要始终优先。' : inactive ? '这条理解已停止影响互动，原聊天仍然保留。' : '尚未用于长期相处，你也可以不保留。'}</Text>
      {!editing && !canConfirm && item.status !== 'confirmed' && !inactive && <Text style={[styles.note, { color: C.textSecondary }]}>先在聊天里聊清楚，话题结束后再决定是否保留。</Text>}
      <View style={styles.actions}>
        {editing ? <>
          <TouchableOpacity disabled={busy || !text.trim()} accessibilityRole="button" onPress={() => void decide('edit')} style={styles.button}><Text style={{ color: C.primary }}>保存我的修正版</Text></TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" onPress={() => setEditing(false)} style={styles.button}><Text style={{ color: C.textSecondary }}>取消</Text></TouchableOpacity>
        </> : <>
          {canConfirm && <TouchableOpacity disabled={busy} accessibilityRole="button" onPress={() => void decide('confirm')} style={styles.button}><Text style={{ color: C.primary }}>准确</Text></TouchableOpacity>}
          <TouchableOpacity disabled={busy} accessibilityRole="button" onPress={() => setEditing(true)} style={styles.button}><Text style={{ color: C.primary }}>改一下</Text></TouchableOpacity>
          {!inactive && <TouchableOpacity disabled={busy} accessibilityRole="button" onPress={() => void decide(item.status === 'confirmed' ? 'revoke' : 'reject')} style={styles.button}><Text style={{ color: C.textSecondary }}>{item.status === 'confirmed' ? '撤销' : '这次不要记'}</Text></TouchableOpacity>}
          {onDetails && <TouchableOpacity accessibilityRole="button" onPress={onDetails} style={styles.button}><Text style={{ color: C.textSecondary }}>来源与变化 ›</Text></TouchableOpacity>}
        </>}
      </View>
      {error ? <Text accessibilityRole="alert" style={{ color: C.danger }}>{error}</Text> : null}
    </View>
  );
}
const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 18, padding: 18, marginVertical: 8 },
  eyebrow: { fontSize: 12, marginBottom: 9 }, statement: { fontSize: 16, lineHeight: 25 },
  note: { fontSize: 12, lineHeight: 19, marginTop: 8 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 10 },
  button: { paddingVertical: 12, paddingHorizontal: 8, minHeight: 44 },
  input: { minHeight: 95, borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 16, lineHeight: 24, textAlignVertical: 'top' },
});
