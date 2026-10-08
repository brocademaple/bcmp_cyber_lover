import React, { useRef, useState } from 'react';
import { ScrollView, Text, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LifeConfig, RootStackParamList } from '../types';
import { useSettingsStore } from '../store/settingsStore';
import { useChatStore } from '../store/chatStore';
import { cancelDailyNotification, scheduleDailyNotification } from '../services/notificationService';
import { SettingsRow, SettingsSection } from '../components/SettingsRow';
import { useThemeColors, useThemeId } from '../utils/theme';

import { getPresentedCharacter } from '../utils/characterRelease';

type Props = NativeStackScreenProps<RootStackParamList, 'LifeSettings'>;

const REMINDER_HOURS = [8, 12, 20, 23];

function formatHour(hour: number) {
  return `${String(hour).padStart(2, '0')}:00`;
}

export default function LifeSettingsScreen({ navigation }: Props) {
  const C = useThemeColors();
  const themeId = useThemeId();
  const isUrbanClear = themeId === 'urbanClear';
  const isSoftSweet = themeId === 'softSweet';
  const { settings, updateLife, saveSettings } = useSettingsStore();
  const life = settings.life;
  const savingRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const [saveNotice, setSaveNotice] = useState('修改会自动保存。');
  const [saveError, setSaveError] = useState(false);

  const syncDailyNotification = async (nextLife: LifeConfig) => {
    if (!nextLife.enabled || !nextLife.allowBackgroundMessages || !nextLife.allowProactiveMessages) {
      await cancelDailyNotification();
      return '提醒已关闭。';
    }

    const currentSettings = useSettingsStore.getState().settings;
    const character = getPresentedCharacter(useChatStore.getState().characters, currentSettings.selectedCharacterId, currentSettings.appMode);
    if (!character) return '当前角色未就绪，可稍后重试通知同步。';
    const selectedCharacterId = character.id;
    const result = await scheduleDailyNotification(
      selectedCharacterId,
      character?.name ?? '心动伴侣',
      nextLife.notificationHour,
      0
    );
    return result === 'scheduled' ? '系统提醒已同步。' : result === 'permission_denied'
      ? '系统通知未获允许，请在 iPhone 设置中允许通知后重试。'
      : '浏览器仅保存提醒偏好，系统通知请在 iPhone 上确认。';
  };

  const applyLifeUpdate = async (updates: Partial<LifeConfig>) => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setSaveError(false);
    setSaveNotice('正在保存…');
    const nextLife = { ...useSettingsStore.getState().settings.life, ...updates };
    updateLife(updates);

    try {
      const saved = await saveSettings();
      if (!saved) throw new Error('设置未保存');
      let notificationNotice = '';
      if (updates.enabled !== undefined || updates.notificationHour !== undefined || updates.allowBackgroundMessages !== undefined || updates.allowProactiveMessages !== undefined) {
        try {
          notificationNotice = await syncDailyNotification(nextLife);
        } catch {
          setSaveError(true);
          notificationNotice = '系统通知未同步，偏好已保留，请重试。';
        }
      }
      setSaveNotice(`设置已保存。${notificationNotice}`);
    } catch {
      setSaveError(true);
      setSaveNotice('保存未完成，当前选择仍在本页，请重试。');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (savingRef.current) return;
    const saved = await saveSettings();
    if (saved) navigation.goBack();
    else { setSaveError(true); setSaveNotice('保存未完成，请重试。'); }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: C.background }]}>
      <ScrollView contentContainerStyle={styles.scroll} contentInsetAdjustmentBehavior="automatic">
        <View
          style={[
            styles.hero,
            isUrbanClear && styles.urbanHero,
            isSoftSweet && styles.softHero,
            { borderColor: C.border },
          ]}
        >
          <Text style={[styles.pageTitle, { color: C.text }]}>陪伴提醒</Text>
          <Text style={[styles.pageDesc, { color: C.textSecondary }]}>
            让她在合适的时间轻轻出现，而不是变成打扰你的通知机器。
          </Text>
        </View>

        <View
          style={[
            styles.summaryCard,
            isUrbanClear && styles.urbanSummaryCard,
            isSoftSweet && styles.softSummaryCard,
            {
              backgroundColor: isSoftSweet ? C.accentLight : C.surface,
              borderColor: C.border,
              shadowColor: C.shadow,
            },
          ]}
        >
          <Text style={[styles.summaryTitle, { color: C.text }]}>
            {life.enabled ? '她会保留一点主动性' : '由你决定什么时候再聊'}
          </Text>
          <Text style={[styles.summaryText, { color: C.textSecondary }]}>
            当前提醒时间：{formatHour(life.notificationHour)}。主动问候{life.allowProactiveMessages ? '已开启' : '已关闭'}。
          </Text>
          <Text accessibilityLiveRegion="polite" style={[styles.summaryText, { color: saveError ? C.danger : C.textSecondary }]}>{saveNotice}</Text>
          {saveError && <TouchableOpacity accessibilityRole="button" accessibilityLabel="重试保存陪伴提醒" disabled={saving} onPress={() => void applyLifeUpdate({ enabled: life.enabled })} style={{ minHeight: 44, justifyContent: 'center' }}>
            <Text style={{ color: C.primary, fontSize: 15 }}>重试保存与同步</Text>
          </TouchableOpacity>}
        </View>

        <View pointerEvents={saving ? 'none' : 'auto'} style={{ opacity: saving ? 0.6 : 1 }}>
        <SettingsSection title="陪伴节奏">
          <SettingsRow
            label="启用陪伴提醒"
            disabled={saving}
            description="关闭后，她不会主动发起提醒。"
            value={life.enabled}
            onToggle={(v) => {
              void applyLifeUpdate({ enabled: v });
            }}
          />
          <SettingsRow
            label="允许主动问候"
            disabled={saving}
            description="她会在适合的时候给你一句轻提醒。"
            value={life.allowProactiveMessages}
            onToggle={(v) => {
              void applyLifeUpdate({ allowProactiveMessages: v });
            }}
          />
          <SettingsRow
            label="后台轻提醒"
            disabled={saving}
            description="离开聊天后，也可以保留温和提醒。"
            value={life.allowBackgroundMessages}
            onToggle={(v) => {
              void applyLifeUpdate({ allowBackgroundMessages: v });
            }}
          />
        </SettingsSection>

        <View style={styles.timeSection}>
          <Text style={[styles.timeHint, { color: C.textSecondary }]}>
            选择每天更适合她出现的时间
          </Text>
          <View style={styles.timeGrid}>
            {REMINDER_HOURS.map((hour) => {
              const selected = life.notificationHour === hour;
              return (
                <TouchableOpacity
                  key={hour}
                  accessibilityRole="button"
                  accessibilityLabel={`每天 ${formatHour(hour)} 提醒`}
                  accessibilityState={{ selected, disabled: saving }}
                  disabled={saving}
                  style={[
                    styles.timeChip,
                    isUrbanClear && styles.urbanTimeChip,
                    isSoftSweet && styles.softTimeChip,
                    {
                      borderColor: selected ? C.primary : C.border,
                      backgroundColor: selected ? C.primary : isSoftSweet ? C.accentLight : C.surface,
                      shadowColor: C.shadow,
                    },
                  ]}
                  onPress={() => {
                    void applyLifeUpdate({ notificationHour: hour });
                  }}
                >
                  <Text style={[styles.timeText, { color: selected ? '#fff' : C.text }]}>
                    {formatHour(hour)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
        </View>

        <TouchableOpacity
          style={[
            styles.saveBtn,
            isUrbanClear && styles.urbanSaveBtn,
            isSoftSweet && styles.softSaveBtn,
            { backgroundColor: C.primary, shadowColor: C.shadow },
          ]}
          onPress={handleSave}
          disabled={saving}
          accessibilityRole="button"
          accessibilityLabel="完成陪伴提醒设置"
        >
          <Text style={styles.saveBtnText}>{saving ? '正在保存…' : '完成'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 32 },
  hero: {
    marginBottom: 16,
  },
  urbanHero: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: 14,
  },
  softHero: {
    borderWidth: StyleSheet.hairlineWidth,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 18,
    borderBottomRightRadius: 26,
    borderBottomLeftRadius: 18,
    padding: 16,
  },
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
  summaryCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 28,
    padding: 18,
    marginBottom: 20,
    gap: 8,
  },
  urbanSummaryCard: {
    borderRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 18,
  },
  softSummaryCard: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 22,
    borderBottomRightRadius: 30,
    borderBottomLeftRadius: 22,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    transform: [{ rotate: '-0.6deg' }],
  },
  summaryEyebrow: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  summaryTitle: {
    fontSize: 22,
    lineHeight: 27,
    fontWeight: '900',
  },
  summaryText: {
    fontSize: 14,
    lineHeight: 21,
  },
  timeSection: {
    marginHorizontal: 16,
    marginBottom: 22,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 8,
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  timeHint: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
    marginLeft: 4,
  },
  timeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  timeChip: {
    minWidth: 78,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingVertical: 11,
    paddingHorizontal: 15,
    alignItems: 'center',
  },
  urbanTimeChip: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 8,
    borderBottomRightRadius: 16,
    borderBottomLeftRadius: 8,
  },
  softTimeChip: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 16,
    borderBottomRightRadius: 22,
    borderBottomLeftRadius: 16,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  timeText: {
    fontSize: 14,
    fontWeight: '900',
  },
  saveBtn: {
    borderRadius: 28,
    paddingVertical: 15,
    alignItems: 'center',
    marginHorizontal: 16,
  },
  urbanSaveBtn: {
    borderTopLeftRadius: 12,
    borderTopRightRadius: 24,
    borderBottomRightRadius: 12,
    borderBottomLeftRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
  },
  softSaveBtn: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 18,
    borderBottomRightRadius: 26,
    borderBottomLeftRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    transform: [{ rotate: '-1deg' }],
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '900' },
});
