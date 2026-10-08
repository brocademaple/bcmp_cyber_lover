import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import ResilientImage from '../components/ResilientImage';
import { getDefaultCharacterAssetSet } from '../utils/characterAssets';

const avatarAsset = getDefaultCharacterAssetSet('qingning')!.headshot!;
const LOCAL_AVATAR = typeof avatarAsset === 'string' ? { uri: avatarAsset } : avatarAsset;
const MISSING_PRIMARY = { uri: '/__missing_avatar_probe__.png' };
const MISSING_FALLBACK = { uri: '/__missing_avatar_fallback_probe__.png' };

/** Development-only visual probe. No settings, chats, credentials, or persistent data. */
export default function ImageRecoveryProbe() {
  const [primaryErrors, setPrimaryErrors] = useState(0);
  const [primaryLoads, setPrimaryLoads] = useState(0);
  const [allErrors, setAllErrors] = useState(0);
  const [recoveryLoads, setRecoveryLoads] = useState(0);
  const [recovered, setRecovered] = useState(false);
  const [recoveryKey, setRecoveryKey] = useState(0);

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Text style={styles.title} accessibilityRole="header">图片恢复验收</Text>
      <Text style={styles.lead}>仅测试页面 · 不读取或修改任何存档</Text>

      <View style={styles.card}>
        <Text style={styles.heading}>A · 首选图失败，本地头像回退</Text>
        <View style={styles.row}>
          <ResilientImage
            source={MISSING_PRIMARY}
            fallbackSources={[LOCAL_AVATAR]}
            style={styles.avatar}
            resizeMode="cover"
            accessibilityLabel="A 本地备用鹿芽头像"
            onError={() => setPrimaryErrors((count) => count + 1)}
            onLoad={() => setPrimaryLoads((count) => count + 1)}
          />
          <View style={styles.copy}>
            <Text style={styles.status}>首选失败：{primaryErrors} 次</Text>
            <Text style={styles.status}>备用加载成功：{primaryLoads} 次</Text>
            <Text style={styles.expected}>预期：失败 1 次，人物图可见</Text>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.heading}>B · 两个来源都失败，停止自动重试</Text>
        <View style={styles.row}>
          <ResilientImage
            source={recovered ? LOCAL_AVATAR : MISSING_PRIMARY}
            fallbackSources={recovered ? [] : [MISSING_FALLBACK]}
            retryKey={recoveryKey}
            style={styles.avatar}
            resizeMode="cover"
            accessibilityLabel="B 故障与恢复图片"
            fallbackLabel="两个来源都失败"
            retryLabel="重试这张图片"
            onError={() => setAllErrors((count) => count + 1)}
            onLoad={() => setRecoveryLoads((count) => count + 1)}
          />
          <View style={styles.copy}>
            <Text style={styles.status}>候选失败：{allErrors} 次</Text>
            <Text style={styles.status}>恢复加载成功：{recoveryLoads} 次</Text>
            <Text style={styles.expected}>预期：初始失败 2 次；点重试后 4 次，随后停止</Text>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.heading}>C · 来源恢复后重新显示人物图</Text>
        <Text style={styles.status}>{recovered ? '已切换本地头像，恢复请求已发起' : '等待点击“恢复图片”'}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="恢复图片"
          disabled={recovered}
          onPress={() => {
            setRecovered(true);
            setRecoveryKey((key) => key + 1);
          }}
          style={({ pressed }) => [styles.button, (pressed || recovered) && styles.buttonMuted]}
        >
          <Text style={styles.buttonText}>{recovered ? '图片来源已恢复' : '恢复图片'}</Text>
        </Pressable>
        <Text style={styles.expected}>预期：B 区恢复头像、加载成功 1 次，失败计数不再增长。</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F5F0EA' },
  content: { padding: 18, paddingTop: 28, paddingBottom: 30, gap: 14, maxWidth: 680, width: '100%', alignSelf: 'center' },
  title: { fontSize: 25, fontWeight: '600', color: '#4C3630' },
  lead: { fontSize: 13, lineHeight: 20, color: '#725B55' },
  card: { padding: 16, borderRadius: 20, backgroundColor: '#FFFBF7', gap: 14 },
  heading: { fontSize: 16, fontWeight: '600', lineHeight: 24, color: '#4C3630' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 112, height: 112, borderRadius: 18, backgroundColor: '#F3E9E5' },
  copy: { flex: 1, minWidth: 0, gap: 7 },
  status: { fontSize: 14, lineHeight: 21, color: '#4C3630' },
  expected: { fontSize: 12, lineHeight: 19, color: '#725B55' },
  button: { minHeight: 48, borderRadius: 14, backgroundColor: '#8C575D', alignItems: 'center', justifyContent: 'center' },
  buttonMuted: { opacity: 0.7 },
  buttonText: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
});
