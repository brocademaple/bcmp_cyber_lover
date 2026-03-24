import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppMode, RootStackParamList } from '../types';
import { useThemeColors } from '../utils/theme';
import { useSettingsStore } from '../store/settingsStore';
import { format } from 'date-fns';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

interface MenuItemProps {
  icon: string;
  label: string;
  description?: string;
  onPress: () => void;
  color?: string;
}

function MenuItem({ icon, label, description, onPress, color }: MenuItemProps) {
  const C = useThemeColors();
  return (
    <TouchableOpacity
      style={[styles.menuItem, { backgroundColor: C.surface, borderColor: C.border }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={styles.menuIcon}>{icon}</Text>
      <View style={styles.menuText}>
        <Text style={[styles.menuLabel, { color: color || C.text }]}>{label}</Text>
        {description && (
          <Text style={[styles.menuDesc, { color: C.textSecondary }]}>{description}</Text>
        )}
      </View>
      <Text style={[styles.arrow, { color: C.textSecondary }]}>›</Text>
    </TouchableOpacity>
  );
}

export default function SettingsScreen({ navigation }: Props) {
  const C = useThemeColors();
  const { settings, setAppMode, setDebugNowTs, saveSettings } = useSettingsStore();
  const isAdmin = settings.appMode === 'admin';
  const debugNow = settings.advanced.debugNowTs;
  const effectiveNow = debugNow ?? Date.now();

  const handleModeChange = async (mode: AppMode) => {
    setAppMode(mode);
    await saveSettings();
  };

  const shiftDebugTime = async (deltaMs: number) => {
    const base = settings.advanced.debugNowTs ?? Date.now();
    setDebugNowTs(base + deltaMs);
    await saveSettings();
  };

  const resetDebugTime = async () => {
    setDebugNowTs(undefined);
    await saveSettings();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: C.background }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[styles.pageTitle, { color: C.primary }]}>设置</Text>

        <View style={styles.group}>
          <Text style={[styles.groupLabel, { color: C.textSecondary }]}>系统模式</Text>
          <View style={[styles.modeRow, { backgroundColor: C.surface, borderColor: C.border }]}>
            <TouchableOpacity
              style={[styles.modeOption, isAdmin && { backgroundColor: C.primary }]}
              onPress={() => handleModeChange('admin')}
              activeOpacity={0.8}
            >
              <Text style={[styles.modeLabel, { color: isAdmin ? '#fff' : C.text }]}>Admin 模式</Text>
              <Text style={[styles.modeDesc, { color: isAdmin ? 'rgba(255,255,255,0.9)' : C.textSecondary }]}>
                可查看角色日记与编辑设定
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeOption, !isAdmin && { backgroundColor: C.primary }]}
              onPress={() => handleModeChange('explore')}
              activeOpacity={0.8}
            >
              <Text style={[styles.modeLabel, { color: !isAdmin ? '#fff' : C.text }]}>探索模式</Text>
              <Text style={[styles.modeDesc, { color: !isAdmin ? 'rgba(255,255,255,0.9)' : C.textSecondary }]}>
                仅聊天体验，隐藏日记等管理信息
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.group}>
          <Text style={[styles.groupLabel, { color: C.textSecondary }]}>服务配置</Text>
          <MenuItem
            icon="🔌"
            label="服务提供商"
            description="配置AI模型、API密钥"
            onPress={() => navigation.navigate('ServiceSettings')}
          />
        </View>

        <View style={styles.group}>
          <Text style={[styles.groupLabel, { color: C.textSecondary }]}>角色设置</Text>
          {isAdmin && (
            <MenuItem
              icon="👤"
              label="编辑角色"
              description="自定义AI伴侣的性格和设定"
              onPress={() => navigation.navigate('CharacterEditor', {})}
            />
          )}
        </View>

        {isAdmin && (
          <View style={styles.group}>
            <Text style={[styles.groupLabel, { color: C.textSecondary }]}>时间调试（Admin）</Text>
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
        )}

        <View style={styles.group}>
          <Text style={[styles.groupLabel, { color: C.textSecondary }]}>模式说明</Text>
          {!isAdmin && (
            <View style={[styles.hintCard, { backgroundColor: C.surface, borderColor: C.border }]}>
              <Text style={[styles.hintText, { color: C.textSecondary }]}>
                探索模式下隐藏角色编辑与日记管理，切换到 Admin 可见。
              </Text>
            </View>
          )}
        </View>

        <View style={styles.group}>
          <Text style={[styles.groupLabel, { color: C.textSecondary }]}>功能设置</Text>
          <MenuItem
            icon="💖"
            label="生命"
            description="主动消息、每日通知时间"
            onPress={() => navigation.navigate('LifeSettings')}
          />
          {/* 记忆设置和高级设置入口已在MVP中隐藏 */}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16, paddingTop: 8 },
  pageTitle: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 20,
    marginLeft: 4,
  },
  group: {
    marginBottom: 20,
  },
  modeRow: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 4,
    gap: 6,
  },
  modeOption: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  modeLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  modeDesc: {
    fontSize: 12,
    marginTop: 2,
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
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 8,
  },
  menuIcon: {
    fontSize: 24,
    marginRight: 14,
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
  arrow: {
    fontSize: 22,
  },
});
