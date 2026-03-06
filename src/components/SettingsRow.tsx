import React from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity } from 'react-native';
import { useThemeColors } from '../utils/theme';

interface SettingsRowProps {
  label: string;
  description?: string;
  value?: boolean;
  onToggle?: (val: boolean) => void;
  onPress?: () => void;
  showArrow?: boolean;
  children?: React.ReactNode;
}

export function SettingsRow({
  label,
  description,
  value,
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

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 54,
  },
  labelSection: {
    flex: 1,
    marginRight: 12,
  },
  label: {
    fontSize: 15,
    fontWeight: '400',
  },
  description: {
    fontSize: 12,
    marginTop: 3,
    lineHeight: 17,
  },
  controlSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  arrow: {
    fontSize: 22,
    marginLeft: 4,
  },
  section: {
    marginBottom: 20,
    marginHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionCard: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
});
