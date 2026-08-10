import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  Image,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { DEFAULT_CHARACTERS } from '../store/chatStore';
import { useSettingsStore } from '../store/settingsStore';
import { scheduleDailyNotification } from '../services/notificationService';
import { testChatCompletion } from '../services/aiService';

export const ONBOARDING_KEY = '@bcmp_onboardingCompleted';

type Props = NativeStackScreenProps<RootStackParamList, 'Onboarding'>;

function getOnboardingSkin(theme?: string) {
  if (theme === 'urbanClear' || theme === 'midnight') {
    return {
      mode: 'urban' as const,
      accent: '#c6a160',
      accentSoft: '#f1e6d1',
      bg: '#f9f5ee',
      panel: 'rgba(255,255,255,0.78)',
      border: '#dfcfb3',
      text: '#4d4740',
      muted: '#9a8f82',
      selectedBg: 'rgba(255,255,255,0.72)',
    };
  }

  return {
    mode: 'sweet' as const,
    accent: '#ef8fb3',
    accentSoft: '#ffe4ee',
    bg: '#fff4f8',
    panel: 'rgba(255,253,252,0.82)',
    border: '#f3c9d7',
    text: '#553246',
    muted: '#b98299',
    selectedBg: 'rgba(255,232,241,0.8)',
  };
}

