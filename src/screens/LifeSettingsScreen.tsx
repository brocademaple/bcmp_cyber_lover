import React from 'react';
import { ScrollView, Text, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { useSettingsStore } from '../store/settingsStore';
import { SettingsRow, SettingsSection } from '../components/SettingsRow';
import { useThemeColors } from '../utils/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'LifeSettings'>;

export default function LifeSettingsScreen({ navigation }: Props) {
  const C = useThemeColors();
  const { settings, updateLife, saveSettings } = useSettingsStore();
  const life = settings.life;

  const handleSave = async () => {
    await saveSettings();
    navigation.goBack();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: C.background }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[styles.pageTitle, { color: C.text }]}>生命</Text>

        <SettingsSection title="">
          <SettingsRow
            label="启用生命"
            value={life.enabled}
            onToggle={(v) => updateLife({ enabled: v })}
          />
          <SettingsRow
            label="允许Ta主动发送消息"
            value={life.allowProactiveMessages}
            onToggle={(v) => updateLife({ allowProactiveMessages: v })}
          />
          <SettingsRow
            label="允许Ta在后台时主动发送消息"
            value={life.allowBackgroundMessages}
            onToggle={(v) => updateLife({ allowBackgroundMessages: v })}
          />
          <SettingsRow
            label="设置允许Ta主动发送消息的时间间隔"
            showArrow
            onPress={() => {}}
          />
          <SettingsRow
            label="启用后台消息Toast提示"
            description="关闭后，在后台消息功能已打开时，进入聊天页将不再弹出有关后台消息功能的Toast提示"
            value={life.backgroundToastEnabled}
            onToggle={(v) => updateLife({ backgroundToastEnabled: v })}
          />
          <SettingsRow
            label="启用后台消息退出确认"
            description="关闭后，在后台消息功能已打开时，退出聊天页将不再弹出二次确认窗口"
            value={life.backgroundExitConfirm}
            onToggle={(v) => updateLife({ backgroundExitConfirm: v })}
          />
          <SettingsRow
            label="提升动态主动性"
            description="开启后，将会在你对动态进行任意操作（如发动态，点赞动态，评论动态）时，通知最近一次聊天的人（如果你点赞或评论的动态不是最近一次聊天的人发布的，则会通知该条动态的发布者）并让Ta立即做出回应"
            value={life.enhancedMomentProactivity}
            onToggle={(v) => updateLife({ enhancedMomentProactivity: v })}
          />
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
