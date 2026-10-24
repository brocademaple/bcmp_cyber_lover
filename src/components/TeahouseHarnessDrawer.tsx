/**
 * Teahouse Harness Drawer
 * 
 * **茶室 Harness 操作面板**
 * 
 * 这是 Agent Harness 架构的主要 UI 入口，提供：
 * 1. 基底饮品切换 (乌龙/黑咖/洋甘菊/薄茶)
 * 2. 佐料调节器开关 (鲜奶/方糖/陈皮/冰块)
 * 3. 生茶罐入茶界面 (多模态输入)
 * 4. 茶宠博古架展示
 * 5. Harness 透视镜 (Inspector)
 * 
 * 设计风格：
 * - 浮动抽屉，从底部或侧面滑入
 * - SoftSweet 主题（雾粉 + 香槟金）
 * - 半透明毛玻璃效果
 * - 中等装饰度，避免重盒子感
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  Pressable,
  TextInput,
  Platform,
} from 'react-native';
import { useThemeColors } from '../utils/theme';
import { NOTO_SANS_SC } from '../utils/appFonts';
import { getBrewSkillRegistry } from '../services/brewSkillRegistry';
import type { BaseDrinkSkill, DrinkModifier } from '../types/harness';

interface TeahouseHarnessDrawerProps {
  visible: boolean;
  onClose: () => void;
  currentBaseDrink: string;
  currentModifiers: string[];
  onBaseDrinkChange: (drinkId: string) => void;
  onModifierToggle: (modifierId: string) => void;
  onOpenIngest: () => void;
  onOpenShelf: () => void;
  onOpenInspector: () => void;
  onOpenSettlement: () => void;
}

export default function TeahouseHarnessDrawer({
  visible,
  onClose,
  currentBaseDrink,
  currentModifiers,
  onBaseDrinkChange,
  onModifierToggle,
  onOpenIngest,
  onOpenShelf,
  onOpenInspector,
  onOpenSettlement,
}: TeahouseHarnessDrawerProps) {
  const colors = useThemeColors();
  const registry = getBrewSkillRegistry();
  
  const [activeTab, setActiveTab] = useState<'drinks' | 'modifiers' | 'tools'>('drinks');
  
  if (!visible) return null;
  
  const baseDrinks = Object.values(registry.baseDrinks);
  const modifiers = Object.values(registry.modifiers);
  
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.drawerContainer} onPress={(e) => e.stopPropagation()}>
          <View style={[styles.drawer, { 
            backgroundColor: 'rgba(253, 248, 245, 0.92)',
            borderTopWidth: 1,
            borderLeftWidth: 0.5,
            borderRightWidth: 0.5,
            borderColor: '#C4A574',
          }]}>
            <View style={[styles.handle, { backgroundColor: '#C4A574' }]} />
            
            <View style={styles.header}>
              <Text style={[styles.title, { color: colors.text, fontFamily: NOTO_SANS_SC.bold }]}>
                茶室 Harness 操控台
              </Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary, fontFamily: NOTO_SANS_SC.regular }]}>
                调制专属对话风格
              </Text>
            </View>
            
            <View style={styles.tabs}>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'drinks' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
                onPress={() => setActiveTab('drinks')}
              >
                <Text style={[styles.tabText, { color: activeTab === 'drinks' ? colors.primary : colors.textSecondary }]}>
                  🍵 基底饮品
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.tab, activeTab === 'modifiers' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
                onPress={() => setActiveTab('modifiers')}
              >
                <Text style={[styles.tabText, { color: activeTab === 'modifiers' ? colors.primary : colors.textSecondary }]}>
                  🥛 加料佐料
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.tab, activeTab === 'tools' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
                onPress={() => setActiveTab('tools')}
              >
                <Text style={[styles.tabText, { color: activeTab === 'tools' ? colors.primary : colors.textSecondary }]}>
                  🔧 工具箱
                </Text>
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
              {activeTab === 'drinks' && (
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: colors.textSecondary, fontFamily: NOTO_SANS_SC.medium }]}>
                    选择对话模式
                  </Text>
                  {baseDrinks.map((drink) => (
                    <DrinkCard
                      key={drink.id}
                      drink={drink}
                      selected={currentBaseDrink === drink.id}
                      onPress={() => onBaseDrinkChange(drink.id)}
                      colors={colors}
                    />
                  ))}
                </View>
              )}
              
              {activeTab === 'modifiers' && (
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: colors.textSecondary, fontFamily: NOTO_SANS_SC.medium }]}>
                    实时调节器（可多选）
                  </Text>
                  {modifiers.map((modifier) => (
                    <ModifierCard
                      key={modifier.id}
                      modifier={modifier}
                      active={currentModifiers.includes(modifier.id)}
                      onToggle={() => onModifierToggle(modifier.id)}
                      colors={colors}
                    />
                  ))}
                </View>
              )}
              
              {activeTab === 'tools' && (
                <View style={styles.section}>
                  <ToolButton
                    icon="📝"
                    title="生茶罐 · 多模态入茶"
                    description="上传笔记、语音碎碎念、代码日志"
                    onPress={onOpenIngest}
                    colors={colors}
                  />
                  <ToolButton
                    icon="🏺"
                    title="茶宠博古架"
                    description="查看自我发现收藏与包浆进度"
                    onPress={onOpenShelf}
                    colors={colors}
                  />
                  <ToolButton
                    icon="🔍"
                    title="Harness 透视镜"
                    description="查看组装的 System Prompt 与上下文状态"
                    onPress={onOpenInspector}
                    colors={colors}
                  />
                  <ToolButton
                    icon="🍃"
                    title="收席封瓶 · 三态复盘"
                    description="结束当前会话，分拣封瓶/更新/遗忘"
                    onPress={onOpenSettlement}
                    colors={colors}
                  />
                </View>
              )}
            </ScrollView>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function DrinkCard({
  drink,
  selected,
  onPress,
  colors,
}: {
  drink: BaseDrinkSkill;
  selected: boolean;
  onPress: () => void;
  colors: any;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.card,
        { 
          backgroundColor: selected ? 'rgba(231, 160, 180, 0.15)' : 'rgba(253, 248, 245, 0.6)', 
          borderColor: selected ? '#E7A0B4' : '#C4A574',
        },
      ]}
      onPress={onPress}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.cardIcon}>{drink.icon}</Text>
        <Text style={[styles.cardTitle, { color: colors.text, fontFamily: NOTO_SANS_SC.medium }]}>
          {drink.displayName}
        </Text>
      </View>
      <Text style={[styles.cardDescription, { color: colors.textSecondary, fontFamily: NOTO_SANS_SC.regular }]}>
        {drink.description}
      </Text>
      <Text style={[styles.cardBestFor, { color: colors.textSecondary, fontFamily: NOTO_SANS_SC.regular }]}>
        适合：{drink.bestFor.join(' · ')}
      </Text>
    </TouchableOpacity>
  );
}

function ModifierCard({
  modifier,
  active,
  onToggle,
  colors,
}: {
  modifier: DrinkModifier;
  active: boolean;
  onToggle: () => void;
  colors: any;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.card,
        styles.modifierCard,
        { 
          backgroundColor: active ? 'rgba(231, 160, 180, 0.15)' : 'rgba(253, 248, 245, 0.6)', 
          borderColor: active ? '#E7A0B4' : '#C4A574',
        },
      ]}
      onPress={onToggle}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.cardIcon}>{modifier.icon}</Text>
        <Text style={[styles.cardTitle, { color: colors.text, fontFamily: NOTO_SANS_SC.medium }]}>
          {modifier.displayName}
        </Text>
        {active && (
          <View style={[styles.activeBadge, { backgroundColor: colors.primary }]}>
            <Text style={[styles.activeBadgeText, { fontFamily: NOTO_SANS_SC.medium }]}>✓</Text>
          </View>
        )}
      </View>
      <Text style={[styles.cardDescription, { color: colors.textSecondary, fontFamily: NOTO_SANS_SC.regular }]}>
        {modifier.description}
      </Text>
    </TouchableOpacity>
  );
}

function ToolButton({
  icon,
  title,
  description,
  onPress,
  colors,
}: {
  icon: string;
  title: string;
  description: string;
  onPress: () => void;
  colors: any;
}) {
  return (
    <TouchableOpacity
      style={[styles.toolButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={onPress}
    >
      <Text style={styles.toolIcon}>{icon}</Text>
      <View style={styles.toolContent}>
        <Text style={[styles.toolTitle, { color: colors.text, fontFamily: NOTO_SANS_SC.medium }]}>
          {title}
        </Text>
        <Text style={[styles.toolDescription, { color: colors.textSecondary, fontFamily: NOTO_SANS_SC.regular }]}>
          {description}
        </Text>
      </View>
      <Text style={[styles.toolArrow, { color: colors.textSecondary }]}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  drawerContainer: {
    maxHeight: '85%',
  },
  drawer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tabText: {
    fontSize: 14,
  },
  content: {
    maxHeight: 480,
  },
  section: {
    paddingBottom: 20,
  },
  sectionTitle: {
    fontSize: 12,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  card: {
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  modifierCard: {
    borderRadius: 12,
    padding: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardIcon: {
    fontSize: 24,
    marginRight: 8,
  },
  cardTitle: {
    fontSize: 16,
    flex: 1,
  },
  activeBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeBadgeText: {
    color: '#fff',
    fontSize: 12,
  },
  cardDescription: {
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 6,
  },
  cardBestFor: {
    fontSize: 12,
    lineHeight: 18,
  },
  toolButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  toolIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  toolContent: {
    flex: 1,
  },
  toolTitle: {
    fontSize: 15,
    marginBottom: 4,
  },
  toolDescription: {
    fontSize: 12,
    lineHeight: 18,
  },
  toolArrow: {
    fontSize: 24,
    marginLeft: 8,
  },
});
