/**
 * Ingest Panel Component
 * 
 * **生茶罐 · 多模态入茶界面**
 * 
 * 允许用户上传多种原始输入：
 * - 文本笔记（Markdown、日记、工作日志）
 * - 语音碎碎念转录
 * - 图片 + OCR
 * - 代码调试记录
 * 
 * 显示两段式转译过程：
 * 1. Stage 1: 客观事实提取
 * 2. Stage 2: 鹿芽镜像解读
 * 
 * 生成「待泡茶叶」后可以在茶室中择机冲泡。
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useThemeColors } from '../utils/theme';
import { NOTO_SANS_SC } from '../utils/appFonts';
import { ingestRawMaterial } from '../services/ingestDistillerService';
import type { UnsteepedLeaf } from '../types/harness';

interface IngestPanelProps {
  visible: boolean;
  onClose: () => void;
  characterId: string;
  onLeafCreated?: (leaf: UnsteepedLeaf) => void;
}

export default function IngestPanel({
  visible,
  onClose,
  characterId,
  onLeafCreated,
}: IngestPanelProps) {
  const colors = useThemeColors();
  
  const [inputText, setInputText] = useState('');
  const [processing, setProcessing] = useState(false);
  const [currentLeaf, setCurrentLeaf] = useState<UnsteepedLeaf | null>(null);
  const [stage, setStage] = useState<'input' | 'stage1' | 'stage2' | 'complete'>('input');
  
  const handleIngest = async () => {
    if (!inputText.trim()) return;
    
    setProcessing(true);
    setStage('stage1');
    
    try {
      const leaf = await ingestRawMaterial(characterId, {
        type: 'text',
        content: inputText,
      });
      
      setCurrentLeaf(leaf);
      setStage('complete');
      
      if (onLeafCreated) {
        onLeafCreated(leaf);
      }
      
      setTimeout(() => {
        setProcessing(false);
      }, 500);
    } catch (error) {
      console.error('[IngestPanel] Failed:', error);
      setProcessing(false);
      setStage('input');
    }
  };
  
  const handleReset = () => {
    setInputText('');
    setCurrentLeaf(null);
    setStage('input');
    setProcessing(false);
  };
  
  const handleClosePanel = () => {
    handleReset();
    onClose();
  };
  
  if (!visible) return null;
  
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClosePanel}
    >
      <Pressable style={styles.backdrop} onPress={handleClosePanel}>
        <Pressable style={styles.panel} onPress={(e) => e.stopPropagation()}>
          <View style={[styles.container, { backgroundColor: colors.surface }]}>
            <View style={[styles.handle, { backgroundColor: colors.border }]} />
            
            <View style={styles.header}>
              <Text style={[styles.title, { color: colors.text, fontFamily: NOTO_SANS_SC.bold }]}>
                📝 生茶罐 · 多模态入茶
              </Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary, fontFamily: NOTO_SANS_SC.regular }]}>
                两段式转译：客观事实 → 鹿芽镜像
              </Text>
            </View>
            
            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
              {stage === 'input' && (
                <View>
                  <Text style={[styles.label, { color: colors.textSecondary, fontFamily: NOTO_SANS_SC.medium }]}>
                    输入原始内容
                  </Text>
                  <TextInput
                    style={[styles.textInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                    placeholder="粘贴笔记、日记、工作日志、语音碎碎念转录……"
                    placeholderTextColor={colors.textSecondary}
                    multiline
                    numberOfLines={12}
                    value={inputText}
                    onChangeText={setInputText}
                    textAlignVertical="top"
                  />
                  
                  <TouchableOpacity
                    style={[styles.button, { backgroundColor: colors.primary, opacity: inputText.trim() ? 1 : 0.5 }]}
                    onPress={handleIngest}
                    disabled={!inputText.trim() || processing}
                  >
                    <Text style={[styles.buttonText, { fontFamily: NOTO_SANS_SC.medium }]}>
                      开始转译入茶
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
              
              {(stage === 'stage1' || stage === 'stage2') && (
                <View style={styles.processingView}>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text style={[styles.processingText, { color: colors.textSecondary, fontFamily: NOTO_SANS_SC.medium }]}>
                    {stage === 'stage1' ? '正在提取客观事实...' : '正在进行鹿芽镜像转译...'}
                  </Text>
                </View>
              )}
              
              {stage === 'complete' && currentLeaf && (
                <View>
                  <View style={[styles.resultSection, { borderColor: colors.border }]}>
                    <Text style={[styles.resultTitle, { color: colors.primary, fontFamily: NOTO_SANS_SC.bold }]}>
                      ✓ Stage 1: 客观事实提取
                    </Text>
                    
                    {currentLeaf.objectiveFacts.events.length > 0 && (
                      <View style={styles.resultBlock}>
                        <Text style={[styles.resultLabel, { color: colors.textSecondary, fontFamily: NOTO_SANS_SC.medium }]}>
                          事件：
                        </Text>
                        {currentLeaf.objectiveFacts.events.map((event, idx) => (
                          <Text key={idx} style={[styles.resultItem, { color: colors.text, fontFamily: NOTO_SANS_SC.regular }]}>
                            • {event}
                          </Text>
                        ))}
                      </View>
                    )}
                    
                    {currentLeaf.objectiveFacts.blockers.length > 0 && (
                      <View style={styles.resultBlock}>
                        <Text style={[styles.resultLabel, { color: colors.textSecondary, fontFamily: NOTO_SANS_SC.medium }]}>
                          阻塞点：
                        </Text>
                        {currentLeaf.objectiveFacts.blockers.map((blocker, idx) => (
                          <Text key={idx} style={[styles.resultItem, { color: colors.text, fontFamily: NOTO_SANS_SC.regular }]}>
                            • {blocker}
                          </Text>
                        ))}
                      </View>
                    )}
                    
                    <View style={styles.resultBlock}>
                      <Text style={[styles.resultLabel, { color: colors.textSecondary, fontFamily: NOTO_SANS_SC.medium }]}>
                        紧急程度：
                      </Text>
                      <Text style={[styles.resultItem, { color: colors.text, fontFamily: NOTO_SANS_SC.regular }]}>
                        {currentLeaf.objectiveFacts.urgencyLevel === 'high' ? '🔥 高' :
                         currentLeaf.objectiveFacts.urgencyLevel === 'medium' ? '⚡ 中' :
                         '💤 低'}
                      </Text>
                    </View>
                  </View>
                  
                  <View style={[styles.resultSection, { borderColor: colors.border }]}>
                    <Text style={[styles.resultTitle, { color: colors.primary, fontFamily: NOTO_SANS_SC.bold }]}>
                      ✓ Stage 2: 鹿芽镜像转译
                    </Text>
                    
                    <View style={styles.resultBlock}>
                      <Text style={[styles.resultLabel, { color: colors.textSecondary, fontFamily: NOTO_SANS_SC.medium }]}>
                        反映的模式：
                      </Text>
                      <Text style={[styles.resultItem, { color: colors.text, fontFamily: NOTO_SANS_SC.regular }]}>
                        {currentLeaf.luyaMirrorLens.reflectedPattern}
                      </Text>
                    </View>
                    
                    <View style={styles.resultBlock}>
                      <Text style={[styles.resultLabel, { color: colors.textSecondary, fontFamily: NOTO_SANS_SC.medium }]}>
                        建议话题：
                      </Text>
                      <Text style={[styles.resultItem, { color: colors.text, fontFamily: NOTO_SANS_SC.regular }]}>
                        {currentLeaf.luyaMirrorLens.suggestedBrewTopic}
                      </Text>
                    </View>
                    
                    {currentLeaf.luyaMirrorLens.relevantUserTraits.length > 0 && (
                      <View style={styles.resultBlock}>
                        <Text style={[styles.resultLabel, { color: colors.textSecondary, fontFamily: NOTO_SANS_SC.medium }]}>
                          关联特质：
                        </Text>
                        <View style={styles.traitTags}>
                          {currentLeaf.luyaMirrorLens.relevantUserTraits.map((trait, idx) => (
                            <View key={idx} style={[styles.traitTag, { backgroundColor: colors.accentLight, borderColor: colors.primary }]}>
                              <Text style={[styles.traitTagText, { color: colors.primary, fontFamily: NOTO_SANS_SC.medium }]}>
                                {trait}
                              </Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    )}
                  </View>
                  
                  <View style={[styles.leafCard, { backgroundColor: colors.accentLight, borderColor: colors.primary }]}>
                    <Text style={[styles.leafCardTitle, { color: colors.primary, fontFamily: NOTO_SANS_SC.bold }]}>
                      🍃 待泡茶叶已生成
                    </Text>
                    <Text style={[styles.leafCardText, { color: colors.text, fontFamily: NOTO_SANS_SC.regular }]}>
                      这片茶叶已放入生茶罐，在对话中可以择机冲泡
                    </Text>
                  </View>
                  
                  <View style={styles.actionButtons}>
                    <TouchableOpacity
                      style={[styles.secondaryButton, { borderColor: colors.primary }]}
                      onPress={handleReset}
                    >
                      <Text style={[styles.secondaryButtonText, { color: colors.primary, fontFamily: NOTO_SANS_SC.medium }]}>
                        再转译一份
                      </Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={[styles.button, { backgroundColor: colors.primary, flex: 1, marginLeft: 12 }]}
                      onPress={handleClosePanel}
                    >
                      <Text style={[styles.buttonText, { fontFamily: NOTO_SANS_SC.medium }]}>
                        完成
                      </Text>
                    </TouchableOpacity>
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
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
  },
  content: {
    maxHeight: 520,
  },
  label: {
    fontSize: 13,
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    minHeight: 200,
    marginBottom: 16,
  },
  button: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
  },
  processingView: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  processingText: {
    marginTop: 16,
    fontSize: 14,
  },
  resultSection: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  resultTitle: {
    fontSize: 16,
    marginBottom: 12,
  },
  resultBlock: {
    marginBottom: 12,
  },
  resultLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  resultItem: {
    fontSize: 13,
    lineHeight: 20,
    marginTop: 2,
  },
  traitTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 6,
  },
  traitTag: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginRight: 8,
    marginBottom: 6,
  },
  traitTagText: {
    fontSize: 12,
  },
  leafCard: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  leafCardTitle: {
    fontSize: 16,
    marginBottom: 6,
  },
  leafCardText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
  actionButtons: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  secondaryButton: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    flex: 1,
  },
  secondaryButtonText: {
    fontSize: 14,
  },
});
