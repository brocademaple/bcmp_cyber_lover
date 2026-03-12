import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { EmotionalState } from '../types';
import { getMoodEmoji, getIntimacyLevel } from '../services/emotionService';
import { useThemeColors } from '../utils/theme';

interface Props {
  emotionalState: EmotionalState;
}

export default function EmotionalStateBar({ emotionalState }: Props) {
  const { mood, intimacy, energy } = emotionalState;
  const C = useThemeColors();

  return (
    <View style={styles.container}>
      <Text style={[styles.item, { color: C.textSecondary }]}>
        {getMoodEmoji(mood)} {mood}
      </Text>
      <Text style={[styles.item, { color: C.textSecondary }]}>
        💕 {getIntimacyLevel(intimacy)} ({intimacy})
      </Text>
      <Text style={[styles.item, { color: C.textSecondary }]}>
        ⚡ {energy}%
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  item: {
    fontSize: 12,
  },
});
