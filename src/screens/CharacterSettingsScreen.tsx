import React, { useEffect, useRef, useState } from 'react';
import {
  Image,
  ImageSourcePropType,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { format } from 'date-fns';
import { Character, CharacterDiary, ChatArchive, Message, RootStackParamList } from '../types';
import { useChatStore } from '../store/chatStore';
import { useSettingsStore } from '../store/settingsStore';
import { NOTO_SANS_SC, NOTO_SERIF_SC } from '../utils/appFonts';
import { useThemeColors } from '../utils/theme';
import { filterByDate, getDateKey, MessageSearchRole, searchMessages } from '../utils/chatHistory';
import {
  deriveRelationshipStage,
  RELATIONSHIP_STAGE_LABELS,
} from '../services/relationshipTimelineService';

type Props = NativeStackScreenProps<RootStackParamList, 'CharacterSettings'>;
type PageKey = 'profile' | 'memory' | 'timeline' | 'archive' | 'anniversary' | 'diary';
const PAGE_ORDER: PageKey[] = ['profile', 'memory', 'timeline', 'archive', 'anniversary', 'diary'];

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

  const { archives, messages, getCharacter, loadMessages } = useChatStore();
  const isAdmin = useSettingsStore((s) => s.settings.appMode === 'admin');
  const setSelectedCharacter = useSettingsStore((s) => s.setSelectedCharacter);
  const character = getCharacter(characterId);
  const [pageIndex, setPageIndex] = useState(() => {
    const initialPage = route.params.initialPage;
    const index = initialPage ? PAGE_ORDER.indexOf(initialPage) : 0;
    return index >= 0 ? index : 0;
  });

  useEffect(() => {
    setSelectedCharacter(characterId);
    loadMessages(characterId);
  }, [characterId, loadMessages, setSelectedCharacter]);

  useEffect(() => {
    if (pageIndex <= 0) return;
    requestAnimationFrame(() => {
      pagerRef.current?.scrollTo({ x: pageIndex * width, animated: false });
    });
  }, [pageIndex, width]);

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
    { key: 'timeline', label: '关系' },
    { key: 'archive', label: '留档' },
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
  const characterArchives = archives[characterId] ?? [];
  const characterMessages = messages[characterId] ?? [];
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
                {page.key === 'memory' && <MemoryPage character={character} onOpenMemory={() => navigation.navigate('MemorySettings', { characterId })} />}
                {page.key === 'timeline' && <TimelinePage character={character} />}
                {page.key === 'archive' && <ArchivePage archives={characterArchives} messages={characterMessages} />}
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

function ArchivePage({ archives, messages }: { archives: ChatArchive[]; messages: Message[] }) {
  const C = useThemeColors();
  const [selectedArchiveId, setSelectedArchiveId] = useState<string | null>(archives[0]?.id ?? null);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<MessageSearchRole>('all');
  const hasSearch = searchQuery.trim().length > 0 || roleFilter !== 'all';
  const validMessages = messages.filter((message) => message.status !== 'failed');
  const searchResults = searchMessages(validMessages, searchQuery, roleFilter);
  const hitDateKeys = new Set(searchResults.map((message) => getDateKey(message.timestamp)));
  const visibleArchives = hasSearch
    ? archives.filter((archive) => hitDateKeys.has(archive.dateKey))
    : archives;
  const selectedArchive = selectedArchiveId
    ? archives.find((archive) => archive.id === selectedArchiveId)
    : hasSearch
      ? undefined
      : archives[0];
  const selectedMessages = hasSearch
    ? selectedArchive
      ? filterByDate(searchResults, selectedArchive.dateKey)
      : searchResults
    : selectedArchive
      ? filterByDate(validMessages, selectedArchive.dateKey)
      : [];
  const roleOptions: { key: MessageSearchRole; label: string }[] = [
    { key: 'all', label: '全部' },
    { key: 'user', label: '只看你' },
    { key: 'assistant', label: '只看她' },
  ];

  useEffect(() => {
    if (!archives.length) {
      setSelectedArchiveId(null);
      return;
    }
    if (hasSearch) {
      if (selectedArchiveId && !visibleArchives.some((archive) => archive.id === selectedArchiveId)) {
        setSelectedArchiveId(null);
      }
      return;
    }
    if (!selectedArchiveId || !archives.some((archive) => archive.id === selectedArchiveId)) {
      setSelectedArchiveId(archives[0].id);
    }
  }, [archives, hasSearch, selectedArchiveId, visibleArchives]);

  return (
    <>
      <Text style={[styles.pageTitle, { color: C.text }]}>聊天留档</Text>
      <Text style={[styles.pageLead, { color: C.textSecondary }]}>
        按日期自动归档，也可以按关键词和发送方查找聊天记录。
      </Text>

      {archives.length > 0 ? (
        <>
          <View style={[styles.searchBox, { backgroundColor: C.background, borderColor: C.border }]}>
            <Text style={[styles.searchIcon, { color: C.textSecondary }]}>⌕</Text>
            <TextInput
              value={searchQuery}
              onChangeText={(value) => {
                setSearchQuery(value);
                setSelectedArchiveId(null);
              }}
              placeholder="搜索聊天记录"
              placeholderTextColor={C.textSecondary}
              style={[styles.searchInput, { color: C.text }]}
              returnKeyType="search"
            />
            {searchQuery.trim().length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearSearchButton}>
                <Text style={[styles.clearSearchText, { color: C.textSecondary }]}>×</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.roleFilterRow}>
            {roleOptions.map((option) => {
              const active = roleFilter === option.key;
              return (
                <TouchableOpacity
                  key={option.key}
                  style={[
                    styles.roleFilterChip,
                    {
                      backgroundColor: active ? C.primary : C.background,
                      borderColor: active ? C.primary : C.border,
                    },
                  ]}
                  onPress={() => {
                    setRoleFilter(option.key);
                    setSelectedArchiveId(null);
                  }}
                  activeOpacity={0.82}
                >
                  <Text style={[styles.roleFilterText, { color: active ? '#fff' : C.textSecondary }]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.archiveResultHeader}>
            <Text style={[styles.archiveResultCount, { color: C.textSecondary }]}>
              {hasSearch
                ? `找到 ${selectedMessages.length} 条 · ${visibleArchives.length} 天`
                : `共 ${archives.length} 天记录`}
            </Text>
            {hasSearch && (
              <View style={styles.archiveHeaderActions}>
                {selectedArchive && (
                  <TouchableOpacity onPress={() => setSelectedArchiveId(null)} activeOpacity={0.78}>
                    <Text style={[styles.archiveHeaderAction, { color: C.primary }]}>全部命中</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={() => {
                    setSearchQuery('');
                    setRoleFilter('all');
                    setSelectedArchiveId(archives[0]?.id ?? null);
                  }}
                  activeOpacity={0.78}
                >
                  <Text style={[styles.archiveHeaderAction, { color: C.primary }]}>清除筛选</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <View style={styles.archiveList}>
            {visibleArchives.map((archive) => {
              const active = selectedArchive?.id === archive.id;
              return (
                <TouchableOpacity
                  key={archive.id}
                  style={[
                    styles.archiveCard,
                    {
                      backgroundColor: active ? C.primary : C.background,
                      borderColor: active ? C.primary : C.border,
                    },
                  ]}
                  onPress={() => setSelectedArchiveId(archive.id)}
                  activeOpacity={0.82}
                >
                  <Text style={[styles.archiveDate, { color: active ? '#fff' : C.primary }]}>
                    {archive.dateKey.replace(/-/g, '.')}
                  </Text>
                  <Text style={[styles.archiveTitle, { color: active ? '#fff' : C.text }]} numberOfLines={1}>
                    {archive.title}
                  </Text>
                  <Text style={[styles.archiveMeta, { color: active ? 'rgba(255,255,255,0.84)' : C.textSecondary }]}>
                    {hasSearch
                      ? `${searchResults.filter((message) => getDateKey(message.timestamp) === archive.dateKey).length} 条命中`
                      : `${archive.messageCount} 条 · 你 ${archive.userMessageCount} / 她 ${archive.assistantMessageCount}`}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {selectedMessages.length > 0 ? (
            <View style={[styles.archiveDetail, { borderColor: C.border }]}>
              <Text style={[styles.archiveDetailTitle, { color: C.text }]}>
                {hasSearch
                  ? selectedArchive
                    ? `${selectedArchive.dateKey.replace(/-/g, '.')} 的命中记录`
                    : '全部命中记录'
                  : selectedArchive
                    ? `${format(selectedArchive.startedAt, 'yyyy-MM-dd HH:mm')} - ${format(selectedArchive.updatedAt, 'HH:mm')}`
                    : '聊天记录'}
              </Text>
              <View style={styles.archiveMessages}>
                {selectedMessages.map((message) => (
                  <View
                    key={message.id}
                    style={[
                      styles.archiveMessage,
                      { backgroundColor: message.role === 'user' ? C.primaryLight + '33' : C.background },
                    ]}
                  >
                    <Text style={[styles.archiveMessageMeta, { color: C.textSecondary }]}>
                      {message.role === 'user' ? '你' : '她'} · {format(message.timestamp, 'HH:mm')}
                    </Text>
                    <Text style={[styles.archiveMessageText, { color: C.text }]}>{message.content}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : (
            <View style={[styles.emptyPanel, { backgroundColor: C.background, borderColor: C.border }]}>
              <Text style={[styles.emptyTitle, { color: C.text }]}>没有找到匹配记录</Text>
              <Text style={[styles.emptyText, { color: C.textSecondary }]}>换个关键词，或切回全部发送方再试试。</Text>
            </View>
          )}
        </>
      ) : (
        <View style={[styles.emptyPanel, { backgroundColor: C.background, borderColor: C.border }]}>
          <Text style={[styles.emptyTitle, { color: C.text }]}>还没有聊天留档</Text>
          <Text style={[styles.emptyText, { color: C.textSecondary }]}>发出第一段有效消息后，这里会自动按日期生成归档。</Text>
        </View>
      )}
    </>
  );
}

function AnniversaryPage({ character }: { character: Character }) {
  const C = useThemeColors();
  const anniversaries = character.anniversaries ?? [];
  return (
    <>
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

function TimelinePage({ character }: { character: Character }) {
  const C = useThemeColors();
  const stage = character.relationshipStage ?? deriveRelationshipStage(character.emotionalState?.intimacy ?? 50);
  const events = (character.relationshipEvents ?? [])
    .slice()
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 20);

  return (
    <>
      <Text style={[styles.pageEyebrow, { color: C.primary }]}>当前章节 · {RELATIONSHIP_STAGE_LABELS[stage]}</Text>
      <Text style={[styles.pageTitle, { color: C.text }]}>你们的关系时间线</Text>
      <Text style={[styles.pageLead, { color: C.textSecondary }]}>这里只记录被确认的记忆、纪念日和关系章节。每个变化都能回到真实互动。</Text>

      <View style={styles.memoryList}>
        {events.length > 0 ? (
          events.map((event) => (
            <View key={event.id} style={[styles.memoryChip, { backgroundColor: C.background, borderColor: C.border }]}>
              <Text style={[styles.memoryDate, { color: C.textSecondary }]}>{format(event.timestamp, 'yyyy-MM-dd HH:mm')}</Text>
              <Text style={[styles.memoryText, { color: C.text }]}>{event.title}</Text>
              <Text style={[styles.emptyText, { color: C.textSecondary }]}>{event.detail}</Text>
              {event.verified && <Text style={[styles.archiveHeaderAction, { color: C.primary }]}>用户确认</Text>}
            </View>
          ))
        ) : (
          <View style={[styles.emptyPanel, { backgroundColor: C.background, borderColor: C.border }]}>
            <Text style={[styles.emptyTitle, { color: C.text }]}>关系正在开始</Text>
            <Text style={[styles.emptyText, { color: C.textSecondary }]}>确认第一条长期记忆、添加纪念日或进入新的亲密阶段后，会在这里形成时间线。</Text>
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
    fontFamily: NOTO_SERIF_SC.regular,
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
    fontFamily: NOTO_SERIF_SC.black,
    fontSize: 40,
    lineHeight: 82,
    textAlign: 'center',
  },
  heroCopy: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontFamily: NOTO_SERIF_SC.black,
    fontSize: 28,
    lineHeight: 32,
  },
  meta: {
    fontFamily: NOTO_SERIF_SC.bold,
    marginTop: 4,
    fontSize: 13,
  },
  editButton: {
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  editButtonText: {
    fontFamily: NOTO_SANS_SC.bold,
    color: '#fff',
    fontSize: 13,
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
    fontFamily: NOTO_SANS_SC.medium,
    fontSize: 11,
  },
  metricValue: {
    fontFamily: NOTO_SERIF_SC.black,
    fontSize: 17,
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
    fontFamily: NOTO_SERIF_SC.bold,
    fontSize: 13,
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
    fontFamily: NOTO_SANS_SC.bold,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  pageTitle: {
    fontFamily: NOTO_SERIF_SC.black,
    fontSize: 27,
    lineHeight: 32,
    marginBottom: 9,
  },
  pageLead: {
    fontFamily: NOTO_SERIF_SC.regular,
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
    fontFamily: NOTO_SANS_SC.medium,
    fontSize: 12,
  },
  infoValue: {
    fontFamily: NOTO_SERIF_SC.regular,
    fontSize: 15,
    lineHeight: 22,
  },
  memoryList: {
    gap: 10,
  },
  searchBox: {
    minHeight: 46,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  searchIcon: {
    fontFamily: NOTO_SERIF_SC.black,
    fontSize: 18,
    lineHeight: 22,
  },
  searchInput: {
    fontFamily: NOTO_SANS_SC.regular,
    flex: 1,
    minHeight: 42,
    paddingVertical: 8,
    fontSize: 15,
  },
  clearSearchButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearSearchText: {
    fontFamily: NOTO_SANS_SC.bold,
    fontSize: 22,
    lineHeight: 24,
  },
  roleFilterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  roleFilterChip: {
    minHeight: 34,
    borderRadius: 17,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleFilterText: {
    fontFamily: NOTO_SANS_SC.bold,
    fontSize: 12,
  },
  archiveResultHeader: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 8,
  },
  archiveResultCount: {
    fontFamily: NOTO_SANS_SC.medium,
    flex: 1,
    minWidth: 0,
    fontSize: 12,
  },
  archiveHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  archiveHeaderAction: {
    fontFamily: NOTO_SANS_SC.bold,
    fontSize: 12,
  },
  archiveList: {
    gap: 10,
    marginBottom: 14,
  },
  archiveCard: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    gap: 5,
  },
  archiveDate: {
    fontFamily: NOTO_SERIF_SC.black,
    fontSize: 12,
  },
  archiveTitle: {
    fontFamily: NOTO_SERIF_SC.bold,
    fontSize: 16,
    lineHeight: 21,
  },
  archiveMeta: {
    fontFamily: NOTO_SANS_SC.medium,
    fontSize: 12,
  },
  archiveDetail: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 14,
    gap: 10,
  },
  archiveDetailTitle: {
    fontFamily: NOTO_SERIF_SC.bold,
    fontSize: 15,
    lineHeight: 20,
  },
  archiveMessages: {
    gap: 8,
  },
  archiveMessage: {
    borderRadius: 16,
    padding: 12,
    gap: 5,
  },
  archiveMessageMeta: {
    fontFamily: NOTO_SANS_SC.bold,
    fontSize: 11,
  },
  archiveMessageText: {
    fontFamily: NOTO_SERIF_SC.regular,
    fontSize: 14,
    lineHeight: 21,
  },
  memoryChip: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    gap: 6,
  },
  memoryDate: {
    fontFamily: NOTO_SANS_SC.medium,
    fontSize: 12,
  },
  memoryText: {
    fontFamily: NOTO_SERIF_SC.bold,
    fontSize: 15,
    lineHeight: 22,
  },
  emptyPanel: {
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 18,
    gap: 8,
  },
  emptyTitle: {
    fontFamily: NOTO_SERIF_SC.bold,
    fontSize: 17,
  },
  emptyText: {
    fontFamily: NOTO_SERIF_SC.regular,
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
    fontFamily: NOTO_SERIF_SC.black,
    color: '#fff',
    fontSize: 16,
  },
  anniversaryCard: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    gap: 4,
  },
  anniversaryDate: {
    fontFamily: NOTO_SERIF_SC.bold,
    fontSize: 13,
  },
  anniversaryTitle: {
    fontFamily: NOTO_SERIF_SC.bold,
    fontSize: 16,
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
