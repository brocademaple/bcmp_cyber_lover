import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Image,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList, Character } from '../types';
import { useChatStore } from '../store/chatStore';
import { useThemeColors } from '../utils/theme';
import { format } from 'date-fns';

type Props = NativeStackScreenProps<RootStackParamList, 'CharacterSettings'>;
type TabType = 'profile' | 'memory' | 'anniversary';

const MOOD_TO_VALUE: Record<string, number> = {
  happy: 85,
  sad: 25,
  excited: 90,
  tired: 40,
  angry: 30,
  neutral: 50,
};

// 圆环进度条（横屏原型：心情值/亲密度/活力值）- 外圈灰色环 + 内层彩色弧
function CircularProgress({ value, label, color }: { value: number; label: string; color: string }) {
  const C = useThemeColors();
  const size = 72;
  const strokeWidth = 6;
  const normalized = Math.min(100, Math.max(0, value));

  return (
    <View style={landscapeStyles.progressItem}>
      <View style={[landscapeStyles.progressCircle, { width: size, height: size }]}>
        {/* 底环 */}
        <View
          style={[
            landscapeStyles.progressRing,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              borderWidth: strokeWidth,
              borderColor: C.border,
            },
          ]}
        />
        {/* 彩色弧：四象限顺时针从 12 点开始 */}
        <View style={[landscapeStyles.progressArcWrap, { width: size, height: size }]}>
          <View
            style={[
              landscapeStyles.progressArcQuarter,
              {
                width: size / 2,
                height: size / 2,
                left: size / 2,
                borderLeftWidth: strokeWidth,
                borderBottomWidth: strokeWidth,
                borderColor: color,
                opacity: (normalized >= 25 ? 1 : normalized / 25),
              },
            ]}
          />
          <View
            style={[
              landscapeStyles.progressArcQuarter,
              {
                width: size / 2,
                height: size / 2,
                left: size / 2,
                top: size / 2,
                borderLeftWidth: strokeWidth,
                borderTopWidth: strokeWidth,
                borderColor: color,
                opacity: (normalized >= 50 ? 1 : (normalized >= 25 ? (normalized - 25) / 25 : 0)),
              },
            ]}
          />
          <View
            style={[
              landscapeStyles.progressArcQuarter,
              {
                width: size / 2,
                height: size / 2,
                top: size / 2,
                borderRightWidth: strokeWidth,
                borderTopWidth: strokeWidth,
                borderColor: color,
                opacity: (normalized >= 75 ? 1 : (normalized >= 50 ? (normalized - 50) / 25 : 0)),
              },
            ]}
          />
          <View
            style={[
              landscapeStyles.progressArcQuarter,
              {
                width: size / 2,
                height: size / 2,
                borderRightWidth: strokeWidth,
                borderBottomWidth: strokeWidth,
                borderColor: color,
                opacity: (normalized >= 100 ? 1 : (normalized >= 75 ? (normalized - 75) / 25 : 0)),
              },
            ]}
          />
        </View>
        <View style={landscapeStyles.progressCenter}>
          <Text style={[landscapeStyles.progressValue, { color: C.text }]}>{normalized}</Text>
        </View>
      </View>
      <Text style={[landscapeStyles.progressLabel, { color: C.textSecondary }]}>
        {label} {normalized}/100
      </Text>
    </View>
  );
}

