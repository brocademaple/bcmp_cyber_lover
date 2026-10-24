/**
 * Session Settlement Modal
 * 
 * **会话封瓶三态分拣界面**
 * 
 * 在会话结束时显示 LLM 生成的三态分拣卡：
 * 1. 封瓶存留 (seal): 关键自我发现
 * 2. 刷新认知 (update): 更新用户镜像
 * 3. 倒掉废茶 (discard): 永久遗忘的噪音
 * 
 * 用户可以勾选/取消选择，确认后执行。
 */

import React, { useState } from 'react';
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
import type { SessionSettlementCard } from '../types/harness';

interface SessionSettlementModalProps {
  visible: boolean;
  onClose: () => void;
  settlementCard: SessionSettlementCard | null;
  onConfirm: (selection: {
    sealIds: number[];
    updateConfirmed: boolean;
    discardIds: number[];
  }) => void;
}

export default function SessionSettlementModal({
  visible,
  onClose,
  settlementCard,
  onConfirm,
}: SessionSettlementModalProps) {
  const colors = useThemeColors();
  
  const [selectedSealIds, setSelectedSealIds] = useState<number[]>([]);
  const [updateConfirmed, setUpdateConfirmed] = useState(false);
  const [selectedDiscardIds, setSelectedDiscardIds] = useState<number[]>([]);
  
  if (!visible || !settlementCard) return null;
  
  const toggleSeal = (idx: number) => {
    setSelectedSealIds(prev =>
      prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
    );
  };
  
  const toggleDiscard = (idx: number) => {
    setSelectedDiscardIds(prev =>
      prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
    );
  };
  
  const handleConfirm = () => {
    onConfirm({
      sealIds: selectedSealIds,
      updateConfirmed,
      discardIds: selectedDiscardIds,
    });
    resetState();
  };
  
  const handleSkip = () => {
    onClose();
    resetState();
  };
  
  const resetState = () => {
    setSelectedSealIds([]);
    setUpdateConfirmed(false);
    setSelectedDiscardIds([]);
  };
  
  const hasSelection = selectedSealIds.length > 0 || updateConfirmed || selectedDiscardIds.length > 0;
  
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleSkip}
    >
      <Pressable style={styles.backdrop} onPress={handleSkip}>
        <Pressable style={styles.panel} onPress={(e) => e.stopPropagation()}>
          <View style={[styles.container, { backgroundColor: colors.surface }]}>
            <View style={[styles.handle, { backgroundColor: colors.border }]} />
            
            <View style={styles.header}>
              <Text style={[styles.title, { color: colors.text, fontFamily: NOTO_SANS_SC.bold }]}>
                🍃 收席封瓶 · 三态分拣
              </Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary, fontFamily: NOTO_SANS_SC.regular }]}>
                选择需要封存、更新或遗忘的内容
              </Text>
            </View>
            
            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
              {settlementCard.toSeal.length > 0 && (
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: colors.primary, fontFamily: NOTO_SANS_SC.bold }]}>
                    ✨ 封瓶存留 (Seal)
                  </Text>
                  <Text style={[styles.sectionHint, { color: colors.textSecondary, fontFamily: NOTO_SANS_SC.regular }]}>
                    关键自我发现，结晶为瓶子并滋养茶宠
                  </Text>
                  
                  {settlementCard.toSeal.map((item, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={[
                        styles.card,
                        {
                          backgroundColor: selectedSealIds.includes(idx) ? colors.accentLight : colors.surface,
                          borderColor: selectedSealIds.includes(idx) ? colors.primary : colors.border,
                        },
                      ]}
                      onPress={() => toggleSeal(idx)}
                    >
                      <View style={styles.cardHeader}>
                        <View style={[
                          styles.checkbox,
                          {
                            backgroundColor: selectedSealIds.includes(idx) ? colors.primary : 'transparent',
                            borderColor: colors.border,
                          },
                        ]}>
                          {selectedSealIds.includes(idx) && (
                            <Text style={styles.checkmark}>✓</Text>
                          )}
                        </View>
                        <Text style={[styles.petBadge, { color: colors.primary, fontFamily: NOTO_SANS_SC.medium }]}>
                          {getPetIcon(item.nourishes)} {getPetName(item.nourishes)}
                        </Text>
                      </View>
                      <Text style={[styles.cardText, { color: colors.text, fontFamily: NOTO_SANS_SC.regular }]}>
                        {item.insight}
                      </Text>
                      <Text style={[styles.cardMeta, { color: colors.textSecondary, fontFamily: NOTO_SANS_SC.regular }]}>
                        包浆贡献：+{item.estimatedPatinaExp}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              
              {(settlementCard.toUpdate.traits?.length || settlementCard.toUpdate.currentFocus?.length || settlementCard.toUpdate.resolvedBlockers?.length) && (
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: colors.primary, fontFamily: NOTO_SANS_SC.bold }]}>
                    🔄 刷新认知 (Update)
                  </Text>
                  <Text style={[styles.sectionHint, { color: colors.textSecondary, fontFamily: NOTO_SANS_SC.regular }]}>
                    更新用户镜像中的特质、关注与已解决问题
                  </Text>
                  
                  <TouchableOpacity
                    style={[
                      styles.card,
                      {
                        backgroundColor: updateConfirmed ? colors.accentLight : colors.surface,
                        borderColor: updateConfirmed ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => setUpdateConfirmed(!updateConfirmed)}
                  >
                    <View style={styles.cardHeader}>
                      <View style={[
                        styles.checkbox,
                        {
                          backgroundColor: updateConfirmed ? colors.primary : 'transparent',
                          borderColor: colors.border,
                        },
                      ]}>
                        {updateConfirmed && (
                          <Text style={styles.checkmark}>✓</Text>
                        )}
                      </View>
                      <Text style={[styles.updateLabel, { color: colors.text, fontFamily: NOTO_SANS_SC.medium }]}>
                        确认更新用户镜像
                      </Text>
                    </View>
                    
                    {settlementCard.toUpdate.traits && settlementCard.toUpdate.traits.length > 0 && (
                      <View style={styles.updateBlock}>
                        <Text style={[styles.updateBlockTitle, { color: colors.textSecondary, fontFamily: NOTO_SANS_SC.medium }]}>
                          新识别特质：
                        </Text>
                        <View style={styles.tags}>
                          {settlementCard.toUpdate.traits.map((trait, idx) => (
                            <View key={idx} style={[styles.tag, { backgroundColor: colors.accentLight, borderColor: colors.primary }]}>
                              <Text style={[styles.tagText, { color: colors.primary, fontFamily: NOTO_SANS_SC.regular }]}>
                                {trait}
                              </Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    )}
                    
                    {settlementCard.toUpdate.currentFocus && settlementCard.toUpdate.currentFocus.length > 0 && (
                      <View style={styles.updateBlock}>
                        <Text style={[styles.updateBlockTitle, { color: colors.textSecondary, fontFamily: NOTO_SANS_SC.medium }]}>
                          新的关注：
                        </Text>
                        {settlementCard.toUpdate.currentFocus.map((focus, idx) => (
                          <Text key={idx} style={[styles.updateItem, { color: colors.text, fontFamily: NOTO_SANS_SC.regular }]}>
                            • {focus}
                          </Text>
                        ))}
                      </View>
                    )}
                    
                    {settlementCard.toUpdate.resolvedBlockers && settlementCard.toUpdate.resolvedBlockers.length > 0 && (
                      <View style={styles.updateBlock}>
                        <Text style={[styles.updateBlockTitle, { color: colors.textSecondary, fontFamily: NOTO_SANS_SC.medium }]}>
                          已解决障碍：
                        </Text>
                        {settlementCard.toUpdate.resolvedBlockers.map((blocker, idx) => (
                          <Text key={idx} style={[styles.updateItem, { color: colors.text, fontFamily: NOTO_SANS_SC.regular }]}>
                            • {blocker}
                          </Text>
                        ))}
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              )}
              
              {settlementCard.toDiscard.length > 0 && (
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: colors.danger, fontFamily: NOTO_SANS_SC.bold }]}>
                    🗑 倒掉废茶 (Discard)
                  </Text>
                  <Text style={[styles.sectionHint, { color: colors.textSecondary, fontFamily: NOTO_SANS_SC.regular }]}>
                    纯情绪发泄与噪音，永久遗忘（Memory GC）
                  </Text>
                  
                  {settlementCard.toDiscard.map((item, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={[
                        styles.card,
                        {
                          backgroundColor: selectedDiscardIds.includes(idx) ? 'rgba(226, 85, 99, 0.1)' : colors.surface,
                          borderColor: selectedDiscardIds.includes(idx) ? colors.danger : colors.border,
                        },
                      ]}
                      onPress={() => toggleDiscard(idx)}
                    >
                      <View style={styles.cardHeader}>
                        <View style={[
                          styles.checkbox,
                          {
                            backgroundColor: selectedDiscardIds.includes(idx) ? colors.danger : 'transparent',
                            borderColor: colors.border,
                          },
                        ]}>
                          {selectedDiscardIds.includes(idx) && (
                            <Text style={styles.checkmark}>✓</Text>
                          )}
                        </View>
                      </View>
                      <Text style={[styles.cardText, { color: colors.text, fontFamily: NOTO_SANS_SC.regular }]}>
                        {item.snippet}
                      </Text>
                      <Text style={[styles.cardMeta, { color: colors.textSecondary, fontFamily: NOTO_SANS_SC.regular }]}>
                        原因：{item.reason}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </ScrollView>
            
            <View style={styles.footer}>
              <TouchableOpacity
                style={[styles.footerButton, { borderColor: colors.border }]}
                onPress={handleSkip}
              >
                <Text style={[styles.footerButtonText, { color: colors.textSecondary, fontFamily: NOTO_SANS_SC.medium }]}>
                  跳过
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.footerButton,
                  styles.footerButtonPrimary,
                  { backgroundColor: colors.primary, opacity: hasSelection ? 1 : 0.5 },
                ]}
                onPress={handleConfirm}
                disabled={!hasSelection}
              >
                <Text style={[styles.footerButtonTextPrimary, { fontFamily: NOTO_SANS_SC.medium }]}>
                  确认封瓶
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function getPetIcon(nourishes: string): string {
  const icons: Record<string, string> = {
    clarity_deer: '🦌',
    action_cat: '🐱',
    ease_fox: '🦊',
    spark_bird: '🐦',
  };
  return icons[nourishes] || '🏺';
}

function getPetName(nourishes: string): string {
  const names: Record<string, string> = {
    clarity_deer: '澄明',
    action_cat: '笃行',
    ease_fox: '松弛',
    spark_bird: '灵光',
  };
  return names[nourishes] || nourishes;
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
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
    shadowOpacity: 0.2,
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
  content: {
    maxHeight: 500,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    marginBottom: 4,
  },
  sectionHint: {
    fontSize: 12,
    marginBottom: 12,
    lineHeight: 18,
  },
  card: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmark: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  petBadge: {
    fontSize: 13,
  },
  cardText: {
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 6,
  },
  cardMeta: {
    fontSize: 11,
  },
  updateLabel: {
    fontSize: 14,
  },
  updateBlock: {
    marginTop: 10,
  },
  updateBlockTitle: {
    fontSize: 12,
    marginBottom: 6,
  },
  updateItem: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 2,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tag: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 6,
    marginBottom: 6,
  },
  tagText: {
    fontSize: 11,
  },
  footer: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 12,
  },
  footerButton: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  footerButtonPrimary: {
    borderWidth: 0,
  },
  footerButtonText: {
    fontSize: 15,
  },
  footerButtonTextPrimary: {
    color: '#fff',
    fontSize: 15,
  },
});
