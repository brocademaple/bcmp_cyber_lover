import React from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity } from 'react-native';
import { useThemeColors } from '../utils/theme';
import { YINZHI_BODY, YINZHI_TITLE } from '../utils/appFonts';

interface SettingsRowProps {
  label: string;
  description?: string;
  value?: boolean;
  disabled?: boolean;
  onToggle?: (val: boolean) => void;
  onPress?: () => void;
  showArrow?: boolean;
  children?: React.ReactNode;
}

export function SettingsRow({
  label,
  description,
  value,
  disabled,
  onToggle,
  onPress,
  showArrow,
  children,
}: SettingsRowProps) {
  const C = useThemeColors();

  const content = (
    <View style={[styles.row, { borderBottomColor: C.border }]}>
      <View style={styles.labelSection}>
        <Text style={[styles.label, { color: C.text }]}>{label}</Text>
        {description && (
          <Text style={[styles.description, { color: C.textSecondary }]}>{description}</Text>
        )}
      </View>
      <View style={styles.controlSection}>
        {children}
        {onToggle !== undefined && (
          <Switch
            accessibilityLabel={label}
            disabled={disabled}
            value={value}
            onValueChange={onToggle}
            trackColor={{ false: C.border, true: C.primary }}
            thumbColor="#fff"
          />
        )}
        {showArrow && (
          <Text style={[styles.arrow, { color: C.textSecondary }]}>›</Text>
        )}
      </View>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.6}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

export function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  const C = useThemeColors();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: C.primary }]}>{title}</Text>
      <View style={[styles.sectionCard, { backgroundColor: C.surface, borderColor: C.border }]}>
        {children}
      </View>
    </View>
  );
}

export default SettingsRow;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 58,
  },
  labelSection: {
    flex: 1,
    marginRight: 12,
  },
  label: {
    fontSize: 15,
    fontFamily: YINZHI_BODY.medium,
    fontWeight: undefined,
  },
  description: {
    fontSize: 12,
    marginTop: 3,
    lineHeight: 17,
    fontFamily: YINZHI_BODY.regular,
  },
  controlSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  arrow: {
    fontSize: 22,
    marginLeft: 4,
    fontFamily: YINZHI_BODY.regular,
  },
  section: {
    marginBottom: 20,
    marginHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: YINZHI_TITLE,
    fontWeight: undefined,
    marginBottom: 8,
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  sectionCard: {
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
});
