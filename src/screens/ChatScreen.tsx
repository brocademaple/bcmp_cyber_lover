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
  useColorScheme,
  Image,
  ImageBackground,
  InteractionManager,
  ScrollView,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  RootStackParamList,
  Message,
  Character,
  MemoryConfig,
  DebugPromptMessage,
  DebugPromptSection,
  DebugRequestItem,
} from '../types';
import { useChatStore } from '../store/chatStore';
import { useSettingsStore } from '../store/settingsStore';
import { useDebugStore } from '../store/debugStore';
import {
  sendMessage,
  generateDailyGreeting,
  generateMoodEntryGreeting,
  getCharacterStateLabel,
  buildPromptDebugSnapshot,
} from '../services/aiService';
import ChatBubble from '../components/ChatBubble';
import MessageInput from '../components/MessageInput';
import { useThemeColors, useThemeId } from '../utils/theme';
import { NOTO_SANS_SC, NOTO_SERIF_SC } from '../utils/appFonts';
import { oldestFirst, recentChronological } from '../utils/chatHistory';
import { LinearGradient } from 'expo-linear-gradient';
import {
  calculateAffinityDelta,
  MemoryDecision,
  nextEmotionalState,
} from '../services/relationshipService';
import { evaluateMemoryDecisionAfterReply } from '../services/memoryDecisionService';
import {
  evaluateMoodFromConversation,
  MoodJudgementResult,
} from '../services/moodJudgementService';

type Props = NativeStackScreenProps<RootStackParamList, 'Chat'>;

let msgIdCounter = Date.now();
function genId() {
  return `msg_${++msgIdCounter}`;
}

function getImageSource(source?: Character['imageUri']) {
  if (source == null) return null;
  return typeof source === 'number' ? source : { uri: source };
}

const QUICK_REPLIES = [
  { label: '😊 嗯嗯～', text: '嗯嗯～' },
  { label: '❤️ 我也是', text: '我也是' },
  { label: '😴 今天好累', text: '今天好累' },
  { label: '🥺 想你了', text: '想你了' },
];
const MOOD_ENTRY_VALID_MS = 5 * 60 * 1000;

function buildMoodJudgementCacheKey(characterId: string, mood: string, messages: Message[]) {
  const effectiveMessages = recentChronological(messages, 18)
    .filter((message) => message.role !== 'system' && message.status !== 'failed' && message.content.trim());
  const lastMessage = effectiveMessages[effectiveMessages.length - 1];
  return [
    characterId,
    mood,
    effectiveMessages.length,
    lastMessage?.id ?? 'none',
    lastMessage?.timestamp ?? 0,
    lastMessage?.content.length ?? 0,
  ].join(':');
}

type PendingSend = {
  characterId: string;
  userMsg: Message;
};

type MemoryCaptureNotice =
  | (Extract<MemoryDecision, { action: 'ask' }> & {
      kind: 'ask';
      sourceMessageId?: string;
      sourceAssistantMessageId?: string;
    })
  | { kind: 'saved'; content: string };

function getMemoryDecisionContext(messages: Message[], memory: MemoryConfig): Message[] {
  if (!memory.alwaysRetainHistory) return recentChronological(messages, 2);
  const retentionRange = Number.isFinite(memory.retentionRange)
    ? Math.max(2, Math.min(200, Math.round(memory.retentionRange)))
    : 24;
  return recentChronological(messages, retentionRange);
}

function formatMemoryDecisionDetail(decision: MemoryDecision | { action: 'none' }) {
  return JSON.stringify(decision, null, 2);
}

function buildDisplayMessages(chatMessages: Message[], moodEntryMessage: Message | null): Message[] {
  return moodEntryMessage
    ? oldestFirst([...chatMessages, moodEntryMessage])
    : oldestFirst(chatMessages);
}

