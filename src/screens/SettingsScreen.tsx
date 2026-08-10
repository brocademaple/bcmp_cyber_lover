import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppMode, AppTheme, RootStackParamList } from '../types';
import { useThemeColors } from '../utils/theme';
import { useSettingsStore } from '../store/settingsStore';
import { format } from 'date-fns';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

const VISUAL_THEME_OPTIONS: Array<{
  value: AppTheme;
  label: string;
  accent: string;
}> = [
  {
    value: 'urbanClear',
    label: '都市清透',
    accent: '#d8bd86',
  },
  {
    value: 'softSweet',
    label: '甜美柔软',
    accent: '#f4a8c4',
  },
  { value: 'pink', label: '粉色甜心', accent: '#ff6b9d' },
  { value: 'blue', label: '蓝色清新', accent: '#5dade2' },
  { value: 'yellow', label: '黄色阳光', accent: '#f9ca24' },
  { value: 'purple', label: '紫色梦幻', accent: '#a29bfe' },
  { value: 'midnight', label: '午夜深色', accent: '#7d6df6' },
];

interface MenuItemProps {
  icon: string;
  label: string;
  description?: string;
  onPress: () => void;
  color?: string;
  value?: string;
}

function MenuItem({ icon, label, description, onPress, color, value }: MenuItemProps) {
  const C = useThemeColors();
  return (
    <TouchableOpacity
      style={[styles.menuItem, { backgroundColor: C.surface, borderColor: C.border }]}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`${label}${description ? `，${description}` : ''}${value ? `，${value}` : ''}`}
    >
      <Text style={styles.menuIcon}>{icon}</Text>
      <View style={styles.menuText}>
        <Text style={[styles.menuLabel, { color: color || C.text }]}>{label}</Text>
        {description && (
          <Text style={[styles.menuDesc, { color: C.textSecondary }]}>{description}</Text>
        )}
      </View>
      {value && <Text style={[styles.menuValue, { color: C.textSecondary }]}>{value}</Text>}
      <Text style={[styles.arrow, { color: C.textSecondary }]}>›</Text>
    </TouchableOpacity>
  );
}

