import React from 'react';
import { ScrollView, Text, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { useSettingsStore } from '../store/settingsStore';
import { SettingsRow, SettingsSection } from '../components/SettingsRow';
import { useThemeColors } from '../utils/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'AdvancedSettings'>;

const DARK_MODE_OPTIONS = [
  { value: 'auto', label: '跟随系统' },
  { value: 'light', label: '浅色' },
  { value: 'dark', label: '深色' },
] as const;

const THEME_OPTIONS = [
  { value: 'urbanClear', label: '都市清透' },
  { value: 'softSweet', label: '甜美柔软' },
  { value: 'pink', label: '鹿芽粉' },
  { value: 'blue', label: '纪遥蓝' },
  { value: 'yellow', label: '暖黄色' },
  { value: 'purple', label: '梦紫色' },
  { value: 'midnight', label: '凛夜深色' },
] as const;

const DELAY_OPTIONS = [0, 300, 800, 1200];

export default function AdvancedSettingsScreen({ navigation }: Props) {
  const C = useThemeColors();
  const { settings, updateAdvanced, saveSettings } = useSettingsStore();
  const adv = settings.advanced;

  const handleSave = async () => {
    await saveSettings();
    navigation.goBack();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: C.background }]}>
      <ScrollView contentContainerStyle={styles.scroll} contentInsetAdjustmentBehavior="automatic">
        <View style={styles.hero}>
          <Text style={[styles.pageTitle, { color: C.text }]}>内部参数</Text>
          <Text style={[styles.pageDesc, { color: C.textSecondary }]}>
            这些选项只用于连接兼容和外观校准，日常体验不需要频繁调整。
          </Text>
        </View>

        <SettingsSection title="模型兼容">
          <SettingsRow
            label="兼容模式"
            description="遇到不支持 system 消息的模型时开启。"
            value={adv.compatibilityMode}
            onToggle={(v) => updateAdvanced({ compatibilityMode: v })}
          />
          <SettingsRow
            label="启用深度思考"
            description="仅对支持该参数的服务生效。"
            value={adv.deepThinking}
            onToggle={(v) => updateAdvanced({ deepThinking: v })}
          />
        </SettingsSection>

        <View style={[styles.panel, { backgroundColor: C.surface, borderColor: C.border }]}>
          <Text style={[styles.panelTitle, { color: C.text }]}>外观</Text>
          <Text style={[styles.fieldLabel, { color: C.textSecondary }]}>深色模式</Text>
          <View style={styles.segmentControl}>
            {DARK_MODE_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.segmentBtn,
                  { borderColor: C.border },
                  adv.darkMode === opt.value && { backgroundColor: C.primary, borderColor: C.primary },
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

          <SettingsRow
            label="跟随角色主题色"
            description="关闭后可固定为都市清透或甜美柔软等视觉皮肤。"
            value={adv.themeMode === 'character'}
            onToggle={(v) => updateAdvanced({ themeMode: v ? 'character' : 'manual' })}
          />

          {adv.themeMode === 'manual' && (
            <>
              <Text style={[styles.fieldLabel, { color: C.textSecondary }]}>手动主题</Text>
              <View style={styles.themeGrid}>
                {THEME_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.themeBtn,
                      { borderColor: C.border, backgroundColor: C.inputBg },
                      adv.theme === opt.value && { backgroundColor: C.primary, borderColor: C.primary },
                    ]}
                    onPress={() => updateAdvanced({ theme: opt.value })}
                  >
                    <Text style={[styles.segmentBtnText, { color: adv.theme === opt.value ? '#fff' : C.textSecondary }]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}
        </View>

        <View style={[styles.panel, { backgroundColor: C.surface, borderColor: C.border }]}>
          <Text style={[styles.panelTitle, { color: C.text }]}>发送节奏</Text>
          <Text style={[styles.fieldLabel, { color: C.textSecondary }]}>发送前等待</Text>
          <View style={styles.themeGrid}>
            {DELAY_OPTIONS.map((ms) => {
              const active = adv.sendDelayMs === ms;
              return (
                <TouchableOpacity
                  key={ms}
                  style={[
                    styles.themeBtn,
                    { borderColor: C.border, backgroundColor: C.inputBg },
                    active && { backgroundColor: C.primary, borderColor: C.primary },
                  ]}
                  onPress={() => updateAdvanced({ sendDelayMs: ms })}
                >
                  <Text style={[styles.segmentBtnText, { color: active ? '#fff' : C.textSecondary }]}>
                    {ms === 0 ? '立即' : `${ms}ms`}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <TouchableOpacity style={[styles.saveBtn, { backgroundColor: C.primary }]} onPress={handleSave}>
          <Text style={styles.saveBtnText}>保存内部参数</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 32 },
  hero: { marginBottom: 16 },
  pageTitle: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '900',
  },
  pageDesc: {
    fontSize: 15,
    lineHeight: 22,
    marginTop: 6,
  },
  panel: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 24,
    padding: 16,
    marginBottom: 16,
    gap: 12,
    overflow: 'hidden',
  },
  panelTitle: { fontSize: 18, fontWeight: '900' },
  fieldLabel: { fontSize: 12, fontWeight: '800' },
  segmentControl: {
    flexDirection: 'row',
    gap: 7,
  },
  segmentBtn: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    paddingVertical: 10,
    alignItems: 'center',
  },
  themeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  themeBtn: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  segmentBtnText: { fontSize: 13, fontWeight: '900' },
  saveBtn: {
    borderRadius: 28,
    paddingVertical: 15,
    alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '900' },
});
