import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Audio } from 'expo-av';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Speech from 'expo-speech';
import { RootStackParamList, CallType } from '../types';
import { useChatStore } from '../store/chatStore';
import { useSettingsStore } from '../store/settingsStore';
import { sendMessage, analyzeFrameWithEmotion } from '../services/aiService';
import { calculateEmotionChange } from '../services/emotionService';
import { useThemeColors } from '../utils/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Call'>;

const { width, height } = Dimensions.get('window');

export default function CallScreen({ route, navigation }: Props) {
  const { characterId, callType } = route.params;
  const C = useThemeColors();

  const { getCharacter, messages, addMessage, updateEmotionalState } = useChatStore();
  const { settings } = useSettingsStore();
  const character = getCharacter(characterId);

  const [callState, setCallState] = useState({
    active: true,
    isMuted: false,
    isCameraOff: false,
    isSpeakerOn: true,
  });
  const [duration, setDuration] = useState(0);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'ended'>('connecting');
  const [aiResponse, setAiResponse] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [cameraPermission, setCameraPermission] = useState(false);
  const [audioPermission, setAudioPermission] = useState(false);

  const cameraRef = useRef<CameraView>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const analyzeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chatMessages = messages[characterId] || [];

  useEffect(() => {
    requestPermissions();
    return () => cleanup();
  }, []);

  useEffect(() => {
    if (status === 'connected') {
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
      // Periodic frame analysis for video calls
      if (callType === 'video' && settings.service.visionModel) {
        analyzeTimerRef.current = setInterval(() => {
          captureAndAnalyze();
        }, 8000); // Every 8 seconds
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (analyzeTimerRef.current) clearInterval(analyzeTimerRef.current);
    };
  }, [status]);

  const requestPermissions = async () => {
    try {
      const audioStatus = await Audio.requestPermissionsAsync();
      setAudioPermission(audioStatus.granted);

      if (callType === 'video') {
        // CameraView permissions use useCameraPermissions hook; fallback via static method
        const { Camera: StaticCamera } = require('expo-camera');
        const camStatus = await StaticCamera.requestCameraPermissionsAsync();
        setCameraPermission(camStatus.granted);
      }

      // Simulate connection delay
      setTimeout(() => {
        setStatus('connected');
        speakGreeting();
      }, 1500);
    } catch (e) {
      Alert.alert('权限错误', '无法获取摄像头或麦克风权限');
    }
  };

  const speakGreeting = () => {
    if (!character) return;
    const greeting =
      callType === 'video'
        ? `哇，老公，我终于看到你了～你今天好帅啊`
        : `老公，是你打来的呀～嘿嘿，好开心`;
    setAiResponse(greeting);
    Speech.speak(greeting, {
      language: 'zh-CN',
      rate: 1.0,
      pitch: 1.2,
    });
  };

  const captureAndAnalyze = useCallback(async () => {
    if (!cameraRef.current || callState.isCameraOff || isProcessing || !character) return;

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.3,
        base64: true,
      });

      if (!photo || !photo.base64) return;

      setIsProcessing(true);
      const { response, detectedEmotion } = await analyzeFrameWithEmotion(
        photo.base64,
        character,
        settings.service
      );

      if (response) {
        setAiResponse(response);
        if (!callState.isMuted) {
          Speech.speak(response, { language: 'zh-CN', rate: 1.0, pitch: 1.2 });
        }

        // 根据检测到的用户情绪更新角色情感状态
        if (detectedEmotion === '难过' && character.emotionalState) {
          await updateEmotionalState(characterId, { mood: 'sad' });
        } else if (detectedEmotion === '开心' && character.emotionalState) {
          await updateEmotionalState(characterId, {
            mood: 'happy',
            intimacy: Math.min(100, character.emotionalState.intimacy + 2)
          });
        }
      }
    } catch (e) {
      // Silent fail for frame analysis
    } finally {
      setIsProcessing(false);
    }
  }, [callState, isProcessing, character, settings.service, characterId, updateEmotionalState]);

  const startVoiceRecording = async () => {
    if (!audioPermission) return;
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
    } catch {}
  };

  const stopVoiceRecordingAndProcess = async () => {
    if (!recordingRef.current || !character) return;
    try {
      await recordingRef.current.stopAndUnloadAsync();
      // In a full implementation, we'd use a speech-to-text API here
      // For now, we send a simulated interaction message
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

      if (!uri) return;

      setIsProcessing(true);
      const voiceMsg = '（语音消息）请和我说说话吧';
      const response = await sendMessage(
        voiceMsg,
        character,
        chatMessages,
        settings.service,
        settings.memory,
        settings.advanced
      );

      setAiResponse(response);
      Speech.speak(response, { language: 'zh-CN', rate: 1.0, pitch: 1.2 });
    } catch (e) {
      // Silent fail
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMuteToggle = () => {
    setCallState((s) => ({ ...s, isMuted: !s.isMuted }));
  };

  const handleCameraToggle = () => {
    setCallState((s) => ({ ...s, isCameraOff: !s.isCameraOff }));
  };

  const handleSpeakerToggle = () => {
    setCallState((s) => ({ ...s, isSpeakerOn: !s.isSpeakerOn }));
  };

  const handleEndCall = async () => {
    cleanup();
    setStatus('ended');
    // Save call to chat history
    if (character) {
      const callMsg = {
        id: `call_${Date.now()}`,
        role: 'assistant' as const,
        content: `📞 ${callType === 'video' ? '视频' : '语音'}通话已结束，时长 ${formatDuration(duration)}`,
        timestamp: Date.now(),
      };
      await addMessage(characterId, callMsg);
    }
    navigation.goBack();
  };

  const cleanup = () => {
    Speech.stop();
    if (recordingRef.current) {
      recordingRef.current.stopAndUnloadAsync().catch(() => {});
      recordingRef.current = null;
    }
    if (timerRef.current) clearInterval(timerRef.current);
    if (analyzeTimerRef.current) clearInterval(analyzeTimerRef.current);
  };

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  if (!character) {
    navigation.goBack();
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor: C.primaryDark }]}>
      <StatusBarHidden />

      {/* Camera preview for video calls */}
      {callType === 'video' && cameraPermission && !callState.isCameraOff && status === 'connected' && (
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing="front"
        />
      )}

      {/* Dark overlay */}
      <View style={[styles.overlay, callType === 'video' && styles.overlayTransparent]} />

      <SafeAreaView style={styles.safeArea}>
        {/* Top info */}
        <View style={styles.topSection}>
          <Text style={styles.characterEmoji}>{character.avatar}</Text>
          <Text style={styles.characterName}>{character.name}</Text>
          <Text style={styles.callTypeLabel}>
            {callType === 'video' ? '视频通话' : '语音通话'}
          </Text>
          <Text style={styles.statusText}>
            {status === 'connecting' ? '连接中...' : formatDuration(duration)}
          </Text>
        </View>

        {/* AI response speech bubble */}
        {aiResponse !== '' && status === 'connected' && (
          <View style={styles.speechBubble}>
            {isProcessing && <ActivityIndicator size="small" color={C.accent} style={{ marginBottom: 4 }} />}
            <Text style={styles.speechText}>{aiResponse}</Text>
          </View>
        )}

        {/* Video call: show AI character in corner */}
        {callType === 'video' && (
          <View style={styles.aiVideoBox}>
            <View style={[styles.aiVideoInner, { backgroundColor: C.primary }]}>
              <Text style={{ fontSize: 40 }}>{character.avatar}</Text>
              <Text style={{ color: '#fff', fontSize: 11, marginTop: 4 }}>{character.name}</Text>
            </View>
          </View>
        )}

        {/* Controls */}
        <View style={styles.controls}>
          <CallButton
            icon={callState.isMuted ? '🔇' : '🎙'}
            label={callState.isMuted ? '取消静音' : '静音'}
            onPress={handleMuteToggle}
            active={callState.isMuted}
          />

          {callType === 'video' && (
            <CallButton
              icon={callState.isCameraOff ? '📷' : '📹'}
              label={callState.isCameraOff ? '开启摄像' : '关闭摄像'}
              onPress={handleCameraToggle}
              active={callState.isCameraOff}
            />
          )}

          <CallButton
            icon="🔊"
            label={callState.isSpeakerOn ? '关扬声器' : '开扬声器'}
            onPress={handleSpeakerToggle}
            active={callState.isSpeakerOn}
          />

          <CallButton
            icon="💬"
            label="说话"
            onPress={startVoiceRecording}
            onPressOut={stopVoiceRecordingAndProcess}
            isHold
          />
        </View>

        {/* End call button */}
        <TouchableOpacity style={styles.endCallBtn} onPress={handleEndCall}>
          <Text style={styles.endCallIcon}>📵</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
}

