import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList, Character } from '../types';
import { useChatStore, DEFAULT_CHARACTERS } from '../store/chatStore';
import { useSettingsStore } from '../store/settingsStore';
import { useThemeColors } from '../utils/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'CharacterEditor'>;

const AVATAR_OPTIONS = ['🍋', '🌸', '🌙', '🦊', '🐱', '🐰', '🌺', '⭐', '🎀', '💎', '🌈', '🦋'];

export default function CharacterEditorScreen({ route, navigation }: Props) {
  const C = useThemeColors();
  const { characterId } = route.params || {};
  const { getCharacter, saveCharacter, deleteCharacter } = useChatStore();
  const { settings, setSelectedCharacter } = useSettingsStore();

  const existing = characterId ? getCharacter(characterId) : undefined;
  const isDefault = DEFAULT_CHARACTERS.some((c) => c.id === characterId);

  const [name, setName] = useState(existing?.name || '');
  const [avatar, setAvatar] = useState(existing?.avatar || '🍋');
  const [systemPrompt, setSystemPrompt] = useState(existing?.systemPrompt || '');
  const [greeting, setGreeting] = useState(existing?.greeting || '');
  const [personality, setPersonality] = useState(existing?.personality || '');

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('提示', '请输入角色名称');
      return;
    }

    const character: Character = {
      id: characterId || `custom_${Date.now()}`,
      name: name.trim(),
      avatar,
      systemPrompt: systemPrompt.trim(),
      greeting: greeting.trim(),
      personality: personality.trim(),
    };

    await saveCharacter(character);
    setSelectedCharacter(character.id);
    await useSettingsStore.getState().saveSettings();
    navigation.goBack();
  };

  const handleDelete = () => {
    if (!characterId || isDefault) return;
    Alert.alert('删除角色', `确定要删除"${name}"吗？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          await deleteCharacter(characterId);
          navigation.goBack();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: C.background }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[styles.pageTitle, { color: C.text }]}>
          {characterId ? '编辑角色' : '创建角色'}
        </Text>

        {/* Avatar selector */}
        <Text style={[styles.label, { color: C.textSecondary }]}>选择头像</Text>
        <View style={styles.avatarGrid}>
          {AVATAR_OPTIONS.map((e) => (
            <TouchableOpacity
              key={e}
              style={[
                styles.avatarOption,
                { borderColor: avatar === e ? C.primary : C.border },
                avatar === e && { backgroundColor: C.primary + '22' },
              ]}
              onPress={() => setAvatar(e)}
            >
              <Text style={styles.avatarOptionText}>{e}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.label, { color: C.textSecondary }]}>角色名称 *</Text>
        <TextInput
          style={[styles.input, { color: C.text, borderColor: C.border, backgroundColor: C.surface }]}
          value={name}
          onChangeText={setName}
          placeholder="角色名称"
          placeholderTextColor={C.textSecondary}
        />

        <Text style={[styles.label, { color: C.textSecondary }]}>性格标签</Text>
        <TextInput
          style={[styles.input, { color: C.text, borderColor: C.border, backgroundColor: C.surface }]}
          value={personality}
          onChangeText={setPersonality}
          placeholder="如：活泼、可爱、温柔"
          placeholderTextColor={C.textSecondary}
        />

        <Text style={[styles.label, { color: C.textSecondary }]}>开场白</Text>
        <TextInput
          style={[styles.input, { color: C.text, borderColor: C.border, backgroundColor: C.surface }]}
          value={greeting}
          onChangeText={setGreeting}
          placeholder="第一次见面说的话"
          placeholderTextColor={C.textSecondary}
          multiline
          numberOfLines={2}
        />

        <Text style={[styles.label, { color: C.textSecondary }]}>系统提示词（人设）</Text>
        <TextInput
          style={[styles.textArea, { color: C.text, borderColor: C.border, backgroundColor: C.surface }]}
          value={systemPrompt}
          onChangeText={setSystemPrompt}
          placeholder="描述角色的性格、背景、说话方式等..."
          placeholderTextColor={C.textSecondary}
          multiline
          numberOfLines={6}
          textAlignVertical="top"
        />

        <TouchableOpacity style={[styles.saveBtn, { backgroundColor: C.primary }]} onPress={handleSave}>
          <Text style={styles.btnText}>保存</Text>
        </TouchableOpacity>

        {characterId && !isDefault && (
          <TouchableOpacity style={[styles.deleteBtn, { borderColor: C.danger }]} onPress={handleDelete}>
            <Text style={[styles.deleteBtnText, { color: C.danger }]}>删除角色</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: C.danger }]} onPress={() => navigation.goBack()}>
          <Text style={styles.btnText}>取消</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16 },
  pageTitle: { fontSize: 22, fontWeight: '700', marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '500', marginBottom: 6, marginTop: 4, marginLeft: 2 },
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  avatarOption: {
    width: 52,
    height: 52,
    borderRadius: 10,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarOptionText: { fontSize: 28 },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: 12,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    minHeight: 140,
    marginBottom: 16,
  },
  saveBtn: {
    borderRadius: 25,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  deleteBtn: {
    borderWidth: 1,
    borderRadius: 25,
    paddingVertical: 13,
    alignItems: 'center',
    marginBottom: 10,
  },
  deleteBtnText: { fontSize: 15 },
  cancelBtn: {
    borderRadius: 25,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 24,
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
