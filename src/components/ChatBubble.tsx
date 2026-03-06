import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { Message } from '../types';
import { useThemeColors } from '../utils/theme';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface Props {
  message: Message;
  characterAvatar: string;
  characterName: string;
}

export default function ChatBubble({ message, characterAvatar, characterName }: Props) {
  const C = useThemeColors();
  const isUser = message.role === 'user';
  const timeStr = format(new Date(message.timestamp), 'HH:mm', { locale: zhCN });

  if (message.isThinking) {
    return (
      <View style={[styles.row, styles.assistantRow]}>
        <View style={[styles.avatarCircle, { backgroundColor: C.primaryLight }]}>
          <Text style={styles.avatarText}>{characterAvatar}</Text>
        </View>
        <View style={[styles.bubble, styles.assistantBubble, { backgroundColor: C.bubbleAssistant, shadowColor: C.shadow }]}>
          <TypingIndicator color={C.textSecondary} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.row, isUser ? styles.userRow : styles.assistantRow]}>
      {!isUser && (
        <View style={[styles.avatarCircle, { backgroundColor: C.primaryLight }]}>
          <Text style={styles.avatarText}>{characterAvatar}</Text>
        </View>
      )}

      <View style={styles.bubbleColumn}>
        {!isUser && (
          <Text style={[styles.senderName, { color: C.textSecondary }]}>{characterName}</Text>
        )}
        <View style={[
          styles.bubble,
          isUser
            ? [styles.userBubble, { backgroundColor: C.bubbleUser }]
            : [styles.assistantBubble, { backgroundColor: C.bubbleAssistant, shadowColor: C.shadow }],
        ]}>
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
        <Text style={[styles.timestamp, { color: C.textSecondary }, isUser && styles.timestampRight]}>
          {timeStr}
        </Text>
      </View>

      {isUser && <View style={styles.userSpacer} />}
    </View>
  );
}

function TypingIndicator({ color }: { color: string }) {
  return (
    <View style={styles.typingRow}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <View style={[styles.dot, styles.dotMid, { backgroundColor: color }]} />
      <View style={[styles.dot, { backgroundColor: color }]} />
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
  bubbleColumn: {
    maxWidth: '72%',
  },
  senderName: {
    fontSize: 12,
    marginBottom: 2,
    marginLeft: 4,
  },
  bubble: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  userBubble: {
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    borderBottomLeftRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  messageImage: {
    width: 200,
    height: 150,
    borderRadius: 10,
    marginBottom: 6,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  timestamp: {
    fontSize: 11,
    marginTop: 2,
    marginLeft: 4,
  },
  timestampRight: {
    textAlign: 'right',
    marginRight: 4,
  },
  userSpacer: {
    width: 8,
  },
  typingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 20,
    paddingHorizontal: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 2,
    opacity: 0.6,
  },
  dotMid: {
    opacity: 1,
  },
});
