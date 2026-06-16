import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Modal,
  Image,
  useWindowDimensions,
  ImageSourcePropType,
  AccessibilityInfo,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { RootStackParamList, Character } from '../types';
import { useChatStore } from '../store/chatStore';
import { useSettingsStore } from '../store/settingsStore';
import { useThemeColors } from '../utils/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Main'>;

const CARD_SPACING = 16;

function getCharacterImageSource(imageUri: Character['imageUri']): ImageSourcePropType | undefined {
  if (!imageUri) return undefined;
  return typeof imageUri === 'string' ? { uri: imageUri } : imageUri;
}

function getCharacterMainImage(character: Character): Character['imageUri'] {
  return character.assetSet?.main ?? character.imageUri;
}

function getCharacterIdleFrames(character?: Character): NonNullable<Character['imageUri']>[] {
  if (!character) return [];
  const frames = character.assetSet?.idleFrames?.filter(Boolean) ?? [];
  const fallback = character.assetSet?.main ?? character.imageUri;
  return frames.length > 0 ? frames : fallback ? [fallback] : [];
}

function getCharacterAvatar(character: Character): Character['imageUri'] {
  return character.assetSet?.avatar ?? getCharacterMainImage(character);
}

function getMoodLabel(character?: Character) {
  const mood = character?.emotionalState?.mood;
  if (mood === 'happy') return '开心';
  if (mood === 'sad') return '有点低落';
  if (mood === 'excited') return '很有精神';
  if (mood === 'tired') return '低电量';
  if (mood === 'angry') return '有点别扭';
  return '安静陪着你';
}

function getCharacterStatusLine(character?: Character) {
  if (!character) return '今天也在等你回来。';
  if (character.theme === 'midnight') return '夜已经深了，她还留着屏幕的微光。';
  if (character.theme === 'purple' || character.theme === 'blue') return '窗外有雨，她把今天的安静留给你。';
  return '房间里有一点甜，她把今天的小事都留着。';
}

