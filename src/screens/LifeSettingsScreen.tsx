import React from 'react';
import { Alert, ScrollView, Text, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LifeConfig, RootStackParamList } from '../types';
import { useSettingsStore } from '../store/settingsStore';
import { useChatStore } from '../store/chatStore';
import { cancelDailyNotification, scheduleDailyNotification } from '../services/notificationService';
import { SettingsRow, SettingsSection } from '../components/SettingsRow';
import { useThemeColors, useThemeId } from '../utils/theme';

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
  const getCharacter = useChatStore((state) => state.getCharacter);
  const life = settings.life;

  const syncDailyNotification = async (nextLife: LifeConfig) => {
    if (!nextLife.enabled) {
      await cancelDailyNotification();
      return;
    }

    const selectedCharacterId = useSettingsStore.getState().settings.selectedCharacterId;
    const character = getCharacter(selectedCharacterId);
    await scheduleDailyNotification(
      selectedCharacterId,
      character?.name ?? '心动伴侣',
      nextLife.notificationHour,
      0
    );
  };

  const applyLifeUpdate = async (updates: Partial<LifeConfig>) => {
    const nextLife = { ...useSettingsStore.getState().settings.life, ...updates };
    updateLife(updates);

    try {
      if (updates.enabled !== undefined || updates.notificationHour !== undefined) {
        await syncDailyNotification(nextLife);
      }
    } catch (error) {
      console.error('Failed to sync reminder settings', error);
      Alert.alert('提醒设置未同步', '本地设置已更新，但系统通知同步失败。请稍后再试。');
    } finally {
      await useSettingsStore.getState().saveSettings();
    }
  };

  const handleSave = async () => {
    await saveSettings();
    navigation.goBack();
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
            {life.enabled ? '她会保留一点主动性' : '她会安静等你回来'}
          </Text>
          <Text style={[styles.summaryText, { color: C.textSecondary }]}>
            当前提醒时间：{formatHour(life.notificationHour)}。主动问候{life.allowProactiveMessages ? '已开启' : '已关闭'}。
          </Text>
        </View>

        <SettingsSection title="陪伴节奏">
          <SettingsRow
            label="启用陪伴提醒"
            description="关闭后，她不会主动发起提醒。"
            value={life.enabled}
            onToggle={(v) => {
              void applyLifeUpdate({ enabled: v });
            }}
          />
          <SettingsRow
            label="允许主动问候"
            description="她会在适合的时候给你一句轻提醒。"
            value={life.allowProactiveMessages}
            onToggle={(v) => {
              void applyLifeUpdate({ allowProactiveMessages: v });
            }}
          />
          <SettingsRow
            label="后台轻提醒"
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

        <TouchableOpacity
          style={[
            styles.saveBtn,
            isUrbanClear && styles.urbanSaveBtn,
            isSoftSweet && styles.softSaveBtn,
            { backgroundColor: C.primary, shadowColor: C.shadow },
          ]}
          onPress={handleSave}
        >
          <Text style={styles.saveBtnText}>保存陪伴设置</Text>
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
