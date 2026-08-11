import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { Message } from '../types';
import { useThemeColors, useThemeId } from '../utils/theme';
import { NOTO_SANS_SC, NOTO_SERIF_SC } from '../utils/appFonts';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { getMoodStateLabel } from '../services/characterPromptArchitectureService';

interface Props {
  message: Message;
  characterAvatar: string;
  characterName: string;
}

export default function ChatBubble({ message, characterAvatar, characterName }: Props) {
  const C = useThemeColors();
  const themeId = useThemeId();
  const isUser = message.role === 'user';
  const dateTimeStr = format(
    new Date(message.timestamp),
    isUser ? 'HH:mm' : 'yyyy-MM-dd HH:mm',
    { locale: zhCN }
  );
  const replyMoodLabel = !isUser && message.characterMood
    ? getMoodStateLabel(message.characterMood)
    : null;
  const isUrbanClear = themeId === 'urbanClear';
  const isSoftSweet = themeId === 'softSweet';
  const assistantBubbleStyle = [
    styles.assistantBubble,
    isUrbanClear && styles.urbanAssistantBubble,
    isSoftSweet && styles.softAssistantBubble,
    {
      backgroundColor: C.bubbleAssistant,
      borderColor: C.border,
      shadowColor: C.shadow,
    },
  ];
  const userBubbleStyle = [
    styles.userBubble,
    isUrbanClear && styles.urbanUserBubble,
    isSoftSweet && styles.softUserBubble,
    { backgroundColor: C.bubbleUser },
  ];

  if (message.isThinking) {
    return (
      <View style={[styles.row, styles.assistantRow]}>
        <View style={[styles.avatarCircle, isUrbanClear && styles.urbanAvatar, isSoftSweet && styles.softAvatar, { backgroundColor: C.primaryLight }]}>
          <Text style={styles.avatarText}>{characterAvatar}</Text>
        </View>
        <View style={[styles.bubble, styles.thinkingBubble, ...assistantBubbleStyle]}>
          <WaitingIndicator characterName={characterName} color={C.textSecondary} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.row, isUser ? styles.userRow : styles.assistantRow]}>
      {!isUser && (
        <View style={[styles.avatarCircle, isUrbanClear && styles.urbanAvatar, isSoftSweet && styles.softAvatar, { backgroundColor: C.primaryLight }]}>
          <Text style={styles.avatarText}>{characterAvatar}</Text>
        </View>
      )}

      <View style={styles.bubbleColumn}>
        {!isUser && (
          <Text style={[styles.senderName, { color: C.textSecondary }]}>{characterName}</Text>
        )}
        <View
          style={[
            styles.bubble,
            isUser ? styles.userBubbleAlign : styles.assistantBubbleAlign,
            ...(isUser ? userBubbleStyle : assistantBubbleStyle),
          ]}
        >
          {message.imageUri && (
            <Image source={{ uri: message.imageUri }} style={styles.messageImage} resizeMode="cover" />
          )}
          <Text style={[
            styles.messageText,
            { color: isUser ? C.bubbleUserText : C.bubbleAssistantText },
          ]}>
            {message.content}
          </Text>
        </View>
        <View
          style={[
            styles.messageMetaRow,
            isUser && styles.messageMetaRowUser,
            replyMoodLabel && styles.messageMetaRowWithMood,
          ]}
          accessibilityLabel={replyMoodLabel ? `${dateTimeStr}，回复时心情：${replyMoodLabel}` : dateTimeStr}
        >
          <Text style={[styles.timestamp, { color: C.textSecondary }, isUser && styles.timestampRight]}>
            {message.status === 'failed' ? `${dateTimeStr} · 未送达` : dateTimeStr}
          </Text>
          {replyMoodLabel && (
            <View
              style={[
                styles.replyMoodBadge,
                {
                  backgroundColor: C.surface,
                  borderColor: C.primary,
                  shadowColor: C.shadow,
                },
              ]}
            >
              <View style={[styles.replyMoodDot, { backgroundColor: C.primary }]} />
              <Text style={[styles.replyMood, { color: C.text }]} numberOfLines={1}>
                {replyMoodLabel}
              </Text>
            </View>
          )}
        </View>
        {message.status === 'failed' && (
          <Text style={[styles.failedHint, { color: C.danger }, isUser && styles.timestampRight]}>
            服务还没有连接好
          </Text>
        )}
      </View>

      {isUser && <View style={styles.userSpacer} />}
    </View>
  );
}

const WAITING_HINTS: Record<string, string[]> = {
  '鹿芽': [
    '鹿芽正在飞快地打字中',
    '鹿芽正一边喝饮料一边回你',
    '鹿芽把手机捧近了一点',
    '鹿芽正在笑着组织语言',
    '鹿芽刚坐直，准备认真接住这句话',
    '鹿芽翻了翻刚才的聊天，没让你等太久',
  ],
  '纪遥': [
    '纪遥正在慢慢斟酌措辞',
    '纪遥把书签夹好，抬眼看向你',
    '纪遥正安静地把你的话读完',
    '纪遥在窗边想了一会儿',
    '纪遥正在给这句话留一点余温',
    '纪遥把语气放轻，准备回复',
  ],
  '凛夜': [
    '凛夜正在飞快地敲键盘',
    '凛夜啧了一声，但还是马上回你',
    '凛夜一边喝饮料一边打字',
    '凛夜把耳机往上推了推',
    '凛夜正在挑一句没那么别扭的话',
    '凛夜看完了，手指已经落在键盘上',
  ],
};

