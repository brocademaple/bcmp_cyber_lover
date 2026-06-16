import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
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
import { LinearGradient } from 'expo-linear-gradient';
import {
  calculateAffinityDelta,
  evaluateMemoryDecision,
  MemoryDecision,
  nextEmotionalState,
} from '../services/relationshipService';

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

  const {
    messages,
    addMessage,
    updateMessage,
    loadMessages,
    setTyping,
    isTyping,
    getCharacter,
    updateEmotionalState,
    addMemory,
    generateDiariesForCharacter,
  } = useChatStore();
  const { settings, setSelectedCharacter } = useSettingsStore();

  const character = getCharacter(characterId);
  const getEffectiveNow = () => settings.advanced.debugNowTs ?? Date.now();
  const chatMessages = messages[characterId] || [];
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [deliveryIssue, setDeliveryIssue] = useState<{ text: string; imageUri?: string } | null>(null);
  const [memoryPrompt, setMemoryPrompt] = useState<Extract<MemoryDecision, { action: 'ask' }> | null>(null);

  useEffect(() => {
    loadMessages(characterId);
    setSelectedCharacter(characterId);
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
        timestamp: getEffectiveNow(),
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
          timestamp: getEffectiveNow(),
        };
        await addMessage(characterId, aiMsg);
      } catch {
        const aiMsg: Message = {
          id: aiMsgId,
          role: 'assistant',
          content: character.greeting,
          timestamp: getEffectiveNow(),
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
        setDeliveryIssue({ text, imageUri });
        return;
      }

      const userMsg: Message = {
        id: genId(),
        role: 'user',
        content: text,
        timestamp: getEffectiveNow(),
        status: 'sending',
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
          timestamp: getEffectiveNow(),
        };
        await addMessage(characterId, aiMsg);
        await updateMessage(characterId, userMsg.id, { status: 'sent', errorMessage: undefined });
        setDeliveryIssue(null);

        const now = getEffectiveNow();
        const affinityDelta = calculateAffinityDelta(character, text);
        await updateEmotionalState(
          characterId,
          nextEmotionalState(character.emotionalState, affinityDelta, now, text)
        );

        const memoryDecision = evaluateMemoryDecision(character, text);
        if (memoryDecision.action === 'save') {
          await addMemory(characterId, memoryDecision.content, memoryDecision.tags, memoryDecision.importance);
          await addMessage(characterId, {
            id: genId(),
            role: 'assistant',
            content: '我已经把这件事写进记忆里了。',
            timestamp: getEffectiveNow(),
          });
          setMemoryPrompt(null);
        } else if (memoryDecision.action === 'ask') {
          setMemoryPrompt(memoryDecision);
        } else {
          setMemoryPrompt(null);
        }

        // 每次有效聊天后刷新该角色的日报/周记/月记
        await generateDiariesForCharacter(characterId);
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : '服务暂时没有连接好';
        await updateMessage(characterId, userMsg.id, { status: 'failed', errorMessage: errorMsg });
        setDeliveryIssue({ text, imageUri });
      } finally {
        setTyping(false);
        setStreamingId(null);
        setStreamingContent('');
      }
    },
    [
      character,
      characterId,
      chatMessages,
      settings,
      addMessage,
      updateMessage,
      updateEmotionalState,
      addMemory,
      generateDiariesForCharacter,
    ]
  );

  const handleQuickReply = useCallback(
    (text: string) => {
      handleSend(text);
    },
    [handleSend]
  );

  const handleConfirmMemory = useCallback(async () => {
    if (!memoryPrompt) return;
    await addMemory(characterId, memoryPrompt.content, memoryPrompt.tags, memoryPrompt.importance);
    await addMessage(characterId, {
      id: genId(),
      role: 'assistant',
      content: '好，我把这件事写进记忆里了。',
      timestamp: getEffectiveNow(),
    });
    setMemoryPrompt(null);
  }, [addMemory, addMessage, characterId, memoryPrompt]);

  // Build display messages list
  const displayMessages: Message[] = [...chatMessages];
  if (isTyping && streamingId) {
    if (streamingContent) {
      displayMessages.push({
        id: streamingId,
        role: 'assistant',
        content: streamingContent,
        timestamp: getEffectiveNow(),
      });
    } else {
      displayMessages.push({
        id: streamingId + '_thinking',
        role: 'assistant',
        content: '',
        timestamp: getEffectiveNow(),
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

  const backgroundImage = character.assetSet?.main ?? character.imageUri;
  const backgroundSource =
    backgroundImage != null
      ? typeof backgroundImage === 'number'
        ? backgroundImage
        : { uri: backgroundImage }
      : null;

  const content = (
    <>
      <StatusBar barStyle={character.theme === 'midnight' ? 'light-content' : 'dark-content'} backgroundColor={C.background} />
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

        {deliveryIssue && (
          <View style={[styles.deliveryNotice, { backgroundColor: C.surface, borderColor: C.border }]}>
            <Text style={[styles.deliveryTitle, { color: C.text }]}>服务还没有连接好，先去设置一下？</Text>
            <View style={styles.deliveryActions}>
              <TouchableOpacity
                style={[styles.deliveryPrimary, { backgroundColor: C.primary }]}
                onPress={() => navigation.navigate('ServiceSettings')}
              >
                <Text style={styles.deliveryPrimaryText}>去连接服务</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.deliverySecondary, { borderColor: C.border }]}
                onPress={() => handleSend(deliveryIssue.text, deliveryIssue.imageUri)}
              >
                <Text style={[styles.deliverySecondaryText, { color: C.primary }]}>重试</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {memoryPrompt && (
          <View style={[styles.memoryNotice, { backgroundColor: C.surface + 'F2', borderColor: C.border }]}>
            <Text style={[styles.memoryNoticeTitle, { color: C.text }]}>{memoryPrompt.question}</Text>
            <Text style={[styles.memoryNoticeText, { color: C.textSecondary }]} numberOfLines={2}>
              {memoryPrompt.content}
            </Text>
            <View style={styles.deliveryActions}>
              <TouchableOpacity
                style={[styles.deliveryPrimary, { backgroundColor: C.primary }]}
                onPress={handleConfirmMemory}
              >
                <Text style={styles.deliveryPrimaryText}>写入记忆</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.deliverySecondary, { borderColor: C.border }]}
                onPress={() => setMemoryPrompt(null)}
              >
                <Text style={[styles.deliverySecondaryText, { color: C.textSecondary }]}>先不记</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Quick Reply Buttons */}
        <View style={[styles.quickReplyContainer, { backgroundColor: C.surface + 'D8', borderTopColor: C.border }]}>
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
          <LinearGradient
            colors={[
              character.theme === 'midnight' ? 'rgba(4,6,14,0.44)' : 'rgba(255,248,246,0.64)',
              character.theme === 'midnight' ? 'rgba(4,6,14,0.18)' : 'rgba(255,248,246,0.2)',
              character.theme === 'midnight' ? 'rgba(4,6,14,0.82)' : 'rgba(255,248,246,0.86)',
            ]}
            locations={[0, 0.46, 1]}
            style={styles.backgroundOverlay}
          />
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
    paddingTop: 96,
    paddingBottom: 12,
  },
  quickReplyContainer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: 8,
  },
  quickReplyScroll: {
    paddingHorizontal: 10,
    paddingRight: 18,
    gap: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  quickReplyBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    minWidth: 78,
    alignItems: 'center',
  },
  quickReplyText: {
    fontSize: 13,
    fontWeight: '500',
  },
  deliveryNotice: {
    marginHorizontal: 12,
    marginBottom: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    padding: 12,
  },
  memoryNotice: {
    marginHorizontal: 12,
    marginBottom: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 20,
    padding: 13,
    gap: 8,
  },
  memoryNoticeTitle: {
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 20,
  },
  memoryNoticeText: {
    fontSize: 13,
    lineHeight: 19,
  },
  deliveryTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
  },
  deliveryActions: {
    flexDirection: 'row',
    gap: 8,
  },
  deliveryPrimary: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 9,
    alignItems: 'center',
  },
  deliveryPrimaryText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  deliverySecondary: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 9,
    alignItems: 'center',
  },
  deliverySecondaryText: {
    fontSize: 13,
    fontWeight: '800',
  },
});
