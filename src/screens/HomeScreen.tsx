import React, { useCallback, useEffect, useState, useRef } from 'react';
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
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { RootStackParamList, Character, AppTheme, EmotionalState } from '../types';
import { hydrateDefaultCharacterAssets, useChatStore } from '../store/chatStore';
import { useSettingsStore } from '../store/settingsStore';
import { resolveDefaultCharacterAssetKey } from '../utils/characterAssets';
import { NOTO_SERIF_SC } from '../utils/appFonts';
import { useThemeColors, useThemeId } from '../utils/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Main'>;

const CARD_SPACING = 16;
type Mood = EmotionalState['mood'];
const DEFAULT_HOME_MOOD: Mood = 'neutral';
const MOOD_ENTRY_VALID_MS = 5 * 60 * 1000;
type StatusLineSet = Partial<Record<Mood, string[]>>;

const STATUS_OPTIONS: Array<{
  id: string;
  label: string;
  detail: string;
  mood: Mood;
  frameIndex: number;
  mark: string;
}> = [
  { id: 'main', label: '自然待机', detail: '回到她平时陪你的样子。', mood: 'neutral', frameIndex: 0, mark: '✦' },
  { id: 'happy', label: '开心营业', detail: '让她用更明亮的状态迎接你。', mood: 'happy', frameIndex: 1, mark: '♡' },
  { id: 'soft', label: '安静陪着', detail: '少说一点，留一盏灯陪你。', mood: 'sad', frameIndex: 2, mark: '…' },
  { id: 'low-energy', label: '低电量关心', detail: '适合累了、想被轻轻照顾的时候。', mood: 'tired', frameIndex: 3, mark: '☾' },
  { id: 'near', label: '靠近一下', detail: '让她更主动地回应你的靠近。', mood: 'excited', frameIndex: 4, mark: '↗' },
  { id: 'waiting', label: '坐着等你', detail: '她不催你，只在原地等你回来。', mood: 'angry', frameIndex: 5, mark: '⌛' },
];

function getCharacterImageSource(imageUri: Character['imageUri']): ImageSourcePropType | undefined {
  if (!imageUri) return undefined;
  return typeof imageUri === 'string' ? { uri: imageUri } : imageUri;
}

function getBundledFallbackImage(character?: Character): Character['imageUri'] | undefined {
  if (!character) return undefined;
  const hydrated = hydrateDefaultCharacterAssets(character);
  return hydrated.assetSet?.main ?? hydrated.imageUri;
}

function getCharacterMainImage(character: Character): Character['imageUri'] {
  const hydrated = hydrateDefaultCharacterAssets(character);
  return hydrated.assetSet?.main ?? hydrated.imageUri;
}

function getCharacterIdleFrames(character?: Character): NonNullable<Character['imageUri']>[] {
  if (!character) return [];
  const hydrated = hydrateDefaultCharacterAssets(character);
  const frames = hydrated.assetSet?.idleFrames?.filter(Boolean) ?? [];
  const fallback = hydrated.assetSet?.main ?? hydrated.imageUri;
  return frames.length > 0 ? frames : fallback ? [fallback] : [];
}

function getStatusOption(mood?: Mood) {
  return STATUS_OPTIONS.find((option) => option.mood === mood) ?? STATUS_OPTIONS[0];
}

function getCharacterStatusFrame(character?: Character, moodOverride?: Mood): Character['imageUri'] | undefined {
  if (!character) return undefined;
  const frames = getCharacterIdleFrames(character);
  const option = getStatusOption(moodOverride ?? character.emotionalState?.mood);
  return frames[option.frameIndex] ?? frames[0] ?? character.imageUri;
}

function getCharacterHeadshot(character: Character): Character['imageUri'] {
  const hydrated = hydrateDefaultCharacterAssets(character);
  return hydrated.assetSet?.headshot ?? hydrated.assetSet?.avatar ?? getCharacterMainImage(hydrated);
}

function getNextRenderableCharacterImage(
  character: Character | undefined,
  failedImage?: Character['imageUri']
): Character['imageUri'] | undefined {
  if (!character) return undefined;
  const hydrated = hydrateDefaultCharacterAssets(character);
  const candidates = [
    ...(hydrated.assetSet?.idleFrames ?? []),
    hydrated.assetSet?.headshot,
    hydrated.assetSet?.avatar,
    hydrated.assetSet?.main,
    hydrated.imageUri,
  ].filter(Boolean) as NonNullable<Character['imageUri']>[];
  return candidates.find((candidate) => candidate !== failedImage) ?? candidates[0];
}

