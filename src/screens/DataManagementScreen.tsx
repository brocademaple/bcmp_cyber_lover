import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { format } from 'date-fns';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { RootStackParamList } from '../types';
import { useThemeColors } from '../utils/theme';
import {
  DataExportResult,
  exportAppData,
  listAppDataExports,
  restoreAppDataExport,
} from '../services/appDataPortability';
import {
  AppDiagnosticIssue,
  clearAppIssues,
  getAppIssues,
  recordAppIssue,
} from '../services/appDiagnostics';

type Props = NativeStackScreenProps<RootStackParamList, 'DataManagement'>;

function filename(uri: string): string {
  return decodeURIComponent(uri.split('/').pop() ?? uri);
}

export default function DataManagementScreen({ navigation }: Props) {
  const C = useThemeColors();
  const [exports, setExports] = useState<string[]>([]);
  const [issues, setIssues] = useState<AppDiagnosticIssue[]>([]);
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState<DataExportResult | null>(null);

  const refresh = useCallback(async () => {
    const [nextExports, nextIssues] = await Promise.all([
      listAppDataExports().catch(() => []),
      getAppIssues(),
    ]);
    setExports(nextExports);
    setIssues(nextIssues);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createBackup = async () => {
    setBusy(true);
    try {
      const result = await exportAppData();
      setLastResult(result);
      await refresh();
      Alert.alert(
        '备份完成',
        `已保存 ${result.characterCount} 个角色和 ${result.messageCount} 条消息。\n\n${filename(result.uri)}`
      );
    } catch (error) {
      await recordAppIssue('数据备份', error, true);
      Alert.alert('备份失败', error instanceof Error ? error.message : '无法创建本地备份');
    } finally {
      setBusy(false);
    }
  };

  const restoreLatest = () => {
    const latest = exports[0];
    if (!latest) {
      Alert.alert('没有可恢复的备份', '请先创建一次本地备份。');
      return;
    }
    Alert.alert(
      '恢复最近备份',
      '恢复会覆盖同名角色和设置，并写回备份中的聊天；现有数据会先自动生成一份“恢复前备份”。API Key 不会被覆盖。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确认恢复',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              const result = await restoreAppDataExport(latest);
              setLastResult(result);
              await refresh();
              Alert.alert('恢复完成', '数据已经写回本机。返回首页后重新打开相关页面即可读取。');
            } catch (error) {
              await recordAppIssue('数据恢复', error, false);
              Alert.alert('恢复失败', error instanceof Error ? error.message : '无法恢复本地备份');
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  };

  const importBackup = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/json',
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled || !result.assets[0]) return;
    const selected = result.assets[0];
    Alert.alert(
      '导入并恢复备份',
      `将校验并恢复 ${selected.name}。当前数据会先自动创建恢复前备份。`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确认恢复',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              const restored = await restoreAppDataExport(selected.uri);
              setLastResult(restored);
              await refresh();
              Alert.alert('导入完成', '备份已经通过完整性校验并写回本机。');
            } catch (error) {
              await recordAppIssue('数据导入恢复', error, false);
              Alert.alert('导入失败', error instanceof Error ? error.message : '无法读取该备份');
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  };

  const shareLatest = async () => {
    const latest = exports[0];
    if (!latest) {
      Alert.alert('没有可分享的备份', '请先创建一次本地备份。');
      return;
    }
    if (!(await Sharing.isAvailableAsync())) {
      Alert.alert('当前平台不支持分享', latest);
      return;
    }
    await Sharing.shareAsync(latest, {
      mimeType: 'application/json',
      dialogTitle: '导出心动伴侣备份',
      UTI: 'public.json',
    });
  };

  const clearDiagnostics = async () => {
    await clearAppIssues();
    await refresh();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: C.background }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={[styles.backButton, { backgroundColor: C.surface, borderColor: C.border }]}
          >
            <Text style={[styles.backText, { color: C.text }]}>‹</Text>
          </TouchableOpacity>
          <View style={styles.headerCopy}>
            <Text style={[styles.title, { color: C.text }]}>数据与恢复</Text>
            <Text style={[styles.subtitle, { color: C.textSecondary }]}>本地优先，API Key 永不进入导出文件</Text>
          </View>
        </View>

        <View style={[styles.hero, { backgroundColor: C.surface, borderColor: C.border }]}>
          <Text style={[styles.heroTitle, { color: C.text }]}>关系数据是产品资产</Text>
          <Text style={[styles.body, { color: C.textSecondary }]}>聊天、角色设定、记忆、日记和版本记录会写入备份。恢复前会再次自动备份当前状态。</Text>
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: C.primary, opacity: busy ? 0.6 : 1 }]}
              onPress={createBackup}
              disabled={busy}
            >
              <Text style={styles.primaryText}>{busy ? '处理中…' : '创建本地备份'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.secondaryButton, { backgroundColor: C.background, borderColor: C.border }]}
              onPress={restoreLatest}
              disabled={busy}
            >
              <Text style={[styles.secondaryText, { color: C.text }]}>恢复最近备份</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.secondaryButton, { backgroundColor: C.background, borderColor: C.border }]}
              onPress={importBackup}
              disabled={busy}
            >
              <Text style={[styles.secondaryText, { color: C.text }]}>从文件导入</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.secondaryButton, { backgroundColor: C.background, borderColor: C.border }]}
              onPress={shareLatest}
              disabled={busy}
            >
              <Text style={[styles.secondaryText, { color: C.text }]}>分享最近备份</Text>
            </TouchableOpacity>
          </View>
          {lastResult && (
            <Text style={[styles.result, { color: C.primary }]}>最近处理：{lastResult.characterCount} 个角色 · {lastResult.messageCount} 条消息</Text>
          )}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: C.text }]}>本地备份</Text>
          <Text style={[styles.sectionMeta, { color: C.textSecondary }]}>{exports.length} 份</Text>
        </View>
        <View style={styles.stack}>
          {exports.slice(0, 8).map((uri) => (
            <View key={uri} style={[styles.item, { backgroundColor: C.surface, borderColor: C.border }]}>
              <Text style={[styles.itemTitle, { color: C.text }]} numberOfLines={1}>{filename(uri)}</Text>
              <Text style={[styles.itemMeta, { color: C.textSecondary }]} numberOfLines={1}>{uri}</Text>
            </View>
          ))}
          {exports.length === 0 && <Text style={[styles.empty, { color: C.textSecondary }]}>还没有本地备份。</Text>}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: C.text }]}>最近诊断</Text>
          {issues.length > 0 && (
            <TouchableOpacity onPress={clearDiagnostics}>
              <Text style={[styles.clearText, { color: C.primary }]}>清空</Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.stack}>
          {issues.slice(0, 10).map((issue) => (
            <View key={issue.id} style={[styles.item, { backgroundColor: C.surface, borderColor: C.border }]}>
              <View style={styles.issueHeader}>
                <Text style={[styles.itemTitle, { color: C.text }]}>{issue.area}</Text>
                <Text style={[styles.itemMeta, { color: C.textSecondary }]}>{format(issue.timestamp, 'MM-dd HH:mm')}</Text>
              </View>
              <Text style={[styles.body, { color: C.textSecondary }]}>{issue.message}</Text>
            </View>
          ))}
          {issues.length === 0 && <Text style={[styles.empty, { color: C.textSecondary }]}>没有记录到数据或连接异常。</Text>}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 36, gap: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backButton: { width: 44, height: 44, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 34, lineHeight: 36 },
  headerCopy: { flex: 1 },
  title: { fontSize: 27, fontWeight: '900' },
  subtitle: { fontSize: 13, marginTop: 3 },
  hero: { borderRadius: 26, borderWidth: StyleSheet.hairlineWidth, padding: 18, gap: 10 },
  heroTitle: { fontSize: 20, fontWeight: '900' },
  body: { fontSize: 14, lineHeight: 21 },
  buttonRow: { gap: 10, marginTop: 4 },
  primaryButton: { minHeight: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  secondaryButton: { minHeight: 46, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { fontSize: 14, fontWeight: '800' },
  result: { fontSize: 12, fontWeight: '700' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  sectionTitle: { fontSize: 18, fontWeight: '900' },
  sectionMeta: { fontSize: 12 },
  clearText: { fontSize: 13, fontWeight: '800' },
  stack: { gap: 9 },
  item: { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 6 },
  itemTitle: { fontSize: 14, fontWeight: '800', flex: 1 },
  itemMeta: { fontSize: 11 },
  issueHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  empty: { paddingVertical: 18, textAlign: 'center', fontSize: 14 },
});
