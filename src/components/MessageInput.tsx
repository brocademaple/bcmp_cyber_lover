import React, { useState, forwardRef, useImperativeHandle, useRef } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Text,
  ActivityIndicator,
  Image,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useThemeColors } from '../utils/theme';

interface Props {
  onSend: (text: string, imageUri?: string) => void;
  // onAudioCall and onVideoCall are hidden for MVP — kept as optional props
  onAudioCall?: () => void;
  onVideoCall?: () => void;
  disabled?: boolean;
}

export interface MessageInputHandle {
  focus: () => void;
}

const MessageInput = forwardRef<MessageInputHandle, Props>(
  ({ onSend, disabled }, ref) => {
    const [text, setText] = useState('');
    const [selectedImage, setSelectedImage] = useState<string | undefined>();
    const inputRef = useRef<TextInput>(null);
    const C = useThemeColors();

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
        setSelectedImage(result.assets[0].uri);
      }
    };

    const canSend = (text.trim().length > 0 || !!selectedImage) && !disabled;

    return (
      <View style={[styles.container, { backgroundColor: C.surface, borderTopColor: C.border }]}>
        {selectedImage && (
          <View style={styles.imagePreviewRow}>
            <Image source={{ uri: selectedImage }} style={styles.imagePreview} />
            <TouchableOpacity onPress={() => setSelectedImage(undefined)} style={styles.removeImageBtn}>
              <Text style={styles.removeImageText}>✕</Text>
            </TouchableOpacity>
          </View>
        )}
        <View style={styles.inputRow}>
          <TouchableOpacity onPress={pickImage} style={[styles.iconBtn, { backgroundColor: C.inputBg }]}>
            <Text style={styles.iconText}>🖼</Text>
          </TouchableOpacity>

          <TextInput
            ref={inputRef}
            style={[styles.input, { backgroundColor: C.inputBg, color: C.text }]}
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
            style={[styles.sendBtn, { backgroundColor: canSend ? C.primary : C.border }]}
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

export default MessageInput;

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
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
  iconText: {
    fontSize: 18,
  },
  input: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
    minHeight: 40,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendIcon: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
});