export default function OnboardingScreen({ navigation }: Props) {
  const [step, setStep] = useState(0); // 0=选角色, 1=API Key, 2=完成
  const [selectedCharacterId, setSelectedCharacterId] = useState(DEFAULT_CHARACTERS[0].id);
  const [apiKey, setApiKey] = useState('');
  const [isTestingService, setIsTestingService] = useState(false);
  const { settings, updateService, saveSettings, updateLife, updateAdvanced, setSelectedCharacter } = useSettingsStore();

  const selectedCharacter = DEFAULT_CHARACTERS.find((c) => c.id === selectedCharacterId)!;
  const skin = getOnboardingSkin(selectedCharacter.theme);
  const configuredApiKey = settings.service.apiKey.trim();
  const hasConfiguredApiKey = configuredApiKey.length > 0;

  const handleSelectCharacter = (id: string) => {
    setSelectedCharacterId(id);
  };

  const handleNextFromCharacter = () => {
    setStep(1);
  };

  const handleNextFromApiKey = async () => {
    const effectiveApiKey = apiKey.trim() || configuredApiKey;
    if (!effectiveApiKey) {
      Alert.alert('请输入API密钥', '需要API密钥才能与角色对话');
      return;
    }
    const currentSettings = useSettingsStore.getState().settings;
    const nextSettings = {
      ...currentSettings,
      service: { ...currentSettings.service, apiKey: effectiveApiKey },
      advanced: { ...currentSettings.advanced, theme: selectedCharacter.theme ?? 'urbanClear', themeMode: 'manual' as const },
      selectedCharacterId,
    };
    setIsTestingService(true);
    const connection = await testChatCompletion(nextSettings.service);
    setIsTestingService(false);
    if (!connection.ok) {
      Alert.alert(
        '连接测试没有通过',
        `${connection.message}\n\n请检查 API Key、模型名称和网络。当前配置尚未写入本机。`
      );
      return;
    }
    updateService({ apiKey: effectiveApiKey });
    updateAdvanced({ theme: selectedCharacter.theme ?? 'urbanClear', themeMode: 'manual' });
    setSelectedCharacter(selectedCharacterId);
    const saved = await saveSettings(nextSettings);
    if (!saved) {
      Alert.alert('保存失败', 'API 密钥没有写入本机，请稍后重试。');
      return;
    }
    setStep(2);
  };

  const handleComplete = async () => {
    // Schedule daily notification for selected character at 8pm
    await scheduleDailyNotification(selectedCharacterId, selectedCharacter.name, 20, 0);
    const currentSettings = useSettingsStore.getState().settings;
    const nextSettings = {
      ...currentSettings,
      life: { ...currentSettings.life, notificationHour: 20 },
    };
    updateLife({ notificationHour: 20 });
    await saveSettings(nextSettings);
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    navigation.replace('Main');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: skin.bg }]}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: skin.accent }]}>心动伴侣</Text>
        <View style={styles.stepIndicator}>
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              style={[
                styles.stepDot,
                { backgroundColor: skin.accentSoft },
                i === step && [styles.stepDotActive, { backgroundColor: skin.accent }],
                i < step && { backgroundColor: skin.accent + '88' },
              ]}
            />
          ))}
        </View>
      </View>

      {/* Step 0: Select Character */}
      {step === 0 && (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={[styles.heroPanel, { backgroundColor: skin.panel, borderColor: skin.border }]}>
            <Text style={[styles.stepTitle, { color: skin.text }]}>选择你的专属伴侣</Text>
            <Text style={[styles.stepSubtitle, { color: skin.muted }]}>TA 将每天陪伴你、关心你</Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.characterRail}
            contentContainerStyle={styles.characterList}
          >
            {DEFAULT_CHARACTERS.map((char) => {
              const isSelected = char.id === selectedCharacterId;
              const charSkin = getOnboardingSkin(char.theme);
              return (
                <TouchableOpacity
                  key={char.id}
                  style={[
                    styles.characterCard,
                    {
                      backgroundColor: isSelected ? charSkin.selectedBg : 'rgba(255,255,255,0.72)',
                      borderColor: isSelected ? charSkin.accent : charSkin.border,
                    },
                    charSkin.mode === 'urban' && styles.urbanCharacterCard,
                    charSkin.mode === 'sweet' && styles.sweetCharacterCard,
                  ]}
                  onPress={() => handleSelectCharacter(char.id)}
                  activeOpacity={0.85}
                >
                  <View style={[styles.characterImageWrap, { borderColor: charSkin.border }]}>
                    {char.imageUri ? (
                      <Image
                        // imageUri is stored as a require() number in DEFAULT_CHARACTERS
                        source={char.imageUri as unknown as number}
                        style={styles.characterImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <Text style={styles.characterAvatar}>{char.avatar}</Text>
                    )}
                    {isSelected && (
                      <View style={[styles.selectedBadge, { backgroundColor: charSkin.accent }]}>
                        <Text style={styles.selectedBadgeText}>✓</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.characterName, { color: isSelected ? charSkin.accent : charSkin.text }]}>
                    {char.name}
                  </Text>
                  <Text style={[styles.characterPersonality, { color: charSkin.muted }]}>{char.personality}</Text>
                  <Text style={[styles.characterGreeting, { color: charSkin.text }]} numberOfLines={2}>
                    「{char.greeting}」
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: skin.accent }]} onPress={handleNextFromCharacter}>
            <Text style={styles.primaryBtnText}>选好了，下一步 →</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* Step 1: API Key */}
      {step === 1 && (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={[styles.heroPanel, { backgroundColor: skin.panel, borderColor: skin.border }]}>
            <Text style={[styles.stepTitle, { color: skin.text }]}>{hasConfiguredApiKey ? '已读取本地开发密钥' : '填写 API 密钥'}</Text>
            <Text style={[styles.stepSubtitle, { color: skin.muted }]}>
              {hasConfiguredApiKey
                ? `当前已配置 ${settings.service.provider === 'deepseek' ? 'DeepSeek' : 'AI'} 服务，可直接进入体验。`
                : `用于与 ${selectedCharacter.name} 对话的 AI 服务`}
            </Text>
          </View>

          <View style={[styles.apiKeyCard, { backgroundColor: skin.panel, borderColor: skin.border }]}>
            <Text style={[styles.apiKeyLabel, { color: skin.muted }]}>API 密钥</Text>
            <TextInput
              style={[styles.apiKeyInput, { borderColor: skin.border, color: skin.text, backgroundColor: 'rgba(255,255,255,0.72)' }]}
              value={apiKey}
              onChangeText={setApiKey}
              placeholder="sk-..."
              placeholderTextColor={skin.muted}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
            />
          </View>

          <View style={[styles.helpCard, { backgroundColor: skin.accentSoft + 'CC', borderColor: skin.border }]}>
            <Text style={[styles.helpTitle, { color: skin.text }]}>{hasConfiguredApiKey ? '已连接开发配置' : '💡 如何获取 API 密钥？'}</Text>
            <Text style={[styles.helpText, { color: skin.text }]}>
              {hasConfiguredApiKey
                ? '项目已从本地 .env.local 读取到 API Key。开发阶段可以不在这里重复填写；如果你输入新 key，会覆盖本地运行时配置。'
                : '推荐使用硅基流动（免费额度），注册后在「API 密钥」页面创建并复制。'}
            </Text>
            {!hasConfiguredApiKey && (
              <>
                <TouchableOpacity onPress={() => Linking.openURL('https://cloud.siliconflow.cn')}>
                  <Text style={[styles.helpLink, { color: skin.accent }]}>前往硅基流动获取 →</Text>
                </TouchableOpacity>
                <Text style={[styles.helpText, { marginTop: 8, color: skin.text }]}>
                  也可使用 DeepSeek 或任何兼容 OpenAI 接口的服务。
                </Text>
              </>
            )}
          </View>

          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: skin.accent, opacity: isTestingService ? 0.68 : 1 }]}
            onPress={handleNextFromApiKey}
            disabled={isTestingService}
          >
            <Text style={styles.primaryBtnText}>
              {isTestingService
                ? '正在验证连接…'
                : hasConfiguredApiKey && !apiKey.trim()
                  ? '验证本地配置，下一步 →'
                  : '验证连接，下一步 →'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.backBtn} onPress={() => setStep(0)}>
            <Text style={[styles.backBtnText, { color: skin.muted }]}>← 返回</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* Step 2: Complete */}
      {step === 2 && (
        <View style={styles.content}>
          <View style={[styles.completeWrap, { backgroundColor: skin.panel, borderColor: skin.border }]}>
            <View style={[styles.completeChracterWrap, { backgroundColor: skin.accentSoft, borderColor: skin.border }]}>
              {selectedCharacter.imageUri ? (
                <Image
                  source={selectedCharacter.imageUri as unknown as number}
                  style={styles.completeImage}
                  resizeMode="cover"
                />
              ) : (
                <Text style={styles.completeAvatar}>{selectedCharacter.avatar}</Text>
              )}
            </View>
            <Text style={[styles.completeName, { color: skin.text }]}>{selectedCharacter.name}</Text>
            <View style={[styles.completeGreetingBubble, { borderColor: skin.border, backgroundColor: 'rgba(255,255,255,0.78)' }]}>
              <Text style={[styles.completeGreeting, { color: skin.text }]}>{selectedCharacter.greeting}</Text>
            </View>
            <Text style={[styles.completeTip, { color: skin.muted }]}>每天晚上 8 点，{selectedCharacter.name} 会主动来找你 🌙</Text>
            <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: skin.accent }]} onPress={handleComplete}>
              <Text style={styles.primaryBtnText}>开始聊天 💖</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  artworkLayer: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.92,
  },
  sweetBubbleArt: {
    position: 'absolute',
    top: 92,
    right: -96,
    width: 270,
    height: 76,
    opacity: 0.54,
    transform: [{ rotate: '-4deg' }],
  },
  sweetCharmArt: {
    position: 'absolute',
    top: 310,
    left: -48,
    width: 140,
    height: 200,
    opacity: 0.5,
    transform: [{ rotate: '-6deg' }],
  },
  sweetRibbonArt: {
    position: 'absolute',
    bottom: 104,
    left: 22,
    width: 330,
    height: 68,
    opacity: 0.72,
  },
  sweetBowArt: {
    position: 'absolute',
    top: 174,
    left: 18,
    width: 164,
    height: 40,
    opacity: 0.58,
  },
  urbanCityArt: {
    position: 'absolute',
    top: 120,
    left: -78,
    width: 230,
    height: 130,
    opacity: 0.46,
  },
  urbanPendantsArt: {
    position: 'absolute',
    top: 36,
    right: -24,
    width: 224,
    height: 92,
    opacity: 0.68,
  },
  urbanWindowArt: {
    position: 'absolute',
    bottom: 96,
    right: -52,
    width: 164,
    height: 164,
    opacity: 0.5,
  },
  urbanBubbleArt: {
    position: 'absolute',
    top: 224,
    right: -90,
    width: 330,
    height: 70,
    opacity: 0.34,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 12,
    alignItems: 'center',
    zIndex: 2,
  },
  headerTitle: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '900',
    marginBottom: 14,
  },
  stepIndicator: {
    flexDirection: 'row',
    gap: 8,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  stepDotActive: {
    width: 24,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 18,
    paddingBottom: 32,
    zIndex: 2,
  },
  heroPanel: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 26,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 16,
    marginTop: 10,
    marginBottom: 18,
  },
  stepTitle: {
    fontSize: 24,
    lineHeight: 31,
    fontWeight: '900',
    marginBottom: 6,
    textAlign: 'center',
  },
  stepSubtitle: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '700',
    textAlign: 'center',
  },
  characterList: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    paddingHorizontal: 2,
    paddingBottom: 20,
    marginBottom: 8,
  },
  characterRail: {
    maxHeight: 404,
    marginBottom: 8,
  },
  characterCard: {
    width: 172,
    minHeight: 336,
    alignSelf: 'flex-start',
    borderRadius: 24,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1.5,
  },
  sweetCharacterCard: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 22,
    borderBottomRightRadius: 30,
    borderBottomLeftRadius: 18,
    transform: [{ rotate: '-0.6deg' }],
  },
  urbanCharacterCard: {
    borderTopLeftRadius: 14,
    borderTopRightRadius: 26,
    borderBottomRightRadius: 14,
    borderBottomLeftRadius: 26,
  },
  characterImageWrap: {
    width: 148,
    height: 154,
    borderRadius: 22,
    overflow: 'hidden',
    marginBottom: 12,
    backgroundColor: 'rgba(255,255,255,0.42)',
    position: 'relative',
    borderWidth: StyleSheet.hairlineWidth,
  },
  characterImage: {
    width: 148,
    height: 154,
  },
  characterAvatar: {
    fontSize: 40,
    textAlign: 'center',
    lineHeight: 154,
  },
  selectedBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  characterName: {
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '900',
    marginBottom: 4,
  },
  characterPersonality: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  characterGreeting: {
    fontSize: 12,
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 18,
  },
  primaryBtn: {
    borderRadius: 28,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  backBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 8,
  },
  backBtnText: {
    color: '#999',
    fontSize: 15,
  },
  apiKeyCard: {
    borderRadius: 22,
    padding: 16,
    marginBottom: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  apiKeyLabel: {
    fontSize: 13,
    marginBottom: 8,
    fontWeight: '600',
  },
  apiKeyInput: {
    fontSize: 15,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  helpCard: {
    borderRadius: 22,
    padding: 16,
    marginBottom: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  helpTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  helpText: {
    fontSize: 13,
    lineHeight: 20,
  },
  helpLink: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 8,
  },
  completeWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 28,
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 36,
    marginTop: 14,
    marginBottom: 24,
  },
  completeChracterWrap: {
    width: 120,
    height: 120,
    borderRadius: 30,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 16,
  },
  completeImage: {
    width: 120,
    height: 120,
  },
  completeAvatar: {
    fontSize: 64,
    textAlign: 'center',
    lineHeight: 120,
  },
  completeName: {
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 16,
  },
  completeGreetingBubble: {
    borderRadius: 22,
    borderBottomLeftRadius: 8,
    padding: 16,
    marginBottom: 24,
    maxWidth: '100%',
    borderWidth: StyleSheet.hairlineWidth,
  },
  completeGreeting: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
  completeTip: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
});