const DEFAULT_WAITING_HINTS = [
  '正在飞快地打字中',
  '正一边喝饮料一边打字',
  '正在认真读你的消息',
  '正在把话整理得更贴近你一点',
  '刚靠近屏幕，准备回复',
  '正在短暂停顿，像是在想怎么说更好',
];

function getWaitingHints(characterName: string) {
  return WAITING_HINTS[characterName] || DEFAULT_WAITING_HINTS.map((hint) => `${characterName}${hint}`);
}

function WaitingIndicator({ characterName, color }: { characterName: string; color: string }) {
  const hints = useMemo(() => getWaitingHints(characterName), [characterName]);
  const [hintIndex, setHintIndex] = useState(0);

  useEffect(() => {
    setHintIndex(0);
    const timer = setInterval(() => {
      setHintIndex((current) => (current + 1) % hints.length);
    }, 2400);

    return () => clearInterval(timer);
  }, [hints]);

  return (
    <View style={styles.waitingWrap}>
      <View style={styles.typingRow} accessibilityLabel="正在回复">
        <View style={[styles.dot, { backgroundColor: color }]} />
        <View style={[styles.dot, styles.dotMid, { backgroundColor: color }]} />
        <View style={[styles.dot, { backgroundColor: color }]} />
      </View>
      <Text style={[styles.waitingText, { color }]} numberOfLines={2}>
        {hints[hintIndex]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    marginVertical: 4,
    paddingHorizontal: 12,
    alignItems: 'flex-end',
  },
  userRow: {
    justifyContent: 'flex-end',
  },
  assistantRow: {
    justifyContent: 'flex-start',
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    marginBottom: 18,
  },
  avatarText: {
    fontSize: 20,
  },
  urbanAvatar: {
    borderWidth: StyleSheet.hairlineWidth,
    transform: [{ rotate: '-2deg' }],
  },
  softAvatar: {
    borderRadius: 14,
    transform: [{ rotate: '3deg' }],
  },
  bubbleColumn: {
    maxWidth: '72%',
    minWidth: 0,
    flexShrink: 1,
  },
  senderName: {
    fontFamily: NOTO_SERIF_SC.bold,
    fontSize: 12,
    marginBottom: 2,
    marginLeft: 4,
  },
  bubble: {
    maxWidth: '100%',
    borderRadius: 18,
    paddingLeft: 14,
    paddingRight: 20,
    paddingVertical: 10,
  },
  assistantBubbleAlign: {
    alignSelf: 'flex-start',
  },
  userBubbleAlign: {
    alignSelf: 'flex-end',
  },
  thinkingBubble: {
    maxWidth: 260,
  },
  userBubble: {
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    borderBottomLeftRadius: 4,
    borderWidth: 0,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  urbanUserBubble: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 8,
  },
  urbanAssistantBubble: {
    borderWidth: StyleSheet.hairlineWidth,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 22,
    borderBottomRightRadius: 22,
    borderBottomLeftRadius: 22,
    shadowOpacity: 0.06,
    shadowRadius: 10,
  },
  softUserBubble: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 18,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 7,
  },
  softAssistantBubble: {
    borderWidth: StyleSheet.hairlineWidth,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 26,
    borderBottomRightRadius: 18,
    borderBottomLeftRadius: 8,
    shadowOpacity: 0.1,
    shadowRadius: 9,
  },
  messageImage: {
    width: 200,
    height: 150,
    borderRadius: 10,
    marginBottom: 6,
  },
  messageText: {
    fontFamily: NOTO_SERIF_SC.regular,
    fontSize: 15,
    lineHeight: 22,
    flexShrink: 1,
    // Custom CJK glyphs can overhang React Native's measured text width on iOS.
    // Reserve a small trailing inset so the bubble's rounded edge never clips
    // the final glyph of a line.
    paddingRight: 2,
  },
  timestamp: {
    fontFamily: NOTO_SANS_SC.regular,
    fontSize: 11,
  },
  messageMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
    marginHorizontal: 4,
  },
  messageMetaRowUser: {
    justifyContent: 'flex-end',
  },
  messageMetaRowWithMood: {
    minWidth: 196,
    justifyContent: 'space-between',
    columnGap: 14,
  },
  replyMoodBadge: {
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    columnGap: 5,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 5,
    elevation: 2,
  },
  replyMoodDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  replyMood: {
    fontFamily: NOTO_SERIF_SC.bold,
    fontSize: 14,
    lineHeight: 20,
  },
  timestampRight: {
    textAlign: 'right',
  },
  failedHint: {
    fontFamily: NOTO_SANS_SC.bold,
    fontSize: 11,
    marginTop: 2,
    marginLeft: 4,
  },
  userSpacer: {
    width: 8,
  },
  typingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 18,
    paddingRight: 2,
  },
  waitingWrap: {
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginHorizontal: 1.5,
    opacity: 0.6,
  },
  dotMid: {
    opacity: 1,
  },
  waitingText: {
    fontFamily: NOTO_SERIF_SC.regular,
    flexShrink: 1,
    fontSize: 13,
    lineHeight: 18,
  },
});
