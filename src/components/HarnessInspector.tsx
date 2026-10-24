/**
 * Harness Inspector Component
 * 
 * **Harness 透视镜**
 * 
 * 让用户实时查看 Agent Harness 的内部工作状态：
 * 1. 组装的完整 System Prompt
 * 2. 当前激活的技能（基底饮品 + 佐料）
 * 3. 三温层上下文状态（Token 估算、Turn 数）
 * 4. Memory GC 队列
 * 
 * 教育目的：让用户（项目所有者）边用边学 Agent Harness 原理。
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Pressable,
  Platform,
} from 'react-native';
import { useThemeColors } from '../utils/theme';
import { NOTO_SANS_SC } from '../utils/appFonts';
import { assembleSystemPrompt, getBrewSkillRegistry } from '../services/brewSkillRegistry';
import { loadDualPersonaStore, getUserMirrorSummary } from '../services/dualPersonaStore';
import { LUYA_SYSTEM_PROMPT } from '../config/luyaPersona';

interface HarnessInspectorProps {
  visible: boolean;
  onClose: () => void;
  characterId: string;
  currentBaseDrink: string;
  currentModifiers: string[];
  contextTokenEstimate: number;
  hotTurnCount: number;
  warmDigestCount: number;
  coldBottleCount: number;
}

export default function HarnessInspector({
  visible,
  onClose,
  characterId,
  currentBaseDrink,
  currentModifiers,
  contextTokenEstimate,
  hotTurnCount,
  warmDigestCount,
  coldBottleCount,
}: HarnessInspectorProps) {
  const colors = useThemeColors();
  const registry = getBrewSkillRegistry();
  
  const [assembledPrompt, setAssembledPrompt] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'prompt' | 'skills' | 'context'>('prompt');
  
  useEffect(() => {
    if (visible) {
      loadPrompt();
    }
  }, [visible, characterId, currentBaseDrink, currentModifiers]);
  
  const loadPrompt = async () => {
    try {
      const dualPersona = await loadDualPersonaStore(characterId);
      const userMirrorSummary = getUserMirrorSummary(dualPersona.userMirror);
      
      const prompt = assembleSystemPrompt({
        baseDrink: currentBaseDrink,
        modifiers: currentModifiers,
        basePersona: LUYA_SYSTEM_PROMPT,
        userMirrorSummary,
      });
      
      setAssembledPrompt(prompt);
    } catch (error) {
      console.error('[HarnessInspector] Failed to load prompt:', error);
    }
  };
  
  if (!visible) return null;
  
  const baseDrink = registry.baseDrinks[currentBaseDrink];
  const activeModifiers = currentModifiers.map(id => registry.modifiers[id]).filter(Boolean);
  
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.panel} onPress={(e) => e.stopPropagation()}>
          <View style={[styles.container, { backgroundColor: colors.surface }]}>
            <View style={[styles.handle, { backgroundColor: colors.border }]} />
            
            <View style={styles.header}>
              <Text style={[styles.title, { color: colors.text, fontFamily: NOTO_SANS_SC.bold }]}>
                🔍 Harness 透视镜
              </Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary, fontFamily: NOTO_SANS_SC.regular }]}>
                实时查看 Agent Harness 内部状态
              </Text>
            </View>
            
            <View style={styles.tabs}>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'prompt' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
                onPress={() => setActiveTab('prompt')}
              >
                <Text style={[styles.tabText, { color: activeTab === 'prompt' ? colors.primary : colors.textSecondary }]}>
                  Prompt
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.tab, activeTab === 'skills' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
                onPress={() => setActiveTab('skills')}
              >
                <Text style={[styles.tabText, { color: activeTab === 'skills' ? colors.primary : colors.textSecondary }]}>
                  Skills
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.tab, activeTab === 'context' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
                onPress={() => setActiveTab('context')}
              >
                <Text style={[styles.tabText, { color: activeTab === 'context' ? colors.primary : colors.textSecondary }]}>
                  Context
                </Text>
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
              {activeTab === 'prompt' && (
                <View>
                  <Text style={[styles.label, { color: colors.textSecondary, fontFamily: NOTO_SANS_SC.medium }]}>
                    组装的完整 System Prompt
                  </Text>
                  <View style={[styles.codeBlock, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                    <Text style={[styles.codeText, { color: colors.text, fontFamily: 'Courier' }]}>
                      {assembledPrompt || '加载中...'}
                    </Text>
                  </View>
                </View>
              )}
              
              {activeTab === 'skills' && (
                <View>
                  <Text style={[styles.label, { color: colors.textSecondary, fontFamily: NOTO_SANS_SC.medium }]}>
                    当前激活的技能组合
                  </Text>
                  
                  {baseDrink && (
                    <View style={[styles.skillCard, { backgroundColor: colors.accentLight, borderColor: colors.primary }]}>
                      <Text style={[styles.skillTitle, { color: colors.primary, fontFamily: NOTO_SANS_SC.bold }]}>
                        基底饮品 (Base Drink)
                      </Text>
                      <Text style={[styles.skillName, { color: colors.text, fontFamily: NOTO_SANS_SC.medium }]}>
                        {baseDrink.icon} {baseDrink.displayName}
                      </Text>
                      <Text style={[styles.skillDescription, { color: colors.text, fontFamily: NOTO_SANS_SC.regular }]}>
                        {baseDrink.description}
                      </Text>
                      <View style={[styles.codeBlock, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <Text style={[styles.codeText, { color: colors.text, fontFamily: 'Courier', fontSize: 11 }]}>
                          {baseDrink.conversationPhilosophy}
                        </Text>
                      </View>
                    </View>
                  )}
                  
                  {activeModifiers.length > 0 ? (
                    <>
                      <Text style={[styles.label, { color: colors.textSecondary, fontFamily: NOTO_SANS_SC.medium, marginTop: 16 }]}>
                        激活的调节器 (Modifiers)
                      </Text>
                      {activeModifiers.map((modifier) => (
                        <View
                          key={modifier.id}
                          style={[styles.skillCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                        >
                          <Text style={[styles.skillName, { color: colors.text, fontFamily: NOTO_SANS_SC.medium }]}>
                            {modifier.icon} {modifier.displayName}
                          </Text>
                          <Text style={[styles.skillDescription, { color: colors.textSecondary, fontFamily: NOTO_SANS_SC.regular }]}>
                            影响参数: {modifier.affectsParameter} (+{modifier.parameterDelta})
                          </Text>
                          <View style={[styles.codeBlock, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                            <Text style={[styles.codeText, { color: colors.text, fontFamily: 'Courier', fontSize: 11 }]}>
                              {modifier.promptSnippet}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </>
                  ) : (
                    <Text style={[styles.emptyText, { color: colors.textSecondary, fontFamily: NOTO_SANS_SC.regular }]}>
                      未激活任何调节器
                    </Text>
                  )}
                </View>
              )}
              
              {activeTab === 'context' && (
                <View>
                  <Text style={[styles.label, { color: colors.textSecondary, fontFamily: NOTO_SANS_SC.medium }]}>
                    三温层上下文状态
                  </Text>
                  
                  <View style={[styles.contextCard, { backgroundColor: colors.accentLight, borderColor: colors.primary }]}>
                    <Text style={[styles.contextTitle, { color: colors.primary, fontFamily: NOTO_SANS_SC.bold }]}>
                      总体状态
                    </Text>
                    <Text style={[styles.contextItem, { color: colors.text, fontFamily: NOTO_SANS_SC.regular }]}>
                      Token 估算: ~{contextTokenEstimate}
                    </Text>
                  </View>
                  
                  <View style={[styles.contextCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Text style={[styles.contextTitle, { color: colors.text, fontFamily: NOTO_SANS_SC.bold }]}>
                      🔥 热茶层 (Hot Tier)
                    </Text>
                    <Text style={[styles.contextItem, { color: colors.text, fontFamily: NOTO_SANS_SC.regular }]}>
                      最近对话轮数: {hotTurnCount}
                    </Text>
                    <Text style={[styles.contextDescription, { color: colors.textSecondary, fontFamily: NOTO_SANS_SC.regular }]}>
                      原始消息直接进入 Context Window
                    </Text>
                  </View>
                  
                  <View style={[styles.contextCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Text style={[styles.contextTitle, { color: colors.text, fontFamily: NOTO_SANS_SC.bold }]}>
                      💧 温茶层 (Warm Tier / 茶海)
                    </Text>
                    <Text style={[styles.contextItem, { color: colors.text, fontFamily: NOTO_SANS_SC.regular }]}>
                      确认共鸣点数: {warmDigestCount}
                    </Text>
                    <Text style={[styles.contextDescription, { color: colors.textSecondary, fontFamily: NOTO_SANS_SC.regular }]}>
                      用户通过「饮一口 · 回甘」确认的洞察
                    </Text>
                  </View>
                  
                  <View style={[styles.contextCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Text style={[styles.contextTitle, { color: colors.text, fontFamily: NOTO_SANS_SC.bold }]}>
                      ❄️ 冷茶层 (Cold Tier / 博古架)
                    </Text>
                    <Text style={[styles.contextItem, { color: colors.text, fontFamily: NOTO_SANS_SC.regular }]}>
                      召回封存瓶数: {coldBottleCount}
                    </Text>
                    <Text style={[styles.contextDescription, { color: colors.textSecondary, fontFamily: NOTO_SANS_SC.regular }]}>
                      长期记忆选择性召回 + 双向人设
                    </Text>
                    {currentModifiers.includes('peel') && (
                      <Text style={[styles.contextBoost, { color: colors.primary, fontFamily: NOTO_SANS_SC.medium }]}>
                        ✓ 陈皮激活：召回权重 +50%
                      </Text>
                    )}
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  panel: {
    maxHeight: '90%',
  },
  container: {
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
    maxHeight: 520,
  },
  label: {
    fontSize: 13,
    marginBottom: 8,
  },
  codeBlock: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  codeText: {
    fontSize: 12,
    lineHeight: 18,
  },
  skillCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  skillTitle: {
    fontSize: 14,
    marginBottom: 8,
  },
  skillName: {
    fontSize: 15,
    marginBottom: 6,
  },
  skillDescription: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 8,
  },
  emptyText: {
    textAlign: 'center',
    padding: 20,
    fontSize: 13,
  },
  contextCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  contextTitle: {
    fontSize: 15,
    marginBottom: 8,
  },
  contextItem: {
    fontSize: 13,
    marginBottom: 4,
  },
  contextDescription: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  contextBoost: {
    fontSize: 12,
    marginTop: 8,
  },
});
