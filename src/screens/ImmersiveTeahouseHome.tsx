/**
 * 鹿芽主场：沉浸茶室首页态（全屏立绘 + A+C HUD）
 * 从输入/动作/热点进入 Chat（ImmersiveChatScreen）
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  StyleSheet,
  StatusBar,
  Dimensions,
  TouchableOpacity,
  Text,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RootStackParamList, Character } from '../types';
import { useTeahouseHarness } from '../contexts/TeahouseHarnessContext';
import { getCharacterStateLabel } from '../services/aiService';
import { getLuyaLifeProjection } from '../services/luyaLifeService';
import { useSettingsStore } from '../store/settingsStore';
import ResilientImage from '../components/ResilientImage';
import ImmersiveTeahouseUI from '../components/ImmersiveTeahouseUI';

type Nav = NativeStackScreenProps<RootStackParamList, 'Main'>['navigation'];

interface Props {
  navigation: Nav;
  character: Character;
}

const teahouseHeroImage = require('../../docs/assets/tearoom/hero-9x16.jpg');

const drinkIconSources = {
  oolong: require('../../assets/ui/yinzhi-hud/drink-oolong_8d1f.png'),
  espresso: require('../../assets/ui/yinzhi-hud/drink-coffee_8973.png'),
  chamomile: require('../../assets/ui/yinzhi-hud/drink-chamomile_9a27.png'),
};

export default function ImmersiveTeahouseHome({ navigation, character }: Props) {
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const [inputValue, setInputValue] = useState('');
  const harness = useTeahouseHarness();
  const { settings } = useSettingsStore();
  const characterId = character.id;

  const openChat = useCallback(
    (initialInput?: string) => {
      navigation.navigate(
        'Chat',
        initialInput ? { characterId, initialInput } : { characterId },
      );
    },
    [navigation, characterId],
  );

  useFocusEffect(
    useCallback(() => {
      if (characterId === 'qingning') {
        if (!harness.sessionId) {
          harness.startSession(characterId);
        }
        void harness.refreshLeaves(characterId);
      }
    }, [characterId, harness]),
  );

  const characterStatus = getCharacterStateLabel(character);
  const lifeNow = settings.advanced.debugNowTs ?? Date.now();
  const luyaProjection = character.luyaRuntime
    ? getLuyaLifeProjection(character.luyaRuntime.life, lifeNow)
    : undefined;
  const welcomeMessage =
    luyaProjection?.currentActivity?.trim() || '进来坐。茶还热着。';

  const drinks = [
    { id: 'oolong', icon: '🍵', iconSource: drinkIconSources.oolong, active: harness.baseDrink === 'oolong' },
    { id: 'espresso', icon: '☕', iconSource: drinkIconSources.espresso, active: harness.baseDrink === 'espresso' },
    { id: 'chamomile', icon: '🌼', iconSource: drinkIconSources.chamomile, active: harness.baseDrink === 'chamomile' },
  ];

  const { height, width } = Dimensions.get('window');
  const hotspots = [
    { id: 'shelf-jar', x: width * 0.15, y: height * 0.22, onPress: () => openChat() },
    { id: 'teapot', x: width * 0.35, y: height * 0.72, onPress: () => openChat() },
    { id: 'tea-pet-shelf', x: width * 0.82, y: height * 0.45, onPress: () => openChat() },
    { id: 'sealed-bottle', x: width * 0.75, y: height * 0.75, onPress: () => openChat() },
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      <View style={StyleSheet.absoluteFill}>
        <ResilientImage
          source={teahouseHeroImage}
          fallbackSources={[teahouseHeroImage]}
          retryKey={String(isFocused)}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          accessible={false}
        />
      </View>

      <TouchableOpacity
        style={[styles.settingsButton, { top: insets.top + 12 }]}
        onPress={() => navigation.navigate('Settings')}
        accessibilityRole="button"
        accessibilityLabel="打开设置"
      >
        <Text style={styles.settingsIcon}>⚙</Text>
      </TouchableOpacity>

      <ImmersiveTeahouseUI
        characterStatus={characterStatus}
        characterName="鹿芽"
        currentMessage={welcomeMessage}
        onOpenIngest={() => openChat()}
        onOpenArchive={() => openChat()}
        drinks={drinks}
        onDrinkSelect={(drinkId) => {
          harness.setBaseDrink(drinkId);
        }}
        showCalibration={false}
        onResonate={() => {}}
        onAdjust={() => {}}
        onContinue={() => openChat('顺着这泡往下聊')}
        onReflect={() => openChat('帮我照照卡在哪')}
        onChallenge={() => openChat('加块冰直接挑刺')}
        onRest={() => openChat('换杯洋甘菊歇会儿')}
        inputValue={inputValue}
        onInputChange={setInputValue}
        onInputSubmit={() => {
          const text = inputValue.trim();
          if (text) {
            openChat(text);
            setInputValue('');
          } else {
            openChat();
          }
        }}
        hotspots={hotspots}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FBF6F3',
  },
  settingsButton: {
    position: 'absolute',
    right: 128,
    zIndex: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 253, 251, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(196, 165, 116, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsIcon: {
    fontSize: 18,
    color: '#3C3032',
  },
});
