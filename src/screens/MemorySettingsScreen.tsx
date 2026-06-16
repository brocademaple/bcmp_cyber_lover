import React, { useMemo, useState } from 'react';
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
import { RootStackParamList } from '../types';
import { useSettingsStore } from '../store/settingsStore';
import { useChatStore } from '../store/chatStore';
import { SettingsRow, SettingsSection } from '../components/SettingsRow';
import { useThemeColors } from '../utils/theme';
import { getMemoryVisualCards, MemoryVisualCard } from '../utils/memoryVisuals';

type Props = NativeStackScreenProps<RootStackParamList, 'MemorySettings'>;

const PANEL_TOUCH_AREAS = [
  { top: '0%', left: '0%' },
  { top: '0%', left: '50%' },
  { top: '50%', left: '0%' },
  { top: '50%', left: '50%' },
] as const;

const PANEL_FLOAT_AREAS = [
  { top: '27%', left: 18, right: '34%' },
  { top: '27%', left: '28%', right: 18 },
  { bottom: '30%', left: 18, right: '32%' },
  { bottom: '18%', left: '26%', right: 18 },
] as const;

export default function MemorySettingsScreen({ navigation }: Props) {
  const C = useThemeColors();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const { settings, updateMemory, saveSettings } = useSettingsStore();
  const { characters } = useChatStore();
  const memory = settings.memory;
  const character = characters.find((char) => char.id === settings.selectedCharacterId) ?? characters[0];
  const cards = useMemo(() => getMemoryVisualCards(character), [character]);
  const [selectedCard, setSelectedCard] = useState<MemoryVisualCard | null>(null);
  const [selectedPanelIndex, setSelectedPanelIndex] = useState(0);
  const [showControls, setShowControls] = useState(false);
  const canShowControls = settings.appMode === 'admin';
  const readerPanel = selectedCard?.comicPanels[selectedPanelIndex] ?? selectedCard?.comicPanels[0];
  const readerImage = selectedCard?.readerImageUri ?? selectedCard?.imageUri;

  const handleSave = async () => {
    await saveSettings();
    navigation.goBack();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: C.background }]}>
      <ScrollView contentContainerStyle={styles.scroll} contentInsetAdjustmentBehavior="automatic">
        <View style={styles.hero}>
          <Text style={[styles.eyebrow, { color: C.primary }]}>Memory Album</Text>
          <Text style={[styles.pageTitle, { color: C.text }]}>
            {character ? `${character.name}的记忆漫画` : '记忆漫画'}
          </Text>
          <Text style={[styles.heroText, { color: C.textSecondary }]}>
            把聊天里的小事变成可以回看的场景。文字负责记录事实，漫画负责留住当时的温度。
          </Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.cardRail}
        >
          {cards.map((card) => (
            <TouchableOpacity
              key={card.id}
              style={[styles.memoryCard, { backgroundColor: C.surface, borderColor: C.border }]}
              activeOpacity={0.88}
              onPress={() => {
                setSelectedPanelIndex(0);
                setSelectedCard(card);
              }}
            >
              <Image source={card.imageUri} style={styles.memoryImage} resizeMode="cover" />
              <View style={styles.memoryOverlay}>
                <Text style={styles.memoryTime}>{card.timestampLabel}</Text>
                <Text style={styles.memoryTitle} numberOfLines={2}>{card.title}</Text>
                <Text style={styles.memorySubtitle} numberOfLines={1}>{card.subtitle}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={[styles.insightPanel, { backgroundColor: C.surface, borderColor: C.border }]}>
          <Text style={[styles.insightTitle, { color: C.text }]}>她把这件小事收进了记忆里</Text>
          <Text style={[styles.insightText, { color: C.textSecondary }]}>
            有些话当时只是随口一说，后来却变成了你们之间的暗号。这里会慢慢留下她记得的瞬间。
          </Text>
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
                description="关闭后，每次退出聊天后都会自动清除聊天记录。"
                value={memory.alwaysRetainHistory}
                onToggle={(v) => updateMemory({ alwaysRetainHistory: v })}
              />
              <SettingsRow
                label="设置保留聊天记录范围"
                description="设置保留在本地的最大聊天条数"
                showArrow
                onPress={() =>
                  Alert.prompt?.(
                    '保留记录条数',
                    '设置本地保留的最大聊天条数',
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
                onToggle={(v) => updateMemory({ autoSummarize: v })}
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
            <ImageBackground
              source={readerImage}
              style={[styles.readerBackground, { width: windowWidth, minHeight: windowHeight }]}
              imageStyle={styles.readerBackgroundImage}
              resizeMode="cover"
            >
              <View style={styles.readerScrim} />

              <TouchableOpacity style={styles.readerBackButton} onPress={() => setSelectedCard(null)} activeOpacity={0.82}>
                <Text style={styles.readerBackText}>‹</Text>
              </TouchableOpacity>

              <View style={styles.readerMetaPill}>
                <Text style={styles.readerMetaEyebrow}>{selectedCard.timestampLabel}</Text>
                <Text style={styles.readerMetaTitle} numberOfLines={2}>{selectedCard.title}</Text>
                <Text style={styles.readerMetaSubtitle} numberOfLines={1}>{selectedCard.subtitle}</Text>
              </View>

              {readerPanel && (
                <View
                  pointerEvents="none"
                  style={[
                    styles.readerPanelBubble,
                    selectedCard.panelOverlayAreas?.[selectedPanelIndex] ?? PANEL_FLOAT_AREAS[selectedPanelIndex],
                  ]}
                >
                  <Text style={styles.readerPanelStep}>Panel {selectedPanelIndex + 1}</Text>
                  <Text style={styles.readerPanelTitle}>{readerPanel.title}</Text>
                  <Text style={styles.readerPanelDialogue}>{readerPanel.dialogue}</Text>
                  <Text style={styles.readerPanelCaption}>{readerPanel.caption}</Text>
                </View>
              )}

              {selectedCard.comicPanels.map((panel, index) => (
                <TouchableOpacity
                  key={`${panel.id}-tap`}
                  activeOpacity={0.76}
                  onPress={() => setSelectedPanelIndex(index)}
                  style={[
                    styles.readerPanelHotspot,
                    PANEL_TOUCH_AREAS[index],
                    selectedPanelIndex === index && { borderColor: C.primary, backgroundColor: C.primaryLight + '20' },
                  ]}
                >
                  <Text style={[styles.readerPanelIndex, selectedPanelIndex === index && { backgroundColor: C.primary }]}>
                    {index + 1}
                  </Text>
                </TouchableOpacity>
              ))}

              <View style={styles.readerTagShelf}>
                {selectedCard.tags.map((tag) => (
                  <View key={tag} style={styles.readerTag}>
                    <Text style={styles.readerTagText}>{tag}</Text>
                  </View>
                ))}
              </View>

              <TouchableOpacity style={[styles.readerCloseCapsule, { backgroundColor: C.primary }]} onPress={() => setSelectedCard(null)} activeOpacity={0.86}>
                <Text style={styles.readerCloseText}>收起记忆</Text>
              </TouchableOpacity>
            </ImageBackground>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingVertical: 18, paddingBottom: 36 },
  hero: {
    paddingHorizontal: 20,
    gap: 8,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  pageTitle: {
    fontSize: 30,
    fontWeight: '800',
    lineHeight: 36,
  },
  heroText: {
    fontSize: 15,
    lineHeight: 23,
  },
  cardRail: {
    paddingHorizontal: 20,
    paddingVertical: 18,
    gap: 14,
  },
  memoryCard: {
    width: 272,
    height: 390,
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  memoryImage: {
    width: '100%',
    height: '100%',
  },
  memoryOverlay: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 14,
    padding: 14,
    borderRadius: 22,
    backgroundColor: 'rgba(12, 10, 18, 0.58)',
  },
  memoryTime: {
    color: 'rgba(255,255,255,0.74)',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  memoryTitle: {
    color: '#fff',
    fontSize: 19,
    fontWeight: '800',
    lineHeight: 24,
  },
  memorySubtitle: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 12,
    marginTop: 7,
  },
  insightPanel: {
    marginHorizontal: 20,
    padding: 18,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  insightTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  insightText: {
    fontSize: 14,
    lineHeight: 22,
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
  readerBackground: {
    flex: 1,
  },
  readerBackgroundImage: {
    width: '100%',
    height: '100%',
  },
  readerScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.18)',
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
    backgroundColor: 'rgba(10,10,18,0.48)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.26)',
  },
  readerBackText: {
    color: '#fff',
    fontSize: 38,
    lineHeight: 40,
    fontWeight: '500',
  },
  readerMetaPill: {
    position: 'absolute',
    top: 54,
    left: 78,
    right: 18,
    zIndex: 5,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: 'rgba(8,8,14,0.46)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  readerMetaEyebrow: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  readerMetaTitle: {
    color: '#fff',
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '900',
    marginTop: 4,
  },
  readerMetaSubtitle: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 12,
    marginTop: 4,
  },
  readerPanelBubble: {
    position: 'absolute',
    zIndex: 4,
    padding: 14,
    borderRadius: 22,
    backgroundColor: 'rgba(8,8,14,0.58)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.22)',
    gap: 5,
  },
  readerPanelStep: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  readerPanelTitle: {
    color: '#fff',
    fontSize: 19,
    lineHeight: 23,
    fontWeight: '900',
  },
  readerPanelDialogue: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '800',
  },
  readerPanelCaption: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 12,
    lineHeight: 17,
  },
  readerPanelHotspot: {
    position: 'absolute',
    zIndex: 3,
    width: '50%',
    height: '50%',
    borderWidth: 2.5,
    borderColor: 'transparent',
  },
  readerPanelIndex: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    overflow: 'hidden',
    color: '#fff',
    fontSize: 13,
    lineHeight: 28,
    textAlign: 'center',
    fontWeight: '900',
    backgroundColor: 'rgba(8,8,14,0.54)',
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