export default function CharacterSettingsScreen({ route, navigation }: Props) {
  const { characterId } = route.params;
  const C = useThemeColors();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const { getCharacter, addMemory, addAnniversary } = useChatStore();
  const character = getCharacter(characterId);

  const [activeTab, setActiveTab] = useState<TabType>('profile');
  const [memoryContent, setMemoryContent] = useState('');
  const [memoryTags, setMemoryTags] = useState('');
  const [memoryImportance, setMemoryImportance] = useState('5');
  const [annTitle, setAnnTitle] = useState('');
  const [annDate, setAnnDate] = useState('');

  if (!character) {
    navigation.goBack();
    return null;
  }

  const handleAddMemory = async () => {
    if (!memoryContent.trim()) {
      Alert.alert('提示', '请输入记忆内容');
      return;
    }
    const tags = memoryTags.split(',').map((t) => t.trim()).filter(Boolean);
    const importance = parseInt(memoryImportance, 10) || 5;
    await addMemory(characterId, memoryContent.trim(), tags, importance);
    setMemoryContent('');
    setMemoryTags('');
    setMemoryImportance('5');
    Alert.alert('成功', '记忆已添加');
  };

  const handleAddAnniversary = async () => {
    if (!annTitle.trim() || !annDate.trim()) {
      Alert.alert('提示', '请输入标题和日期');
      return;
    }
    await addAnniversary(characterId, annTitle.trim(), annDate.trim(), 'custom');
    setAnnTitle('');
    setAnnDate('');
    Alert.alert('成功', '纪念日已添加');
  };

  const emotion = character.emotionalState;
  const moodValue = emotion ? (MOOD_TO_VALUE[emotion.mood] ?? 50) : 50;
  const intimacyValue = emotion?.intimacy ?? 50;
  const energyValue = emotion?.energy ?? 50;

  if (isLandscape) {
    return (
      <SafeAreaView style={[landscapeStyles.container, { backgroundColor: C.background }]} edges={['top']}>
        <Text style={[landscapeStyles.pageTitle, { color: C.text }]}>角色设置</Text>

        <View style={landscapeStyles.mainRow}>
          {/* 左侧：角色人设图 */}
          <View style={[landscapeStyles.leftColumn, { backgroundColor: C.surface, borderColor: C.border }]}>
            {character.imageUri ? (
              <Image
                source={character.imageUri}
                style={landscapeStyles.characterImage}
                resizeMode="contain"
              />
            ) : (
              <View style={landscapeStyles.placeholderImage}>
                <Text style={[landscapeStyles.placeholderText, { color: C.textSecondary }]}>角色人设图</Text>
                <Text style={[landscapeStyles.avatarLarge, { color: C.textSecondary }]}>{character.avatar}</Text>
              </View>
            )}
          </View>

          {/* 右侧：姓名/性格/编辑 + 当前状态 + Tab + 内容 */}
          <View style={landscapeStyles.rightColumn}>
            {/* 姓名、性格、编辑 icon */}
            <View style={landscapeStyles.basicInfoRow}>
              <Text style={[landscapeStyles.basicLabel, { color: C.text }]}>姓名: {character.name}</Text>
              <Text style={[landscapeStyles.basicLabel, { color: C.text }]}>性格: {character.personality}</Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('CharacterEditor', { characterId })}
                style={[landscapeStyles.editIconBtn, { backgroundColor: C.primary }]}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Text style={landscapeStyles.editIconText}>✏️</Text>
              </TouchableOpacity>
            </View>

            {/* 当前状态：三个圆环 */}
            <Text style={[landscapeStyles.sectionTitle, { color: C.text }]}>当前状态</Text>
            <View style={landscapeStyles.statusRow}>
              <CircularProgress value={moodValue} label="心情值" color="#7BC67E" />
              <CircularProgress value={intimacyValue} label="亲密度" color="#F48FB1" />
              <CircularProgress value={energyValue} label="活力值" color="#81D4FA" />
            </View>

            {/* Tab：角色档案 | 记忆匣 | 特别日期 */}
            <View style={[landscapeStyles.tabRow, { borderBottomColor: C.border }]}>
              {(
                [
                  { key: 'profile' as const, label: '角色档案' },
                  { key: 'memory' as const, label: '记忆匣' },
                  { key: 'anniversary' as const, label: '特别日期' },
                ] as const
              ).map(({ key, label }) => (
                <TouchableOpacity
                  key={key}
                  onPress={() => setActiveTab(key)}
                  style={[
                    landscapeStyles.tabItem,
                    activeTab === key && { backgroundColor: C.primary },
                  ]}
                >
                  <View
                    style={[
                      landscapeStyles.tabCircle,
                      { borderColor: C.text, backgroundColor: activeTab === key ? C.primary : 'transparent' },
                    ]}
                  />
                  <Text style={[landscapeStyles.tabLabel, { color: activeTab === key ? '#fff' : C.text }]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* 内容区 */}
            <ScrollView
              style={landscapeStyles.contentScroll}
              contentContainerStyle={landscapeStyles.contentScrollInner}
              showsVerticalScrollIndicator={false}
            >
              {activeTab === 'profile' && character.profile && (
                <View style={landscapeStyles.profileContent}>
                  <View style={[landscapeStyles.fieldBlock, { borderBottomColor: C.border }]}>
                    <Text style={[landscapeStyles.fieldLabel, { color: C.text }]}>背景故事</Text>
                    <Text style={[landscapeStyles.fieldValue, { color: C.textSecondary }]}>
                      {character.profile.backstory}
                    </Text>
                  </View>
                  <View style={[landscapeStyles.fieldBlock, { borderBottomColor: C.border }]}>
                    <Text style={[landscapeStyles.fieldLabel, { color: C.text }]}>兴趣爱好</Text>
                    <Text style={[landscapeStyles.fieldValue, { color: C.textSecondary }]}>
                      {character.profile.hobbies.join('、')}
                    </Text>
                  </View>
                  <View style={[landscapeStyles.fieldBlock, { borderBottomColor: C.border }]}>
                    <Text style={[landscapeStyles.fieldLabel, { color: C.text }]}>口头禅</Text>
                    <Text style={[landscapeStyles.fieldValue, { color: C.textSecondary }]}>
                      {character.profile.catchphrases.join('、')}
                    </Text>
                  </View>
                </View>
              )}

              {activeTab === 'memory' && (
                <View style={landscapeStyles.memoryContent}>
                  {/* 添加记忆 */}
                  <View style={[landscapeStyles.addBlock, { backgroundColor: C.surface, borderColor: C.border }]}>
                    <TextInput
                      style={[landscapeStyles.input, { color: C.text, borderColor: C.border }]}
                      placeholder="记忆内容（和谁一起、感觉...）"
                      placeholderTextColor={C.textSecondary}
                      value={memoryContent}
                      onChangeText={setMemoryContent}
                      multiline
                    />
                    <TouchableOpacity
                      style={[landscapeStyles.addBtn, { backgroundColor: C.primary }]}
                      onPress={handleAddMemory}
                    >
                      <Text style={landscapeStyles.addBtnText}>添加记忆</Text>
                    </TouchableOpacity>
                  </View>
                  {/* 记忆列表 */}
                  {(character.memories?.length ?? 0) > 0 ? (
                    character.memories!.slice().reverse().map((mem) => (
                      <View key={mem.id} style={[landscapeStyles.memoryItem, { borderBottomColor: C.border }]}>
                        <Text style={[landscapeStyles.memoryTime, { color: C.textSecondary }]}>
                          {format(mem.timestamp, 'yyyy年M月d日 H:mm')}:
                        </Text>
                        <Text style={[landscapeStyles.memoryText, { color: C.text }]}>
                          和伴侣一起 {mem.content}
                        </Text>
                        {mem.tags.length > 0 && (
                          <Text style={[landscapeStyles.memoryFeel, { color: C.textSecondary }]}>
                            感觉 {mem.tags.join('、')}
                          </Text>
                        )}
                      </View>
                    ))
                  ) : (
                    <Text style={[landscapeStyles.emptyHint, { color: C.textSecondary }]}>暂无记忆，添加一条吧</Text>
                  )}
                </View>
              )}

              {activeTab === 'anniversary' && (
                <View style={landscapeStyles.anniversaryContent}>
                  {/* 添加纪念日 */}
                  <View style={[landscapeStyles.addBlock, { backgroundColor: C.surface, borderColor: C.border }]}>
                    <TextInput
                      style={[landscapeStyles.input, { color: C.text, borderColor: C.border }]}
                      placeholder="标题（如：生日）"
                      placeholderTextColor={C.textSecondary}
                      value={annTitle}
                      onChangeText={setAnnTitle}
                    />
                    <TextInput
                      style={[landscapeStyles.input, { color: C.text, borderColor: C.border }]}
                      placeholder="日期 YYYY-MM-DD"
                      placeholderTextColor={C.textSecondary}
                      value={annDate}
                      onChangeText={setAnnDate}
                    />
                    <TouchableOpacity
                      style={[landscapeStyles.addBtn, { backgroundColor: C.primary }]}
                      onPress={handleAddAnniversary}
                    >
                      <Text style={landscapeStyles.addBtnText}>添加特别日期</Text>
                    </TouchableOpacity>
                  </View>
                  {/* 特别日期列表 */}
                  {(character.anniversaries?.length ?? 0) > 0 ? (
                    character.anniversaries!.map((a) => (
                      <View key={a.id} style={[landscapeStyles.anniversaryItem, { borderBottomColor: C.border }]}>
                        <Text style={[landscapeStyles.anniversaryDate, { color: C.text }]}>
                          {a.date.replace(/-/g, '/')} 是
                        </Text>
                        <Text style={[landscapeStyles.anniversaryTitle, { color: C.textSecondary }]}>{a.title}</Text>
                      </View>
                    ))
                  ) : (
                    <Text style={[landscapeStyles.emptyHint, { color: C.textSecondary }]}>暂无特别日期</Text>
                  )}
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // 竖屏：与原型一致 — 标题、姓名/性格/编辑、当前状态三圆环、Tab、内容区（人设图半透明垫底）
  return (
    <SafeAreaView style={[portraitStyles.container, { backgroundColor: C.background }]} edges={['top']}>
      <Text style={[portraitStyles.pageTitle, { color: C.text }]}>角色设置</Text>

      <View style={portraitStyles.topBlock}>
        <View style={portraitStyles.basicInfoRow}>
          <Text style={[portraitStyles.basicLabel, { color: C.text }]}>姓名: {character.name}</Text>
          <Text style={[portraitStyles.basicLabel, { color: C.text }]}>性格: {character.personality}</Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('CharacterEditor', { characterId })}
            style={[portraitStyles.editIconBtn, { backgroundColor: C.primary }]}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={portraitStyles.editIconText}>✏️</Text>
          </TouchableOpacity>
        </View>

        <Text style={[portraitStyles.sectionTitle, { color: C.text }]}>当前状态</Text>
        <View style={portraitStyles.statusRow}>
          <CircularProgress value={moodValue} label="心情值" color="#7BC67E" />
          <CircularProgress value={intimacyValue} label="亲密度" color="#F48FB1" />
          <CircularProgress value={energyValue} label="活力值" color="#81D4FA" />
        </View>

        <View style={[portraitStyles.tabRow, { borderBottomColor: C.border }]}>
          {(
            [
              { key: 'profile' as const, label: '角色档案' },
              { key: 'memory' as const, label: '记忆匣' },
              { key: 'anniversary' as const, label: '特别日期' },
            ] as const
          ).map(({ key, label }) => (
            <TouchableOpacity
              key={key}
              onPress={() => setActiveTab(key)}
              style={[portraitStyles.tabItem, activeTab === key && { backgroundColor: C.primary }]}
            >
              <View
                style={[
                  portraitStyles.tabCircle,
                  { borderColor: C.text, backgroundColor: activeTab === key ? C.primary : 'transparent' },
                ]}
              />
              <Text style={[portraitStyles.tabLabel, { color: activeTab === key ? '#fff' : C.text }]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* 内容区：角色人设图垫底作为背景、半透明 */}
      <View style={portraitStyles.contentWrap}>
        {character.imageUri && (
          <Image
            source={character.imageUri}
            style={portraitStyles.bgImage}
            resizeMode="cover"
          />
        )}
        <ScrollView
          style={portraitStyles.contentScroll}
          contentContainerStyle={portraitStyles.contentScrollInner}
          showsVerticalScrollIndicator={false}
        >
          {activeTab === 'profile' && character.profile && (
            <View style={portraitStyles.profileContent}>
              <View style={[portraitStyles.fieldBlock, { borderBottomColor: C.border }]}>
                <Text style={[portraitStyles.fieldLabel, { color: C.text }]}>背景故事</Text>
                <Text style={[portraitStyles.fieldValue, { color: C.textSecondary }]}>{character.profile.backstory}</Text>
              </View>
              <View style={[portraitStyles.fieldBlock, { borderBottomColor: C.border }]}>
                <Text style={[portraitStyles.fieldLabel, { color: C.text }]}>兴趣爱好</Text>
                <Text style={[portraitStyles.fieldValue, { color: C.textSecondary }]}>{character.profile.hobbies.join('、')}</Text>
              </View>
              <View style={[portraitStyles.fieldBlock, { borderBottomColor: C.border }]}>
                <Text style={[portraitStyles.fieldLabel, { color: C.text }]}>口头禅</Text>
                <Text style={[portraitStyles.fieldValue, { color: C.textSecondary }]}>{character.profile.catchphrases.join('、')}</Text>
              </View>
            </View>
          )}

          {activeTab === 'memory' && (
            <View style={portraitStyles.memoryContent}>
              <View style={[portraitStyles.addBlock, { backgroundColor: C.surface, borderColor: C.border }]}>
                <TextInput
                  style={[portraitStyles.input, { color: C.text, borderColor: C.border }]}
                  placeholder="记忆内容（和谁一起、感觉...）"
                  placeholderTextColor={C.textSecondary}
                  value={memoryContent}
                  onChangeText={setMemoryContent}
                  multiline
                />
                <TouchableOpacity style={[portraitStyles.addBtn, { backgroundColor: C.primary }]} onPress={handleAddMemory}>
                  <Text style={portraitStyles.addBtnText}>添加记忆</Text>
                </TouchableOpacity>
              </View>
              {(character.memories?.length ?? 0) > 0 ? (
                character.memories!.slice().reverse().map((mem) => (
                  <View key={mem.id} style={[portraitStyles.memoryItem, { borderBottomColor: C.border }]}>
                    <Text style={[portraitStyles.memoryTime, { color: C.textSecondary }]}>
                      {format(mem.timestamp, 'yyyy年M月d日 H:mm')}:
                    </Text>
                    <Text style={[portraitStyles.memoryText, { color: C.text }]}>和伴侣一起 {mem.content}</Text>
                    {mem.tags.length > 0 && (
                      <Text style={[portraitStyles.memoryFeel, { color: C.textSecondary }]}>感觉 {mem.tags.join('、')}</Text>
                    )}
                  </View>
                ))
              ) : (
                <Text style={[portraitStyles.emptyHint, { color: C.textSecondary }]}>暂无记忆，添加一条吧</Text>
              )}
            </View>
          )}

          {activeTab === 'anniversary' && (
            <View style={portraitStyles.anniversaryContent}>
              <View style={[portraitStyles.addBlock, { backgroundColor: C.surface, borderColor: C.border }]}>
                <TextInput
                  style={[portraitStyles.input, { color: C.text, borderColor: C.border }]}
                  placeholder="标题（如：生日）"
                  placeholderTextColor={C.textSecondary}
                  value={annTitle}
                  onChangeText={setAnnTitle}
                />
                <TextInput
                  style={[portraitStyles.input, { color: C.text, borderColor: C.border }]}
                  placeholder="日期 YYYY-MM-DD"
                  placeholderTextColor={C.textSecondary}
                  value={annDate}
                  onChangeText={setAnnDate}
                />
                <TouchableOpacity style={[portraitStyles.addBtn, { backgroundColor: C.primary }]} onPress={handleAddAnniversary}>
                  <Text style={portraitStyles.addBtnText}>添加特别日期</Text>
                </TouchableOpacity>
              </View>
              {(character.anniversaries?.length ?? 0) > 0 ? (
                character.anniversaries!.map((a) => (
                  <View key={a.id} style={[portraitStyles.anniversaryItem, { borderBottomColor: C.border }]}>
                    <Text style={[portraitStyles.anniversaryDate, { color: C.text }]}>{a.date.replace(/-/g, '/')} 是</Text>
                    <Text style={[portraitStyles.anniversaryTitle, { color: C.textSecondary }]}>{a.title}</Text>
                  </View>
                ))
              ) : (
                <Text style={[portraitStyles.emptyHint, { color: C.textSecondary }]}>暂无特别日期</Text>
              )}
            </View>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

// 横屏样式
const landscapeStyles = StyleSheet.create({
  container: { flex: 1 },
  pageTitle: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  mainRow: {
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: 16,
  },
  leftColumn: {
    width: '32%',
    minWidth: 200,
    marginRight: 16,
    borderRadius: 16,
    borderWidth: 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  characterImage: {
    width: '100%',
    height: '100%',
  },
  placeholderImage: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  placeholderText: { fontSize: 14, marginBottom: 8 },
  avatarLarge: { fontSize: 64 },
  rightColumn: {
    flex: 1,
    minWidth: 0,
  },
  basicInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 16,
  },
  basicLabel: { fontSize: 16 },
  editIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 'auto',
  },
  editIconText: { fontSize: 18 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingVertical: 8,
  },
  progressItem: { alignItems: 'center' },
  progressCircle: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  progressRing: { position: 'absolute' },
  progressArcWrap: {
    position: 'absolute',
    overflow: 'hidden',
  },
  progressArcQuarter: {
    position: 'absolute',
    borderRadius: 100,
    backgroundColor: 'transparent',
  },
  progressCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressValue: { fontSize: 18, fontWeight: '700' },
  progressLabel: { fontSize: 12, marginTop: 4 },
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: 8,
    marginBottom: 12,
    gap: 8,
  },
  tabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 6,
  },
  tabCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
  },
  tabLabel: { fontSize: 15, fontWeight: '500' },
  contentScroll: { flex: 1 },
  contentScrollInner: { paddingBottom: 24 },
  profileContent: {},
  fieldBlock: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  fieldLabel: { fontSize: 14, fontWeight: '600', marginBottom: 4 },
  fieldValue: { fontSize: 14, lineHeight: 20 },
  memoryContent: {},
  addBlock: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    fontSize: 14,
  },
  addBtn: {
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  addBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  memoryItem: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  memoryTime: { fontSize: 12, marginBottom: 4 },
  memoryText: { fontSize: 14, marginBottom: 2 },
  memoryFeel: { fontSize: 12 },
  anniversaryContent: {},
  anniversaryItem: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  anniversaryDate: { fontSize: 15, fontWeight: '600' },
  anniversaryTitle: { fontSize: 14 },
  emptyHint: { fontSize: 14, paddingVertical: 24, textAlign: 'center' },
});

// 竖屏样式（与竖屏原型一致，内容区人设图半透明垫底）
const portraitStyles = StyleSheet.create({
  container: { flex: 1 },
  pageTitle: { fontSize: 22, fontWeight: '700', textAlign: 'center', marginBottom: 12, marginTop: 8 },
  topBlock: { paddingHorizontal: 16, paddingBottom: 12 },
  basicInfoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 12 },
  basicLabel: { fontSize: 16 },
  editIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 'auto',
  },
  editIconText: { fontSize: 18 },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 10 },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingVertical: 8,
  },
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: 8,
    marginBottom: 0,
    gap: 8,
  },
  tabItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, gap: 6 },
  tabCircle: { width: 20, height: 20, borderRadius: 10, borderWidth: 2 },
  tabLabel: { fontSize: 15, fontWeight: '500' },
  contentWrap: {
    flex: 1,
    position: 'relative',
    minHeight: 200,
  },
  bgImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.25,
  },
  contentScroll: { flex: 1 },
  contentScrollInner: { padding: 16, paddingBottom: 32 },
  profileContent: {},
  fieldBlock: { paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  fieldLabel: { fontSize: 14, fontWeight: '600', marginBottom: 4 },
  fieldValue: { fontSize: 14, lineHeight: 20 },
  memoryContent: {},
  addBlock: { padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 16 },
  input: { borderWidth: 1, borderRadius: 8, padding: 10, marginBottom: 8, fontSize: 14 },
  addBtn: { paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  addBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  memoryItem: { paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  memoryTime: { fontSize: 12, marginBottom: 4 },
  memoryText: { fontSize: 14, marginBottom: 2 },
  memoryFeel: { fontSize: 12 },
  anniversaryContent: {},
  anniversaryItem: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  anniversaryDate: { fontSize: 15, fontWeight: '600' },
  anniversaryTitle: { fontSize: 14 },
  emptyHint: { fontSize: 14, paddingVertical: 24, textAlign: 'center' },
});
