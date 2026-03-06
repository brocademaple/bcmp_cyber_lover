import React from 'react';
import { ScrollView, Text, StyleSheet, TouchableOpacity, View, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { useSettingsStore } from '../store/settingsStore';
import { SettingsRow, SettingsSection } from '../components/SettingsRow';
import { useThemeColors } from '../utils/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'AdvancedSettings'>;

export default function AdvancedSettingsScreen({ navigation }: Props) {
  const C = useThemeColors();
  const { settings, updateAdvanced, saveSettings } = useSettingsStore();
  const adv = settings.advanced;

  const handleSave = async () => {
    await saveSettings();
    navigation.goBack();
  };

  const DARK_MODE_OPTIONS = [
    { value: 'auto', label: '跟随系统' },
    { value: 'light', label: '浅色' },
    { value: 'dark', label: '深色' },
  ] as const;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: C.background }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[styles.pageTitle, { color: C.text }]}>高级</Text>

        <SettingsSection title="">
          <SettingsRow
            label="兼容模式"
            description="开启后将会把请求消息列表中所有system角色的消息（如人设，图片描述，主动消息请求）转换为user角色的消息（普通对话），以此尝试解决讯飞星火大模型等平台不支持多条system消息的问题"
            value={adv.compatibilityMode}
            onToggle={(v) => updateAdvanced({ compatibilityMode: v })}
          />
          <SettingsRow
            label="启用深度思考"
            description={'在请求体内加入enable_thinking参数并设置值为true，该选项仅对硅基流动平台有效。若想设置其他平台的深度思考开关，请使用下面的\u201c自定义请求参数\u201d功能'}
            value={adv.deepThinking}
            onToggle={(v) => updateAdvanced({ deepThinking: v })}
          />
          <SettingsRow
            label="自定义请求参数"
            description="自定义请求体所包含的参数，以解决平台独有参数或深度思考参数不一致等问题（如智谱GLM的thinking.type）"
            showArrow
            onPress={() => {}}
          />
          <SettingsRow
            label="添加自定义桌面图标"
            showArrow
            onPress={() => {}}
          />
        </SettingsSection>

        <SettingsSection title="外观">
          <View style={[styles.segmentRow, { borderBottomColor: C.border }]}>
            <Text style={[styles.segmentLabel, { color: C.text }]}>深色模式</Text>
            <View style={styles.segmentControl}>
              {DARK_MODE_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.segmentBtn,
                    { borderColor: C.border },
                    adv.darkMode === opt.value && { backgroundColor: C.primary },
                  ]}
                  onPress={() => updateAdvanced({ darkMode: opt.value })}
                >
                  <Text
                    style={[
                      styles.segmentBtnText,
                      { color: adv.darkMode === opt.value ? '#fff' : C.textSecondary },
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </SettingsSection>

        <SettingsSection title="发送">
          <SettingsRow
            label="发送延时"
            description="设置发送消息和发送请求之间的等待时间"
            showArrow
            onPress={() => {}}
          >
            <Text style={[styles.valueText, { color: C.textSecondary }]}>
              {adv.sendDelayMs}ms
            </Text>
          </SettingsRow>
        </SettingsSection>

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
  segmentRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  segmentLabel: { fontSize: 15, marginBottom: 10 },
  segmentControl: {
    flexDirection: 'row',
    gap: 6,
  },
  segmentBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  segmentBtnText: { fontSize: 13 },
  valueText: { fontSize: 14, marginRight: 4 },
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
