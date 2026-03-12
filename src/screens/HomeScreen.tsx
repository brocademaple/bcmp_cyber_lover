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

// 横屏：角色卡片（人设图 + 名字 + 性格词）
function CharacterCard({
  character,
  onPress,
  onEdit,
  cardWidth,
}: {
  character: Character;
  onPress: () => void;
  onEdit: () => void;
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
        {character.imageUri ? (
          <Image source={character.imageUri} style={styles.characterImage} resizeMode="cover" />
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
      <TouchableOpacity onPress={onEdit} style={[styles.editBtn, { backgroundColor: C.primary }]}>
        <Text style={styles.editIcon}>✏️</Text>
      </TouchableOpacity>
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
      <Text style={[styles.createText, { color: C.primary }]}>点击创建新角色</Text>
    </TouchableOpacity>
  );
}

// 竖屏：单角色大图 + 名字 + 性格词（居中展示）
function PortraitCharacterView({
  character,
  onPress,
  onEdit,
  imageSize,
}: {
  character: Character;
  onPress: () => void;
  onEdit: () => void;
  imageSize: { width: number; height: number };
}) {
  const C = useThemeColors();
  return (
    <TouchableOpacity
      style={styles.portraitCenter}
      onPress={onPress}
      activeOpacity={1}
    >
      <View style={[styles.portraitImageWrap, { width: imageSize.width, height: imageSize.height, backgroundColor: C.surface, borderColor: C.border }]}>
        {character.imageUri ? (
          <Image
            source={character.imageUri}
            style={{ width: imageSize.width, height: imageSize.height }}
            resizeMode="contain"
          />
        ) : (
          <Text style={styles.avatarLarge}>{character.avatar}</Text>
        )}
        <TouchableOpacity
          onPress={onEdit}
          style={[styles.portraitEditBtn, { backgroundColor: C.primary }]}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.editIcon}>✏️</Text>
        </TouchableOpacity>
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
  const { loadSettings, updateAdvanced, saveSettings, settings } = useSettingsStore();
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [portraitIndex, setPortraitIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const landscapeScrollX = useRef(0);

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

  const handleOpenChat = (character: Character) => {
    navigation.navigate('Chat', { characterId: character.id });
  };

  const handleSelectTheme = async (theme: 'pink' | 'blue' | 'yellow' | 'purple') => {
    updateAdvanced({ theme });
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

  const darkModeIcons = { light: '☀️', dark: '🌙' };
  const themeEmojis = { pink: '💗', blue: '💙', yellow: '💛', purple: '💜' };
  const themeNames = { pink: '粉色甜心', blue: '蓝色清新', yellow: '黄色阳光', purple: '紫色梦幻' };

  const currentCharacter = characters[portraitIndex];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: C.background }]}>
      <StatusBar barStyle="light-content" backgroundColor={C.primaryDark} />

      {/* 抬头栏：产品信息 + 全局设置 */}
      <LinearGradient
        colors={[C.primaryDark, C.primary]}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Text style={styles.headerTitle}>心动伴侣 {themeEmojis[settings.advanced.theme]}</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity style={styles.iconBtn} onPress={handleToggleDarkMode}>
            <Text style={styles.iconBtnText}>{darkModeIcons[settings.advanced.darkMode]}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={() => setShowThemeModal(true)}>
            <Text style={styles.iconBtnText}>🎨</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('Settings')}>
            <Text style={styles.iconBtnText}>⚙️</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* 竖屏：单角色大图 + 名字 + 性格词 + 左右箭头 */}
      {!isLandscape && (
        <View style={styles.portraitContainer}>
          <TouchableOpacity
            style={[styles.arrowBtn, { left: 8 }]}
            onPress={() => setPortraitIndex((i) => (i <= 0 ? characters.length - 1 : i - 1))}
          >
            <Text style={styles.arrowText}>‹</Text>
          </TouchableOpacity>

          <View style={styles.portraitContentWrap}>
            {currentCharacter ? (
              <PortraitCharacterView
                character={currentCharacter}
                onPress={() => handleOpenChat(currentCharacter)}
                onEdit={() => navigation.navigate('CharacterEditor', { characterId: currentCharacter.id })}
                imageSize={{ width: portraitImageWidth, height: portraitImageHeight }}
              />
            ) : (
              <View style={styles.portraitCenter}>
                <Text style={[styles.createText, { color: C.primary }]}>暂无角色</Text>
              </View>
            )}
          </View>

          <TouchableOpacity
            style={[styles.arrowBtn, { right: 8 }]}
            onPress={() => setPortraitIndex((i) => (i >= characters.length - 1 ? 0 : i + 1))}
          >
            <Text style={styles.arrowText}>›</Text>
          </TouchableOpacity>

          <View style={styles.portraitCreateBtnWrap}>
            <TouchableOpacity
              style={[styles.portraitCreateBtn, { backgroundColor: C.primary, borderColor: C.primary }]}
              onPress={() => navigation.navigate('CharacterEditor', {})}
            >
              <Text style={styles.portraitCreateText}>点击创建新角色</Text>
            </TouchableOpacity>
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
                  onPress={() => handleOpenChat(char)}
                  onEdit={() => navigation.navigate('CharacterEditor', { characterId: char.id })}
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
            {(['pink', 'blue', 'yellow', 'purple'] as const).map((theme) => (
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
  arrowBtn: {
    position: 'absolute',
    top: '50%',
    marginTop: -36,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0,0,0,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  arrowText: {
    fontSize: 36,
    fontWeight: '300',
    color: '#333',
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
