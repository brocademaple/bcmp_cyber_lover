import React from 'react';
import { ScrollView, Text, StyleSheet, TouchableOpacity, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { useSettingsStore } from '../store/settingsStore';
import { SettingsRow, SettingsSection } from '../components/SettingsRow';
import { useThemeColors } from '../utils/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'MemorySettings'>;

export default function MemorySettingsScreen({ navigation }: Props) {
  const C = useThemeColors();
  const { settings, updateMemory, saveSettings } = useSettingsStore();
  const memory = settings.memory;

  const handleSave = async () => {
    await saveSettings();
    navigation.goBack();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: C.background }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[styles.pageTitle, { color: C.text }]}>记忆</Text>

        <SettingsSection title="">
          <SettingsRow
            label="启用记忆库"
            value={memory.enabled}
            onToggle={(v) => updateMemory({ enabled: v })}
          />
          <SettingsRow
            label="始终保留聊天记录"
            description="关闭后，每次退出聊天后都会自动清除聊天记录，重新进入聊天时将不会再有上次的聊天记录"
            value={memory.alwaysRetainHistory}
            onToggle={(v) => updateMemory({ alwaysRetainHistory: v })}
          />
          <SettingsRow
            label="设置保留聊天记录范围"
            description="设置保留在本地的聊天记录范围"
            showArrow
            onPress={() =>
              Alert.prompt?.(
                '保留记录条数',
                '设置本地保留的最大聊天条数',
                [
                  { text: '取消', style: 'cancel' },
                  {
                    text: '确认',
                    onPress: (v) => v && updateMemory({ retentionRange: parseInt(v) || 100 }),
                  },
                ],
                'plain-text',
                String(memory.retentionRange)
              )
            }
          />
          <SettingsRow
            label="设置发送时加载的聊天记录范围"
            description="设置每次发送消息时请求内容所包含的聊天记录范围"
            showArrow
            onPress={() =>
              Alert.prompt?.(
                '发送记录条数',
                '设置每次请求包含的历史消息条数',
                [
                  { text: '取消', style: 'cancel' },
                  {
                    text: '确认',
                    onPress: (v) => v && updateMemory({ sendRange: parseInt(v) || 20 }),
                  },
                ],
                'plain-text',
                String(memory.sendRange)
              )
            }
          />
          <SettingsRow
            label="始终向模型提供完整记忆库"
            value={memory.alwaysProvideFullMemory}
            onToggle={(v) => updateMemory({ alwaysProvideFullMemory: v })}
          />
          <SettingsRow
            label="仅向模型提供特定时间范围内的记忆"
            showArrow
            onPress={() => {}}
          />
          <SettingsRow
            label="自动总结聊天记录"
            description="设置在聊天时或退出聊天时自动总结聊天记录"
            showArrow
            onPress={() => updateMemory({ autoSummarize: !memory.autoSummarize })}
          />
          <SettingsRow
            label="修改记忆系统提示词约束"
            showArrow
            onPress={() => {}}
          />
        </SettingsSection>

        <Text style={[styles.fieldLabel, { color: C.textSecondary }]}>记忆系统提示词：</Text>
        <TextInput
          style={[styles.textArea, { color: C.text, borderColor: C.border, backgroundColor: C.surface }]}
          value={memory.memorySystemPrompt}
          onChangeText={(v) => updateMemory({ memorySystemPrompt: v })}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />

        <TouchableOpacity
          style={[styles.testBtn, { borderColor: C.primary }]}
          onPress={() => {}}
        >
          <Text style={[styles.testBtnText, { color: C.primary }]}>测试连接</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.saveBtn, { backgroundColor: C.primary }]} onPress={handleSave}>
          <Text style={styles.saveBtnText}>保存</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.cancelBtn, { backgroundColor: C.danger }]}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.saveBtnText}>取消</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16 },
  pageTitle: { fontSize: 22, fontWeight: '700', marginBottom: 16 },
  fieldLabel: { fontSize: 14, marginBottom: 6, marginTop: 8, marginLeft: 4 },
  textArea: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    minHeight: 100,
    marginBottom: 16,
  },
  testBtn: {
    borderWidth: 1,
    borderRadius: 25,
    paddingVertical: 13,
    alignItems: 'center',
    marginBottom: 10,
  },
  testBtnText: { fontSize: 15 },
  saveBtn: {
    borderRadius: 25,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  cancelBtn: {
    borderRadius: 25,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 24,
  },
});