function getMoodLabel(character?: Character, moodOverride?: Mood) {
  const mood = moodOverride ?? character?.emotionalState?.mood;
  if (mood === 'neutral') return '自然待机';
  if (mood === 'happy') return '开心';
  if (mood === 'sad') return '有点低落';
  if (mood === 'excited') return '很有精神';
  if (mood === 'tired') return '低电量';
  if (mood === 'angry') return '有点别扭';
  return '安静陪着你';
}

function isDarkColor(color: string) {
  const hex = color.trim().replace('#', '');
  const normalized = hex.length === 3
    ? hex.split('').map((char) => `${char}${char}`).join('')
    : hex.slice(0, 6);
  if (normalized.length !== 6) return false;
  const red = parseInt(normalized.slice(0, 2), 16);
  const green = parseInt(normalized.slice(2, 4), 16);
  const blue = parseInt(normalized.slice(4, 6), 16);
  if ([red, green, blue].some((value) => Number.isNaN(value))) return false;
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;
  return luminance < 0.5;
}

const CHARACTER_STATUS_LINES: Record<string, StatusLineSet> = {
  qingning: {
    neutral: [
      '房间里有一点甜，她把今天的小事都留着。',
    ],
    happy: ['她笑得亮晶晶的，像刚把好消息藏进袖口。'],
    sad: ['她把声音放软了一点，想先陪你慢慢缓过来。'],
    tired: ['她把零食和毯子都备好，只催你先歇一下。'],
    excited: ['她已经凑近屏幕，等你把今天的新鲜事讲完。'],
    angry: ['她嘴上哼了一声，还是把你的位置留得好好的。'],
  },
  sakura: {
    neutral: [
      '她把书页停在这里，等你把今天慢慢讲完。',
    ],
    happy: ['她眼里有很轻的笑意，像雨停后亮起来的窗。'],
    sad: ['她没有急着说话，只把安静的位置留给你。'],
    tired: ['她替你把灯调暗，提醒你不用马上振作。'],
    excited: ['她合上书，认真等你说完这件值得开心的事。'],
    angry: ['她看出你有点别扭，仍然温柔地等你开口。'],
  },
  luna: {
    neutral: [
      '夜已经深了，她还留着屏幕的微光。',
    ],
    happy: ['她嘴角压不住一点笑，还硬说只是刚好心情不错。'],
    sad: ['她没拆穿你，只把耳机摘下一边，等你靠近。'],
    tired: ['她皱着眉让你别硬撑，手上已经替你按了暂停。'],
    excited: ['她把键盘推远了一点，像是准备陪你通关。'],
    angry: ['她啧了一声，却还是把台阶放到你脚边。'],
  },
};

function pickRotatingLine(lines: string[], variantIndex: number) {
  return lines[Math.abs(variantIndex) % lines.length] ?? lines[0] ?? '今天也在等你回来。';
}

const FALLBACK_STATUS_LINES: Record<Mood, string[]> = {
  neutral: ['今天也在等你回来。'],
  happy: ['她把一点好心情留给你。'],
  sad: ['她把安静的位置留给你。'],
  tired: ['她提醒你先慢慢歇一下。'],
  excited: ['她正等你把新鲜事讲完。'],
  angry: ['她有点别扭，但还是在等你。'],
};

