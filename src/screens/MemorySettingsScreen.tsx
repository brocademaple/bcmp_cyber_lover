import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  ImageBackground,
  Modal,
  ScrollView,
  StyleSheet,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MemoryFragment, RootStackParamList } from '../types';
import { useSettingsStore } from '../store/settingsStore';
import { useChatStore } from '../store/chatStore';
import { SettingsRow, SettingsSection } from '../components/SettingsRow';
import { useThemeColors } from '../utils/theme';
import { getMemoryVisualCards, MemoryVisualCard } from '../utils/memoryVisuals';

type Props = NativeStackScreenProps<RootStackParamList, 'MemorySettings'>;

export default function MemorySettingsScreen({ navigation, route }: Props) {
  const C = useThemeColors();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const { settings, updateMemory, saveSettings } = useSettingsStore();
  const { characters, loadCharacters, updateMemory: updateCharacterMemory, deleteMemory } = useChatStore();
  const memory = settings.memory;
  const targetCharacterId = route.params?.characterId ?? settings.selectedCharacterId;
  const character = characters.find((char) => char.id === targetCharacterId) ?? characters[0];
  const cards = useMemo(() => getMemoryVisualCards(character), [character]);
  const comicWidth = windowWidth;
  const comicHeight = Math.min(windowHeight - 118, comicWidth * 1.66);
  const [selectedCard, setSelectedCard] = useState<MemoryVisualCard | null>(null);
  const [showControls, setShowControls] = useState(false);
  const [editingMemory, setEditingMemory] = useState<MemoryFragment | null>(null);
  const [memoryDraft, setMemoryDraft] = useState('');
  const canShowControls = settings.appMode === 'admin';
  const readerImage = selectedCard?.readerImageUri ?? selectedCard?.imageUri;
  const memories = (character?.memories ?? []).slice().sort((a, b) => b.timestamp - a.timestamp);

  useEffect(() => {
    loadCharacters();
  }, [loadCharacters]);

  const handleSave = async () => {
    await saveSettings();
    navigation.goBack();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: C.background }]}>
      <ScrollView contentContainerStyle={styles.scroll} contentInsetAdjustmentBehavior="automatic">
        <View style={styles.comicStack}>
          {cards.map((card) => (
            <TouchableOpacity
              key={card.id}
              style={[styles.memoryCard, { width: comicWidth, height: comicHeight }]}
              activeOpacity={0.88}
              onPress={() => {
                setSelectedCard(card);
              }}
            >
              <Image source={card.imageUri} style={styles.memoryImage} resizeMode="contain" />
              <View style={styles.memoryTopOverlay}>
                <Text style={styles.memoryTime}>{card.timestampLabel}</Text>
                <Text style={styles.memoryCharacter}>{character?.name ?? '记忆漫画'}</Text>
              </View>
              <View style={styles.memoryBottomOverlay}>
                <Text style={styles.memorySubtitle}>全屏阅读</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <View style={[styles.librarySection, { backgroundColor: C.surface, borderColor: C.border }]}>
          <View style={styles.libraryHeader}>
            <View style={styles.libraryHeaderCopy}>
              <Text style={[styles.libraryTitle, { color: C.text }]}>{character?.name ?? '角色'}的长期记忆</Text>
              <Text style={[styles.libraryLead, { color: C.textSecondary }]}>你可以修正、锁定或删除每一条。锁定记忆仍会进入对话，并在 Prompt 中标记为用户确认。</Text>
            </View>
            <Text style={[styles.libraryCount, { color: C.primary }]}>{memories.length}</Text>
          </View>

          <View style={styles.memoryList}>
            {memories.map((item) => (
              <View key={item.id} style={[styles.memoryItem, { backgroundColor: C.background, borderColor: C.border }]}>
                <View style={styles.memoryItemHeader}>
                  <Text style={[styles.memoryItemMeta, { color: C.textSecondary }]}>重要度 {item.importance} · 可信度 {Math.round((item.confidence ?? 1) * 100)}%</Text>
                  <Text style={[styles.memoryState, { color: item.status === 'locked' ? C.primary : C.textSecondary }]}>
                    {item.status === 'locked' ? '已锁定' : '可修正'}
                  </Text>
                </View>
                <Text style={[styles.memoryItemText, { color: C.text }]}>{item.content}</Text>
                {item.tags.length > 0 && (
                  <Text style={[styles.memoryTags, { color: C.textSecondary }]}>{item.tags.join(' · ')}</Text>
                )}
                <View style={styles.memoryActions}>
                  <TouchableOpacity
                    style={[styles.memoryAction, { borderColor: C.border }]}
                    onPress={() => updateCharacterMemory(character.id, item.id, { status: item.status === 'locked' ? 'active' : 'locked' })}
                  >
                    <Text style={[styles.memoryActionText, { color: C.primary }]}>{item.status === 'locked' ? '解除锁定' : '锁定'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.memoryAction, { borderColor: C.border }]}
                    onPress={() => {
                      setEditingMemory(item);
                      setMemoryDraft(item.content);
                    }}
                  >
                    <Text style={[styles.memoryActionText, { color: C.text }]}>修正</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.memoryAction, { borderColor: C.border }]}
                    onPress={() => Alert.alert('删除记忆', '删除后角色不会再引用这条记忆。聊天原文不会被删除。', [
                      { text: '取消', style: 'cancel' },
                      { text: '删除', style: 'destructive', onPress: () => deleteMemory(character.id, item.id) },
                    ])}
                  >
                    <Text style={[styles.memoryActionText, { color: '#C85757' }]}>删除</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
            {memories.length === 0 && (
              <Text style={[styles.libraryEmpty, { color: C.textSecondary }]}>还没有确认写入的长期记忆。聊天中明确说“记住”或确认记忆候选后，会出现在这里。</Text>
            )}
          </View>
        </View>

        {canShowControls && (
          <TouchableOpacity
            style={[styles.controlToggle, { borderColor: C.border, backgroundColor: C.surface }]}
            onPress={() => setShowControls((v) => !v)}
          >
            <Text style={[styles.controlToggleText, { color: C.primary }]}>
              {showControls ? '收起记忆设置' : '展开记忆设置'}
            </Text>
          </TouchableOpacity>
        )}

        {canShowControls && showControls && (
          <>
            <SettingsSection title="记忆设置">
              <SettingsRow
                label="启用记忆库"
                value={memory.enabled}
                onToggle={(v) => updateMemory({ enabled: v })}
              />
              <SettingsRow
                label="始终保留聊天记录"
                description="关闭后，新的记忆判断只读取本轮上下文；不会删除已有聊天记录。"
                value={memory.alwaysRetainHistory}
                onToggle={(v) => updateMemory({ alwaysRetainHistory: v })}
              />
              <SettingsRow
                label="设置记忆判断范围"
                description="限制长期记忆判断可读取的最近消息条数，不会裁剪本地记录。"
                showArrow
                onPress={() =>
                  Alert.prompt?.(
                    '记忆判断范围',
                    '设置长期记忆判断可读取的最近消息条数',
                    [
                      { text: '取消', style: 'cancel' },
                      {
                        text: '确认',
                        onPress: (v?: string) => v && updateMemory({ retentionRange: parseInt(v, 10) || 100 }),
                      },
                    ],
                    'plain-text',
                    String(memory.retentionRange)
                  )
                }
              />
              <SettingsRow
                label="设置发送时加载的聊天记录范围"
                description="设置每次请求包含的历史消息条数"
                showArrow
                onPress={() =>
                  Alert.prompt?.(
                    '发送记录条数',
                    '设置每次请求包含的历史消息条数',
                    [
                      { text: '取消', style: 'cancel' },
                      {
                        text: '确认',
                        onPress: (v?: string) => v && updateMemory({ sendRange: parseInt(v, 10) || 20 }),
                      },
                    ],
                    'plain-text',
                    String(memory.sendRange)
                  )
                }
              />
              <SettingsRow
                label="始终向模型提供完整记忆库"
                value={memory.alwaysProvideFullMemory}
                onToggle={(v) => updateMemory({ alwaysProvideFullMemory: v })}
              />
              <SettingsRow
                label="自动总结聊天记录"
                description="聊天后自动沉淀关系记忆"
                value={memory.autoSummarize}
                onToggle={(v) =>
                  updateMemory({
                    autoSummarize: v,
                    autoSummarizeTrigger: v && memory.autoSummarizeTrigger === 'on_exit'
                      ? 'during'
                      : memory.autoSummarizeTrigger,
                  })
                }
              />
            </SettingsSection>

            <Text style={[styles.fieldLabel, { color: C.textSecondary }]}>记忆沉淀规则</Text>
            <TextInput
              style={[styles.textArea, { color: C.text, borderColor: C.border, backgroundColor: C.surface }]}
              value={memory.memorySystemPrompt}
              onChangeText={(v) => updateMemory({ memorySystemPrompt: v })}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: C.primary }]} onPress={handleSave}>
              <Text style={styles.saveBtnText}>保存记忆设置</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      <Modal visible={!!selectedCard} animationType="fade" presentationStyle="fullScreen" onRequestClose={() => setSelectedCard(null)}>
        <View style={styles.readerContainer}>
          <StatusBar barStyle="light-content" backgroundColor="#04040A" />
          {selectedCard && readerImage && (
            <View style={[styles.readerStage, { width: windowWidth, minHeight: windowHeight }]}>
              <ImageBackground
                source={readerImage}
                style={StyleSheet.absoluteFill}
                imageStyle={styles.readerBackdropImage}
                blurRadius={22}
                resizeMode="cover"
              >
                <View style={styles.readerBackdropTint} />
              </ImageBackground>

              <Image source={readerImage} style={styles.readerFullComic} resizeMode="contain" />
              <View pointerEvents="none" style={styles.readerEdgeFade} />

              <TouchableOpacity style={styles.readerBackButton} onPress={() => setSelectedCard(null)} activeOpacity={0.82}>
                <Text style={styles.readerBackText}>‹</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>

      <Modal visible={!!editingMemory} transparent animationType="fade" onRequestClose={() => setEditingMemory(null)}>
        <View style={styles.editModalBackdrop}>
          <View style={[styles.editModalCard, { backgroundColor: C.surface, borderColor: C.border }]}>
            <Text style={[styles.libraryTitle, { color: C.text }]}>修正长期记忆</Text>
            <Text style={[styles.libraryLead, { color: C.textSecondary }]}>修改会保留原始来源消息，只更新角色以后使用的记忆文本。</Text>
            <TextInput
              value={memoryDraft}
              onChangeText={setMemoryDraft}
              style={[styles.memoryEditInput, { color: C.text, backgroundColor: C.background, borderColor: C.border }]}
              multiline
              textAlignVertical="top"
            />
            <View style={styles.memoryActions}>
              <TouchableOpacity style={[styles.modalButton, { borderColor: C.border }]} onPress={() => setEditingMemory(null)}>
                <Text style={[styles.memoryActionText, { color: C.textSecondary }]}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: C.primary, borderColor: C.primary }]}
                onPress={async () => {
                  if (!editingMemory || !character || !memoryDraft.trim()) return;
                  await updateCharacterMemory(character.id, editingMemory.id, { content: memoryDraft.trim(), confidence: 1 });
                  setEditingMemory(null);
                }}
              >
                <Text style={styles.saveBtnText}>保存修正</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingTop: 4, paddingBottom: 28 },
  comicStack: {
    gap: 18,
    alignItems: 'center',
  },
  librarySection: {
    marginHorizontal: 20,
    marginTop: 18,
    borderRadius: 26,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 14,
  },
  libraryHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  libraryHeaderCopy: { flex: 1 },
  libraryTitle: { fontSize: 20, fontWeight: '900' },
  libraryLead: { fontSize: 13, lineHeight: 20, marginTop: 4 },
  libraryCount: { fontSize: 28, fontWeight: '900' },
  memoryList: { gap: 10 },
  memoryItem: { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 7 },
  memoryItemHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  memoryItemMeta: { fontSize: 11 },
  memoryState: { fontSize: 11, fontWeight: '800' },
  memoryItemText: { fontSize: 15, lineHeight: 22, fontWeight: '700' },
  memoryTags: { fontSize: 11 },
  memoryActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  memoryAction: { flex: 1, minHeight: 36, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  memoryActionText: { fontSize: 12, fontWeight: '800' },
  libraryEmpty: { fontSize: 13, lineHeight: 20, paddingVertical: 14, textAlign: 'center' },
  editModalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.42)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  editModalCard: { width: '100%', maxWidth: 520, borderRadius: 24, borderWidth: StyleSheet.hairlineWidth, padding: 18, gap: 12 },
  memoryEditInput: { minHeight: 130, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 12, fontSize: 15, lineHeight: 22 },
  modalButton: { flex: 1, minHeight: 44, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  memoryCard: {
    backgroundColor: '#060711',
    overflow: 'hidden',
  },
  memoryImage: {
    width: '100%',
    height: '100%',
  },
  memoryTopOverlay: {
    position: 'absolute',
    top: 14,
    left: 14,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: 'rgba(8,8,14,0.54)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.18)',
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  memoryTime: {
    color: 'rgba(255,255,255,0.74)',
    fontSize: 11,
    fontWeight: '900',
  },
  memoryCharacter: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '900',
  },
  memoryBottomOverlay: {
    position: 'absolute',
    right: 14,
    bottom: 18,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: 'rgba(8,8,14,0.56)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  memorySubtitle: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 12,
    fontWeight: '900',
  },
  controlToggle: {
    marginHorizontal: 20,
    marginTop: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingVertical: 13,
    alignItems: 'center',
  },
  controlToggleText: {
    fontSize: 15,
    fontWeight: '800',
  },
  fieldLabel: {
    fontSize: 14,
    marginBottom: 6,
    marginTop: 8,
    marginHorizontal: 20,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    minHeight: 100,
    marginHorizontal: 20,
    marginBottom: 16,
  },
  saveBtn: {
    borderRadius: 25,
    paddingVertical: 14,
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 10,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  readerContainer: {
    flex: 1,
    backgroundColor: '#04040A',
  },
  readerStage: {
    flex: 1,
    overflow: 'hidden',
  },
  readerBackdropImage: {
    opacity: 0.72,
    transform: [{ scale: 1.06 }],
  },
  readerBackdropTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(11,7,8,0.42)',
  },
  readerFullComic: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    width: '100%',
    height: '100%',
  },
  readerEdgeFade: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 14,
    borderColor: 'rgba(255,246,236,0.22)',
  },
  readerBackButton: {
    position: 'absolute',
    top: 54,
    left: 18,
    zIndex: 6,
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,250,246,0.78)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(80,50,56,0.16)',
  },
  readerBackText: {
    color: '#4E3441',
    fontSize: 38,
    lineHeight: 40,
    fontWeight: '500',
  },
  readerTagShelf: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 88,
    zIndex: 5,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  readerTag: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: 'rgba(8,8,14,0.5)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  readerTagText: {
    color: 'rgba(255,255,255,0.86)',
    fontSize: 12,
    fontWeight: '800',
  },
  readerCloseCapsule: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 26,
    zIndex: 6,
    borderRadius: 999,
    paddingVertical: 15,
    alignItems: 'center',
  },
  readerCloseText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
  },
  readerBody: {
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 18,
    gap: 12,
  },
  modalTitle: {
    fontSize: 23,
    fontWeight: '800',
    lineHeight: 29,
  },
  modalContent: {
    fontSize: 15,
    lineHeight: 23,
  },
  panelSelector: {
    flexDirection: 'row',
    gap: 8,
  },
  panelSelectorBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  panelSelectorText: {
    fontSize: 13,
    fontWeight: '900',
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  tag: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '700',
  },
  closeBtn: {
    marginTop: 12,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
  },
});
