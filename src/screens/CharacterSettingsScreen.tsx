import React, { useEffect, useRef, useState } from 'react';
import {
  Image,
  ImageSourcePropType,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { format } from 'date-fns';
import { Character, CharacterDiary, RootStackParamList } from '../types';
import { useChatStore } from '../store/chatStore';
import { useSettingsStore } from '../store/settingsStore';
import { useThemeColors } from '../utils/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'CharacterSettings'>;
type PageKey = 'profile' | 'memory' | 'anniversary' | 'diary';

const MOOD_TO_LABEL: Record<string, string> = {
  happy: '开心',
  sad: '有点低落',
  excited: '很有精神',
  tired: '低电量',
  angry: '有点别扭',
  neutral: '安静陪着你',
};

function getImageSource(imageUri: Character['imageUri']): ImageSourcePropType | undefined {
  if (!imageUri) return undefined;
  return typeof imageUri === 'string' ? { uri: imageUri } : imageUri;
}

function getMainImage(character: Character): Character['imageUri'] {
  return character.assetSet?.main ?? character.imageUri;
}

function getAvatarImage(character: Character): Character['imageUri'] {
  return character.assetSet?.avatar ?? getMainImage(character);
}

function MetricPill({ label, value, color }: { label: string; value: number; color: string }) {
  const C = useThemeColors();
  const normalized = Math.min(100, Math.max(0, value));

  return (
    <View style={[styles.metricPill, { backgroundColor: C.surface + 'E8', borderColor: C.border }]}>
      <View style={styles.metricHeader}>
        <Text style={[styles.metricLabel, { color: C.textSecondary }]}>{label}</Text>
        <Text style={[styles.metricValue, { color }]}>{normalized}%</Text>
      </View>
      <View style={[styles.metricTrack, { backgroundColor: C.border }]}>
        <View style={[styles.metricFill, { width: `${normalized}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  const C = useThemeColors();
  return (
    <View style={[styles.infoRow, { borderBottomColor: C.border }]}>
      <Text style={[styles.infoLabel, { color: C.textSecondary }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: C.text }]}>{value}</Text>
    </View>
  );
}

export default function CharacterSettingsScreen({ route, navigation }: Props) {
  const { characterId } = route.params;
  const C = useThemeColors();
  const { width } = useWindowDimensions();
  const pagerRef = useRef<ScrollView>(null);

  const { getCharacter } = useChatStore();
  const isAdmin = useSettingsStore((s) => s.settings.appMode === 'admin');
  const setSelectedCharacter = useSettingsStore((s) => s.setSelectedCharacter);
  const character = getCharacter(characterId);
  const [pageIndex, setPageIndex] = useState(0);

  useEffect(() => {
    setSelectedCharacter(characterId);
  }, [characterId, setSelectedCharacter]);

  if (!character) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: C.background }]}>
        <Text style={[styles.missingText, { color: C.textSecondary }]}>角色未找到</Text>
      </SafeAreaView>
    );
  }

  const pages: { key: PageKey; label: string }[] = [
    { key: 'profile', label: '档案' },
    { key: 'memory', label: '记忆' },
    { key: 'anniversary', label: '纪念日' },
    ...(isAdmin ? [{ key: 'diary' as const, label: '日记' }] : []),
  ];

  const emotion = character.emotionalState;
  const moodLabel = MOOD_TO_LABEL[emotion?.mood ?? 'neutral'] ?? '安静陪着你';
  const moodValue = emotion?.mood === 'happy' ? 85 : emotion?.mood === 'tired' ? 38 : 62;
  const intimacyValue = emotion?.intimacy ?? 50;
  const energyValue = emotion?.energy ?? 50;
  const mainImage = getMainImage(character);
  const avatarImage = getAvatarImage(character);
  const pageWidth = width;
  const cardWidth = Math.max(0, width - 32);

  const scrollToPage = (nextIndex: number) => {
    const safeIndex = Math.max(0, Math.min(nextIndex, pages.length - 1));
    setPageIndex(safeIndex);
    pagerRef.current?.scrollTo({ x: safeIndex * pageWidth, animated: true });
  };

  const handleMomentumEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / pageWidth);
    setPageIndex(Math.max(0, Math.min(nextIndex, pages.length - 1)));
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: C.background }]} edges={['bottom']}>
      {mainImage && (
        <Image source={getImageSource(mainImage)} style={styles.backdropImage} resizeMode="cover" />
      )}
      <View style={[styles.backdropVeil, { backgroundColor: C.background + 'E8' }]} />

      <ScrollView
        contentContainerStyle={styles.shell}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.heroCard, { backgroundColor: C.surface + 'E8', borderColor: C.border }]}>
          <View style={styles.heroTop}>
            <View style={styles.avatarWrap}>
              {avatarImage ? (
                <Image source={getImageSource(avatarImage)} style={styles.avatarImage} resizeMode="cover" />
              ) : (
                <Text style={styles.avatarFallback}>{character.avatar}</Text>
              )}
            </View>

            <View style={styles.heroCopy}>
              <Text style={[styles.name, { color: C.text }]}>{character.name}</Text>
              <Text style={[styles.meta, { color: C.primary }]}>{moodLabel} · 亲密度 {intimacyValue}%</Text>
            </View>

            {isAdmin && (
              <TouchableOpacity
                style={[styles.editButton, { backgroundColor: C.primary }]}
                onPress={() => navigation.navigate('CharacterEditor', { characterId })}
              >
                <Text style={styles.editButtonText}>编辑</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.metrics}>
            <MetricPill label="心情" value={moodValue} color="#F76F98" />
            <MetricPill label="亲密" value={intimacyValue} color={C.primary} />
            <MetricPill label="活力" value={energyValue} color="#7FC9D8" />
          </View>
        </View>

        <View style={[styles.segmented, { backgroundColor: C.surface + 'E8', borderColor: C.border }]}>
          {pages.map((page, index) => (
            <TouchableOpacity
              key={page.key}
              style={[styles.segmentItem, pageIndex === index && { backgroundColor: C.primary }]}
              onPress={() => scrollToPage(index)}
            >
              <Text style={[styles.segmentText, { color: pageIndex === index ? '#fff' : C.textSecondary }]}>
                {page.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView
          ref={pagerRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleMomentumEnd}
          scrollEventThrottle={16}
          style={styles.pager}
        >
          {pages.map((page) => (
            <View key={page.key} style={[styles.page, { width: pageWidth }]}>
              <View style={[styles.pageCard, { width: cardWidth, backgroundColor: C.surface + 'F2', borderColor: C.border }]}>
                {page.key === 'profile' && <ProfilePage character={character} />}
                {page.key === 'memory' && <MemoryPage character={character} onOpenMemory={() => navigation.navigate('MemorySettings')} />}
                {page.key === 'anniversary' && <AnniversaryPage character={character} />}
                {page.key === 'diary' && <DiaryPage diaries={character.diaries ?? []} />}
              </View>
            </View>
          ))}
        </ScrollView>

        <View style={styles.pageDots}>
          {pages.map((page, index) => (
            <TouchableOpacity
              key={`${page.key}-dot`}
              onPress={() => scrollToPage(index)}
              style={[
                styles.pageDot,
                { backgroundColor: pageIndex === index ? C.primary : C.border },
                pageIndex === index && styles.pageDotActive,
              ]}
            />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ProfilePage({ character }: { character: Character }) {
  const C = useThemeColors();
  const profile = character.profile;
  return (
    <>
      <Text style={[styles.pageEyebrow, { color: C.primary }]}>Profile</Text>
      <Text style={[styles.pageTitle, { color: C.text }]}>关于她</Text>
      <Text style={[styles.pageLead, { color: C.textSecondary }]}>
        {profile?.backstory ?? character.greeting}
      </Text>

      <View style={[styles.infoGroup, { borderColor: C.border }]}>
        <InfoRow label="性格" value={character.personality} />
        <InfoRow label="兴趣" value={profile?.hobbies?.join('、') || '慢慢了解中'} />
        <InfoRow label="口头禅" value={profile?.catchphrases?.join('、') || character.greeting} />
        <InfoRow label="想靠近的方向" value={profile?.goals?.join('、') || '把日常变成你们之间的暗号'} />
      </View>
    </>
  );
}

function MemoryPage({ character, onOpenMemory }: { character: Character; onOpenMemory: () => void }) {
  const C = useThemeColors();
  const memories = (character.memories ?? []).slice().reverse().slice(0, 3);
  return (
    <>
      <Text style={[styles.pageEyebrow, { color: C.primary }]}>Memory</Text>
      <Text style={[styles.pageTitle, { color: C.text }]}>她记得的事</Text>
      <Text style={[styles.pageLead, { color: C.textSecondary }]}>
        这里不再像配置表，而是你们关系里留下来的片段。
      </Text>

      <View style={styles.memoryList}>
        {memories.length > 0 ? (
          memories.map((memory) => (
            <View key={memory.id} style={[styles.memoryChip, { backgroundColor: C.background, borderColor: C.border }]}>
              <Text style={[styles.memoryDate, { color: C.textSecondary }]}>{format(memory.timestamp, 'M月d日 HH:mm')}</Text>
              <Text style={[styles.memoryText, { color: C.text }]} numberOfLines={3}>{memory.content}</Text>
            </View>
          ))
        ) : (
          <View style={[styles.emptyPanel, { backgroundColor: C.background, borderColor: C.border }]}>
            <Text style={[styles.emptyTitle, { color: C.text }]}>还没有新的共同记忆</Text>
            <Text style={[styles.emptyText, { color: C.textSecondary }]}>先去聊一会儿，她会慢慢把小事收起来。</Text>
          </View>
        )}
      </View>

      <TouchableOpacity style={[styles.primaryButton, { backgroundColor: C.primary }]} onPress={onOpenMemory}>
        <Text style={styles.primaryButtonText}>打开记忆漫画</Text>
      </TouchableOpacity>
    </>
  );
}

function AnniversaryPage({ character }: { character: Character }) {
  const C = useThemeColors();
  const anniversaries = character.anniversaries ?? [];
  return (
    <>
      <Text style={[styles.pageEyebrow, { color: C.primary }]}>Anniversary</Text>
      <Text style={[styles.pageTitle, { color: C.text }]}>值得记住的日子</Text>
      <Text style={[styles.pageLead, { color: C.textSecondary }]}>
        关系不是靠大事件组成的，有些日期只是因为你们一起经历过。
      </Text>

      <View style={styles.memoryList}>
        {anniversaries.length > 0 ? (
          anniversaries.map((item) => (
            <View key={item.id} style={[styles.anniversaryCard, { backgroundColor: C.background, borderColor: C.border }]}>
              <Text style={[styles.anniversaryDate, { color: C.primary }]}>{item.date.replace(/-/g, '.')}</Text>
              <Text style={[styles.anniversaryTitle, { color: C.text }]}>{item.title}</Text>
            </View>
          ))
        ) : (
          <View style={[styles.emptyPanel, { backgroundColor: C.background, borderColor: C.border }]}>
            <Text style={[styles.emptyTitle, { color: C.text }]}>还没有纪念日</Text>
            <Text style={[styles.emptyText, { color: C.textSecondary }]}>以后可以把生日、第一次聊天、某个夜晚都放进来。</Text>
          </View>
        )}
      </View>
    </>
  );
}

function DiaryPage({ diaries }: { diaries: CharacterDiary[] }) {
  const C = useThemeColors();
  const recent = diaries.slice().sort((a, b) => b.timestamp - a.timestamp).slice(0, 3);
  return (
    <>
      <Text style={[styles.pageEyebrow, { color: C.primary }]}>Diary</Text>
      <Text style={[styles.pageTitle, { color: C.text }]}>她的日记</Text>
      <Text style={[styles.pageLead, { color: C.textSecondary }]}>内部可见，用来检查长期记忆有没有稳定沉淀。</Text>

      <View style={styles.memoryList}>
        {recent.length > 0 ? (
          recent.map((diary) => (
            <View key={diary.id} style={[styles.memoryChip, { backgroundColor: C.background, borderColor: C.border }]}>
              <Text style={[styles.memoryDate, { color: C.textSecondary }]}>{format(diary.timestamp, 'yyyy-MM-dd HH:mm')}</Text>
              <Text style={[styles.memoryText, { color: C.text }]}>{diary.title}</Text>
              <Text style={[styles.emptyText, { color: C.textSecondary }]} numberOfLines={3}>{diary.content}</Text>
            </View>
          ))
        ) : (
          <View style={[styles.emptyPanel, { backgroundColor: C.background, borderColor: C.border }]}>
            <Text style={[styles.emptyTitle, { color: C.text }]}>暂无日记</Text>
            <Text style={[styles.emptyText, { color: C.textSecondary }]}>聊天后会自动生成。</Text>
          </View>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  missingText: {
    textAlign: 'center',
    marginTop: 40,
  },
  backdropImage: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.2,
  },
  backdropVeil: {
    ...StyleSheet.absoluteFillObject,
  },
  shell: {
    paddingTop: 14,
    paddingBottom: 28,
    gap: 14,
  },
  heroCard: {
    marginHorizontal: 16,
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 14,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarWrap: {
    width: 82,
    height: 82,
    borderRadius: 41,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    fontSize: 40,
    lineHeight: 82,
    textAlign: 'center',
  },
  heroCopy: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '900',
  },
  meta: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '800',
  },
  editButton: {
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  editButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
  },
  metrics: {
    flexDirection: 'row',
    gap: 8,
  },
  metricPill: {
    flex: 1,
    minWidth: 0,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    padding: 11,
  },
  metricHeader: {
    gap: 2,
    marginBottom: 8,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '800',
  },
  metricValue: {
    fontSize: 17,
    fontWeight: '900',
  },
  metricTrack: {
    height: 5,
    borderRadius: 999,
    overflow: 'hidden',
  },
  metricFill: {
    height: '100%',
    borderRadius: 999,
  },
  segmented: {
    marginHorizontal: 16,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 4,
    flexDirection: 'row',
    gap: 4,
  },
  segmentItem: {
    flex: 1,
    minHeight: 38,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '900',
  },
  pager: {
    flexGrow: 0,
  },
  page: {
    alignItems: 'center',
  },
  pageCard: {
    minHeight: 420,
    borderRadius: 30,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 20,
  },
  pageEyebrow: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  pageTitle: {
    fontSize: 27,
    lineHeight: 32,
    fontWeight: '900',
    marginBottom: 9,
  },
  pageLead: {
    fontSize: 15,
    lineHeight: 23,
    marginBottom: 16,
  },
  infoGroup: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  infoRow: {
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '800',
  },
  infoValue: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
  },
  memoryList: {
    gap: 10,
  },
  memoryChip: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    gap: 6,
  },
  memoryDate: {
    fontSize: 12,
    fontWeight: '800',
  },
  memoryText: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '700',
  },
  emptyPanel: {
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 18,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '900',
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 21,
  },
  primaryButton: {
    marginTop: 16,
    minHeight: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
  },
  anniversaryCard: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    gap: 4,
  },
  anniversaryDate: {
    fontSize: 13,
    fontWeight: '900',
  },
  anniversaryTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  pageDots: {
    flexDirection: 'row',
    alignSelf: 'center',
    gap: 7,
  },
  pageDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  pageDotActive: {
    width: 22,
  },
});
