import React, { useState } from 'react';
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
  value?: string;
}

function MenuItem({ icon, label, description, onPress, color, value }: MenuItemProps) {
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
      {value && <Text style={[styles.menuValue, { color: C.textSecondary }]}>{value}</Text>}
      <Text style={[styles.arrow, { color: C.textSecondary }]}>›</Text>
    </TouchableOpacity>
  );
}

export default function SettingsScreen({ navigation }: Props) {
  const C = useThemeColors();
  const { settings, setAppMode, setDebugNowTs, saveSettings } = useSettingsStore();
  const isAdmin = settings.appMode === 'admin';
  const [advancedTapCount, setAdvancedTapCount] = useState(0);
  const [showAdvancedControls, setShowAdvancedControls] = useState(false);
  const debugNow = settings.advanced.debugNowTs;
  const effectiveNow = debugNow ?? Date.now();
  const connected = settings.service.apiKey.trim().length > 0;
  const connectionLabel = connected ? '已准备好' : '待连接';

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

  const handleVersionTap = async () => {
    const nextCount = advancedTapCount + 1;
    setAdvancedTapCount(nextCount);
    if (nextCount >= 5) {
      setShowAdvancedControls(true);
      if (!isAdmin) {
        setAppMode('admin');
        await saveSettings();
      }
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: C.background }]}>
      <ScrollView contentContainerStyle={styles.scroll} contentInsetAdjustmentBehavior="automatic">
        <View style={styles.hero}>
          <Text style={[styles.pageTitle, { color: C.text }]}>设置</Text>
          <Text style={[styles.pageDesc, { color: C.textSecondary }]}>
            管理她如何回复、何时陪你，以及哪些关系片段会被留下。
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.statusCard, { backgroundColor: C.surface, borderColor: C.border }]}
          onPress={() => navigation.navigate('ServiceSettings')}
          activeOpacity={0.82}
        >
          <View style={[styles.statusIcon, { backgroundColor: connected ? C.primary : C.inputBg }]}>
            <Text style={styles.statusIconText}>{connected ? '✓' : '…'}</Text>
          </View>
          <View style={styles.statusCopy}>
            <Text style={[styles.statusTitle, { color: C.text }]}>服务连接</Text>
            <Text style={[styles.statusDesc, { color: C.textSecondary }]}>
              {connected ? '她已经可以在聊天里实时回复。' : '连接 API 后，聊天、好感和记忆才会正式生效。'}
            </Text>
          </View>
          <Text style={[styles.statusValue, { color: connected ? C.primary : C.textSecondary }]}>{connectionLabel}</Text>
        </TouchableOpacity>

        {showAdvancedControls && (
          <View style={styles.group}>
            <Text style={[styles.groupLabel, { color: C.textSecondary }]}>内部工具</Text>
            <View style={[styles.modeRow, { backgroundColor: C.surface, borderColor: C.border }]}>
              <TouchableOpacity
                style={[styles.modeOption, isAdmin && { backgroundColor: C.primary }]}
                onPress={() => handleModeChange('admin')}
                activeOpacity={0.8}
              >
                <Text style={[styles.modeLabel, { color: isAdmin ? '#fff' : C.text }]}>高级模式</Text>
                <Text style={[styles.modeDesc, { color: isAdmin ? 'rgba(255,255,255,0.9)' : C.textSecondary }]}>
                  显示角色编辑与关系沉淀工具
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeOption, !isAdmin && { backgroundColor: C.primary }]}
                onPress={() => handleModeChange('explore')}
                activeOpacity={0.8}
              >
                <Text style={[styles.modeLabel, { color: !isAdmin ? '#fff' : C.text }]}>陪伴模式</Text>
                <Text style={[styles.modeDesc, { color: !isAdmin ? 'rgba(255,255,255,0.9)' : C.textSecondary }]}>
                  保留聊天、记忆漫画和日常陪伴
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {showAdvancedControls && (
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
        )}

        {showAdvancedControls && isAdmin && (
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
        )}

        <View style={styles.group}>
          <Text style={[styles.groupLabel, { color: C.textSecondary }]}>陪伴体验</Text>
          <MenuItem
            icon="▣"
            label="记忆漫画"
            description="查看她记住的多格漫画与关系片段"
            onPress={() => navigation.navigate('MemorySettings')}
          />
          <MenuItem
            icon="♡"
            label="陪伴提醒"
            description="每日提醒、主动问候和安静陪伴"
            onPress={() => navigation.navigate('LifeSettings')}
            value={settings.life.enabled ? '开启' : '关闭'}
          />
          <MenuItem
            icon="⌁"
            label="连接服务"
            description="API 密钥、模型和连接测试"
            onPress={() => navigation.navigate('ServiceSettings')}
            value={connectionLabel}
          />
          {showAdvancedControls && isAdmin && (
            <MenuItem
              icon="⚙"
              label="内部参数"
              description="兼容模式、主题、发送延迟"
              onPress={() => navigation.navigate('AdvancedSettings')}
            />
          )}
        </View>

        <TouchableOpacity style={styles.versionTap} onPress={handleVersionTap} activeOpacity={0.7}>
          <Text style={[styles.versionText, { color: C.textSecondary }]}>HeartBeat Companion · v1.0</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16, paddingTop: 8, paddingBottom: 28 },
  hero: {
    marginBottom: 16,
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
