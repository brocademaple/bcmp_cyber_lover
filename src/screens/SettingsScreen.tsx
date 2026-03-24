import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { useThemeColors } from '../utils/theme';

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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: C.background }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[styles.pageTitle, { color: C.primary }]}>设置</Text>

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
          <MenuItem
            icon="👤"
            label="编辑角色"
            description="自定义AI伴侣的性格和设定"
            onPress={() => navigation.navigate('CharacterEditor', {})}
          />
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
