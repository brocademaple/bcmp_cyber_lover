import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeColors } from '../utils/theme';

export default function LifeSettingsScreen() {
  const C = useThemeColors();
  return <SafeAreaView style={[styles.container, { backgroundColor: C.background }]}>
    <Text style={[styles.title, { color: C.text }]}>提醒已关闭</Text>
    <Text style={[styles.body, { color: C.textSecondary }]}>饮之不会发送每日通知或主动问候。你可以按自己的节奏回来聊聊。</Text>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 16 },
  title: { fontSize: 24, fontWeight: '600' },
  body: { fontSize: 15, lineHeight: 24 },
});
