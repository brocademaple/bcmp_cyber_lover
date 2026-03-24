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
  ScrollView,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RootStackParamList, Message } from '../types';
import { useChatStore } from '../store/chatStore';
import { useSettingsStore } from '../store/settingsStore';
import { sendMessage, generateDailyGreeting } from '../services/aiService';
import ChatBubble from '../components/ChatBubble';
import MessageInput from '../components/MessageInput';
import { useThemeColors } from '../utils/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Chat'>;

let msgIdCounter = Date.now();
function genId() {
  return `msg_${++msgIdCounter}`;
}

const QUICK_REPLIES = [
  { label: '😊 嗯嗯～', text: '嗯嗯～' },
  { label: '❤️ 我也是', text: '我也是' },
  { label: '😴 今天好累', text: '今天好累' },
  { label: '🥺 想你了', text: '想你了' },
];

export default function ChatScreen({ route, navigation }: Props) {
  const { characterId, autoGreet } = route.params;
  const C = useThemeColors();
  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<{ focus: () => void }>(null);
  const autoGreetSentRef = useRef(false);

  const { messages, addMessage, loadMessages, setTyping, isTyping, getCharacter } = useChatStore();
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
        <TouchableOpacity
          onPress={() => navigation.navigate('CharacterSettings', { characterId })}
          style={{ marginRight: 8 }}
        >
          <Text style={{ fontSize: 22 }}>⚙️</Text>
        </TouchableOpacity>
      ),
    });
  }, [character, characterId]);

  // Send static greeting if first ever visit (no autoGreet)
  useEffect(() => {
    if (!character) return;
    if (!autoGreet && chatMessages.length === 0) {
      const greeting: Message = {
        id: genId(),
        role: 'assistant',
        content: character.greeting,
        timestamp: Date.now(),
      };
      addMessage(characterId, greeting);
    }
  }, [character, characterId]);

  // Auto-send AI daily greeting when opened from notification
  useEffect(() => {
    if (!autoGreet || !character || autoGreetSentRef.current) return;
    if (!settings.service.apiKey) return;
    autoGreetSentRef.current = true;

    const sendAutoGreet = async () => {
      setTyping(true);
      const aiMsgId = genId();
      setStreamingId(aiMsgId);
      setStreamingContent('');

      try {
        const greeting = await generateDailyGreeting(
          character,
          settings.service,
          settings.advanced
        );
        const aiMsg: Message = {
          id: aiMsgId,
          role: 'assistant',
          content: greeting || character.greeting,
          timestamp: Date.now(),
        };
        await addMessage(characterId, aiMsg);
      } catch {
        const aiMsg: Message = {
          id: aiMsgId,
          role: 'assistant',
          content: character.greeting,
          timestamp: Date.now(),
        };
        await addMessage(characterId, aiMsg);
      } finally {
        setTyping(false);
        setStreamingId(null);
        setStreamingContent('');
      }
    };

    sendAutoGreet();
  }, [autoGreet, character, characterId]);

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

      const userMsg: Message = {
        id: genId(),
        role: 'user',
        content: text,
        timestamp: Date.now(),
        imageUri,
      };
      await addMessage(characterId, userMsg);

      if (settings.advanced.sendDelayMs > 0) {
        await new Promise((r) => setTimeout(r, settings.advanced.sendDelayMs));
      }

      setTyping(true);

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

  const handleQuickReply = useCallback(
    (text: string) => {
      handleSend(text);
    },
    [handleSend]
  );

  const handleFocusInput = useCallback(() => {
    inputRef.current?.focus();
  }, []);

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

        {/* Quick Reply Buttons */}
        <View style={[styles.quickReplyContainer, { backgroundColor: C.surface, borderTopColor: C.border }]}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickReplyScroll}
          >
            {QUICK_REPLIES.map((qr) => (
              <TouchableOpacity
                key={qr.label}
                style={[
                  styles.quickReplyBtn,
                  { backgroundColor: C.primaryLight + '33', borderColor: C.primary },
                ]}
                onPress={() => handleQuickReply(qr.text)}
                disabled={isTyping}
                activeOpacity={0.75}
              >
                <Text style={[styles.quickReplyText, { color: C.primary }]}>{qr.label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[
                styles.quickReplyBtn,
                { backgroundColor: C.surface, borderColor: C.border },
              ]}
              onPress={handleFocusInput}
              activeOpacity={0.75}
            >
              <Text style={[styles.quickReplyText, { color: C.textSecondary }]}>✏️ 自己输入</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        <MessageInput
          ref={inputRef}
          onSend={handleSend}
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
  quickReplyContainer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: 8,
  },
  quickReplyScroll: {
    paddingHorizontal: 12,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  quickReplyBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  quickReplyText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