export default function ChatScreen({ route, navigation }: Props) {
  const { characterId, autoGreet, moodEntry } = route.params;
  const C = useThemeColors();
  const themeId = useThemeId();
  const isUrbanClear = themeId === 'urbanClear';
  const isSoftSweet = themeId === 'softSweet';
  const systemScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<{ focus: () => void }>(null);
  const autoGreetSentRef = useRef(false);
  const moodEntryHandledKeyRef = useRef<string | null>(null);
  const didInitialScrollRef = useRef(false);
  const sendQueueRef = useRef<PendingSend[]>([]);
  const isProcessingQueueRef = useRef(false);

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
  const isDarkChrome =
    themeId === 'midnight' ||
    settings.advanced.darkMode === 'dark' ||
    (settings.advanced.darkMode === 'auto' && systemScheme === 'dark');

  const character = getCharacter(characterId);
  const getEffectiveNow = () => settings.advanced.debugNowTs ?? Date.now();
  const chatMessages = messages[characterId] || [];
  const characterRef = useRef(character);
  const settingsRef = useRef(settings);
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [pendingUserMessages, setPendingUserMessages] = useState<Message[]>([]);
  const [deliveryIssue, setDeliveryIssue] = useState<{ text: string; imageUri?: string } | null>(null);
  const [memoryNotice, setMemoryNotice] = useState<MemoryCaptureNotice | null>(null);
  const [moodJudgement, setMoodJudgement] = useState<MoodJudgementResult | null>(null);
  const [isMoodJudging, setIsMoodJudging] = useState(false);
  const [moodSynced, setMoodSynced] = useState(false);
  const [moodEntryMessage, setMoodEntryMessage] = useState<Message | null>(null);
  const [historyLoadedCharacterId, setHistoryLoadedCharacterId] = useState<string | null>(null);
  const moodJudgementCacheRef = useRef<{ key: string; result: MoodJudgementResult } | null>(null);
  const moodEntryMood = moodEntry?.mood;
  const moodEntryChangedAt = moodEntry?.changedAt;
  const moodEntrySource = moodEntry?.source;

  useEffect(() => {
    characterRef.current = character;
    settingsRef.current = settings;
  }, [character, settings]);

  useEffect(() => {
    didInitialScrollRef.current = false;
    setHistoryLoadedCharacterId(null);
    let cancelled = false;
    loadMessages(characterId).finally(() => {
      if (!cancelled) {
        setHistoryLoadedCharacterId(characterId);
      }
    });
    setSelectedCharacter(characterId);
    return () => {
      cancelled = true;
    };
  }, [characterId, loadMessages, setSelectedCharacter]);

  const scrollToLatest = useCallback((animated: boolean) => {
    flatListRef.current?.scrollToEnd({ animated });

    requestAnimationFrame(() => {
      flatListRef.current?.scrollToEnd({ animated });
    });

    InteractionManager.runAfterInteractions(() => {
      flatListRef.current?.scrollToEnd({ animated });
    });
  }, []);

  // Send static greeting if first ever visit (no autoGreet)
  useEffect(() => {
    if (!character) return;
    if (historyLoadedCharacterId !== characterId) return;
    if (!autoGreet && !moodEntry && chatMessages.length === 0) {
      const greeting: Message = {
        id: genId(),
        role: 'assistant',
        content: character.greeting,
        timestamp: getEffectiveNow(),
        characterMood: character.emotionalState?.mood ?? 'neutral',
      };
      addMessage(characterId, greeting);
    }
  }, [addMessage, autoGreet, character, characterId, chatMessages.length, historyLoadedCharacterId, moodEntry]);

  useEffect(() => {
    if (
      !moodEntryMood ||
      moodEntryChangedAt == null ||
      moodEntrySource !== 'homeStatus' ||
      Date.now() - moodEntryChangedAt > MOOD_ENTRY_VALID_MS
    ) {
      if (moodEntryHandledKeyRef.current !== null) {
        moodEntryHandledKeyRef.current = null;
        setMoodEntryMessage(null);
      }
      return;
    }

    const latestCharacter = useChatStore.getState().getCharacter(characterId) ?? characterRef.current;
    if (!latestCharacter) {
      if (moodEntryHandledKeyRef.current !== null) {
        moodEntryHandledKeyRef.current = null;
        setMoodEntryMessage(null);
      }
      return;
    }

    const latestSettings = settingsRef.current;
    let cancelled = false;
    const messageId = `mood_entry_${characterId}_${moodEntryChangedAt}_${moodEntryMood}`;
    if (moodEntryHandledKeyRef.current === messageId) return;
    moodEntryHandledKeyRef.current = messageId;

    setMoodEntryMessage({
      id: `${messageId}_thinking`,
      role: 'assistant',
      content: '',
      timestamp: moodEntryChangedAt,
      characterMood: moodEntryMood,
      isThinking: true,
    });

    generateMoodEntryGreeting(
      latestCharacter,
      moodEntryMood,
      latestSettings.service,
      latestSettings.advanced,
      moodEntryChangedAt
    ).then((content) => {
      if (cancelled) return;
      setMoodEntryMessage({
        id: messageId,
        role: 'assistant',
        content,
        timestamp: moodEntryChangedAt,
        characterMood: moodEntryMood,
      });
    });

    return () => {
      cancelled = true;
    };
  }, [characterId, moodEntryChangedAt, moodEntryMood, moodEntrySource]);

  const processQueuedSends = useCallback(async () => {
    if (isProcessingQueueRef.current) return;

    isProcessingQueueRef.current = true;
    try {
      while (sendQueueRef.current.length > 0) {
        const next = sendQueueRef.current.shift();
        if (!next) continue;

        setPendingUserMessages((pending) => pending.filter((message) => message.id !== next.userMsg.id));

        const latestSettings = settingsRef.current;
        const latestCharacter = useChatStore.getState().getCharacter(next.characterId) ?? characterRef.current;
        if (!latestCharacter) continue;

        const historyForRequest = useChatStore.getState().messages[next.characterId] || [];
        await addMessage(next.characterId, next.userMsg);

        setTyping(true);
        const aiMsgId = genId();
        setStreamingId(aiMsgId);
        setStreamingContent('');

        if (!latestSettings.service.apiKey) {
          await updateMessage(next.characterId, next.userMsg.id, {
            status: 'failed',
            errorMessage: '请先在设置中配置服务提供商和API密钥',
          });
          setDeliveryIssue({ text: next.userMsg.content, imageUri: next.userMsg.imageUri });
          setStreamingId(null);
          setStreamingContent('');
          continue;
        }

        if (latestSettings.advanced.sendDelayMs > 0) {
          await new Promise((r) => setTimeout(r, latestSettings.advanced.sendDelayMs));
        }

        let fullContent = '';
        let promptSummary = '';
        let promptRequestSummary: DebugRequestItem[] = [];
        let promptSections: DebugPromptSection[] = [];
        let promptMessagesPreview: DebugPromptMessage[] = [];
        let promptNotes: string[] = [];
        let emotionBefore = latestCharacter.emotionalState;
        let emotionAfter = latestCharacter.emotionalState;
        let affinityDelta = 0;

        try {
          const debugSnapshot = buildPromptDebugSnapshot({
            character: latestCharacter,
            chatHistory: historyForRequest,
            config: latestSettings.service,
            memory: latestSettings.memory,
            advanced: latestSettings.advanced,
            userText: next.userMsg.content,
            imageUri: next.userMsg.imageUri,
            nowTs: latestSettings.advanced.debugNowTs ?? Date.now(),
          });
          promptSummary = `${debugSnapshot.title} · ${debugSnapshot.apiMessagesPreview.length} messages · ${debugSnapshot.model}`;
          promptRequestSummary = debugSnapshot.requestSummary;
          promptSections = debugSnapshot.sections;
          promptMessagesPreview = debugSnapshot.apiMessagesPreview;
          promptNotes = debugSnapshot.notes;

          fullContent = await sendMessage(
            next.userMsg.content,
            latestCharacter,
            historyForRequest,
            latestSettings.service,
            latestSettings.memory,
            latestSettings.advanced,
            next.userMsg.imageUri,
            (chunk) => {
              fullContent += chunk;
              setStreamingContent(fullContent);
            },
            latestSettings.advanced.debugNowTs ?? Date.now()
          );

          const aiMsg: Message = {
            id: aiMsgId,
            role: 'assistant',
            content: fullContent || '...',
            timestamp: latestSettings.advanced.debugNowTs ?? Date.now(),
            characterMood: latestCharacter.emotionalState?.mood ?? 'neutral',
          };
          await addMessage(next.characterId, aiMsg);
          await updateMessage(next.characterId, next.userMsg.id, { status: 'sent', errorMessage: undefined });
          setDeliveryIssue(null);

          const now = latestSettings.advanced.debugNowTs ?? Date.now();
          affinityDelta = calculateAffinityDelta(latestCharacter, next.userMsg.content);
          emotionBefore = latestCharacter.emotionalState;
          emotionAfter = nextEmotionalState(latestCharacter.emotionalState, affinityDelta, now, next.userMsg.content);
          await updateEmotionalState(next.characterId, emotionAfter);

          const memoryDecision = latestSettings.memory.enabled
            ? await evaluateMemoryDecisionAfterReply({
                character: latestCharacter,
                userMessage: next.userMsg,
                assistantMessage: aiMsg,
                recentMessages: getMemoryDecisionContext(
                  [...historyForRequest, next.userMsg, aiMsg],
                  latestSettings.memory
                ),
                service: latestSettings.service,
                memory: latestSettings.memory,
                advanced: latestSettings.advanced,
              })
            : { action: 'none' as const };
          if (memoryDecision.action === 'save') {
            await addMemory(
              next.characterId,
              memoryDecision.content,
              memoryDecision.tags,
              memoryDecision.importance,
              {
                sourceMessageId: next.userMsg.id,
                sourceAssistantMessageId: aiMsg.id,
                confidence: 1,
              }
            );
            setMemoryNotice({ kind: 'saved', content: memoryDecision.content });
          } else if (memoryDecision.action === 'ask') {
            setMemoryNotice({
              ...memoryDecision,
              kind: 'ask',
              sourceMessageId: next.userMsg.id,
              sourceAssistantMessageId: aiMsg.id,
            });
          } else {
            setMemoryNotice(null);
          }

          // 每次有效聊天后刷新该角色的日报/周记/月记
          await generateDiariesForCharacter(next.characterId);
          void useDebugStore.getState().addTrace({
            id: `trace_${now}_${next.userMsg.id}`,
            timestamp: now,
            characterId: next.characterId,
            characterName: latestCharacter.name,
            userMessageId: next.userMsg.id,
            assistantMessageId: aiMsg.id,
            userText: next.userMsg.content,
            model: debugSnapshot.model,
            promptSummary,
            promptRequestSummary,
            promptSections,
            promptMessagesPreview,
            promptNotes,
            emotionBefore,
            emotionAfter,
            affinityDelta,
            memoryDecision: memoryDecision.action,
            memoryDecisionDetail: formatMemoryDecisionDetail(memoryDecision),
            assistantText: aiMsg.content,
          });
        } catch (err: unknown) {
          const errorMsg = err instanceof Error ? err.message : '服务暂时没有连接好';
          await updateMessage(next.characterId, next.userMsg.id, { status: 'failed', errorMessage: errorMsg });
          setDeliveryIssue({ text: next.userMsg.content, imageUri: next.userMsg.imageUri });
          void useDebugStore.getState().addTrace({
            id: `trace_error_${Date.now()}_${next.userMsg.id}`,
            timestamp: latestSettings.advanced.debugNowTs ?? Date.now(),
            characterId: next.characterId,
            characterName: latestCharacter.name,
            userMessageId: next.userMsg.id,
            userText: next.userMsg.content,
            model: latestSettings.service.model,
            promptSummary: promptSummary || '生成前失败',
            promptRequestSummary,
            promptSections,
            promptMessagesPreview,
            promptNotes,
            emotionBefore,
            emotionAfter,
            affinityDelta,
            memoryDecision: 'not-run',
            memoryDecisionDetail: JSON.stringify({ action: 'not-run', reason: 'assistant generation failed' }, null, 2),
            errorMessage: errorMsg,
          });
        } finally {
          setStreamingId(null);
          setStreamingContent('');
        }
      }
    } finally {
      isProcessingQueueRef.current = false;
      setTyping(false);
      setStreamingId(null);
      setStreamingContent('');

      if (sendQueueRef.current.length > 0) {
        processQueuedSends();
      }
    }
  }, [
    addMessage,
    updateMessage,
    updateEmotionalState,
    addMemory,
    generateDiariesForCharacter,
    setTyping,
  ]);

  // Auto-send AI daily greeting when opened from notification
  useEffect(() => {
    if (!autoGreet || !character || autoGreetSentRef.current) return;
    if (!settings.service.apiKey) return;
    autoGreetSentRef.current = true;

    const sendAutoGreet = async () => {
      isProcessingQueueRef.current = true;
      setTyping(true);
      const aiMsgId = genId();
      setStreamingId(aiMsgId);
      setStreamingContent('');

      try {
        const greeting = await generateDailyGreeting(
          character,
          settings.service,
          settings.advanced,
          getEffectiveNow()
        );
        const aiMsg: Message = {
          id: aiMsgId,
          role: 'assistant',
          content: greeting || character.greeting,
          timestamp: getEffectiveNow(),
          characterMood: character.emotionalState?.mood ?? 'neutral',
        };
        await addMessage(characterId, aiMsg);
      } catch {
        const aiMsg: Message = {
          id: aiMsgId,
          role: 'assistant',
          content: character.greeting,
          timestamp: getEffectiveNow(),
          characterMood: character.emotionalState?.mood ?? 'neutral',
        };
        await addMessage(characterId, aiMsg);
      } finally {
        isProcessingQueueRef.current = false;
        setTyping(false);
        setStreamingId(null);
        setStreamingContent('');

        if (sendQueueRef.current.length > 0) {
          processQueuedSends();
        }
      }
    };

    sendAutoGreet();
  }, [autoGreet, character, characterId, processQueuedSends]);

  const handleSend = useCallback(
    (text: string, imageUri?: string) => {
      if (!character) return;
      if (!settings.service.apiKey) {
        setDeliveryIssue({ text, imageUri });
        return;
      }

      const userMsg: Message = {
        id: genId(),
        role: 'user',
        content: text,
        timestamp: settingsRef.current.advanced.debugNowTs ?? Date.now(),
        status: 'sending',
        imageUri,
      };

      sendQueueRef.current.push({ characterId, userMsg });
      setPendingUserMessages((pending) => [...pending, userMsg]);
      processQueuedSends();
    },
    [character, characterId, settings.service.apiKey, processQueuedSends]
  );

  const handleQuickReply = useCallback(
    (text: string) => {
      handleSend(text);
    },
    [handleSend]
  );

  const handleConfirmMemory = useCallback(async () => {
    if (!memoryNotice || memoryNotice.kind !== 'ask') return;
    await addMemory(
      characterId,
      memoryNotice.content,
      memoryNotice.tags,
      memoryNotice.importance,
      {
        sourceMessageId: memoryNotice.sourceMessageId,
        sourceAssistantMessageId: memoryNotice.sourceAssistantMessageId,
        confidence: 1,
      }
    );
    setMemoryNotice({ kind: 'saved', content: memoryNotice.content });
  }, [addMemory, characterId, memoryNotice]);

  const handleJudgeMood = useCallback(async () => {
    const latestCharacter = useChatStore.getState().getCharacter(characterId) ?? characterRef.current;
    if (!latestCharacter) return;
    const latestMessages = useChatStore.getState().messages[characterId] || [];
    const cacheKey = buildMoodJudgementCacheKey(
      characterId,
      latestCharacter.emotionalState?.mood ?? 'neutral',
      latestMessages
    );

    if (moodJudgementCacheRef.current?.key === cacheKey) {
      setMoodJudgement(moodJudgementCacheRef.current.result);
      setMoodSynced(false);
      return;
    }

    setIsMoodJudging(true);
    setMoodSynced(false);
    try {
      const latestSettings = settingsRef.current;
      const result = await evaluateMoodFromConversation({
        character: latestCharacter,
        messages: latestMessages,
        service: latestSettings.service,
        advanced: latestSettings.advanced,
        nowTs: latestSettings.advanced.debugNowTs ?? Date.now(),
        preferLocal: isTyping || Boolean(streamingId),
      });
      moodJudgementCacheRef.current = { key: cacheKey, result };
      setMoodJudgement(result);
    } finally {
      setIsMoodJudging(false);
    }
  }, [characterId, isTyping, streamingId]);

  const handleSyncMood = useCallback(async () => {
    if (!moodJudgement?.shouldSync) return;
    await updateEmotionalState(characterId, {
      mood: moodJudgement.suggestedMood,
      lastInteraction: settingsRef.current.advanced.debugNowTs ?? Date.now(),
    });
    setMoodSynced(true);
  }, [characterId, moodJudgement, updateEmotionalState]);

  // Build display messages list
  const displayMessages: Message[] = buildDisplayMessages(chatMessages, moodEntryMessage);
  if (isTyping && streamingId) {
    if (streamingContent) {
      displayMessages.push({
        id: streamingId,
        role: 'assistant',
        content: streamingContent,
        timestamp: getEffectiveNow(),
        characterMood: character?.emotionalState?.mood ?? 'neutral',
      });
    } else {
      displayMessages.push({
        id: streamingId + '_thinking',
        role: 'assistant',
        content: '',
        timestamp: getEffectiveNow(),
        characterMood: character?.emotionalState?.mood ?? 'neutral',
        isThinking: true,
      });
    }
  }
  displayMessages.push(...pendingUserMessages);
  const latestDisplayMessage = displayMessages[displayMessages.length - 1];
  const latestDisplayMessageKey = latestDisplayMessage
    ? [
        characterId,
        latestDisplayMessage.id,
        latestDisplayMessage.content.length,
        latestDisplayMessage.isThinking ? 'thinking' : 'ready',
        displayMessages.length,
      ].join(':')
    : characterId;

  useEffect(() => {
    if (displayMessages.length === 0) return;
    const animated = didInitialScrollRef.current;
    const frame = requestAnimationFrame(() => {
      scrollToLatest(animated);
      didInitialScrollRef.current = true;
    });
    return () => cancelAnimationFrame(frame);
  }, [displayMessages.length, latestDisplayMessageKey, scrollToLatest]);

  if (!character) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: C.background }]}>
        <Text style={{ color: C.text, textAlign: 'center', marginTop: 40 }}>角色未找到</Text>
      </SafeAreaView>
    );
  }

  const backgroundImage = character.assetSet?.main ?? character.imageUri;
  const identityImage = character.assetSet?.headshot ?? character.assetSet?.avatar ?? backgroundImage;
  const backgroundSource =
    backgroundImage != null
      ? typeof backgroundImage === 'number'
        ? backgroundImage
        : { uri: backgroundImage }
      : null;

  const backgroundOverlayColors: [string, string, string] = [
    C.chatBackgroundOverlay,
    isUrbanClear ? C.surface + '62' : isSoftSweet ? C.accentLight + '66' : C.chatBackgroundOverlay,
    isUrbanClear || isSoftSweet ? C.background + 'EE' : C.chatBackgroundOverlay,
  ];
  const identityTop = insets.top + 8;
  const messageListTop = identityTop + 92;

  const content = (
    <>
      <StatusBar barStyle={isDarkChrome ? 'light-content' : 'dark-content'} backgroundColor={C.background} />
      <KeyboardAvoidingView
        style={[styles.flex, styles.contentChrome]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={[styles.chatHeader, { top: identityTop }]}>
          <TouchableOpacity
            style={[
              styles.chatHeaderButton,
              isUrbanClear && styles.urbanChatHeaderButton,
              isSoftSweet && styles.softChatHeaderButton,
              { backgroundColor: C.surface + 'E8', borderColor: C.border, shadowColor: C.shadow },
            ]}
            onPress={() => navigation.goBack()}
            activeOpacity={0.78}
            accessibilityRole="button"
            accessibilityLabel="返回"
          >
            <Text style={[styles.chatBackIcon, { color: C.textSecondary }]}>‹</Text>
          </TouchableOpacity>

          <View
            style={[
              styles.chatIdentityBar,
              isUrbanClear && styles.urbanChatIdentityBar,
              isSoftSweet && styles.softChatIdentityBar,
              {
                backgroundColor: isSoftSweet ? C.surface + 'F4' : C.surface + 'EE',
                borderColor: C.border,
                shadowColor: C.shadow,
              },
            ]}
            accessibilityLabel={`${character.name}当前状态：${getCharacterStateLabel(character)}`}
          >
            {getImageSource(identityImage) ? (
              <Image
                key={`chat-identity-${character.id}`}
                source={getImageSource(identityImage)!}
                style={[
                  styles.chatIdentityAvatar,
                  isUrbanClear && styles.urbanIdentityAvatar,
                  isSoftSweet && styles.softIdentityAvatar,
                ]}
                resizeMode="cover"
              />
            ) : (
              <View
                style={[
                  styles.chatIdentityAvatarFallback,
                  isUrbanClear && styles.urbanIdentityAvatar,
                  isSoftSweet && styles.softIdentityAvatar,
                  { backgroundColor: C.primaryLight },
                ]}
              >
                <Text style={styles.chatIdentityEmoji}>{character.avatar}</Text>
              </View>
            )}
            <View style={styles.chatIdentityCopy}>
              <Text style={[styles.chatIdentityName, { color: C.text }]} numberOfLines={1}>
                {character.name}
              </Text>
              <Text style={[styles.chatIdentityStatus, { color: C.primary }]} numberOfLines={1}>
                {getCharacterStateLabel(character)}
              </Text>
            </View>
            <View style={[styles.chatIdentityDot, { backgroundColor: C.primary }]} />
          </View>

          <View style={styles.chatHeaderActionGroup}>
            <TouchableOpacity
              style={[
                styles.chatHeaderButton,
                styles.chatHeaderCompactButton,
                isUrbanClear && styles.urbanChatHeaderButton,
                isSoftSweet && styles.softChatHeaderButton,
                { backgroundColor: C.surface + 'E8', borderColor: C.border, shadowColor: C.shadow },
              ]}
              onPress={handleJudgeMood}
              activeOpacity={0.78}
              disabled={isMoodJudging}
              accessibilityRole="button"
              accessibilityLabel="校准当前会话状态"
            >
              <Text style={[styles.chatMoodIcon, { color: C.primary }]}>
                {isMoodJudging ? '…' : '♡'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.chatHeaderButton,
                styles.chatHeaderCompactButton,
                isUrbanClear && styles.urbanChatHeaderButton,
                isSoftSweet && styles.softChatHeaderButton,
                { backgroundColor: C.surface + 'E8', borderColor: C.border, shadowColor: C.shadow },
              ]}
              onPress={() => navigation.navigate('CharacterSettings', { characterId, initialPage: 'archive' })}
              activeOpacity={0.78}
              accessibilityRole="button"
              accessibilityLabel="打开角色档案和聊天记录"
            >
              <Text style={[styles.chatSettingsIcon, { color: C.text }]}>☰</Text>
            </TouchableOpacity>
          </View>
        </View>

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
          contentContainerStyle={[styles.messageList, { paddingTop: messageListTop }]}
        />

        {deliveryIssue && (
          <View
            style={[
              styles.deliveryNotice,
              isUrbanClear && styles.urbanNotice,
              isSoftSweet && styles.softNotice,
              { backgroundColor: C.surface, borderColor: C.border, shadowColor: C.shadow },
            ]}
          >
            <Text style={[styles.deliveryTitle, { color: C.text }]}>服务还没有连接好，先去设置一下？</Text>
            <View style={styles.deliveryActions}>
              <TouchableOpacity
                style={[
                  styles.deliveryPrimary,
                  isUrbanClear && styles.urbanActionBtn,
                  isSoftSweet && styles.softActionBtn,
                  { backgroundColor: C.primary },
                ]}
                onPress={() => navigation.navigate('ServiceSettings')}
              >
                <Text style={styles.deliveryPrimaryText}>去连接服务</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.deliverySecondary,
                  isUrbanClear && styles.urbanActionBtn,
                  isSoftSweet && styles.softActionBtn,
                  { borderColor: C.border },
                ]}
                onPress={() => handleSend(deliveryIssue.text, deliveryIssue.imageUri)}
              >
                <Text style={[styles.deliverySecondaryText, { color: C.primary }]}>重试</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {memoryNotice && (
          <View
            style={[
              styles.memoryNotice,
              isUrbanClear && styles.urbanNotice,
              isSoftSweet && styles.softNotice,
              { backgroundColor: C.surface + 'F2', borderColor: C.border, shadowColor: C.shadow },
            ]}
          >
            <Text style={[styles.memoryNoticeTitle, { color: C.text }]}>
              {memoryNotice.kind === 'ask' ? memoryNotice.question : '已写入长期记忆'}
            </Text>
            <Text style={[styles.memoryNoticeText, { color: C.textSecondary }]} numberOfLines={2}>
              {memoryNotice.content}
            </Text>
            <View style={styles.deliveryActions}>
              {memoryNotice.kind === 'ask' && (
                <TouchableOpacity
                  style={[
                    styles.deliveryPrimary,
                    isUrbanClear && styles.urbanActionBtn,
                    isSoftSweet && styles.softActionBtn,
                    { backgroundColor: C.primary },
                  ]}
                  onPress={handleConfirmMemory}
                >
                  <Text style={styles.deliveryPrimaryText}>写入记忆</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[
                  memoryNotice.kind === 'saved' ? styles.deliveryPrimary : styles.deliverySecondary,
                  isUrbanClear && styles.urbanActionBtn,
                  isSoftSweet && styles.softActionBtn,
                  memoryNotice.kind === 'saved'
                    ? { backgroundColor: C.primary }
                    : { borderColor: C.border },
                ]}
                onPress={() => setMemoryNotice(null)}
              >
                <Text style={memoryNotice.kind === 'saved' ? styles.deliveryPrimaryText : [styles.deliverySecondaryText, { color: C.textSecondary }]}>
                  {memoryNotice.kind === 'saved' ? '知道了' : '先不记'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {moodJudgement && (
          <View
            style={[
              styles.moodNotice,
              isUrbanClear && styles.urbanNotice,
              isSoftSweet && styles.softNotice,
              { backgroundColor: C.surface + 'F4', borderColor: C.border, shadowColor: C.shadow },
            ]}
          >
            <View style={styles.moodNoticeHeader}>
              <View style={styles.moodNoticeCopy}>
                <Text style={[styles.memoryNoticeTitle, { color: C.text }]} numberOfLines={1}>
                  {moodJudgement.label}
                </Text>
                <Text style={[styles.moodNoticeMeta, { color: C.primary }]} numberOfLines={1}>
                  当前 {getCharacterStateLabel(character)} · {moodJudgement.bandLabel} · 可信度 {Math.round(moodJudgement.confidence * 100)}%
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.moodCloseButton, { borderColor: C.border }]}
                onPress={() => setMoodJudgement(null)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="关闭状态校准结果"
              >
                <Text style={[styles.moodCloseText, { color: C.textSecondary }]}>×</Text>
              </TouchableOpacity>
            </View>
            <View style={[styles.moodScoreTrack, { backgroundColor: C.border }]}>
              <View
                style={[
                  styles.moodScoreFill,
                  { width: `${moodJudgement.score}%`, backgroundColor: C.primary },
                ]}
              />
            </View>
            <Text style={[styles.memoryNoticeText, { color: C.textSecondary }]} numberOfLines={2}>
              {moodJudgement.reason}
            </Text>
            <View style={styles.moodEvidenceList}>
              {moodJudgement.evidence.map((item, index) => (
                <Text
                  key={`${index}-${item}`}
                  style={[styles.moodEvidenceText, { color: C.textSecondary }]}
                  numberOfLines={1}
                >
                  · {item}
                </Text>
              ))}
            </View>
            <View style={styles.deliveryActions}>
              <TouchableOpacity
                style={[
                  styles.deliveryPrimary,
                  isUrbanClear && styles.urbanActionBtn,
                  isSoftSweet && styles.softActionBtn,
                  { backgroundColor: moodJudgement.shouldSync && !moodSynced ? C.primary : C.textSecondary },
                ]}
                onPress={handleSyncMood}
                disabled={moodSynced || !moodJudgement.shouldSync}
                activeOpacity={0.78}
              >
                <Text style={styles.deliveryPrimaryText}>
                  {moodSynced ? '已同步' : moodJudgement.shouldSync ? '同步到心情' : '维持当前状态'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.deliverySecondary,
                  isUrbanClear && styles.urbanActionBtn,
                  isSoftSweet && styles.softActionBtn,
                  { borderColor: C.border },
                ]}
                onPress={() => setMoodJudgement(null)}
                activeOpacity={0.78}
              >
                <Text style={[styles.deliverySecondaryText, { color: C.textSecondary }]}>仅查看</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Quick Reply Buttons */}
        <View
          style={[
            styles.quickReplyContainer,
            isUrbanClear && styles.urbanQuickReplyContainer,
            isSoftSweet && styles.softQuickReplyContainer,
            {
              backgroundColor: isSoftSweet ? C.accentLight + 'EE' : C.surface + 'D8',
              borderTopColor: C.border,
            },
          ]}
        >
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
                  isUrbanClear && styles.urbanQuickReplyBtn,
                  isSoftSweet && styles.softQuickReplyBtn,
                  {
                    backgroundColor: isUrbanClear ? C.surface + 'D8' : C.primaryLight + '33',
                    borderColor: isSoftSweet ? C.primaryLight : C.primary,
                    shadowColor: C.shadow,
                  },
                ]}
                onPress={() => handleQuickReply(qr.text)}
                activeOpacity={0.75}
              >
                <Text style={[styles.quickReplyText, { color: isSoftSweet ? C.primaryDark : C.primary }]}>{qr.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <MessageInput
          ref={inputRef}
          onSend={handleSend}
          bottomInset={insets.bottom}
        />
      </KeyboardAvoidingView>
    </>
  );

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      {backgroundSource ? (
        <ImageBackground
          source={backgroundSource}
          style={styles.backgroundImage}
          resizeMode="cover"
        >
          <LinearGradient
            colors={backgroundOverlayColors}
            locations={[0, 0.46, 1]}
            style={styles.backgroundOverlay}
          />
          {content}
        </ImageBackground>
      ) : (
        content
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  contentChrome: {
    zIndex: 10,
  },
  backgroundImage: { flex: 1 },
  backgroundOverlay: StyleSheet.absoluteFillObject,
  messageList: {
    paddingTop: 122,
    paddingBottom: 12,
  },
  chatHeader: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 20,
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chatHeaderActionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chatHeaderButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
  },
  chatHeaderCompactButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  urbanChatHeaderButton: {
    width: 52,
    height: 52,
    borderRadius: 16,
  },
  softChatHeaderButton: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 18,
    borderBottomRightRadius: 26,
    borderBottomLeftRadius: 18,
  },
  chatBackIcon: {
    fontSize: 36,
    lineHeight: 38,
    fontWeight: '500',
    marginTop: -2,
  },
  chatSettingsIcon: {
    fontSize: 25,
    lineHeight: 30,
  },
  chatMoodIcon: {
    fontFamily: NOTO_SERIF_SC.bold,
    fontSize: 28,
    lineHeight: 30,
    marginTop: -1,
  },
  chatIdentityBar: {
    flex: 1,
    minWidth: 0,
    minHeight: 64,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 22,
    paddingVertical: 9,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  urbanChatIdentityBar: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
  },
  softChatIdentityBar: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 18,
    borderBottomRightRadius: 26,
    borderBottomLeftRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
  },
  chatIdentityAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  urbanIdentityAvatar: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.76)',
  },
  softIdentityAvatar: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 24,
    borderBottomRightRadius: 18,
    borderBottomLeftRadius: 24,
    transform: [{ rotate: '-2deg' }],
  },
  chatIdentityAvatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatIdentityEmoji: {
    fontSize: 24,
  },
  chatIdentityCopy: {
    flex: 1,
    minWidth: 0,
  },
  chatIdentityName: {
    fontFamily: NOTO_SERIF_SC.black,
    fontSize: 16,
    lineHeight: 20,
  },
  chatIdentityStatus: {
    fontFamily: NOTO_SERIF_SC.bold,
    marginTop: 2,
    fontSize: 13,
    lineHeight: 18,
  },
  chatIdentityDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    opacity: 0.78,
  },
  quickReplyContainer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: 8,
  },
  urbanQuickReplyContainer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 4,
  },
  softQuickReplyContainer: {
    borderTopWidth: 0,
    paddingTop: 10,
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
  urbanQuickReplyBtn: {
    borderWidth: StyleSheet.hairlineWidth,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 8,
    borderBottomRightRadius: 18,
    borderBottomLeftRadius: 8,
  },
  softQuickReplyBtn: {
    borderWidth: StyleSheet.hairlineWidth,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 16,
    borderBottomRightRadius: 22,
    borderBottomLeftRadius: 16,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  quickReplyText: {
    fontFamily: NOTO_SANS_SC.medium,
    fontSize: 13,
  },
  deliveryNotice: {
    marginHorizontal: 12,
    marginBottom: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    padding: 12,
  },
  urbanNotice: {
    borderRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
  },
  softNotice: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 18,
    borderBottomRightRadius: 24,
    borderBottomLeftRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
  memoryNotice: {
    marginHorizontal: 12,
    marginBottom: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 20,
    padding: 13,
    gap: 8,
  },
  moodNotice: {
    marginHorizontal: 12,
    marginBottom: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 20,
    padding: 13,
    gap: 8,
  },
  moodNoticeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  moodNoticeCopy: {
    flex: 1,
    minWidth: 0,
  },
  moodNoticeMeta: {
    fontFamily: NOTO_SANS_SC.medium,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 2,
  },
  moodCloseButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moodCloseText: {
    fontSize: 18,
    lineHeight: 22,
  },
  moodScoreTrack: {
    height: 6,
    borderRadius: 999,
    overflow: 'hidden',
  },
  moodScoreFill: {
    height: 6,
    borderRadius: 999,
  },
  moodEvidenceList: {
    gap: 2,
  },
  moodEvidenceText: {
    fontFamily: NOTO_SANS_SC.regular,
    fontSize: 11,
    lineHeight: 16,
  },
  memoryNoticeTitle: {
    fontFamily: NOTO_SERIF_SC.bold,
    fontSize: 14,
    lineHeight: 20,
  },
  memoryNoticeText: {
    fontFamily: NOTO_SANS_SC.regular,
    fontSize: 13,
    lineHeight: 19,
  },
  deliveryTitle: {
    fontFamily: NOTO_SERIF_SC.bold,
    fontSize: 14,
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
  urbanActionBtn: {
    borderTopLeftRadius: 10,
    borderTopRightRadius: 18,
    borderBottomRightRadius: 10,
    borderBottomLeftRadius: 18,
  },
  softActionBtn: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 14,
    borderBottomRightRadius: 20,
    borderBottomLeftRadius: 14,
  },
  deliveryPrimaryText: {
    fontFamily: NOTO_SANS_SC.bold,
    color: '#fff',
    fontSize: 13,
  },
  deliverySecondary: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 9,
    alignItems: 'center',
  },
  deliverySecondaryText: {
    fontFamily: NOTO_SANS_SC.bold,
    fontSize: 13,
  },
});
