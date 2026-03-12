import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  ImageBackground,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RootStackParamList, Message } from '../types';
import { useChatStore } from '../store/chatStore';
import { useSettingsStore } from '../store/settingsStore';
import { sendMessage } from '../services/aiService';
import { checkAnniversaries, getAnniversaryMessage } from '../services/anniversaryService';
import { calculateEmotionChange } from '../services/emotionService';
import ChatBubble from '../components/ChatBubble';
import MessageInput from '../components/MessageInput';
import { useThemeColors } from '../utils/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Chat'>;

let msgIdCounter = Date.now();
function genId() {
  return `msg_${++msgIdCounter}`;
}

export default function ChatScreen({ route, navigation }: Props) {
  const { characterId } = route.params;
  const C = useThemeColors();
  const flatListRef = useRef<FlatList>(null);

  const { messages, addMessage, loadMessages, setTyping, isTyping, getCharacter, updateEmotionalState } = useChatStore();
  const { settings } = useSettingsStore();

  const character = getCharacter(characterId);
  const chatMessages = messages[characterId] || [];
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingId, setStreamingId] = useState<string | null>(null);

  useEffect(() => {
    loadMessages(characterId);
  }, [characterId]);

  useEffect(() => {
    if (!character) return;
    navigation.setOptions({
      title: character.name,
      headerRight: () => (
        <TouchableOpacity onPress={() => navigation.navigate('CharacterSettings', { characterId })} style={{ marginRight: 8 }}>
          <Text style={{ fontSize: 22 }}>⚙️</Text>
        </TouchableOpacity>
      ),
    });
  }, [character, characterId]);

  // Send greeting if first time
  useEffect(() => {
    if (!character) return;
    if (chatMessages.length === 0) {
      const greeting: Message = {
        id: genId(),
        role: 'assistant',
        content: character.greeting,
        timestamp: Date.now(),
      };
      addMessage(characterId, greeting);
    }
  }, [character, characterId]);

  // Check anniversaries
  useEffect(() => {
    if (!character || !character.anniversaries) return;
    const todayAnniversaries = checkAnniversaries(character.anniversaries);
    todayAnniversaries.forEach(ann => {
      const msg: Message = {
        id: genId(),
        role: 'assistant',
        content: getAnniversaryMessage(ann, character.name),
        timestamp: Date.now(),
      };
      addMessage(characterId, msg);
    });
  }, [character, characterId]);

  // Update emotional state on interaction
  useEffect(() => {
    if (!character || !character.emotionalState) return;
    const timeSince = Date.now() - character.emotionalState.lastInteraction;
    const updates = calculateEmotionChange(character.emotionalState, chatMessages, timeSince);
    if (Object.keys(updates).length > 0) {
      updateEmotionalState(characterId, updates);
    }
  }, [chatMessages.length]);

  const handleSend = useCallback(
    async (text: string, imageUri?: string) => {
      if (!character) return;
      if (!settings.service.apiKey) {
        Alert.alert('未配置API', '请先在设置中配置服务提供商和API密钥', [
          { text: '去设置', onPress: () => navigation.navigate('Settings') },
          { text: '取消' },
        ]);
        return;
      }

      // Add user message
      const userMsg: Message = {
        id: genId(),
        role: 'user',
        content: text,
        timestamp: Date.now(),
        imageUri,
      };
      await addMessage(characterId, userMsg);

      // Add delay if configured
      if (settings.advanced.sendDelayMs > 0) {
        await new Promise((r) => setTimeout(r, settings.advanced.sendDelayMs));
      }

      setTyping(true);

      // Start streaming placeholder
      const aiMsgId = genId();
      setStreamingId(aiMsgId);
      setStreamingContent('');

      let fullContent = '';

      try {
        fullContent = await sendMessage(
          text,
          character,
          chatMessages,
          settings.service,
          settings.memory,
          settings.advanced,
          imageUri,
          (chunk) => {
            fullContent += chunk;
            setStreamingContent(fullContent);
          }
        );

        const aiMsg: Message = {
          id: aiMsgId,
          role: 'assistant',
          content: fullContent || '...',
          timestamp: Date.now(),
        };
        await addMessage(characterId, aiMsg);
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : '发送失败';
        Alert.alert('发送失败', errorMsg);
      } finally {
        setTyping(false);
        setStreamingId(null);
        setStreamingContent('');
      }
    },
    [character, characterId, chatMessages, settings, addMessage, navigation]
  );

  const handleAudioCall = () => {
    navigation.navigate('Call', { characterId, callType: 'audio' });
  };

  const handleVideoCall = () => {
    navigation.navigate('Call', { characterId, callType: 'video' });
  };

  // Build display messages list
  const displayMessages: Message[] = [...chatMessages];
  if (isTyping && streamingId) {
    if (streamingContent) {
      displayMessages.push({
        id: streamingId,
        role: 'assistant',
        content: streamingContent,
        timestamp: Date.now(),
      });
    } else {
      displayMessages.push({
        id: streamingId + '_thinking',
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        isThinking: true,
      });
    }
  }

  if (!character) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: C.background }]}>
        <Text style={{ color: C.text, textAlign: 'center', marginTop: 40 }}>角色未找到</Text>
      </SafeAreaView>
    );
  }

  // 人设图作聊天背景：竖屏完整显示，横屏截取部分；无图时用纯色
  const backgroundSource =
    character.imageUri != null
      ? typeof character.imageUri === 'number'
        ? character.imageUri
        : { uri: character.imageUri }
      : null;

  const content = (
    <>
      <StatusBar barStyle="light-content" backgroundColor={C.primaryDark} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={displayMessages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ChatBubble
              message={item}
              characterAvatar={character.avatar}
              characterName={character.name}
            />
          )}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
        />
        <MessageInput
          onSend={handleSend}
          onAudioCall={handleAudioCall}
          onVideoCall={handleVideoCall}
          disabled={isTyping}
        />
      </KeyboardAvoidingView>
    </>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: C.background }]} edges={['bottom']}>
      {backgroundSource ? (
        <ImageBackground
          source={backgroundSource}
          style={styles.backgroundImage}
          resizeMode="cover"
        >
          <View style={[styles.backgroundOverlay, { backgroundColor: C.chatBackgroundOverlay }]} />
          {content}
        </ImageBackground>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  backgroundImage: { flex: 1 },
  backgroundOverlay: StyleSheet.absoluteFillObject,
  messageList: {
    paddingVertical: 12,
    paddingBottom: 8,
  },
});
