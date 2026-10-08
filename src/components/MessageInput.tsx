import React, { useState, forwardRef, useImperativeHandle, useRef } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Text,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { useThemeColors, useThemeId } from '../utils/theme';
import { NOTO_SANS_SC } from '../utils/appFonts';
import { persistMessageImage, resolveMessageMediaUri } from '../services/messageMedia';

interface Props {
  onSend: (text: string, imageUri?: string) => void;
  // onAudioCall and onVideoCall are hidden for MVP — kept as optional props
  onAudioCall?: () => void;
  onVideoCall?: () => void;
  disabled?: boolean;
  bottomInset?: number;
}

export interface MessageInputHandle {
  focus: () => void;
}

const MessageInput = forwardRef<MessageInputHandle, Props>(
  ({ onSend, disabled, bottomInset = 0 }, ref) => {
    const [text, setText] = useState('');
    const [selectedImage, setSelectedImage] = useState<string | undefined>();
    const inputRef = useRef<TextInput>(null);
    const C = useThemeColors();
    const themeId = useThemeId();
    const isUrbanClear = themeId === 'urbanClear';
    const isSoftSweet = themeId === 'softSweet';

    useImperativeHandle(ref, () => ({
      focus: () => inputRef.current?.focus(),
    }));

    const handleSend = () => {
      const trimmed = text.trim();
      if (!trimmed && !selectedImage) return;
      onSend(trimmed, selectedImage);
      setText('');
      setSelectedImage(undefined);
    };

    const pickImage = async () => {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') return;

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
        base64: false,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        try {
          const durableUri = await persistMessageImage(asset.uri, asset.mimeType ?? undefined);
          setSelectedImage(durableUri);
        } catch {
          Alert.alert('图片没有保存好', '无法把这张图片复制到应用媒体目录，请重新选择。');
        }
      }
    };

    const canSend = (text.trim().length > 0 || !!selectedImage) && !disabled;
    const bottomPadding = Platform.OS === 'ios' ? Math.max(bottomInset, 12) : 12;

    return (
      <View
        style={[
          styles.container,
          isUrbanClear && styles.urbanContainer,
          isSoftSweet && styles.softContainer,
          { backgroundColor: C.surface + 'E8', borderTopColor: C.border, paddingBottom: bottomPadding },
        ]}
      >
        {selectedImage && (
          <View style={styles.imagePreviewRow}>
            <Image
              source={resolveMessageMediaUri(selectedImage)}
              style={styles.imagePreview}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
            <TouchableOpacity onPress={() => setSelectedImage(undefined)} style={styles.removeImageBtn}>
              <Text style={styles.removeImageText}>✕</Text>
            </TouchableOpacity>
          </View>
        )}
        <View style={styles.inputRow}>
          <TouchableOpacity
            onPress={pickImage}
            style={[
              styles.iconBtn,
              isUrbanClear && styles.urbanIconBtn,
              isSoftSweet && styles.softIconBtn,
              { backgroundColor: C.inputBg + 'DD', borderColor: C.border },
            ]}
          >
            <Text style={[styles.iconText, { color: C.primary }]}>＋</Text>
          </TouchableOpacity>

          <TextInput
            ref={inputRef}
            style={[
              styles.input,
              isUrbanClear && styles.urbanInput,
              isSoftSweet && styles.softInput,
              { backgroundColor: C.inputBg + 'DD', color: C.text, borderColor: C.border },
            ]}
            value={text}
            onChangeText={setText}
            placeholder="输入消息..."
            placeholderTextColor={C.textSecondary}
            multiline
            maxLength={2000}
            returnKeyType="default"
            editable={!disabled}
          />

          <TouchableOpacity
            onPress={handleSend}
            disabled={!canSend}
            style={[
              styles.sendBtn,
              isUrbanClear && styles.urbanSendBtn,
              isSoftSweet && styles.softSendBtn,
              { backgroundColor: canSend ? C.primary : C.border },
            ]}
          >
            {disabled ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.sendIcon}>↑</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  }
);

MessageInput.displayName = 'MessageInput';

export default MessageInput;

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 12,
  },
  urbanContainer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
  },
  softContainer: {
    paddingHorizontal: 10,
  },
  imagePreviewRow: {
    flexDirection: 'row',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  imagePreview: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  removeImageBtn: {
    position: 'absolute',
    top: -4,
    left: 50,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeImageText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  urbanIconBtn: {
    borderWidth: StyleSheet.hairlineWidth,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 8,
    borderBottomRightRadius: 18,
    borderBottomLeftRadius: 8,
  },
  softIconBtn: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 22,
    borderBottomRightRadius: 14,
    borderBottomLeftRadius: 22,
  },
  iconText: {
    fontSize: 22,
    fontWeight: '700',
  },
  input: {
    fontFamily: NOTO_SANS_SC.regular,
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
    minHeight: 40,
  },
  urbanInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
  },
  softInput: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 18,
    borderBottomRightRadius: 24,
    borderBottomLeftRadius: 16,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  urbanSendBtn: {
    borderTopLeftRadius: 10,
    borderTopRightRadius: 20,
    borderBottomRightRadius: 10,
    borderBottomLeftRadius: 20,
  },
  softSendBtn: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 16,
    borderBottomRightRadius: 22,
    borderBottomLeftRadius: 16,
    transform: [{ rotate: '-2deg' }],
  },
  sendIcon: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
});
