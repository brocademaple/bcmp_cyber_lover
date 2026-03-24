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

export const ONBOARDING_KEY = '@bcmp_onboardingCompleted';

type Props = NativeStackScreenProps<RootStackParamList, 'Onboarding'>;

const THEME_COLOR = '#E91E8C';
const THEME_LIGHT = '#FCE4F0';

export default function OnboardingScreen({ navigation }: Props) {
  const [step, setStep] = useState(0); // 0=选角色, 1=API Key, 2=完成
  const [selectedCharacterId, setSelectedCharacterId] = useState(DEFAULT_CHARACTERS[0].id);
  const [apiKey, setApiKey] = useState('');
  const { updateService, saveSettings, updateLife, setSelectedCharacter } = useSettingsStore();

  const selectedCharacter = DEFAULT_CHARACTERS.find((c) => c.id === selectedCharacterId)!;

  const handleSelectCharacter = (id: string) => {
    setSelectedCharacterId(id);
  };

  const handleNextFromCharacter = () => {
    setStep(1);
  };

  const handleNextFromApiKey = async () => {
    if (!apiKey.trim()) {
      Alert.alert('请输入API密钥', '需要API密钥才能与角色对话');
      return;
    }
    updateService({ apiKey: apiKey.trim() });
    setSelectedCharacter(selectedCharacterId);
    await saveSettings();
    setStep(2);
  };

  const handleComplete = async () => {
    // Schedule daily notification for selected character at 8pm
    await scheduleDailyNotification(selectedCharacterId, selectedCharacter.name, 20, 0);
    updateLife({ notificationHour: 20 });
    await saveSettings();
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    navigation.replace('Main');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>心动伴侣</Text>
        <View style={styles.stepIndicator}>
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              style={[styles.stepDot, i === step && styles.stepDotActive, i < step && styles.stepDotDone]}
            />
          ))}
        </View>
      </View>

      {/* Step 0: Select Character */}
      {step === 0 && (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.stepTitle}>选择你的专属伴侣</Text>
          <Text style={styles.stepSubtitle}>TA 将每天陪伴你、关心你</Text>

          <View style={styles.characterList}>
            {DEFAULT_CHARACTERS.map((char) => {
              const isSelected = char.id === selectedCharacterId;
              return (
                <TouchableOpacity
                  key={char.id}
                  style={[styles.characterCard, isSelected && styles.characterCardSelected]}
                  onPress={() => handleSelectCharacter(char.id)}
                  activeOpacity={0.85}
                >
                  <View style={styles.characterImageWrap}>
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
                      <View style={styles.selectedBadge}>
                        <Text style={styles.selectedBadgeText}>✓</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.characterName, isSelected && styles.characterNameSelected]}>
                    {char.name}
                  </Text>
                  <Text style={styles.characterPersonality}>{char.personality}</Text>
                  <Text style={styles.characterGreeting} numberOfLines={2}>
                    「{char.greeting}」
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity style={styles.primaryBtn} onPress={handleNextFromCharacter}>
            <Text style={styles.primaryBtnText}>选好了，下一步 →</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* Step 1: API Key */}
      {step === 1 && (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.stepTitle}>填写 API 密钥</Text>
          <Text style={styles.stepSubtitle}>用于与 {selectedCharacter.name} 对话的 AI 服务</Text>

          <View style={styles.apiKeyCard}>
            <Text style={styles.apiKeyLabel}>API 密钥</Text>
            <TextInput
              style={styles.apiKeyInput}
              value={apiKey}
              onChangeText={setApiKey}
              placeholder="sk-..."
              placeholderTextColor="#ccc"
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry={false}
            />
          </View>

          <View style={styles.helpCard}>
            <Text style={styles.helpTitle}>💡 如何获取 API 密钥？</Text>
            <Text style={styles.helpText}>
              推荐使用硅基流动（免费额度），注册后在「API 密钥」页面创建并复制。
            </Text>
            <TouchableOpacity onPress={() => Linking.openURL('https://cloud.siliconflow.cn')}>
              <Text style={styles.helpLink}>前往硅基流动获取 →</Text>
            </TouchableOpacity>
            <Text style={[styles.helpText, { marginTop: 8 }]}>
              也可使用 DeepSeek 或任何兼容 OpenAI 接口的服务。
            </Text>
          </View>

          <TouchableOpacity style={styles.primaryBtn} onPress={handleNextFromApiKey}>
            <Text style={styles.primaryBtnText}>确认，下一步 →</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.backBtn} onPress={() => setStep(0)}>
            <Text style={styles.backBtnText}>← 返回</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* Step 2: Complete */}
      {step === 2 && (
        <View style={styles.content}>
          <View style={styles.completeWrap}>
            <View style={styles.completeChracterWrap}>
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
            <Text style={styles.completeName}>{selectedCharacter.name}</Text>
            <View style={styles.completeGreetingBubble}>
              <Text style={styles.completeGreeting}>{selectedCharacter.greeting}</Text>
            </View>
            <Text style={styles.completeTip}>每天晚上 8 点，{selectedCharacter.name} 会主动来找你 🌙</Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={handleComplete}>
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
    backgroundColor: '#FFF5FA',
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 12,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: THEME_COLOR,
    marginBottom: 16,
  },
  stepIndicator: {
    flexDirection: 'row',
    gap: 8,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ddd',
  },
  stepDotActive: {
    width: 24,
    backgroundColor: THEME_COLOR,
  },
  stepDotDone: {
    backgroundColor: THEME_COLOR + '88',
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  stepTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#333',
    marginTop: 16,
    marginBottom: 6,
    textAlign: 'center',
  },
  stepSubtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginBottom: 24,
  },
  characterList: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  characterCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#eee',
  },
  characterCardSelected: {
    borderColor: THEME_COLOR,
    backgroundColor: THEME_LIGHT,
  },
  characterImageWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    overflow: 'hidden',
    marginBottom: 8,
    backgroundColor: '#f5f5f5',
    position: 'relative',
  },
  characterImage: {
    width: 72,
    height: 72,
  },
  characterAvatar: {
    fontSize: 40,
    textAlign: 'center',
    lineHeight: 72,
  },
  selectedBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: THEME_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  characterName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#333',
    marginBottom: 2,
  },
  characterNameSelected: {
    color: THEME_COLOR,
  },
  characterPersonality: {
    fontSize: 11,
    color: '#999',
    marginBottom: 6,
    textAlign: 'center',
  },
  characterGreeting: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 16,
  },
  primaryBtn: {
    backgroundColor: THEME_COLOR,
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
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#eee',
  },
  apiKeyLabel: {
    fontSize: 13,
    color: '#888',
    marginBottom: 8,
    fontWeight: '600',
  },
  apiKeyInput: {
    fontSize: 15,
    color: '#333',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#fafafa',
  },
  helpCard: {
    backgroundColor: '#FFF9E6',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FFE082',
  },
  helpTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#8B6914',
    marginBottom: 8,
  },
  helpText: {
    fontSize: 13,
    color: '#7A6020',
    lineHeight: 20,
  },
  helpLink: {
    fontSize: 13,
    color: THEME_COLOR,
    fontWeight: '600',
    marginTop: 8,
  },
  completeWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  completeChracterWrap: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: 'hidden',
    backgroundColor: THEME_LIGHT,
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
    fontWeight: '700',
    color: '#333',
    marginBottom: 16,
  },
  completeGreetingBubble: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    padding: 16,
    marginBottom: 24,
    maxWidth: '100%',
    borderWidth: 1,
    borderColor: '#eee',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  completeGreeting: {
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
    textAlign: 'center',
  },
  completeTip: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
});
