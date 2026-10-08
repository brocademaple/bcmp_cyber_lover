import React, { type ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeColors } from '../utils/theme';

interface Props {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

/** Shared, keyboard-aware selection surface; preview stays local until a caller applies it. */
export default function ExperienceSheet({ visible, title, subtitle, onClose, children, footer }: Props) {
  const C = useThemeColors();
  if (!visible) return null;
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel={`关闭${title}`} />
        <SafeAreaView edges={['bottom']} style={[styles.sheet, { backgroundColor: C.surface, borderColor: C.border }]} accessibilityViewIsModal>
          <View style={[styles.handle, { backgroundColor: C.border }]} />
          <View style={styles.header}>
            <View style={styles.heading}>
              <Text style={[styles.title, { color: C.text }]} accessibilityRole="header">{title}</Text>
              {subtitle ? <Text style={[styles.subtitle, { color: C.textSecondary }]}>{subtitle}</Text> : null}
            </View>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={`关闭${title}`} style={({ pressed }) => [styles.close, { backgroundColor: pressed ? C.inputBg : C.background }]}>
              <Text style={[styles.closeText, { color: C.text }]}>×</Text>
            </Pressable>
          </View>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator>
            {children}
          </ScrollView>
          {footer ? <View style={[styles.footer, { borderColor: C.border }]}>{footer}</View> : null}
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(28, 31, 26, 0.42)' },
  sheet: { width: '100%', maxWidth: 680, maxHeight: '84%', borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  handle: { width: 40, height: 4, borderRadius: 2, marginTop: 10, marginBottom: 4, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 14 },
  heading: { flex: 1, minWidth: 0, gap: 5 },
  title: { fontSize: 20, fontWeight: '600', lineHeight: 28 },
  subtitle: { fontSize: 13, lineHeight: 21 },
  close: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontSize: 28, lineHeight: 32 },
  scroll: { flexShrink: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 22, gap: 12 },
  footer: { padding: 16, borderTopWidth: StyleSheet.hairlineWidth, gap: 10 },
});
