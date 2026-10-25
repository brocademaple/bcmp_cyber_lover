/**
 * Immersive Chat Screen (A+C Layout)
 * 饮之沉浸式茶席界面
 * 
 * 全屏立绘 + 边标HUD + 房间物件热点
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  StatusBar,
  Dimensions,
  ImageSourcePropType,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import { RootStackParamList, Message } from '../types';
import { useChatStore } from '../store/chatStore';
import { useSettingsStore } from '../store/settingsStore';
import { useTeahouseHarness } from '../contexts/TeahouseHarnessContext';
import { getDefaultCharacterAssetSet } from '../utils/characterAssets';
import { getCharacterMainImage } from '../utils/characterDisplayImages';
import ResilientImage from '../components/ResilientImage';
import ImmersiveTeahouseUI from '../components/ImmersiveTeahouseUI';
import { sendMessage, getCharacterStateLabel } from '../services/aiService';
import { generateLocalTeahouseReply } from '../services/localTeahouseMirror';
import { oldestFirst } from '../utils/chatHistory';

type Props = NativeStackScreenProps<RootStackParamList, 'Chat'>;

function getImageSource(source?: any): ImageSourcePropType | null {
  if (source == null) return null;
  return typeof source === 'string' ? { uri: source } : source;
}

let msgIdCounter = Date.now();
function genId() {
  return `msg_${++msgIdCounter}`;
}

export default function ImmersiveChatScreen({ route, navigation }: Props) {
  const { characterId, initialInput } = route.params;
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const harness = useTeahouseHarness();
  
  const {
    messages,
    addMessage,
    updateMessage,
    loadMessages,
    getCharacter,
    setTyping,
    isTyping,
  } = useChatStore();
  
  const { settings } = useSettingsStore();
  const [inputValue, setInputValue] = useState(initialInput ?? '');
  const [showCalibration, setShowCalibration] = useState(false);

  useEffect(() => {
    if (initialInput) {
      setInputValue(initialInput);
    }
  }, [initialInput]);
  const [historyLoadedCharacterId, setHistoryLoadedCharacterId] = useState<string | null>(null);
  const isMountedRef = useRef(true);
  
  const character = getCharacter(characterId);
  const chatMessages = messages[characterId] || [];
  
  // 加载历史消息
  useEffect(() => {
    if (historyLoadedCharacterId === characterId) return;
    let cancelled = false;
    loadMessages(characterId).then(() => {
      if (!cancelled) {
        setHistoryLoadedCharacterId(characterId);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [characterId, loadMessages, historyLoadedCharacterId]);
  
  // 启动 Harness 会话
  useEffect(() => {
    if (isFocused && characterId && !harness.sessionId) {
      harness.startSession(characterId);
      harness.refreshLeaves(characterId);
    }
  }, [isFocused, characterId, harness]);
  
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  
  if (!character) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" />
      </View>
    );
  }
  
  // 使用茶室蕾丝版立绘（非便利店开衫版）
  // 优先使用 tearoom hero 资产，符合 A+C 概念图
  const teahouseHeroImage = require('../../docs/assets/tearoom/hero-9x16.jpg');
  const backgroundSource = teahouseHeroImage;
  const backgroundFallbacks = [teahouseHeroImage];
  
  const latestMessages = oldestFirst(chatMessages).slice(-10);
  const latestAssistantMessage = [...latestMessages].reverse().find(m => m.role === 'assistant');
  const currentMessage = latestAssistantMessage?.content || '';
  
  // 获取当前状态
  const characterStatus = getCharacterStateLabel(character);
  
  // 饮品数据（用裁切好的单独图标，不是emoji，第三个不是齿轮）
  const drinkIconSources = {
    oolong: require('../../assets/ui/yinzhi-hud/drink-oolong_8d1f.png'),
    espresso: require('../../assets/ui/yinzhi-hud/drink-coffee_8973.png'),
    chamomile: require('../../assets/ui/yinzhi-hud/drink-chamomile_9a27.png'),
  };
  
  const drinks = [
    { id: 'oolong', icon: '🍵', iconSource: drinkIconSources.oolong, active: harness.baseDrink === 'oolong' },
    { id: 'espresso', icon: '☕', iconSource: drinkIconSources.espresso, active: harness.baseDrink === 'espresso' },
    { id: 'chamomile', icon: '🌼', iconSource: drinkIconSources.chamomile, active: harness.baseDrink === 'chamomile' },
  ];
  
  // 发送消息
  const handleSendMessage = useCallback(async () => {
    if (!inputValue.trim() || isTyping) return;
    
    const userMessageId = genId();
    const userText = inputValue.trim();
    setInputValue('');
    setShowCalibration(false);
    
    const userMessage: Message = {
      id: userMessageId,
      role: 'user',
      content: userText,
      timestamp: Date.now(),
      status: 'sent',
    };
    
    addMessage(characterId, userMessage);
    setTyping(true);
    
    const assistantMessageId = genId();
    
    try {
      // 检查是否有 API 配置
      const hasApiKey = !!settings.service.apiKey;
      
      if (!hasApiKey) {
        // 使用本地茶镜
        const localReply = await generateLocalTeahouseReply({
          characterId,
          userMessage: userText,
          recentMessages: chatMessages.slice(-5),
          baseDrink: harness.baseDrink,
          modifiers: harness.modifiers,
        });
        
        const assistantMessage: Message = {
          id: assistantMessageId,
          role: 'assistant',
          content: localReply,
          timestamp: Date.now(),
          status: 'sent',
        };
        
        addMessage(characterId, assistantMessage);
        setShowCalibration(true);
      } else {
        // 使用 AI 服务
        const reply = await sendMessage(
          userText,
          character,
          chatMessages,
          settings.service,
          settings.memory,
          settings.advanced,
          undefined,
          undefined,
          settings.advanced.debugNowTs
        );
        
        const assistantMessage: Message = {
          id: assistantMessageId,
          role: 'assistant',
          content: reply,
          timestamp: Date.now(),
          status: 'sent',
        };
        
        addMessage(characterId, assistantMessage);
        setShowCalibration(true);
      }
    } catch (error) {
      console.error('[ImmersiveChatScreen] Send failed:', error);
      updateMessage(characterId, assistantMessageId, { status: 'failed' });
    } finally {
      if (isMountedRef.current) {
        setTyping(false);
      }
    }
  }, [inputValue, isTyping, characterId, character, settings, chatMessages, harness, addMessage, updateMessage, setTyping]);
  
  // 快捷动作
  const handleContinue = () => {
    setInputValue('顺着这泡往下聊');
  };
  
  const handleReflect = () => {
    setInputValue('帮我照照卡在哪');
  };
  
  const handleChallenge = () => {
    setInputValue('加块冰直接挑刺');
  };
  
  const handleRest = () => {
    setInputValue('换杯洋甘菊歇会儿');
  };
  
  // 校准
  const handleResonate = () => {
    setShowCalibration(false);
    // TODO: 记录回甘反馈
  };
  
  const handleAdjust = () => {
    setShowCalibration(false);
    // TODO: 打开校准输入
  };
  
  // 房间热点（对齐茶室蕾丝版概念图物件）
  const { height, width } = Dimensions.get('window');
  const hotspots = [
    // 货架茶罐（左上，避开人物）
    { id: 'shelf-jar', x: width * 0.15, y: height * 0.22, onPress: () => harness.openIngestPanel() },
    // 茶壶（桌面中下，低于胸口）
    { id: 'teapot', x: width * 0.35, y: height * 0.72, onPress: () => harness.openIngestPanel() },
    // 茶宠博古架（右侧中部）
    { id: 'tea-pet-shelf', x: width * 0.82, y: height * 0.45, onPress: () => harness.openTeaPetShelf() },
    // 桌边封瓶（右下桌面）
    { id: 'sealed-bottle', x: width * 0.75, y: height * 0.75, onPress: () => harness.openTeaPetShelf() },
  ];
  
  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      
      {/* 全屏立绘背景 */}
      {backgroundSource && (
        <View style={StyleSheet.absoluteFill}>
          <ResilientImage
            source={backgroundSource}
            fallbackSources={backgroundFallbacks}
            retryKey={String(isFocused)}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
            accessible={false}
          />
        </View>
      )}
      
      {/* A+C 沉浸式 HUD */}
      <ImmersiveTeahouseUI
        characterStatus={characterStatus}
        characterName="鹿芽"
        currentMessage={currentMessage}
        onOpenIngest={() => harness.openIngestPanel()}
        onOpenArchive={() => harness.openTeaPetShelf()}
        drinks={drinks}
        onDrinkSelect={(drinkId) => harness.setBaseDrink(drinkId)}
        showCalibration={showCalibration}
        onResonate={handleResonate}
        onAdjust={handleAdjust}
        onContinue={handleContinue}
        onReflect={handleReflect}
        onChallenge={handleChallenge}
        onRest={handleRest}
        inputValue={inputValue}
        onInputChange={setInputValue}
        onInputSubmit={handleSendMessage}
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
});