function getCharacterStatusLine(character?: Character, mood: Mood = DEFAULT_HOME_MOOD, variantIndex = 0) {
  if (!character) return '今天也在等你回来。';
  const characterLineKey = resolveDefaultCharacterAssetKey(character) ?? character.id;
  const customLines = CHARACTER_STATUS_LINES[characterLineKey];
  const moodLines = customLines?.[mood] ?? customLines?.neutral ?? FALLBACK_STATUS_LINES[mood] ?? FALLBACK_STATUS_LINES.neutral;
  return pickRotatingLine(moodLines, variantIndex);
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
  const themeId = useThemeId();
  const isUrbanClear = themeId === 'urbanClear';
  const isSoftSweet = themeId === 'softSweet';
  const { width: winWidth, height: winHeight } = useWindowDimensions();
  const isLandscape = winWidth > winHeight;

  const { characters, loadCharacters, updateEmotionalState } = useChatStore();
  const { loadSettings, updateAdvanced, saveSettings, settings, setSelectedCharacter } = useSettingsStore();
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusModalCharacterId, setStatusModalCharacterId] = useState<string | null>(null);
  const [portraitIndex, setPortraitIndex] = useState(0);
  const [homeDisplayMood, setHomeDisplayMood] = useState<Mood>(DEFAULT_HOME_MOOD);
  const [statusLineSeed, setStatusLineSeed] = useState(0);
  const [optimisticStatus, setOptimisticStatus] = useState<{ characterId: string; mood: Mood } | null>(null);
  const [lastMoodEntry, setLastMoodEntry] = useState<{ characterId: string; mood: Mood; changedAt: number } | null>(null);
  const [failedImageKeys, setFailedImageKeys] = useState<Record<string, boolean>>({});
  const scrollRef = useRef<ScrollView>(null);
  const landscapeScrollX = useRef(0);
  const imageRetryTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
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

  const handleOpenChat = (character: Character) => {
    persistSelectedCharacter(character.id);
    const visibleMood =
      character.id === currentCharacter?.id
        ? activeDisplayMood
        : character.emotionalState?.mood ?? DEFAULT_HOME_MOOD;
    const now = Date.now();
    const moodEntry = lastMoodEntry?.characterId === character.id &&
      lastMoodEntry.mood === visibleMood &&
      now - lastMoodEntry.changedAt <= MOOD_ENTRY_VALID_MS
      ? { mood: visibleMood, changedAt: lastMoodEntry.changedAt, source: 'homeStatus' as const }
      : undefined;

    if (lastMoodEntry?.characterId === character.id) {
      setLastMoodEntry(null);
    }

    navigation.navigate('Chat', moodEntry ? { characterId: character.id, moodEntry } : { characterId: character.id });
  };

  const handleOpenMemory = (character: Character) => {
    persistSelectedCharacter(character.id);
    navigation.navigate('MemorySettings');
  };

  const handleOpenProfile = (character: Character) => {
    persistSelectedCharacter(character.id);
    navigation.navigate('CharacterSettings', { characterId: character.id });
  };

  const persistSelectedCharacter = useCallback((characterId: string) => {
    setSelectedCharacter(characterId);
    const nextSettings = {
      ...useSettingsStore.getState().settings,
      selectedCharacterId: characterId,
    };
    void saveSettings(nextSettings);
  }, [saveSettings, setSelectedCharacter]);

  const handleSelectTheme = async (theme: AppTheme) => {
    const nextSettings = {
      ...useSettingsStore.getState().settings,
      advanced: { ...useSettingsStore.getState().settings.advanced, theme, themeMode: 'manual' as const },
    };
    updateAdvanced({ theme, themeMode: 'manual' });
    await saveSettings(nextSettings);
    setShowThemeModal(false);
  };

  const handleToggleDarkMode = async () => {
    const nextMode: 'light' | 'dark' = settings.advanced.darkMode === 'light' ? 'dark' : 'light';
    const nextSettings = {
      ...useSettingsStore.getState().settings,
      advanced: { ...useSettingsStore.getState().settings.advanced, darkMode: nextMode },
    };
    updateAdvanced({ darkMode: nextMode });
    await saveSettings(nextSettings);
  };

  const openStatusModal = (character: Character) => {
    setStatusModalCharacterId(character.id);
    setShowStatusModal(true);
  };

  const closeStatusModal = () => {
    setShowStatusModal(false);
    setStatusModalCharacterId(null);
  };

  const handleSelectStatus = async (mood: Mood) => {
    const targetCharacter = hydratedStatusModalCharacter ?? currentCharacter;
    if (!targetCharacter) return;
    const targetIndex = characters.findIndex((character) => character.id === targetCharacter.id);

    idleImageOpacity.stopAnimation(() => {
      idleImageOpacity.setValue(1);
    });
    if (targetIndex >= 0 && targetIndex !== portraitIndex) {
      setPortraitIndex(targetIndex);
    }
    persistSelectedCharacter(targetCharacter.id);
    setOptimisticStatus({ characterId: targetCharacter.id, mood });
    setHomeDisplayMood(mood);
    setStatusLineSeed(0);
    closeStatusModal();

    const changedAt = Date.now();
    setLastMoodEntry({ characterId: targetCharacter.id, mood, changedAt });

    await updateEmotionalState(targetCharacter.id, {
      mood,
      lastInteraction: changedAt,
    });
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
    idleImageOpacity.stopAnimation(() => {
      idleImageOpacity.setValue(1);
    });
    setOptimisticStatus(null);
    setLastMoodEntry(null);
    setStatusLineSeed(0);
    setPortraitIndex(safeIndex);
    persistSelectedCharacter(nextCharacter.id);
  };

  const themeEmojis: Record<AppTheme, string> = {
    urbanClear: '✦',
    softSweet: '♡',
    pink: '💗',
    blue: '💙',
    yellow: '💛',
    purple: '💜',
    midnight: '🌙',
  };
  const themeNames: Record<AppTheme, string> = {
    urbanClear: '都市清透',
    softSweet: '甜美柔软',
    pink: '粉色甜心',
    blue: '蓝色清新',
    yellow: '黄色阳光',
    purple: '紫色梦幻',
    midnight: '午夜深色',
  };

  const selectedCharacter =
    characters.find((character) => character.id === settings.selectedCharacterId) ??
    characters.find((character) => character.id === resolveDefaultCharacterAssetKey(settings.selectedCharacterId));
  const rawCurrentCharacter = selectedCharacter ?? characters[portraitIndex];
  const currentCharacter = rawCurrentCharacter ? hydrateDefaultCharacterAssets(rawCurrentCharacter) : undefined;
  const currentCharacterIndex = currentCharacter
    ? characters.findIndex((character) => character.id === currentCharacter.id)
    : -1;
  const statusModalCharacter = statusModalCharacterId
    ? characters.find((character) => character.id === statusModalCharacterId)
    : currentCharacter;
  const hydratedStatusModalCharacter = statusModalCharacter
    ? hydrateDefaultCharacterAssets(statusModalCharacter)
    : undefined;
  const currentOptimisticMood =
    optimisticStatus && optimisticStatus.characterId === currentCharacter?.id
      ? optimisticStatus.mood
      : undefined;
  const activeDisplayMood = currentOptimisticMood ?? homeDisplayMood;
  const modalOptimisticMood =
    optimisticStatus && hydratedStatusModalCharacter && optimisticStatus.characterId === hydratedStatusModalCharacter.id
      ? optimisticStatus.mood
      : undefined;
  const activeIdleFrame = getCharacterStatusFrame(currentCharacter, activeDisplayMood);
  const activeIdentityImage = currentCharacter ? getCharacterHeadshot(currentCharacter) : undefined;
  const activeImageKey = currentCharacter
    ? `${currentCharacter.id}-${currentCharacterIndex}-${activeDisplayMood}`
    : 'empty';
  const intimacyValue = currentCharacter?.emotionalState?.intimacy ?? 36;
  const intimacyPercent = Math.min(100, Math.max(0, intimacyValue));
  const statusLineVariantIndex = statusLineSeed;
  const statusBarStyle = isDarkColor(C.background) ? 'light-content' : 'dark-content';
  const bundledFallbackImage = getBundledFallbackImage(currentCharacter);
  const activeHomeImage = currentCharacter && failedImageKeys[activeImageKey]
    ? getNextRenderableCharacterImage(currentCharacter, activeIdleFrame ?? bundledFallbackImage)
    : activeIdleFrame ?? bundledFallbackImage;
  const activeIdentityKey = currentCharacter ? `identity-${currentCharacter.id}` : 'identity-empty';
  const activeIdentitySource = currentCharacter && failedImageKeys[activeIdentityKey]
    ? getNextRenderableCharacterImage(currentCharacter, activeIdentityImage ?? bundledFallbackImage)
    : activeIdentityImage ?? bundledFallbackImage;
  const showHomeFallbackMark = Boolean(currentCharacter && failedImageKeys[activeImageKey]);
  const showIdentityImage = Boolean(activeIdentitySource && !failedImageKeys[activeIdentityKey]);

  const clearImageFailed = useCallback((key: string) => {
    const timer = imageRetryTimers.current[key];
    if (timer) {
      clearTimeout(timer);
      delete imageRetryTimers.current[key];
    }
    setFailedImageKeys((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }, []);

  const markImageFailed = useCallback((key: string) => {
    setFailedImageKeys((current) => (current[key] ? current : { ...current, [key]: true }));
    const existingTimer = imageRetryTimers.current[key];
    if (existingTimer) clearTimeout(existingTimer);
    imageRetryTimers.current[key] = setTimeout(() => {
      setFailedImageKeys((current) => {
        if (!current[key]) return current;
        const next = { ...current };
        delete next[key];
        return next;
      });
      delete imageRetryTimers.current[key];
    }, 1400);
  }, []);

  useEffect(() => {
    return () => {
      Object.values(imageRetryTimers.current).forEach(clearTimeout);
      imageRetryTimers.current = {};
    };
  }, []);

  const resetHomeStatusDisplay = useCallback(() => {
    idleImageOpacity.stopAnimation();
    setStatusLineSeed(0);
    setOptimisticStatus(null);
    setLastMoodEntry(null);
    setShowStatusModal(false);
    setStatusModalCharacterId(null);
    idleImageOpacity.setValue(1);
  }, [idleImageOpacity]);

  useEffect(() => {
    resetHomeStatusDisplay();
  }, [currentCharacter?.id, resetHomeStatusDisplay]);

  useFocusEffect(
    useCallback(() => {
      resetHomeStatusDisplay();
      return () => {
        idleImageOpacity.stopAnimation();
      };
    }, [idleImageOpacity, resetHomeStatusDisplay])
  );

  useEffect(() => {
    const persistedMood = currentCharacter?.emotionalState?.mood ?? DEFAULT_HOME_MOOD;
    setHomeDisplayMood((current) => (current === persistedMood ? current : persistedMood));
    setStatusLineSeed(0);
  }, [currentCharacter?.id, currentCharacter?.emotionalState?.mood]);

  useEffect(() => {
    if (!optimisticStatus) return;
    const character = characters.find((item) => item.id === optimisticStatus.characterId);
    if (character?.emotionalState?.mood === optimisticStatus.mood) {
      setOptimisticStatus(null);
    }
  }, [characters, optimisticStatus]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: C.background }]} edges={['top', 'bottom']}>
      <StatusBar
        barStyle={statusBarStyle}
        backgroundColor={C.background}
      />

      {/* 竖屏：单角色大图 + 名字 + 性格词 + 左右箭头 */}
      {!isLandscape && (
        <View style={[styles.spaceContainer, { backgroundColor: C.background }]}>
          {currentCharacter && (
            <Text
              style={[
                styles.spaceCharacterFallback,
                { color: C.primary, opacity: showHomeFallbackMark ? 0.9 : 0.18 },
              ]}
              accessibilityElementsHidden
              importantForAccessibility="no"
            >
              {currentCharacter.avatar}
            </Text>
          )}
          {currentCharacter && activeHomeImage ? (
            <Animated.Image
              key={`${activeImageKey}-single`}
              source={getCharacterImageSource(activeHomeImage)}
              style={[styles.spaceSingleImage, { opacity: idleImageOpacity }]}
              resizeMode="cover"
              onError={() => markImageFailed(activeImageKey)}
              onLoad={() => clearImageFailed(activeImageKey)}
            />
          ) : null}

          <LinearGradient
            colors={[
              currentCharacter?.theme === 'midnight' ? 'rgba(6,7,16,0.08)' : 'rgba(255,247,248,0)',
              currentCharacter?.theme === 'midnight' ? 'rgba(6,7,16,0.08)' : 'rgba(255,247,248,0)',
              currentCharacter?.theme === 'midnight' ? 'rgba(5,6,14,0.76)' : 'rgba(18,12,18,0.18)',
            ]}
            locations={[0, 0.58, 1]}
            style={styles.spaceShade}
          />

          <View style={styles.spaceTopBar}>
            {currentCharacter ? (
              <TouchableOpacity
                style={[
                  styles.identityPill,
                  isUrbanClear && styles.urbanIdentityPill,
                  isSoftSweet && styles.softIdentityPill,
                  { backgroundColor: C.surface + 'DD', borderColor: C.border },
                ]}
                onPress={() => openStatusModal(currentCharacter)}
                activeOpacity={0.86}
                accessibilityRole="button"
                accessibilityLabel={`当前状态：${getMoodLabel(currentCharacter, activeDisplayMood)}，点击切换状态`}
              >
                {showIdentityImage ? (
                  <View style={styles.identityAvatarWrap}>
                    <Text style={styles.identityEmoji}>{currentCharacter.avatar}</Text>
                    <Image
                      key={activeIdentityKey}
                      source={getCharacterImageSource(activeIdentitySource)}
                      style={styles.identityAvatarImage}
                      resizeMode="cover"
                      onError={() => markImageFailed(activeIdentityKey)}
                      onLoad={() => clearImageFailed(activeIdentityKey)}
                    />
                  </View>
                ) : (
                  <Text style={styles.identityEmoji}>{currentCharacter.avatar}</Text>
                )}
                <View style={styles.identityText}>
                  <Text style={[styles.identityName, { color: C.text }]} numberOfLines={1}>{currentCharacter.name}</Text>
                  <Text style={[styles.identityMeta, { color: C.primary }]} numberOfLines={1}>
                    {getMoodLabel(currentCharacter, activeDisplayMood)}
                  </Text>
                </View>
              </TouchableOpacity>
            ) : (
              <Text style={[styles.spaceBrand, { color: C.text }]}>心动伴侣</Text>
            )}

            <TouchableOpacity
              style={[
                styles.glassIconBtn,
                isUrbanClear && styles.urbanGlassIconBtn,
                isSoftSweet && styles.softGlassIconBtn,
                { backgroundColor: C.surface + 'CC', borderColor: C.border },
              ]}
              onPress={() => navigation.navigate('Settings')}
              accessibilityRole="button"
              accessibilityLabel="打开设置"
            >
              <Text style={[styles.glassIconText, { color: C.text }]}>⚙</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[
              styles.spaceArrowBtn,
              isUrbanClear && styles.urbanArrowBtn,
              isSoftSweet && styles.softArrowBtn,
              { left: 14, backgroundColor: C.surface + 'CC', borderColor: C.border },
            ]}
            onPress={() => selectPortraitIndex(portraitIndex - 1)}
          >
            <Text style={[styles.spaceArrowText, { color: C.text }]}>‹</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.spaceArrowBtn,
              isUrbanClear && styles.urbanArrowBtn,
              isSoftSweet && styles.softArrowBtn,
              { right: 14, backgroundColor: C.surface + 'CC', borderColor: C.border },
            ]}
            onPress={() => selectPortraitIndex(portraitIndex + 1)}
          >
            <Text style={[styles.spaceArrowText, { color: C.text }]}>›</Text>
          </TouchableOpacity>

          <View style={styles.spaceDock}>
            <View
              style={[
                styles.greetingCard,
                isUrbanClear && styles.urbanGreetingCard,
                isSoftSweet && styles.softGreetingCard,
                { backgroundColor: C.surface + 'E8', borderColor: C.border, shadowColor: C.shadow },
              ]}
            >
              <View style={styles.greetingCompactHeader}>
                <Text style={[styles.greetingTitle, { color: C.text }]} numberOfLines={1}>
                  {currentCharacter ? currentCharacter.name : '欢迎回来'}
                </Text>
                {currentCharacter && (
                  <TouchableOpacity
                    onPress={() => openStatusModal(currentCharacter)}
                    activeOpacity={0.75}
                    style={[styles.statusSelector, { borderColor: C.border, backgroundColor: C.inputBg }]}
                  >
                    <Text style={[styles.statusValue, { color: C.text }]} numberOfLines={1}>
                      {getMoodLabel(currentCharacter, activeDisplayMood)} · {intimacyValue}%
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              <Text style={[styles.greetingCopy, { color: C.textSecondary }]} numberOfLines={2}>
                {getCharacterStatusLine(currentCharacter, activeDisplayMood, statusLineVariantIndex)}
              </Text>

              {currentCharacter && (
                <>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressRail, { backgroundColor: C.border }]}>
                      <View style={[styles.progressFill, { width: `${intimacyPercent}%`, backgroundColor: C.primary }]} />
                    </View>
                    <Text
                      style={[
                        styles.progressHeart,
                        {
                          color: C.primary,
                          left: `${intimacyPercent}%`,
                          backgroundColor: C.surface,
                          borderColor: C.border,
                        },
                      ]}
                      accessibilityElementsHidden
                      importantForAccessibility="no"
                    >
                      ♡
                    </Text>
                  </View>
                  <View style={styles.contextActions}>
                    <TouchableOpacity
                      style={[styles.contextActionPill, { borderColor: C.border, backgroundColor: C.inputBg }]}
                      onPress={() => handleOpenProfile(currentCharacter)}
                      activeOpacity={0.76}
                    >
                      <Text style={[styles.contextActionText, { color: C.primary }]}>档案</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.contextActionPill, { borderColor: C.border, backgroundColor: C.inputBg }]}
                      onPress={() => handleOpenMemory(currentCharacter)}
                      activeOpacity={0.76}
                    >
                      <Text style={[styles.contextActionText, { color: C.primary }]}>记忆漫画</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.contextActionPill, { borderColor: C.border, backgroundColor: C.inputBg }]}
                      onPress={() => {
                        persistSelectedCharacter(currentCharacter.id);
                        navigation.navigate('LifeSettings');
                      }}
                      activeOpacity={0.76}
                    >
                      <Text style={[styles.contextActionText, { color: C.primary }]}>提醒</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>

            {currentCharacter ? (
              <TouchableOpacity
                style={[
                  styles.spacePrimaryBtn,
                  isUrbanClear && styles.urbanPrimaryBtn,
                  isSoftSweet && styles.softPrimaryBtn,
                  { backgroundColor: C.primary },
                ]}
                onPress={() => {
                  void handleOpenChat(currentCharacter);
                }}
              >
                <Text style={styles.spacePrimaryText}>和她聊聊</Text>
                <Text style={styles.spacePrimaryIcon}>💬</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[
                  styles.spacePrimaryBtn,
                  isUrbanClear && styles.urbanPrimaryBtn,
                  isSoftSweet && styles.softPrimaryBtn,
                  { backgroundColor: C.primary },
                ]}
                onPress={() => navigation.navigate('CharacterEditor', {})}
              >
                <Text style={styles.spacePrimaryText}>选择陪伴</Text>
              </TouchableOpacity>
            )}
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
                    void handleOpenChat(char);
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
            {(['urbanClear', 'softSweet', 'pink', 'blue', 'yellow', 'purple', 'midnight'] as const).map((theme) => (
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

      <Modal visible={showStatusModal} transparent animationType="fade" onRequestClose={closeStatusModal}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={closeStatusModal}>
          <View style={[styles.statusModalContent, { backgroundColor: C.surface, borderColor: C.border }]}>
            <Text style={[styles.modalTitle, { color: C.text }]}>切换她现在的状态</Text>
            <Text style={[styles.statusModalLead, { color: C.textSecondary }]}>
              这个状态会同步到她的心情，并切换首页人物图。
            </Text>
            {hydratedStatusModalCharacter && STATUS_OPTIONS.map((option) => {
              const frames = getCharacterIdleFrames(hydratedStatusModalCharacter);
              const preview = frames[option.frameIndex] ?? frames[0];
              const modalActiveMood =
                hydratedStatusModalCharacter.id === currentCharacter?.id
                  ? activeDisplayMood
                  : modalOptimisticMood ?? DEFAULT_HOME_MOOD;
              const modalActiveOption = getStatusOption(modalActiveMood);
              const active = option.mood === modalActiveOption.mood;
              return (
                <TouchableOpacity
                  key={option.id}
                  style={[
                    styles.statusOption,
                    { borderColor: active ? C.primary : C.border, backgroundColor: active ? C.primaryLight + '24' : C.inputBg },
                  ]}
                  onPress={() => handleSelectStatus(option.mood)}
                  activeOpacity={0.84}
                >
                  {preview ? (
                    <Image source={getCharacterImageSource(preview)} style={styles.statusPreview} resizeMode="cover" />
                  ) : (
                    <Text style={[styles.statusOptionMark, { color: C.primary }]}>{option.mark}</Text>
                  )}
                  <View style={styles.statusOptionCopy}>
                    <Text style={[styles.statusOptionTitle, { color: C.text }]}>{option.label}</Text>
                    <Text style={[styles.statusOptionDetail, { color: C.textSecondary }]} numberOfLines={1}>
                      {option.detail}
                    </Text>
                  </View>
                  <Text style={[styles.statusOptionCheck, { color: active ? C.primary : C.textSecondary }]}>
                    {active ? '✓' : option.mark}
                  </Text>
                </TouchableOpacity>
              );
            })}
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
  spaceSingleImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    zIndex: 3,
  },
  spaceCharacterFallback: {
    position: 'absolute',
    top: '36%',
    left: 0,
    right: 0,
    zIndex: 2,
    textAlign: 'center',
    fontSize: 96,
  },
  spaceShade: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 4,
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
  urbanIdentityPill: {
    borderRadius: 12,
    paddingVertical: 7,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
  },
  softIdentityPill: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 18,
    borderBottomRightRadius: 26,
    borderBottomLeftRadius: 14,
    transform: [{ rotate: '-1deg' }],
  },
  identityAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  identityAvatarWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.72)',
  },
  identityAvatarImage: {
    ...StyleSheet.absoluteFillObject,
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
    fontFamily: NOTO_SERIF_SC.bold,
    fontSize: 14,
  },
  identityMeta: {
    fontFamily: NOTO_SERIF_SC.regular,
    fontSize: 11,
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
  urbanGlassIconBtn: {
    borderRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
  },
  softGlassIconBtn: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 14,
    borderBottomRightRadius: 22,
    borderBottomLeftRadius: 14,
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
  urbanArrowBtn: {
    width: 42,
    height: 42,
    borderRadius: 10,
  },
  softArrowBtn: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 14,
    borderBottomRightRadius: 24,
    borderBottomLeftRadius: 14,
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
  urbanGreetingCard: {
    borderRadius: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: StyleSheet.hairlineWidth,
    paddingTop: 18,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
  },
  softGreetingCard: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 22,
    borderBottomRightRadius: 34,
    borderBottomLeftRadius: 18,
    transform: [{ rotate: '-0.4deg' }],
  },
  greetingHeaderRow: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  greetingCompactHeader: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  collapsePanelBtn: {
    minHeight: 26,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  collapsePanelText: {
    fontFamily: NOTO_SERIF_SC.black,
    fontSize: 11,
    lineHeight: 15,
  },
  expandPanelBtn: {
    alignSelf: 'center',
    minHeight: 40,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
  },
  expandPanelText: {
    fontFamily: NOTO_SERIF_SC.black,
    fontSize: 13,
    lineHeight: 18,
  },
  greetingEyebrow: {
    fontFamily: NOTO_SERIF_SC.black,
    fontSize: 11,
    letterSpacing: 1.2,
  },
  greetingTitle: {
    fontFamily: NOTO_SERIF_SC.black,
    flexShrink: 1,
    fontSize: 27,
    lineHeight: 31,
  },
  greetingCopy: {
    fontFamily: NOTO_SERIF_SC.regular,
    fontSize: 14,
    lineHeight: 21,
  },
  statusPanel: {
    marginTop: 4,
    gap: 8,
  },
  statusSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  statusValue: {
    fontFamily: NOTO_SERIF_SC.bold,
    fontSize: 13,
  },
  intimacyLabel: {
    fontFamily: NOTO_SERIF_SC.black,
    flexShrink: 0,
    fontSize: 13,
    lineHeight: 18,
  },
  statusSelector: {
    flexShrink: 0,
    minHeight: 28,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressTrack: {
    height: 18,
    justifyContent: 'center',
    position: 'relative',
  },
  progressRail: {
    height: 4,
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  progressHeart: {
    position: 'absolute',
    top: 0,
    width: 18,
    height: 18,
    marginLeft: -9,
    borderRadius: 9,
    borderWidth: StyleSheet.hairlineWidth,
    textAlign: 'center',
    lineHeight: 17,
    fontFamily: NOTO_SERIF_SC.black,
    fontSize: 12,
    overflow: 'hidden',
    zIndex: 2,
  },
  contextActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 2,
  },
  contextActionPill: {
    minHeight: 30,
    minWidth: 76,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contextActionText: {
    fontFamily: NOTO_SERIF_SC.black,
    fontSize: 12,
    lineHeight: 16,
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
  urbanPrimaryBtn: {
    minHeight: 54,
    borderRadius: 14,
  },
  softPrimaryBtn: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 20,
    borderBottomRightRadius: 30,
    borderBottomLeftRadius: 20,
    transform: [{ rotate: '0.3deg' }],
  },
  spacePrimaryText: {
    fontFamily: NOTO_SERIF_SC.black,
    color: '#fff',
    fontSize: 17,
  },
  spacePrimaryIcon: {
    color: '#fff',
    fontSize: 18,
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
  statusModalContent: {
    width: '86%',
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 18,
  },
  statusModalLead: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: -10,
    marginBottom: 14,
  },
  statusOption: {
    minHeight: 66,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 8,
    marginBottom: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusPreview: {
    width: 48,
    height: 48,
    borderRadius: 13,
  },
  statusOptionMark: {
    width: 48,
    height: 48,
    borderRadius: 13,
    textAlign: 'center',
    lineHeight: 48,
    fontSize: 20,
    fontWeight: '900',
  },
  statusOptionCopy: {
    flex: 1,
    minWidth: 0,
  },
  statusOptionTitle: {
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 3,
  },
  statusOptionDetail: {
    fontSize: 12,
    lineHeight: 16,
  },
  statusOptionCheck: {
    width: 24,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '900',
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