// 横屏：角色卡片（人设图 + 名字 + 性格词）
function CharacterCard({
  character,
  onPress,
  cardWidth,
}: {
  character: Character;
  onPress: () => void;
  cardWidth: number;
}) {
  const C = useThemeColors();
  return (
    <TouchableOpacity
      style={[styles.card, { width: cardWidth, backgroundColor: C.surface, borderColor: C.border }]}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <View style={[styles.cardImageContainer, { backgroundColor: C.primaryLight + '22' }]}>
        {getCharacterMainImage(character) ? (
          <Image source={getCharacterImageSource(getCharacterMainImage(character))} style={styles.characterImage} resizeMode="cover" />
        ) : (
          <Text style={styles.avatarLarge}>{character.avatar}</Text>
        )}
      </View>
      <View style={styles.cardInfo}>
        <Text style={[styles.cardName, { color: C.text }]} numberOfLines={1}>{character.name}</Text>
        <Text style={[styles.cardPersonality, { color: C.textSecondary }]} numberOfLines={1}>
          {character.personality}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// 横屏：创建新角色卡片
function CreateCard({ onPress, cardWidth }: { onPress: () => void; cardWidth: number }) {
  const C = useThemeColors();
  return (
    <TouchableOpacity
      style={[
        styles.card,
        styles.createCard,
        { width: cardWidth, backgroundColor: C.surface, borderColor: C.primary },
      ]}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <Text style={[styles.createIcon, { color: C.primary }]}>＋</Text>
      <Text style={[styles.createText, { color: C.primary }]}>创建新角色</Text>
    </TouchableOpacity>
  );
}

// 竖屏：单角色大图 + 名字 + 性格词（居中展示）
function PortraitCharacterView({
  character,
  imageUri,
  imageOpacity,
  onPress,
  imageSize,
}: {
  character: Character;
  imageUri?: Character['imageUri'];
  imageOpacity?: Animated.Value;
  onPress: () => void;
  imageSize: { width: number; height: number };
}) {
  const C = useThemeColors();
  const activeImageUri = imageUri ?? getCharacterMainImage(character);
  return (
    <TouchableOpacity
      style={styles.portraitCenter}
      onPress={onPress}
      activeOpacity={1}
    >
      <View style={[styles.portraitImageWrap, { width: imageSize.width, height: imageSize.height, backgroundColor: C.surface, borderColor: C.border }]}>
        {activeImageUri ? (
          <Animated.Image
            source={getCharacterImageSource(activeImageUri)}
            style={{ width: imageSize.width, height: imageSize.height, opacity: imageOpacity ?? 1 }}
            resizeMode="contain"
          />
        ) : (
          <Text style={styles.avatarLarge}>{character.avatar}</Text>
        )}
      </View>
      <Text style={[styles.portraitName, { color: C.text }]}>{character.name}</Text>
      <Text style={[styles.portraitPersonality, { color: C.textSecondary }]}>{character.personality}</Text>
    </TouchableOpacity>
  );
}

export default function HomeScreen({ navigation }: Props) {
  const C = useThemeColors();
  const { width: winWidth, height: winHeight } = useWindowDimensions();
  const isLandscape = winWidth > winHeight;

  const { characters, loadCharacters } = useChatStore();
  const { loadSettings, updateAdvanced, saveSettings, settings, setSelectedCharacter } = useSettingsStore();
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [portraitIndex, setPortraitIndex] = useState(0);
  const [idleFrameIndex, setIdleFrameIndex] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const landscapeScrollX = useRef(0);
  const idleImageOpacity = useRef(new Animated.Value(1)).current;

  // 横屏时卡片宽度：约 3 张可见，留出左右箭头空间
  const cardWidthLandscape = Math.min(winWidth * 0.28, 220);
  const carouselPadding = 48;

  // 竖屏时中央人设图区域尺寸（比例约 3:4，完整显示立绘全图）
  const portraitImageWidth = winWidth * 0.78;
  const portraitImageHeight = portraitImageWidth * (4 / 3);

  useEffect(() => {
    loadCharacters();
    loadSettings();
  }, []);

  useEffect(() => {
    if (characters.length > 0 && portraitIndex >= characters.length) {
      setPortraitIndex(characters.length - 1);
    }
  }, [characters.length, portraitIndex]);

  useEffect(() => {
    const selectedIndex = characters.findIndex((char) => char.id === settings.selectedCharacterId);
    if (selectedIndex >= 0 && selectedIndex !== portraitIndex) {
      setPortraitIndex(selectedIndex);
    }
  }, [characters, settings.selectedCharacterId]);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  const handleOpenChat = (character: Character) => {
    setSelectedCharacter(character.id);
    navigation.navigate('Chat', { characterId: character.id });
  };

  const handleOpenMemory = (character: Character) => {
    setSelectedCharacter(character.id);
    navigation.navigate('MemorySettings');
  };

  const handleSelectTheme = async (theme: 'pink' | 'blue' | 'yellow' | 'purple' | 'midnight') => {
    updateAdvanced({ theme, themeMode: 'manual' });
    await saveSettings();
    setShowThemeModal(false);
  };

  const handleToggleDarkMode = async () => {
    const nextMode = settings.advanced.darkMode === 'light' ? 'dark' : 'light';
    updateAdvanced({ darkMode: nextMode });
    await saveSettings();
  };

  const cardStep = cardWidthLandscape + CARD_SPACING;
  const scrollToPrev = () => {
    const nextX = Math.max(0, landscapeScrollX.current - cardStep);
    landscapeScrollX.current = nextX;
    scrollRef.current?.scrollTo({ x: nextX, animated: true });
  };
  const scrollToNext = () => {
    const maxX = (characters.length + 1) * cardStep - winWidth + carouselPadding * 2;
    const nextX = Math.min(maxX, landscapeScrollX.current + cardStep);
    landscapeScrollX.current = nextX;
    scrollRef.current?.scrollTo({ x: nextX, animated: true });
  };

  const selectPortraitIndex = (nextIndex: number) => {
    if (characters.length === 0) return;
    const safeIndex = (nextIndex + characters.length) % characters.length;
    const nextCharacter = characters[safeIndex];
    setPortraitIndex(safeIndex);
    setSelectedCharacter(nextCharacter.id);
  };

  const themeEmojis = { pink: '💗', blue: '💙', yellow: '💛', purple: '💜', midnight: '🌙' };
  const themeNames = { pink: '粉色甜心', blue: '蓝色清新', yellow: '黄色阳光', purple: '紫色梦幻', midnight: '午夜深色' };

  const currentCharacter = characters[portraitIndex];
  const idleFrames = getCharacterIdleFrames(currentCharacter);
  const activeIdleFrame = idleFrames[idleFrameIndex % Math.max(idleFrames.length, 1)];
  const intimacyValue = currentCharacter?.emotionalState?.intimacy ?? 36;
  const statusBarStyle = currentCharacter?.theme === 'midnight' ? 'light-content' : 'dark-content';

  useEffect(() => {
    setIdleFrameIndex(0);
    idleImageOpacity.setValue(1);
  }, [currentCharacter?.id]);

  useEffect(() => {
    if (reduceMotion || idleFrames.length <= 1) return;
    const timer = setInterval(() => {
      Animated.timing(idleImageOpacity, {
        toValue: 0.18,
        duration: 260,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished) return;
        setIdleFrameIndex((current) => (current + 1) % idleFrames.length);
        Animated.timing(idleImageOpacity, {
          toValue: 1,
          duration: 420,
          useNativeDriver: true,
        }).start();
      });
    }, 7000);
    return () => {
      clearInterval(timer);
      idleImageOpacity.stopAnimation();
    };
  }, [currentCharacter?.id, idleFrames.length, idleImageOpacity, reduceMotion]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: C.background }]} edges={['top', 'bottom']}>
      <StatusBar
        barStyle={statusBarStyle}
        backgroundColor={C.background}
      />

      {/* 竖屏：单角色大图 + 名字 + 性格词 + 左右箭头 */}
      {!isLandscape && (
        <View style={[styles.spaceContainer, { backgroundColor: C.background }]}>
          {currentCharacter && activeIdleFrame ? (
            <Animated.Image
              source={getCharacterImageSource(activeIdleFrame)}
              style={[styles.spaceBackground, { opacity: idleImageOpacity }]}
              resizeMode="cover"
            />
          ) : null}

          <LinearGradient
            colors={[
              currentCharacter?.theme === 'midnight' ? 'rgba(6,7,16,0.26)' : 'rgba(255,247,248,0.16)',
              currentCharacter?.theme === 'midnight' ? 'rgba(6,7,16,0.12)' : 'rgba(255,247,248,0.08)',
              currentCharacter?.theme === 'midnight' ? 'rgba(5,6,14,0.92)' : 'rgba(255,247,248,0.88)',
            ]}
            locations={[0, 0.48, 1]}
            style={styles.spaceShade}
          />

          <View style={styles.spaceTopBar}>
            {currentCharacter ? (
              <View style={[styles.identityPill, { backgroundColor: C.surface + 'DD', borderColor: C.border }]}>
                {getCharacterAvatar(currentCharacter) ? (
                  <Image
                    source={getCharacterImageSource(getCharacterAvatar(currentCharacter))}
                    style={styles.identityAvatar}
                    resizeMode="cover"
                  />
                ) : (
                  <Text style={styles.identityEmoji}>{currentCharacter.avatar}</Text>
                )}
                <View style={styles.identityText}>
                  <Text style={[styles.identityName, { color: C.text }]}>{currentCharacter.name}</Text>
                  <Text style={[styles.identityMeta, { color: C.primary }]}>{getMoodLabel(currentCharacter)}</Text>
                </View>
              </View>
            ) : (
              <Text style={[styles.spaceBrand, { color: C.text }]}>心动伴侣</Text>
            )}

            <View style={styles.spaceTopActions}>
              {currentCharacter && (
                <TouchableOpacity
                  style={[styles.glassIconBtn, { backgroundColor: C.surface + 'CC', borderColor: C.border }]}
                  onPress={() => handleOpenMemory(currentCharacter)}
                >
                  <Text style={[styles.glassIconText, { color: C.text }]}>记</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.glassIconBtn, { backgroundColor: C.surface + 'CC', borderColor: C.border }]}
                onPress={() => navigation.navigate('Settings')}
              >
                <Text style={[styles.glassIconText, { color: C.text }]}>⚙</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.spaceArrowBtn, { left: 14, backgroundColor: C.surface + 'CC', borderColor: C.border }]}
            onPress={() => selectPortraitIndex(portraitIndex - 1)}
          >
            <Text style={[styles.spaceArrowText, { color: C.text }]}>‹</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.spaceArrowBtn, { right: 14, backgroundColor: C.surface + 'CC', borderColor: C.border }]}
            onPress={() => selectPortraitIndex(portraitIndex + 1)}
          >
            <Text style={[styles.spaceArrowText, { color: C.text }]}>›</Text>
          </TouchableOpacity>

          <View style={styles.spaceDock}>
            <View style={[styles.greetingCard, { backgroundColor: C.surface + 'E8', borderColor: C.border }]}>
              <Text style={[styles.greetingEyebrow, { color: C.primary }]}>陪伴空间</Text>
              <Text style={[styles.greetingTitle, { color: C.text }]}>
                {currentCharacter ? currentCharacter.name : '欢迎回来'}
              </Text>
              <Text style={[styles.greetingCopy, { color: C.textSecondary }]}>
                {getCharacterStatusLine(currentCharacter)}
              </Text>

              {currentCharacter && (
                <View style={styles.statusPanel}>
                  <View style={styles.statusLine}>
                    <Text style={[styles.statusLabel, { color: C.textSecondary }]}>今日状态</Text>
                    <Text style={[styles.statusValue, { color: C.text }]}>
                      {getMoodLabel(currentCharacter)} {currentCharacter.theme === 'midnight' ? '🌙' : '♡'}
                    </Text>
                  </View>
                  <View style={styles.statusLine}>
                    <Text style={[styles.statusLabel, { color: C.textSecondary }]}>亲密度</Text>
                    <Text style={[styles.statusValue, { color: C.text }]}>{intimacyValue}%</Text>
                  </View>
                  <View style={[styles.progressTrack, { backgroundColor: C.border }]}>
                    <View style={[styles.progressFill, { width: `${Math.min(100, Math.max(0, intimacyValue))}%`, backgroundColor: C.primary }]} />
                  </View>
                </View>
              )}
            </View>

            {currentCharacter ? (
              <TouchableOpacity
                style={[styles.spacePrimaryBtn, { backgroundColor: C.primary }]}
                onPress={() => handleOpenChat(currentCharacter)}
              >
                <Text style={styles.spacePrimaryText}>和她聊聊</Text>
                <Text style={styles.spacePrimaryIcon}>💬</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.spacePrimaryBtn, { backgroundColor: C.primary }]}
                onPress={() => navigation.navigate('CharacterEditor', {})}
              >
                <Text style={styles.spacePrimaryText}>选择陪伴</Text>
              </TouchableOpacity>
            )}

            <View style={[styles.spaceTabBar, { backgroundColor: C.surface + 'E8', borderColor: C.border }]}>
              <TouchableOpacity style={styles.spaceTabItem} onPress={() => currentCharacter && handleOpenChat(currentCharacter)}>
                <Text style={[styles.spaceTabIcon, { color: C.primary }]}>⌂</Text>
                <Text style={[styles.spaceTabLabel, { color: C.primary }]}>陪伴</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.spaceTabItem} onPress={() => currentCharacter && handleOpenMemory(currentCharacter)}>
                <Text style={[styles.spaceTabIcon, { color: C.textSecondary }]}>▣</Text>
                <Text style={[styles.spaceTabLabel, { color: C.textSecondary }]}>记忆</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.spaceTabItem} onPress={() => currentCharacter && navigation.navigate('CharacterSettings', { characterId: currentCharacter.id })}>
                <Text style={[styles.spaceTabIcon, { color: C.textSecondary }]}>♡</Text>
                <Text style={[styles.spaceTabLabel, { color: C.textSecondary }]}>档案</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.spaceTabItem} onPress={() => navigation.navigate('Settings')}>
                <Text style={[styles.spaceTabIcon, { color: C.textSecondary }]}>⚙</Text>
                <Text style={[styles.spaceTabLabel, { color: C.textSecondary }]}>设置</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* 横屏：横向轮播（人设图 + 名字 + 性格词）+ 左右箭头 + 末尾创建新角色 */}
      {isLandscape && (
        <View style={styles.carouselContainer}>
          <TouchableOpacity style={[styles.arrowBtnLandscape, { left: 12 }]} onPress={scrollToPrev}>
            <Text style={[styles.arrowText, { color: C.text }]}>‹</Text>
          </TouchableOpacity>

          <ScrollView
            ref={scrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[
              styles.carousel,
              { paddingHorizontal: carouselPadding },
            ]}
            snapToInterval={cardWidthLandscape + CARD_SPACING}
            decelerationRate="fast"
            onScroll={(e) => { landscapeScrollX.current = e.nativeEvent.contentOffset.x; }}
            scrollEventThrottle={16}
          >
            {characters.map((char) => (
              <View key={char.id} style={{ marginRight: CARD_SPACING }}>
                <CharacterCard
                  character={char}
                  cardWidth={cardWidthLandscape}
                  onPress={() => {
                    setSelectedCharacter(char.id);
                    handleOpenChat(char);
                  }}
                />
              </View>
            ))}
            <CreateCard cardWidth={cardWidthLandscape} onPress={() => navigation.navigate('CharacterEditor', {})} />
          </ScrollView>

          <TouchableOpacity style={[styles.arrowBtnLandscape, { right: 12 }]} onPress={scrollToNext}>
            <Text style={[styles.arrowText, { color: C.text }]}>›</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 主题弹窗 */}
      <Modal visible={showThemeModal} transparent animationType="fade" onRequestClose={() => setShowThemeModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowThemeModal(false)}>
          <View style={[styles.modalContent, { backgroundColor: C.surface }]}>
            <Text style={[styles.modalTitle, { color: C.text }]}>选择主题色</Text>
            {(['pink', 'blue', 'yellow', 'purple', 'midnight'] as const).map((theme) => (
              <TouchableOpacity
                key={theme}
                style={[styles.themeOption, settings.advanced.theme === theme && { backgroundColor: C.primaryLight + '22' }]}
                onPress={() => handleSelectTheme(theme)}
              >
                <Text style={styles.themeEmoji}>{themeEmojis[theme]}</Text>
                <Text style={[styles.themeName, { color: C.text }]}>{themeNames[theme]}</Text>
                {settings.advanced.theme === theme && <Text style={styles.checkMark}>✓</Text>}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  spaceContainer: {
    flex: 1,
    overflow: 'hidden',
  },
  spaceBackground: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  spaceShade: {
    ...StyleSheet.absoluteFillObject,
  },
  spaceTopBar: {
    position: 'absolute',
    top: 10,
    left: 16,
    right: 16,
    zIndex: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  identityPill: {
    minWidth: 118,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 8,
    paddingHorizontal: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  identityAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  identityEmoji: {
    width: 34,
    height: 34,
    borderRadius: 17,
    textAlign: 'center',
    lineHeight: 34,
    fontSize: 20,
  },
  identityText: {
    minWidth: 0,
  },
  identityName: {
    fontSize: 14,
    fontWeight: '800',
  },
  identityMeta: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 1,
  },
  spaceBrand: {
    fontSize: 22,
    fontWeight: '800',
  },
  spaceTopActions: {
    flexDirection: 'row',
    gap: 8,
  },
  glassIconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glassIconText: {
    fontSize: 18,
    fontWeight: '800',
  },
  spaceArrowBtn: {
    position: 'absolute',
    top: '44%',
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 11,
  },
  spaceArrowText: {
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '500',
  },
  spaceDock: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 10,
    zIndex: 12,
    gap: 10,
  },
  greetingCard: {
    borderRadius: 26,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 8,
  },
  greetingEyebrow: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  greetingTitle: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '900',
  },
  greetingCopy: {
    fontSize: 14,
    lineHeight: 21,
  },
  statusPanel: {
    marginTop: 4,
    gap: 8,
  },
  statusLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  statusValue: {
    fontSize: 13,
    fontWeight: '800',
  },
  progressTrack: {
    height: 5,
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  spacePrimaryBtn: {
    minHeight: 56,
    borderRadius: 28,
    paddingHorizontal: 22,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  spacePrimaryText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '900',
  },
  spacePrimaryIcon: {
    color: '#fff',
    fontSize: 18,
  },
  spaceTabBar: {
    minHeight: 66,
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 8,
    paddingVertical: 7,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  spaceTabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  spaceTabIcon: {
    fontSize: 18,
    fontWeight: '800',
  },
  spaceTabLabel: {
    fontSize: 11,
    fontWeight: '800',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconBtnText: { fontSize: 20 },

  // 竖屏
  portraitContainer: {
    flex: 1,
    alignItems: 'center',
  },
  portraitContentWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 120,
  },
  portraitCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  portraitImageWrap: {
    borderRadius: 16,
    borderWidth: 2,
    overflow: 'hidden',
    marginBottom: 16,
  },
  portraitName: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 6,
  },
  portraitPersonality: {
    fontSize: 15,
    marginBottom: 12,
  },
  portraitEditBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  portraitCreateBtnWrap: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 10,
  },
  portraitCreateBtn: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 25,
    borderWidth: 2,
  },
  portraitCreateText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  memoryBtn: {
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
  },
  memoryBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
  createSecondaryBtn: {
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
  },
  createSecondaryText: {
    fontSize: 13,
    fontWeight: '700',
  },
  arrowBtn: {
    position: 'absolute',
    top: '50%',
    marginTop: -36,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(20,20,32,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  arrowText: {
    fontSize: 36,
    fontWeight: '500',
    color: '#2b2434',
  },

  // 横屏轮播
  carouselContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  arrowBtnLandscape: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  carousel: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  card: {
    height: 380,
    borderRadius: 20,
    borderWidth: 2,
    padding: 14,
    position: 'relative',
  },
  cardImageContainer: {
    flex: 1,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    overflow: 'hidden',
  },
  characterImage: {
    width: '100%',
    height: '100%',
  },
  avatarLarge: { fontSize: 72 },
  cardInfo: {
    alignItems: 'center',
    marginBottom: 6,
  },
  cardName: { fontSize: 18, fontWeight: '700', marginBottom: 2 },
  cardPersonality: { fontSize: 13 },
  editBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editIcon: { fontSize: 16 },
  createCard: {
    justifyContent: 'center',
    alignItems: 'center',
    borderStyle: 'dashed',
  },
  createIcon: { fontSize: 52, marginBottom: 10 },
  createText: { fontSize: 15, fontWeight: '600' },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '80%',
    borderRadius: 20,
    padding: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 20,
    textAlign: 'center',
  },
  themeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 10,
  },
  themeEmoji: { fontSize: 28, marginRight: 12 },
  themeName: { fontSize: 16, fontWeight: '500', flex: 1 },
  checkMark: { fontSize: 20, color: '#4CAF50' },
});
