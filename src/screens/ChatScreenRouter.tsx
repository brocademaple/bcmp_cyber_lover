/**
 * Chat Screen Router
 * 根据角色选择沉浸式或传统界面
 */

import React from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import ChatScreen from './ChatScreen';
import ImmersiveChatScreen from './ImmersiveChatScreen';

type Props = NativeStackScreenProps<RootStackParamList, 'Chat'>;

export default function ChatScreenRouter(props: Props) {
  const { characterId } = props.route.params;
  
  // 鹿芽（qingning）使用 A+C 沉浸式界面
  if (characterId === 'qingning') {
    return <ImmersiveChatScreen {...props} />;
  }
  
  // 其他角色使用传统界面
  return <ChatScreen {...props} />;
}