function StatusBarHidden() {
  return null; // React Native StatusBar handled by navigation
}

function CallButton({
  icon,
  label,
  onPress,
  onPressOut,
  active,
  isHold,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  onPressOut?: () => void;
  active?: boolean;
  isHold?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.callBtn, active && styles.callBtnActive]}
      onPress={isHold ? undefined : onPress}
      onPressIn={isHold ? onPress : undefined}
      onPressOut={isHold ? onPressOut : undefined}
      activeOpacity={0.7}
    >
      <Text style={styles.callBtnIcon}>{icon}</Text>
      <Text style={styles.callBtnLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(92, 46, 70, 0.95)',
  },
  overlayTransparent: {
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  safeArea: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 24,
  },
  topSection: {
    alignItems: 'center',
    marginTop: 20,
  },
  characterEmoji: {
    fontSize: 72,
    marginBottom: 8,
  },
  characterName: {
    fontSize: 26,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  callTypeLabel: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 8,
  },
  statusText: {
    fontSize: 20,
    color: '#fff',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  speechBubble: {
    maxWidth: width * 0.75,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 12,
    alignItems: 'center',
  },
  speechText: {
    color: '#fff',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  aiVideoBox: {
    position: 'absolute',
    top: 120,
    right: 20,
  },
  aiVideoInner: {
    width: 100,
    height: 140,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  controls: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  callBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    margin: 4,
  },
  callBtnActive: {
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  callBtnIcon: {
    fontSize: 26,
  },
  callBtnLabel: {
    color: '#fff',
    fontSize: 10,
    marginTop: 2,
    textAlign: 'center',
  },
  endCallBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#c0392b',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  endCallIcon: {
    fontSize: 32,
  },
});