export default function SettingsScreen({ navigation }: Props) {
  const C = useThemeColors();
  const { settings, setAppMode, setDebugNowTs, updateAdvanced, saveSettings } = useSettingsStore();
  const [themePickerOpen, setThemePickerOpen] = useState(false);
  const isAdmin = settings.appMode === 'admin';
  const debugNow = settings.advanced.debugNowTs;
  const effectiveNow = debugNow ?? Date.now();
  const connected = settings.service.apiKey.trim().length > 0;
  const connectionLabel = connected ? '已准备好' : '待连接';

  const handleModeChange = async (mode: AppMode) => {
    const nextSettings = { ...useSettingsStore.getState().settings, appMode: mode };
    setAppMode(mode);
    await saveSettings(nextSettings);
  };

  const shiftDebugTime = async (deltaMs: number) => {
    const base = settings.advanced.debugNowTs ?? Date.now();
    const debugNowTs = base + deltaMs;
    const nextSettings = {
      ...useSettingsStore.getState().settings,
      advanced: { ...useSettingsStore.getState().settings.advanced, debugNowTs },
    };
    setDebugNowTs(debugNowTs);
    await saveSettings(nextSettings);
  };

  const resetDebugTime = async () => {
    const nextSettings = {
      ...useSettingsStore.getState().settings,
      advanced: { ...useSettingsStore.getState().settings.advanced, debugNowTs: undefined },
    };
    setDebugNowTs(undefined);
    await saveSettings(nextSettings);
  };

  const activeThemeOption =
    VISUAL_THEME_OPTIONS.find((option) => option.value === settings.advanced.theme) ?? VISUAL_THEME_OPTIONS[0];

  const handleVisualThemeChange = async (theme: AppTheme) => {
    const nextSettings = {
      ...useSettingsStore.getState().settings,
      advanced: { ...useSettingsStore.getState().settings.advanced, theme, themeMode: 'manual' as const },
    };
    updateAdvanced({ theme, themeMode: 'manual' });
    await saveSettings(nextSettings);
    setThemePickerOpen(false);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: C.background }]}>
      <ScrollView contentContainerStyle={styles.scroll} contentInsetAdjustmentBehavior="automatic">
        <View style={styles.topBar}>
          <TouchableOpacity
            style={[styles.topIconButton, { backgroundColor: C.surface, borderColor: C.border }]}
            onPress={() => navigation.goBack()}
            activeOpacity={0.78}
            accessibilityRole="button"
            accessibilityLabel="返回"
          >
            <Text style={[styles.backIcon, { color: C.text }]}>‹</Text>
          </TouchableOpacity>
          <Text style={[styles.topTitle, { color: C.text }]}>设置</Text>
          <TouchableOpacity
            style={[styles.themeTrigger, { backgroundColor: C.surface, borderColor: C.border }]}
            onPress={() => setThemePickerOpen((open) => !open)}
            activeOpacity={0.78}
            accessibilityRole="button"
            accessibilityLabel={`切换主题色，当前为${activeThemeOption.label}`}
          >
            <View style={[styles.themeTriggerDot, { backgroundColor: activeThemeOption.accent }]} />
          </TouchableOpacity>
        </View>

        {themePickerOpen && (
          <View style={[styles.themePicker, { backgroundColor: C.surface, borderColor: C.border, shadowColor: C.shadow }]}>
            {VISUAL_THEME_OPTIONS.map((option) => {
              const active = settings.advanced.themeMode === 'manual' && settings.advanced.theme === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.themeDotButton,
                    { borderColor: active ? C.text : 'transparent' },
                  ]}
                  onPress={() => handleVisualThemeChange(option.value)}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={`切换到${option.label}`}
                >
                  <View style={[styles.themeDot, { backgroundColor: option.accent }]} />
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <View style={styles.intro}>
          <Text style={[styles.pageDesc, { color: C.textSecondary }]}>
            回复、记忆、提醒和连接服务都在这里。
          </Text>
        </View>

        <View style={styles.group}>
          <Text style={[styles.groupLabel, { color: C.textSecondary }]}>陪伴体验</Text>
          <MenuItem
            icon="⌁"
            label="连接服务"
            description="API 密钥、模型和连接测试"
            onPress={() => navigation.navigate('ServiceSettings')}
            value={connectionLabel}
            color={connected ? undefined : C.primary}
          />
          <MenuItem
            icon="▣"
            label="记忆漫画"
            description="查看她记住的多格漫画与关系片段"
            onPress={() => navigation.navigate('MemorySettings')}
          />
          <MenuItem
            icon="✦"
            label="角色创作工作台"
            description="创建、预览、体检与回退角色设定"
            onPress={() => navigation.navigate('CharacterEditor', {})}
          />
          <MenuItem
            icon="↺"
            label="数据与恢复"
            description="本地备份、恢复和异常诊断"
            onPress={() => navigation.navigate('DataManagement')}
          />
          <MenuItem
            icon="♡"
            label="陪伴提醒"
            description="每日提醒、主动问候和安静陪伴"
            onPress={() => navigation.navigate('LifeSettings')}
            value={settings.life.enabled ? '开启' : '关闭'}
          />
          {isAdmin && (
            <MenuItem
              icon="⚙"
              label="内部参数"
              description="兼容模式、主题、发送延迟"
              onPress={() => navigation.navigate('AdvancedSettings')}
            />
          )}
        </View>

        {isAdmin && (
          <>
            <View style={styles.group}>
              <Text style={[styles.groupLabel, { color: C.textSecondary }]}>开发者工具</Text>
              <MenuItem
                icon="AI"
                label="AI 调试台"
                description="Persona、Prompt、Agent 与最近 turn trace"
                onPress={() => navigation.navigate('DeveloperDebug')}
              />
            </View>

            <View style={styles.group}>
              <Text style={[styles.groupLabel, { color: C.textSecondary }]}>时间校准</Text>
              <View style={[styles.debugPanel, { backgroundColor: C.surface, borderColor: C.border }]}>
                <Text style={[styles.debugTitle, { color: C.text }]}>
                  当前模拟时间：{format(effectiveNow, 'yyyy-MM-dd HH:mm:ss')}
                </Text>
                <Text style={[styles.debugDesc, { color: C.textSecondary }]}>
                  用于快速验证长期聊天后，记忆与日报/周记/月记的更新与存储。
                </Text>

                <View style={styles.debugBtnRow}>
                  <TouchableOpacity style={[styles.debugBtn, { borderColor: C.border }]} onPress={() => shiftDebugTime(60 * 60 * 1000)}>
                    <Text style={[styles.debugBtnText, { color: C.text }]}>+1小时</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.debugBtn, { borderColor: C.border }]} onPress={() => shiftDebugTime(24 * 60 * 60 * 1000)}>
                    <Text style={[styles.debugBtnText, { color: C.text }]}>+1天</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.debugBtn, { borderColor: C.border }]} onPress={() => shiftDebugTime(7 * 24 * 60 * 60 * 1000)}>
                    <Text style={[styles.debugBtnText, { color: C.text }]}>+1周</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.debugBtn, { borderColor: C.border }]} onPress={() => shiftDebugTime(30 * 24 * 60 * 60 * 1000)}>
                    <Text style={[styles.debugBtnText, { color: C.text }]}>+1月</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.debugBtnRow}>
                  <TouchableOpacity style={[styles.debugBtn, { borderColor: C.border }]} onPress={() => shiftDebugTime(-60 * 60 * 1000)}>
                    <Text style={[styles.debugBtnText, { color: C.text }]}>-1小时</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.debugBtn, { borderColor: C.border }]} onPress={() => shiftDebugTime(-24 * 60 * 60 * 1000)}>
                    <Text style={[styles.debugBtnText, { color: C.text }]}>-1天</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.debugBtn, { borderColor: C.border }]} onPress={() => shiftDebugTime(-7 * 24 * 60 * 60 * 1000)}>
                    <Text style={[styles.debugBtnText, { color: C.text }]}>-1周</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.debugBtn, { borderColor: C.border }]} onPress={() => shiftDebugTime(-30 * 24 * 60 * 60 * 1000)}>
                    <Text style={[styles.debugBtnText, { color: C.text }]}>-1月</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity style={[styles.resetBtn, { backgroundColor: C.primary }]} onPress={resetDebugTime}>
                  <Text style={styles.resetBtnText}>恢复真实时间</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}

        <View style={[styles.modeFooter, { borderColor: C.border }]}>
          <Text style={[styles.groupLabel, { color: C.textSecondary }]}>模式</Text>
          <View style={[styles.modeRow, { backgroundColor: C.surface, borderColor: C.border }]}>
            <TouchableOpacity
              style={[styles.modeOption, !isAdmin && { backgroundColor: C.primary }]}
              onPress={() => handleModeChange('explore')}
              activeOpacity={0.8}
            >
              <Text style={[styles.modeLabel, { color: !isAdmin ? '#fff' : C.text }]}>用户模式</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeOption, isAdmin && { backgroundColor: C.primary }]}
              onPress={() => handleModeChange('admin')}
              activeOpacity={0.8}
            >
              <Text style={[styles.modeLabel, { color: isAdmin ? '#fff' : C.text }]}>开发者模式</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.versionTap}>
          <Text style={[styles.versionText, { color: C.textSecondary }]}>HeartBeat Companion · v1.5</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16, paddingTop: 8, paddingBottom: 28 },
  topBar: {
    minHeight: 48,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topIconButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 34,
    lineHeight: 36,
    fontWeight: '500',
  },
  topTitle: {
    position: 'absolute',
    left: 72,
    right: 72,
    textAlign: 'center',
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '900',
  },
  themeTrigger: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeTriggerDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  themePicker: {
    alignSelf: 'flex-end',
    marginTop: -4,
    marginBottom: 14,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 9,
    flexDirection: 'row',
    gap: 6,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 3,
  },
  themeDotButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  intro: {
    marginBottom: 12,
  },
  pageTitle: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '900',
    marginLeft: 4,
  },
  pageDesc: {
    fontSize: 15,
    lineHeight: 22,
    marginTop: 6,
    marginHorizontal: 4,
  },
  statusCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 28,
    padding: 16,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusIconText: {
    color: '#fff',
    fontSize: 21,
    fontWeight: '900',
  },
  statusCopy: {
    flex: 1,
    minWidth: 0,
  },
  statusTitle: {
    fontSize: 17,
    fontWeight: '900',
  },
  statusDesc: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 3,
  },
  statusValue: {
    fontSize: 12,
    fontWeight: '900',
  },
  group: {
    marginBottom: 20,
  },
  modeRow: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    padding: 4,
    gap: 4,
    flexDirection: 'row',
  },
  modeOption: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modeLabel: {
    fontSize: 15,
    fontWeight: '900',
  },
  modeDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  visualThemeGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  visualThemeCard: {
    flex: 1,
    minHeight: 132,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 24,
    padding: 14,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 2,
  },
  visualThemeTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  visualThemeSwatch: {
    width: 34,
    height: 18,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 8,
    borderBottomRightRadius: 14,
    borderBottomLeftRadius: 8,
  },
  visualThemeCheck: {
    fontSize: 11,
    fontWeight: '900',
  },
  visualThemeTitle: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '900',
    marginBottom: 6,
  },
  visualThemeDesc: {
    fontSize: 12,
    lineHeight: 18,
  },
  modeFooter: {
    marginTop: 8,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  debugPanel: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 12,
  },
  debugTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  debugDesc: {
    fontSize: 12,
    marginTop: 4,
    marginBottom: 10,
  },
  debugBtnRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  debugBtn: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  debugBtnText: {
    fontSize: 13,
    fontWeight: '500',
  },
  resetBtn: {
    marginTop: 4,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  resetBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  hintCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 12,
  },
  hintText: {
    fontSize: 12,
  },
  versionTap: {
    alignItems: 'center',
    paddingVertical: 18,
  },
  versionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  groupLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 8,
  },
  menuIcon: {
    width: 30,
    textAlign: 'center',
    fontSize: 22,
    marginRight: 14,
    fontWeight: '800',
  },
  menuText: {
    flex: 1,
  },
  menuLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  menuDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  menuValue: {
    fontSize: 12,
    fontWeight: '800',
    marginHorizontal: 8,
  },
  arrow: {
    fontSize: 22,
  },
});
