/**
 * Sip Calibration Button Component
 * 
 * **饮茶双向校准按钮**
 * 
 * 在鹿芽的回复中添加可交互的「校准点」：
 * - 用户可以点击「回甘」确认某个洞察说对了
 * - 用户可以点击「添水」修正某个理解偏差
 * 
 * 这是 Agent Harness 的核心双向校准机制的 UI 呈现。
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  Pressable,
  Platform,
} from 'react-native';
import { useThemeColors } from '../utils/theme';
import { NOTO_SANS_SC } from '../utils/appFonts';

interface SipCalibrationButtonProps {
  pointId: string;
  snippet: string;
  onResonate: () => void;
  onAdjust: (note: string) => void;
}

export default function SipCalibrationButton({
  pointId,
  snippet,
  onResonate,
  onAdjust,
}: SipCalibrationButtonProps) {
  const colors = useThemeColors();
  
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustmentNote, setAdjustmentNote] = useState('');
  const [calibrated, setCalibrated] = useState<'resonate' | 'adjust' | null>(null);
  
  const handleResonate = () => {
    setCalibrated('resonate');
    onResonate();
  };
  
  const handleAdjustSubmit = () => {
    if (adjustmentNote.trim()) {
      setCalibrated('adjust');
      onAdjust(adjustmentNote.trim());
      setShowAdjustModal(false);
      setAdjustmentNote('');
    }
  };
  
  if (calibrated) {
    return (
      <View style={[styles.calibratedBadge, { backgroundColor: colors.accentLight, borderColor: colors.primary }]}>
        <Text style={[styles.calibratedText, { color: colors.primary, fontFamily: NOTO_SANS_SC.medium }]}>
          {calibrated === 'resonate' ? '✓ 回甘确认' : '✓ 已校准'}
        </Text>
      </View>
    );
  }
  
  return (
    <>
      <View style={[styles.container, { backgroundColor: colors.accentLight }]}>
        <Text style={[styles.hint, { color: colors.textSecondary, fontFamily: NOTO_SANS_SC.regular }]}>
          这口茶味道如何？
        </Text>
        <View style={styles.buttons}>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={handleResonate}
          >
            <Text style={[styles.buttonText, { color: colors.text, fontFamily: NOTO_SANS_SC.medium }]}>
              回甘 · 说对了
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => setShowAdjustModal(true)}
          >
            <Text style={[styles.buttonText, { color: colors.text, fontFamily: NOTO_SANS_SC.medium }]}>
              添水 · 还没说准
            </Text>
          </TouchableOpacity>
        </View>
      </View>
      
      <Modal
        visible={showAdjustModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAdjustModal(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setShowAdjustModal(false)}>
          <Pressable style={[styles.modalContent, { backgroundColor: colors.surface }]} onPress={(e) => e.stopPropagation()}>
            <Text style={[styles.modalTitle, { color: colors.text, fontFamily: NOTO_SANS_SC.bold }]}>
              校准理解偏差
            </Text>
            <Text style={[styles.modalSnippet, { color: colors.textSecondary, fontFamily: NOTO_SANS_SC.regular }]}>
              {snippet}
            </Text>
            
            <Text style={[styles.modalLabel, { color: colors.textSecondary, fontFamily: NOTO_SANS_SC.medium }]}>
              实际情况：
            </Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
              placeholder="帮我修正一下理解……"
              placeholderTextColor={colors.textSecondary}
              multiline
              numberOfLines={4}
              value={adjustmentNote}
              onChangeText={setAdjustmentNote}
              textAlignVertical="top"
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, { borderColor: colors.border }]}
                onPress={() => setShowAdjustModal(false)}
              >
                <Text style={[styles.modalButtonText, { color: colors.textSecondary, fontFamily: NOTO_SANS_SC.medium }]}>
                  取消
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary, { backgroundColor: colors.primary, opacity: adjustmentNote.trim() ? 1 : 0.5 }]}
                onPress={handleAdjustSubmit}
                disabled={!adjustmentNote.trim()}
              >
                <Text style={[styles.modalButtonTextPrimary, { fontFamily: NOTO_SANS_SC.medium }]}>
                  确认校准
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
  },
  hint: {
    fontSize: 12,
    marginBottom: 8,
  },
  buttons: {
    flexDirection: 'row',
    gap: 8,
  },
  button: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 13,
  },
  calibratedBadge: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  calibratedText: {
    fontSize: 12,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 18,
    marginBottom: 8,
  },
  modalSnippet: {
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 16,
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
  },
  modalLabel: {
    fontSize: 13,
    marginBottom: 8,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 100,
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalButtonPrimary: {
    borderWidth: 0,
  },
  modalButtonText: {
    fontSize: 14,
  },
  modalButtonTextPrimary: {
    color: '#fff',
    fontSize: 14,
  },
});
