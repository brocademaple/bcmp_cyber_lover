import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  ImageSourcePropType,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Character,
  CharacterProfile,
  CharacterRevision,
  RelationshipRules,
  RootStackParamList,
} from '../types';
import { DEFAULT_CHARACTERS, hydrateDefaultCharacterAssets, useChatStore } from '../store/chatStore';
import { useSettingsStore } from '../store/settingsStore';
import { resolveDefaultCharacterAssetKey } from '../utils/characterAssets';
import { useThemeColors } from '../utils/theme';
import {
  applyCharacterDefinition,
  getCharacterDefinition,
  listCharacterRevisions,
  saveCharacterRevision,
} from '../services/characterVersionService';
import {
  auditCharacterDefinition,
  buildSimpleCharacterPrompt,
  createBlankCharacter,
} from '../services/characterStudioService';

type Props = NativeStackScreenProps<RootStackParamList, 'CharacterEditor'>;
type EditorMode = 'view' | 'editing' | 'preview';
type StudioDepth = 'simple' | 'expert';
type EditSectionKey =
  | 'all'
  | 'basic'
  | 'identity'
  | 'styleGuide'
  | 'behaviorBoundary'
  | 'hobbies'
  | 'catchphrases'
  | 'memoryTriggers'
  | 'affinityTriggers'
  | 'askMemoryStyle'
  | 'taboos'
  | 'goals'
  | 'promptSummary';

type EditableDraft = {
  name: string;
  personality: string;
  greeting: string;
  backstory: string;
  hobbies: string;
  catchphrases: string;
  taboos: string;
  goals: string;
  affinityTriggers: string;
  memoryTriggers: string;
  askMemoryStyle: string;
  systemPrompt: string;
};

const DEFAULT_CHARACTER_IDS = DEFAULT_CHARACTERS.map((character) => character.id);

const PROMPT_SECTION_LABELS = ['身份', '称呼与风格', '行为', '禁令'] as const;

const EDIT_SECTION_TITLES: Record<EditSectionKey, string> = {
  all: '完整设定',
  basic: '基础设定',
  identity: '身份定位',
  styleGuide: '说话方式',
  behaviorBoundary: '行为和边界',
  hobbies: '兴趣爱好',
  catchphrases: '口头禅',
  memoryTriggers: '记忆触发',
  affinityTriggers: '亲密触发',
  askMemoryStyle: '记忆询问语气',
  taboos: '边界和忌讳',
  goals: '陪伴目标',
  promptSummary: 'Prompt 摘要',
};

function getImageSource(imageUri: Character['imageUri']): ImageSourcePropType | undefined {
  if (!imageUri) return undefined;
  return typeof imageUri === 'string' ? { uri: imageUri } : imageUri;
}

function getMainImage(character: Character): Character['imageUri'] {
  const hydrated = hydrateDefaultCharacterAssets(character);
  return hydrated.assetSet?.main ?? hydrated.imageUri;
}

function getAvatarImage(character: Character): Character['imageUri'] {
  const hydrated = hydrateDefaultCharacterAssets(character);
  return hydrated.assetSet?.headshot ?? hydrated.assetSet?.avatar ?? getMainImage(hydrated);
}

function listToText(values?: string[]) {
  return values?.join('、') ?? '';
}

function textToList(value: string) {
  return value
    .split(/[、,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function splitTags(value?: string) {
  return textToList(value ?? '');
}

function makeDraft(character: Character): EditableDraft {
  const profile = character.profile;
  const relationshipRules = character.relationshipRules;
  return {
    name: character.name,
    personality: character.personality,
    greeting: character.greeting,
    backstory: profile?.backstory ?? '',
    hobbies: listToText(profile?.hobbies),
    catchphrases: listToText(profile?.catchphrases),
    taboos: listToText(profile?.taboos),
    goals: listToText(profile?.goals),
    affinityTriggers: listToText(relationshipRules?.affinityTriggers),
    memoryTriggers: listToText(relationshipRules?.memoryTriggers),
    askMemoryStyle: relationshipRules?.askMemoryStyle ?? '',
    systemPrompt: character.systemPrompt,
  };
}

function buildProfile(character: Character, draft: EditableDraft): CharacterProfile | undefined {
  const profile = character.profile;
  const nextProfile: CharacterProfile = {
    backstory: draft.backstory.trim(),
    hobbies: textToList(draft.hobbies),
    catchphrases: textToList(draft.catchphrases),
    taboos: textToList(draft.taboos),
    goals: textToList(draft.goals),
  };

  if (
    nextProfile.backstory ||
    nextProfile.hobbies.length ||
    nextProfile.catchphrases.length ||
    nextProfile.taboos.length ||
    nextProfile.goals.length ||
    profile
  ) {
    return nextProfile;
  }

  return undefined;
}

function buildRelationshipRules(character: Character, draft: EditableDraft): RelationshipRules | undefined {
  const original = character.relationshipRules;
  const nextRules: RelationshipRules = {
    affinityTriggers: textToList(draft.affinityTriggers),
    memoryTriggers: textToList(draft.memoryTriggers),
    askMemoryStyle: draft.askMemoryStyle.trim(),
  };

  if (
    nextRules.affinityTriggers.length ||
    nextRules.memoryTriggers.length ||
    nextRules.askMemoryStyle ||
    original
  ) {
    return nextRules;
  }

  return undefined;
}

function getPromptSection(systemPrompt: string, label: string) {
  const pattern = new RegExp(`【${label}】([\\s\\S]*?)(?=\\n【|$)`);
  return systemPrompt.match(pattern)?.[1]?.trim() ?? '';
}

function getPromptSummary(systemPrompt: string) {
  return PROMPT_SECTION_LABELS
    .map((label) => ({ label, text: getPromptSection(systemPrompt, label) }))
    .filter((item) => item.text);
}

function updatePromptSection(systemPrompt: string, label: string, nextText: string) {
  const marker = `【${label}】`;
  const pattern = new RegExp(`【${label}】[\\s\\S]*?(?=\\n【|$)`);
  const replacement = `${marker}${nextText.trim()}`;

  if (pattern.test(systemPrompt)) {
    return systemPrompt.replace(pattern, replacement);
  }

  return `${systemPrompt.trim()}\n${replacement}`.trim();
}

function getDraftChanges(character: Character, draft: EditableDraft) {
  const original = makeDraft(character);
  const labels: [keyof EditableDraft, string][] = [
    ['name', '名称'],
    ['personality', '性格标签'],
    ['greeting', '开场白'],
    ['backstory', '背景故事'],
    ['hobbies', '兴趣爱好'],
    ['catchphrases', '口头禅'],
    ['taboos', '边界和忌讳'],
    ['goals', '陪伴目标'],
    ['affinityTriggers', '亲密触发'],
    ['memoryTriggers', '记忆触发'],
    ['askMemoryStyle', '记忆询问语气'],
    ['systemPrompt', '系统人设规则'],
  ];

  return labels
    .filter(([key]) => original[key].trim() !== draft[key].trim())
    .map(([, label]) => label);
}

function getInitialSelectedCharacterId(characterId: string | undefined, selectedCharacterId: string) {
  if (characterId) return characterId;
  if (selectedCharacterId) return selectedCharacterId;
  return DEFAULT_CHARACTER_IDS[0] ?? 'qingning';
}

export default function CharacterEditorScreen({ route }: Props) {
  const C = useThemeColors();
  const { characterId } = route.params || {};
  const { characters, getCharacter, loadCharacters, saveCharacter } = useChatStore();
  const { settings, setSelectedCharacter, saveSettings } = useSettingsStore();
  const isAdmin = settings.appMode === 'admin';
  const initialId = getInitialSelectedCharacterId(characterId, settings.selectedCharacterId);

  const [selectedId, setSelectedId] = useState(initialId);
  const selectedCharacter = getCharacter(selectedId);
  const [mode, setMode] = useState<EditorMode>('view');
  const [studioDepth, setStudioDepth] = useState<StudioDepth>('simple');
  const [editingSection, setEditingSection] = useState<EditSectionKey>('all');
  const [draft, setDraft] = useState<EditableDraft>(() => makeDraft(selectedCharacter ?? DEFAULT_CHARACTERS[0]));
  const [dirty, setDirty] = useState(false);
  const [creatingCharacter, setCreatingCharacter] = useState<Character | null>(null);
  const [revisions, setRevisions] = useState<CharacterRevision[]>([]);

  useEffect(() => {
    loadCharacters();
  }, [loadCharacters]);

  const roster = useMemo(() => {
    const defaultsRoster = DEFAULT_CHARACTERS.map((defaults) => {
      const current =
        characters.find((character) => character.id === defaults.id) ??
        characters.find((character) => resolveDefaultCharacterAssetKey(character) === defaults.id) ??
        defaults;
      return hydrateDefaultCharacterAssets(current);
    });
    const customRoster = characters.filter((character) => !resolveDefaultCharacterAssetKey(character));
    return [...defaultsRoster, ...customRoster];
  }, [characters]);

  const activeCharacter = creatingCharacter?.id === selectedId
    ? creatingCharacter
    : selectedCharacter
      ? hydrateDefaultCharacterAssets(selectedCharacter)
      : roster[0] ?? DEFAULT_CHARACTERS[0];
  const activeMainImage = getMainImage(activeCharacter);
  const changeList = getDraftChanges(activeCharacter, draft);
  const promptSummary = getPromptSummary(activeCharacter.systemPrompt);
  const draftPromptSummary = getPromptSummary(draft.systemPrompt);

  useEffect(() => {
    if (creatingCharacter?.id === selectedId) return;
    const current = getCharacter(selectedId) ?? DEFAULT_CHARACTERS.find((character) => character.id === selectedId);
    if (!current) return;
    setDraft(makeDraft(hydrateDefaultCharacterAssets(current)));
    setDirty(false);
    setEditingSection('all');
    setMode('view');
  }, [creatingCharacter, getCharacter, selectedId]);

  useEffect(() => {
    if (creatingCharacter?.id === activeCharacter.id) {
      setRevisions([]);
      return;
    }
    listCharacterRevisions(activeCharacter.id).then(setRevisions);
  }, [activeCharacter.id, creatingCharacter]);

  const resetDraftFromCharacter = (character: Character) => {
    setDraft(makeDraft(hydrateDefaultCharacterAssets(character)));
    setDirty(false);
  };

  const updateDraft = (updates: Partial<EditableDraft>) => {
    setDraft((current) => ({ ...current, ...updates }));
    setDirty(true);
  };

  const selectCharacter = (nextId: string) => {
    if (!dirty) {
      setCreatingCharacter(null);
      setSelectedId(nextId);
      return;
    }

    Alert.alert('切换角色', '当前草稿还没有应用，切换后会放弃这些改动。', [
      { text: '继续编辑', style: 'cancel' },
      {
        text: '放弃并切换',
        style: 'destructive',
        onPress: () => {
          setCreatingCharacter(null);
          setSelectedId(nextId);
        },
      },
    ]);
  };

  const enterEditing = (section: EditSectionKey = 'all') => {
    resetDraftFromCharacter(activeCharacter);
    setEditingSection(section);
    setStudioDepth(section === 'all' ? 'simple' : 'expert');
    setMode('editing');
  };

  const startCreating = () => {
    const next = createBlankCharacter();
    setCreatingCharacter(next);
    setSelectedId(next.id);
    setDraft(makeDraft(next));
    setDirty(true);
    setEditingSection('all');
    setStudioDepth('simple');
    setMode('editing');
  };

  const discardDraft = () => {
    if (!dirty) {
      resetDraftFromCharacter(activeCharacter);
      setEditingSection('all');
      setMode('view');
      return;
    }

    Alert.alert('放弃草稿', '草稿还没有应用到角色，放弃后不会改写任何本地数据。', [
      { text: '继续编辑', style: 'cancel' },
      {
        text: '放弃',
        style: 'destructive',
        onPress: () => {
          resetDraftFromCharacter(activeCharacter);
          setEditingSection('all');
          setMode('view');
        },
      },
    ]);
  };

  const restoreDefaultCopy = () => {
    const selectedAssetKey = resolveDefaultCharacterAssetKey(selectedId);
    const defaults = DEFAULT_CHARACTERS.find((character) => character.id === selectedAssetKey);
    if (!defaults) {
      Alert.alert('没有系统默认版本', '自定义角色可以从“角色版本”回退到之前保存的人设。');
      return;
    }

    Alert.alert('恢复默认文案', `将 ${defaults.name} 的人设文案恢复为系统默认。预览确认前不会写入本地数据。`, [
      { text: '取消', style: 'cancel' },
      {
        text: '恢复到草稿',
        onPress: () => {
          setDraft(makeDraft(defaults));
          setDirty(true);
          setEditingSection('all');
          setMode('editing');
        },
      },
    ]);
  };

  const previewDraft = () => {
    if (!draft.name.trim()) {
      Alert.alert('提示', '角色名称不能为空');
      return;
    }
    if (!draft.greeting.trim()) {
      Alert.alert('提示', '开场白不能为空');
      return;
    }
    const nextDraft = studioDepth === 'simple'
      ? {
          ...draft,
          systemPrompt: buildSimpleCharacterPrompt({
            name: draft.name.trim(),
            personality: draft.personality.trim(),
            backstory: draft.backstory.trim(),
            catchphrases: textToList(draft.catchphrases),
            taboos: textToList(draft.taboos),
            goals: textToList(draft.goals),
          }),
        }
      : draft;
    if (!nextDraft.systemPrompt.trim()) {
      Alert.alert('提示', '人设规则不能为空');
      return;
    }
    if (nextDraft !== draft) setDraft(nextDraft);
    setMode('preview');
  };

  const applyDraft = async () => {
    const isCreating = creatingCharacter?.id === activeCharacter.id;
    if (!isCreating) {
      await saveCharacterRevision(activeCharacter, '应用新设定前的自动备份');
    }
    const updated: Character = {
      ...activeCharacter,
      name: draft.name.trim(),
      personality: draft.personality.trim(),
      greeting: draft.greeting.trim(),
      systemPrompt: draft.systemPrompt.trim(),
      profile: buildProfile(activeCharacter, draft),
      relationshipRules: buildRelationshipRules(activeCharacter, draft),
      definitionVersion: isCreating ? 1 : (activeCharacter.definitionVersion ?? 1) + 1,
    };

    await saveCharacter(updated);
    setSelectedCharacter(updated.id);
    await saveSettings({
      ...useSettingsStore.getState().settings,
      selectedCharacterId: updated.id,
    });
    setDirty(false);
    setCreatingCharacter(null);
    setEditingSection('all');
    setMode('view');
    setRevisions(await listCharacterRevisions(updated.id));
    Alert.alert('已应用', `${updated.name} 的设定已经更新。`);
  };

  const restoreRevision = (revision: CharacterRevision) => {
    Alert.alert(
      '回退角色设定',
      `将人设回退到 v${revision.version}「${revision.label}」。聊天、记忆、日记和关系状态都会保留。`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确认回退',
          onPress: async () => {
            await saveCharacterRevision(activeCharacter, '回退前的自动备份');
            const restored = applyCharacterDefinition(activeCharacter, revision.definition, revision.version);
            await saveCharacter(restored);
            resetDraftFromCharacter(restored);
            setRevisions(await listCharacterRevisions(restored.id));
            Alert.alert('已回退', `${restored.name} 的角色设定已恢复，关系数据保持不变。`);
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: C.background }]} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Text style={[styles.screenEyebrow, { color: C.primary }]}>角色设定档案</Text>
            <Text style={[styles.screenTitle, { color: C.text }]}>先理解她，再调整她</Text>
            <Text style={[styles.screenLead, { color: C.textSecondary }]}>
              这里展示鹿芽、纪遥、凛夜当前真正参与聊天的人设。默认只读，草稿确认后才会写入本地角色。
            </Text>
          </View>

          <RosterRail
            characters={roster}
            selectedId={selectedId}
            onSelect={selectCharacter}
            onCreate={startCreating}
          />

          <ModePill mode={mode} dirty={dirty} />

          {mode === 'view' && (
            <>
              <ViewContent
                character={activeCharacter}
                mainImage={activeMainImage}
                promptSummary={promptSummary}
                onEdit={enterEditing}
              />
              <StudioAuditPanel character={activeCharacter} />
              <RevisionPanel revisions={revisions} onRestore={restoreRevision} />
            </>
          )}

          {mode === 'editing' && (
            <View style={styles.contentStack}>
              <StudioDepthSwitch value={studioDepth} onChange={setStudioDepth} />
              {studioDepth === 'simple' ? (
                <SimpleEditingContent
                  draft={draft}
                  onChange={updateDraft}
                  onPreview={previewDraft}
                  onCancel={discardDraft}
                  dirty={dirty}
                />
              ) : (
                <EditingContent
                  draft={draft}
                  isAdmin={isAdmin}
                  section={editingSection}
                  onChange={updateDraft}
                  onRestoreDefault={restoreDefaultCopy}
                  onPreview={previewDraft}
                  onCancel={discardDraft}
                  dirty={dirty}
                />
              )}
            </View>
          )}

          {mode === 'preview' && (
            <PreviewContent
              character={activeCharacter}
              draft={draft}
              changes={changeList}
              promptSummary={draftPromptSummary}
              onBackToEdit={() => setMode('editing')}
              onCancel={discardDraft}
              onApply={applyDraft}
            />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function RosterRail({
  characters,
  selectedId,
  onSelect,
  onCreate,
}: {
  characters: Character[];
  selectedId: string;
  onSelect: (id: string) => void;
  onCreate: () => void;
}) {
  const C = useThemeColors();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.roster}
    >
      {characters.map((character) => {
        const active = character.id === selectedId;
        const avatar = getAvatarImage(character);
        return (
          <TouchableOpacity
            key={character.id}
            style={[
              styles.characterCard,
              {
                backgroundColor: active ? C.primaryLight + '2E' : C.surface,
                borderColor: active ? C.primary : C.border,
                shadowColor: C.shadow,
              },
            ]}
            activeOpacity={0.84}
            onPress={() => onSelect(character.id)}
            accessibilityRole="button"
            accessibilityLabel={`查看${character.name}的人设档案`}
          >
            <View style={styles.cardImageWrap}>
              {avatar ? (
                <Image source={getImageSource(avatar)} style={styles.cardImage} resizeMode="cover" />
              ) : (
                <Text style={styles.cardFallback}>{character.avatar}</Text>
              )}
            </View>
            <Text style={[styles.cardName, { color: C.text }]} numberOfLines={1}>
              {character.name}
            </Text>
            <Text style={[styles.cardMeta, { color: active ? C.primary : C.textSecondary }]} numberOfLines={2}>
              {character.personality}
            </Text>
          </TouchableOpacity>
        );
      })}
      <TouchableOpacity
        style={[styles.characterCard, styles.createCharacterCard, { backgroundColor: C.surface, borderColor: C.primary }]}
        activeOpacity={0.84}
        onPress={onCreate}
        accessibilityRole="button"
        accessibilityLabel="创建新角色"
      >
        <View style={[styles.createCharacterIcon, { backgroundColor: C.primaryLight + '30' }]}>
          <Text style={[styles.createCharacterIconText, { color: C.primary }]}>＋</Text>
        </View>
        <Text style={[styles.cardName, { color: C.text }]}>创建角色</Text>
        <Text style={[styles.cardMeta, { color: C.textSecondary }]}>从简单模式开始</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function ModePill({ mode, dirty }: { mode: EditorMode; dirty: boolean }) {
  const C = useThemeColors();
  const labels: Record<EditorMode, string> = {
    view: '查看设定',
    editing: dirty ? '编辑草稿中' : '编辑草稿',
    preview: '草稿预览',
  };
  return (
    <View style={[styles.modePill, { backgroundColor: C.surface, borderColor: C.border }]}>
      <Text style={[styles.modePillText, { color: C.primary }]}>{labels[mode]}</Text>
    </View>
  );
}

function StudioDepthSwitch({ value, onChange }: { value: StudioDepth; onChange: (value: StudioDepth) => void }) {
  const C = useThemeColors();
  return (
    <View style={[styles.depthSwitch, { backgroundColor: C.surface, borderColor: C.border }]}>
      {([
        ['simple', '简单模式', '填写关系与性格，自动生成人设规则'],
        ['expert', '专家模式', '逐层编辑 Prompt、记忆和边界'],
      ] as const).map(([key, label, description]) => {
        const active = value === key;
        return (
          <TouchableOpacity
            key={key}
            style={[styles.depthOption, active && { backgroundColor: C.primary }]}
            onPress={() => onChange(key)}
            activeOpacity={0.82}
          >
            <Text style={[styles.depthLabel, { color: active ? '#fff' : C.text }]}>{label}</Text>
            <Text style={[styles.depthDescription, { color: active ? 'rgba(255,255,255,0.8)' : C.textSecondary }]}>{description}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function StudioAuditPanel({ character }: { character: Character }) {
  const C = useThemeColors();
  const audit = auditCharacterDefinition(getCharacterDefinition(character));
  return (
    <View style={[styles.auditPanel, { backgroundColor: C.surface, borderColor: C.border }]}>
      <View style={styles.auditHeader}>
        <View style={styles.auditHeaderCopy}>
          <Text style={[styles.sectionTitle, { color: C.text }]}>本地角色体检</Text>
          <Text style={[styles.bodyText, { color: C.textSecondary }]}>不调用 API，检查角色设定能否稳定进入长期陪伴链路。</Text>
        </View>
        <Text style={[styles.auditScore, { color: audit.ready ? C.primary : '#C87945' }]}>{audit.score}</Text>
      </View>
      <TagCluster values={audit.passed.slice(0, 6)} strong />
      {audit.issues.map((issue) => (
        <Text key={issue} style={[styles.auditIssue, { color: '#B85C5C' }]}>需要补充：{issue}</Text>
      ))}
    </View>
  );
}

function RevisionPanel({
  revisions,
  onRestore,
}: {
  revisions: CharacterRevision[];
  onRestore: (revision: CharacterRevision) => void;
}) {
  const C = useThemeColors();
  return (
    <View style={[styles.auditPanel, { backgroundColor: C.surface, borderColor: C.border }]}>
      <Text style={[styles.sectionTitle, { color: C.text }]}>角色版本</Text>
      <Text style={[styles.bodyText, { color: C.textSecondary }]}>每次应用新设定前都会自动保存旧版本。回退只修改人设，关系数据保持不变。</Text>
      {revisions.slice(0, 6).map((revision) => (
        <View key={revision.id} style={[styles.revisionRow, { borderTopColor: C.border }]}>
          <View style={styles.revisionCopy}>
            <Text style={[styles.revisionTitle, { color: C.text }]}>v{revision.version} · {revision.label}</Text>
            <Text style={[styles.revisionMeta, { color: C.textSecondary }]}>{new Date(revision.createdAt).toLocaleString('zh-CN')}</Text>
          </View>
          <TouchableOpacity style={[styles.revisionButton, { borderColor: C.border }]} onPress={() => onRestore(revision)}>
            <Text style={[styles.revisionButtonText, { color: C.primary }]}>回退</Text>
          </TouchableOpacity>
        </View>
      ))}
      {revisions.length === 0 && <Text style={[styles.bodyText, { color: C.textSecondary }]}>应用第一次修改后，这里会出现可回退版本。</Text>}
    </View>
  );
}

function ViewContent({
  character,
  mainImage,
  promptSummary,
  onEdit,
}: {
  character: Character;
  mainImage?: Character['imageUri'];
  promptSummary: { label: string; text: string }[];
  onEdit: (section?: EditSectionKey) => void;
}) {
  const C = useThemeColors();
  const profile = character.profile;
  const relationshipRules = character.relationshipRules;
  const identity = promptSummary.find((section) => section.label === '身份')?.text ?? profile?.backstory ?? character.greeting;
  const styleGuide = promptSummary.find((section) => section.label === '称呼与风格')?.text ?? '还没有写入明确的说话方式。';
  const behavior = promptSummary.find((section) => section.label === '行为')?.text ?? '还没有写入明确的行为规则。';
  const guardrail = promptSummary.find((section) => section.label === '禁令')?.text ?? '还没有写入明确的边界禁令。';

  return (
    <View style={styles.contentStack}>
      <View style={[styles.dossierHero, { backgroundColor: C.surface, borderColor: C.border, shadowColor: C.shadow }]}>
        <EditIconButton label="编辑基础设定" onPress={() => onEdit('basic')} floating />
        {mainImage ? (
          <Image source={getImageSource(mainImage)} style={styles.dossierImage} resizeMode="cover" />
        ) : (
          <Text style={styles.heroFallback}>{character.avatar}</Text>
        )}
        <View style={styles.dossierCopy}>
          <Text style={[styles.dossierName, { color: C.text }]}>{character.name}</Text>
          <TagCluster values={splitTags(character.personality)} strong />
          <View style={[styles.quoteBlock, { backgroundColor: C.inputBg, borderColor: C.border }]}>
            <Text style={[styles.quoteLabel, { color: C.primary }]}>开场白</Text>
            <Text style={[styles.quoteText, { color: C.text }]}>{character.greeting}</Text>
          </View>
        </View>
      </View>

      <InfoBlock title="身份定位" body={identity} onEdit={() => onEdit('identity')} />
      <InfoBlock title="说话方式" body={styleGuide} onEdit={() => onEdit('styleGuide')} />
      <InfoBlock title="行为和边界" body={`${behavior}\n\n${guardrail}`} onEdit={() => onEdit('behaviorBoundary')} />

      <View style={styles.twoColumn}>
        <TagPanel title="兴趣爱好" values={profile?.hobbies ?? []} emptyText="还没有记录兴趣爱好" onEdit={() => onEdit('hobbies')} />
        <TagPanel title="口头禅" values={profile?.catchphrases ?? []} emptyText="还没有记录口头禅" onEdit={() => onEdit('catchphrases')} />
      </View>

      <View style={styles.twoColumn}>
        <TagPanel title="记忆触发" values={relationshipRules?.memoryTriggers ?? []} emptyText="还没有记录记忆触发" onEdit={() => onEdit('memoryTriggers')} />
        <TagPanel title="亲密触发" values={relationshipRules?.affinityTriggers ?? []} emptyText="还没有记录亲密触发" onEdit={() => onEdit('affinityTriggers')} />
      </View>

      <InfoBlock
        title="记忆询问语气"
        body={relationshipRules?.askMemoryStyle || '还没有写入询问记忆时的固定语气。'}
        onEdit={() => onEdit('askMemoryStyle')}
      />
      <TagPanel title="边界和忌讳" values={profile?.taboos ?? []} emptyText="还没有记录边界" onEdit={() => onEdit('taboos')} />
      <TagPanel title="陪伴目标" values={profile?.goals ?? []} emptyText="还没有记录陪伴目标" onEdit={() => onEdit('goals')} />

      <PromptCard sections={promptSummary} onEdit={() => onEdit('promptSummary')} />

      <TouchableOpacity
        style={[styles.secondaryBtn, { backgroundColor: C.surface, borderColor: C.border }]}
        onPress={() => onEdit('all')}
        activeOpacity={0.86}
        accessibilityRole="button"
        accessibilityLabel={`调整${character.name}的设定`}
      >
        <Text style={[styles.secondaryText, { color: C.text }]}>完整调整设定</Text>
      </TouchableOpacity>
    </View>
  );
}

function EditingContent({
  draft,
  isAdmin,
  section,
  dirty,
  onChange,
  onRestoreDefault,
  onPreview,
  onCancel,
}: {
  draft: EditableDraft;
  isAdmin: boolean;
  section: EditSectionKey;
  dirty: boolean;
  onChange: (updates: Partial<EditableDraft>) => void;
  onRestoreDefault: () => void;
  onPreview: () => void;
  onCancel: () => void;
}) {
  const C = useThemeColors();
  const showAll = section === 'all';
  const sectionTitle = EDIT_SECTION_TITLES[section];
  const promptIdentity = getPromptSection(draft.systemPrompt, '身份');
  const promptStyle = getPromptSection(draft.systemPrompt, '称呼与风格');
  const promptBehavior = getPromptSection(draft.systemPrompt, '行为');
  const promptGuardrail = getPromptSection(draft.systemPrompt, '禁令');
  const changePromptSection = (label: string, text: string) => {
    onChange({ systemPrompt: updatePromptSection(draft.systemPrompt, label, text) });
  };

  return (
    <View style={styles.contentStack}>
      <View style={[styles.editContextPanel, { backgroundColor: C.primaryLight + '24', borderColor: C.primaryLight }]}>
        <Text style={[styles.previewEyebrow, { color: C.primary }]}>正在调整</Text>
        <Text style={[styles.editContextTitle, { color: C.text }]}>{sectionTitle}</Text>
        <Text style={[styles.previewLead, { color: C.textSecondary }]}>
          改动会先进入草稿预览，确认应用前不会写入本地角色数据。
        </Text>
      </View>

      {(showAll || section === 'basic') && (
        <View style={[styles.editPanel, { backgroundColor: C.surface, borderColor: C.border }]}>
          <Text style={[styles.sectionTitle, { color: C.text }]}>基础设定</Text>
          <Field label="角色名称" value={draft.name} onChangeText={(name) => onChange({ name })} placeholder="例如：鹿芽" />
          <Field
            label="性格标签"
            value={draft.personality}
            onChangeText={(personality) => onChange({ personality })}
            placeholder="例如：元气、嘴甜、黏人"
          />
          <Field
            label="开场白"
            value={draft.greeting}
            onChangeText={(greeting) => onChange({ greeting })}
            placeholder="第一次见面说的话"
            multiline
            minHeight={84}
          />
        </View>
      )}

      {(showAll || section === 'identity') && (
        <View style={[styles.editPanel, { backgroundColor: C.surface, borderColor: C.border }]}>
          <Text style={[styles.sectionTitle, { color: C.text }]}>身份定位</Text>
          <Field
            label="身份 Prompt 段落"
            value={promptIdentity}
            onChangeText={(text) => changePromptSection('身份', text)}
            placeholder="她是谁，以及和用户是什么关系"
            multiline
            minHeight={112}
          />
          <Field
            label="背景故事"
            value={draft.backstory}
            onChangeText={(backstory) => onChange({ backstory })}
            placeholder="她来自哪里，为什么会陪在用户身边"
            multiline
            minHeight={96}
          />
        </View>
      )}

      {(showAll || section === 'styleGuide') && (
        <View style={[styles.editPanel, { backgroundColor: C.surface, borderColor: C.border }]}>
          <Text style={[styles.sectionTitle, { color: C.text }]}>说话方式</Text>
          <Field
            label="称呼与风格 Prompt 段落"
            value={promptStyle}
            onChangeText={(text) => changePromptSection('称呼与风格', text)}
            placeholder="称呼用户的方式、语气、语言节奏"
            multiline
            minHeight={132}
          />
        </View>
      )}

      {(showAll || section === 'behaviorBoundary') && (
        <View style={[styles.editPanel, { backgroundColor: C.surface, borderColor: C.border }]}>
          <Text style={[styles.sectionTitle, { color: C.text }]}>行为和边界</Text>
          <Field
            label="行为 Prompt 段落"
            value={promptBehavior}
            onChangeText={(text) => changePromptSection('行为', text)}
            placeholder="她在不同情绪/场景下如何回应"
            multiline
            minHeight={132}
          />
          <Field
            label="禁令 Prompt 段落"
            value={promptGuardrail}
            onChangeText={(text) => changePromptSection('禁令', text)}
            placeholder="她绝对不能说或不能做什么"
            multiline
            minHeight={112}
          />
        </View>
      )}

      {(showAll || section === 'hobbies') && (
        <View style={[styles.editPanel, { backgroundColor: C.surface, borderColor: C.border }]}>
          <Text style={[styles.sectionTitle, { color: C.text }]}>兴趣爱好</Text>
          <Field label="兴趣爱好" value={draft.hobbies} onChangeText={(hobbies) => onChange({ hobbies })} placeholder="用顿号分隔" />
        </View>
      )}

      {(showAll || section === 'catchphrases') && (
        <View style={[styles.editPanel, { backgroundColor: C.surface, borderColor: C.border }]}>
          <Text style={[styles.sectionTitle, { color: C.text }]}>口头禅</Text>
          <Field label="口头禅" value={draft.catchphrases} onChangeText={(catchphrases) => onChange({ catchphrases })} placeholder="用顿号分隔" />
        </View>
      )}

      {(showAll || section === 'memoryTriggers') && (
        <View style={[styles.editPanel, { backgroundColor: C.surface, borderColor: C.border }]}>
          <Text style={[styles.sectionTitle, { color: C.text }]}>记忆触发</Text>
          <Field
            label="记忆触发"
            value={draft.memoryTriggers}
            onChangeText={(memoryTriggers) => onChange({ memoryTriggers })}
            placeholder="用顿号分隔"
          />
        </View>
      )}

      {(showAll || section === 'affinityTriggers') && (
        <View style={[styles.editPanel, { backgroundColor: C.surface, borderColor: C.border }]}>
          <Text style={[styles.sectionTitle, { color: C.text }]}>亲密触发</Text>
          <Field
            label="亲密触发"
            value={draft.affinityTriggers}
            onChangeText={(affinityTriggers) => onChange({ affinityTriggers })}
            placeholder="用顿号分隔"
          />
        </View>
      )}

      {(showAll || section === 'askMemoryStyle') && (
        <View style={[styles.editPanel, { backgroundColor: C.surface, borderColor: C.border }]}>
          <Text style={[styles.sectionTitle, { color: C.text }]}>记忆询问语气</Text>
          <Field
            label="记忆询问语气"
            value={draft.askMemoryStyle}
            onChangeText={(askMemoryStyle) => onChange({ askMemoryStyle })}
            placeholder="她询问是否记住时怎么说"
            multiline
            minHeight={82}
          />
        </View>
      )}

      {(showAll || section === 'taboos') && (
        <View style={[styles.editPanel, { backgroundColor: C.surface, borderColor: C.border }]}>
          <Text style={[styles.sectionTitle, { color: C.text }]}>边界和忌讳</Text>
          <Field label="边界和忌讳" value={draft.taboos} onChangeText={(taboos) => onChange({ taboos })} placeholder="用顿号分隔" />
        </View>
      )}

      {(showAll || section === 'goals') && (
        <View style={[styles.editPanel, { backgroundColor: C.surface, borderColor: C.border }]}>
          <Text style={[styles.sectionTitle, { color: C.text }]}>陪伴目标</Text>
          <Field label="陪伴目标" value={draft.goals} onChangeText={(goals) => onChange({ goals })} placeholder="用顿号分隔" />
        </View>
      )}

      {(isAdmin && (showAll || section === 'promptSummary')) && (
        <View style={[styles.editPanel, { backgroundColor: C.surface, borderColor: C.border }]}>
          <Text style={[styles.sectionTitle, { color: C.text }]}>系统人设规则</Text>
          <Field
            label="Prompt"
            value={draft.systemPrompt}
            onChangeText={(systemPrompt) => onChange({ systemPrompt })}
            placeholder="身份、称呼与风格、行为、禁令"
            multiline
            minHeight={240}
          />
        </View>
      )}

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.secondaryBtn, { borderColor: C.border, backgroundColor: C.surface }]}
          onPress={onRestoreDefault}
          activeOpacity={0.82}
          accessibilityRole="button"
          accessibilityLabel="恢复默认文案到草稿"
        >
          <Text style={[styles.secondaryText, { color: C.text }]}>恢复默认文案</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.secondaryBtn, { borderColor: C.border, backgroundColor: C.surface }]}
          onPress={onCancel}
          activeOpacity={0.82}
          accessibilityRole="button"
          accessibilityLabel="放弃草稿"
        >
          <Text style={[styles.secondaryText, { color: C.text }]}>放弃草稿</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: C.primary, opacity: dirty ? 1 : 0.72 }]}
          onPress={onPreview}
          activeOpacity={0.86}
          accessibilityRole="button"
          accessibilityLabel="查看草稿预览"
        >
          <Text style={styles.primaryText}>查看草稿预览</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function SimpleEditingContent({
  draft,
  dirty,
  onChange,
  onPreview,
  onCancel,
}: {
  draft: EditableDraft;
  dirty: boolean;
  onChange: (updates: Partial<EditableDraft>) => void;
  onPreview: () => void;
  onCancel: () => void;
}) {
  const C = useThemeColors();
  return (
    <View style={styles.contentStack}>
      <View style={[styles.editContextPanel, { backgroundColor: C.primaryLight + '24', borderColor: C.primaryLight }]}>
        <Text style={[styles.previewEyebrow, { color: C.primary }]}>快速创作</Text>
        <Text style={[styles.editContextTitle, { color: C.text }]}>先把角色关系说清楚</Text>
        <Text style={[styles.previewLead, { color: C.textSecondary }]}>系统会根据这些内容生成身份、语言、行为和边界四层 Prompt。预览确认前不会写入本地。</Text>
      </View>

      <View style={[styles.editPanel, { backgroundColor: C.surface, borderColor: C.border }]}>
        <Text style={[styles.sectionTitle, { color: C.text }]}>她是谁</Text>
        <Field label="角色名称" value={draft.name} onChangeText={(name) => onChange({ name })} placeholder="例如：鹿芽" />
        <Field label="性格关键词" value={draft.personality} onChangeText={(personality) => onChange({ personality })} placeholder="温柔、克制、会接住情绪" />
        <Field label="背景与关系" value={draft.backstory} onChangeText={(backstory) => onChange({ backstory })} placeholder="她来自哪里，为什么会陪伴用户" multiline minHeight={110} />
        <Field label="第一次见面说的话" value={draft.greeting} onChangeText={(greeting) => onChange({ greeting })} placeholder="写一句能体现人物关系的开场白" multiline minHeight={90} />
      </View>

      <View style={[styles.editPanel, { backgroundColor: C.surface, borderColor: C.border }]}>
        <Text style={[styles.sectionTitle, { color: C.text }]}>她如何陪伴</Text>
        <Field label="兴趣爱好" value={draft.hobbies} onChangeText={(hobbies) => onChange({ hobbies })} placeholder="用顿号分隔" />
        <Field label="口头禅" value={draft.catchphrases} onChangeText={(catchphrases) => onChange({ catchphrases })} placeholder="用顿号分隔" />
        <Field label="陪伴目标" value={draft.goals} onChangeText={(goals) => onChange({ goals })} placeholder="她希望为用户带来什么" />
        <Field label="边界和忌讳" value={draft.taboos} onChangeText={(taboos) => onChange({ taboos })} placeholder="她不能说或不能做什么" />
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={[styles.secondaryBtn, { borderColor: C.border, backgroundColor: C.surface }]} onPress={onCancel}>
          <Text style={[styles.secondaryText, { color: C.text }]}>放弃草稿</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: C.primary, opacity: dirty ? 1 : 0.72 }]} onPress={onPreview}>
          <Text style={styles.primaryText}>生成并预览角色</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function PreviewContent({
  character,
  draft,
  changes,
  promptSummary,
  onBackToEdit,
  onCancel,
  onApply,
}: {
  character: Character;
  draft: EditableDraft;
  changes: string[];
  promptSummary: { label: string; text: string }[];
  onBackToEdit: () => void;
  onCancel: () => void;
  onApply: () => void;
}) {
  const C = useThemeColors();
  return (
    <View style={styles.contentStack}>
      <View style={[styles.previewPanel, { backgroundColor: C.surface, borderColor: C.border }]}>
        <Text style={[styles.previewEyebrow, { color: C.primary }]}>将影响的角色</Text>
        <Text style={[styles.previewTitle, { color: C.text }]}>{character.name} → {draft.name.trim() || character.name}</Text>
        <Text style={[styles.previewLead, { color: C.textSecondary }]}>
          确认应用前，这些内容只存在于草稿里，不会改写聊天、记忆、日记或纪念日。
        </Text>
      </View>

      <View style={[styles.previewPanel, { backgroundColor: C.surface, borderColor: C.border }]}>
        <Text style={[styles.sectionTitle, { color: C.text }]}>变更摘要</Text>
        {changes.length > 0 ? (
          <TagCluster values={changes} strong />
        ) : (
          <Text style={[styles.bodyText, { color: C.textSecondary }]}>当前草稿和线上设定一致。</Text>
        )}
      </View>

      <View style={[styles.quoteBlock, { backgroundColor: C.surface, borderColor: C.border }]}>
        <Text style={[styles.quoteLabel, { color: C.primary }]}>开场白预览</Text>
        <Text style={[styles.quoteText, { color: C.text }]}>{draft.greeting}</Text>
      </View>

      <InfoBlock title="背景故事预览" body={draft.backstory || '草稿里还没有背景故事。'} />
      <PromptCard sections={promptSummary} />

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.secondaryBtn, { borderColor: C.border, backgroundColor: C.surface }]}
          onPress={onBackToEdit}
          activeOpacity={0.82}
          accessibilityRole="button"
          accessibilityLabel="返回继续编辑"
        >
          <Text style={[styles.secondaryText, { color: C.text }]}>继续编辑</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.secondaryBtn, { borderColor: C.border, backgroundColor: C.surface }]}
          onPress={onCancel}
          activeOpacity={0.82}
          accessibilityRole="button"
          accessibilityLabel="取消草稿"
        >
          <Text style={[styles.secondaryText, { color: C.text }]}>取消草稿</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: C.primary }]}
          onPress={onApply}
          activeOpacity={0.86}
          accessibilityRole="button"
          accessibilityLabel="确认应用草稿"
        >
          <Text style={styles.primaryText}>确认应用</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function EditIconButton({ label, onPress, floating }: { label: string; onPress: () => void; floating?: boolean }) {
  const C = useThemeColors();
  return (
    <TouchableOpacity
      style={[
        styles.editIconButton,
        floating && styles.floatingEditIcon,
        { backgroundColor: C.surface, borderColor: C.border, shadowColor: C.shadow },
      ]}
      onPress={onPress}
      activeOpacity={0.82}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={styles.editIconText}>✏️</Text>
    </TouchableOpacity>
  );
}

function InfoBlock({ title, body, onEdit }: { title: string; body: string; onEdit?: () => void }) {
  const C = useThemeColors();
  return (
    <View style={[styles.infoBlock, { backgroundColor: C.surface, borderColor: C.border }]}>
      <View style={styles.blockHeader}>
        <Text style={[styles.sectionTitle, { color: C.text }]}>{title}</Text>
        {onEdit && <EditIconButton label={`编辑${title}`} onPress={onEdit} />}
      </View>
      <Text style={[styles.bodyText, { color: C.textSecondary }]}>{body}</Text>
    </View>
  );
}

function TagPanel({
  title,
  values,
  emptyText,
  onEdit,
}: {
  title: string;
  values: string[];
  emptyText: string;
  onEdit?: () => void;
}) {
  const C = useThemeColors();
  return (
    <View style={[styles.tagPanel, { backgroundColor: C.surface, borderColor: C.border }]}>
      <View style={styles.blockHeader}>
        <Text style={[styles.sectionTitle, { color: C.text }]}>{title}</Text>
        {onEdit && <EditIconButton label={`编辑${title}`} onPress={onEdit} />}
      </View>
      {values.length > 0 ? (
        <TagCluster values={values} />
      ) : (
        <Text style={[styles.bodyText, { color: C.textSecondary }]}>{emptyText}</Text>
      )}
    </View>
  );
}

function TagCluster({ values, strong }: { values: string[]; strong?: boolean }) {
  const C = useThemeColors();
  return (
    <View style={styles.tagCluster}>
      {values.map((value) => (
        <View
          key={value}
          style={[
            styles.tag,
            {
              backgroundColor: strong ? C.primaryLight + '30' : C.inputBg,
              borderColor: strong ? C.primaryLight : C.border,
            },
          ]}
        >
          <Text style={[styles.tagText, { color: strong ? C.primary : C.textSecondary }]}>{value}</Text>
        </View>
      ))}
    </View>
  );
}

function PromptCard({ sections, onEdit }: { sections: { label: string; text: string }[]; onEdit?: () => void }) {
  const C = useThemeColors();
  return (
    <View style={[styles.promptCard, { backgroundColor: C.surface, borderColor: C.border }]}>
      <View style={styles.blockHeader}>
        <Text style={[styles.sectionTitle, { color: C.text }]}>Prompt 摘要</Text>
        {onEdit && <EditIconButton label="编辑 Prompt 摘要" onPress={onEdit} />}
      </View>
      {sections.length > 0 ? (
        sections.map((section) => (
          <View key={section.label} style={[styles.promptSection, { borderTopColor: C.border }]}>
            <Text style={[styles.promptLabel, { color: C.primary }]}>{section.label}</Text>
            <Text style={[styles.bodyText, { color: C.textSecondary }]}>{section.text}</Text>
          </View>
        ))
      ) : (
        <Text style={[styles.bodyText, { color: C.textSecondary }]}>当前人设规则还没有可拆分的摘要。</Text>
      )}
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  minHeight,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  multiline?: boolean;
  minHeight?: number;
}) {
  const C = useThemeColors();
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: C.textSecondary }]}>{label}</Text>
      <TextInput
        style={[
          styles.input,
          multiline && styles.multilineInput,
          minHeight ? { minHeight } : undefined,
          { color: C.text, borderColor: C.border, backgroundColor: C.inputBg },
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={C.textSecondary}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboard: { flex: 1 },
  scroll: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 42,
  },
  header: {
    marginBottom: 16,
  },
  screenEyebrow: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '900',
    marginBottom: 6,
  },
  screenTitle: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '900',
    marginBottom: 8,
  },
  screenLead: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '600',
  },
  roster: {
    gap: 12,
    paddingRight: 18,
    paddingBottom: 14,
  },
  characterCard: {
    width: 126,
    minHeight: 168,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 10,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
  },
  createCharacterCard: {
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  createCharacterIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  createCharacterIconText: { fontSize: 36, lineHeight: 40, fontWeight: '500' },
  cardImageWrap: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 13,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.72)',
    marginBottom: 10,
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  cardFallback: {
    fontSize: 34,
  },
  cardName: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '900',
    marginBottom: 4,
  },
  cardMeta: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
  },
  modePill: {
    alignSelf: 'flex-start',
    minHeight: 30,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  modePillText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
  },
  depthSwitch: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 5,
    gap: 5,
    flexDirection: 'row',
  },
  depthOption: {
    flex: 1,
    borderRadius: 16,
    paddingHorizontal: 11,
    paddingVertical: 10,
  },
  depthLabel: { fontSize: 14, fontWeight: '900', marginBottom: 3 },
  depthDescription: { fontSize: 11, lineHeight: 15, fontWeight: '600' },
  contentStack: {
    gap: 14,
  },
  dossierHero: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    position: 'relative',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.07,
    shadowRadius: 24,
  },
  dossierImage: {
    width: '100%',
    height: 230,
  },
  heroFallback: {
    height: 190,
    textAlign: 'center',
    lineHeight: 190,
    fontSize: 42,
  },
  dossierCopy: {
    padding: 16,
    gap: 12,
  },
  dossierName: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '900',
  },
  quoteBlock: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    gap: 7,
  },
  quoteLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
  },
  quoteText: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '800',
  },
  infoBlock: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 9,
  },
  blockHeader: {
    position: 'relative',
    minHeight: 34,
    paddingRight: 44,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  editIconButton: {
    position: 'absolute',
    top: -5,
    right: 0,
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
  },
  floatingEditIcon: {
    top: 12,
    right: 12,
    zIndex: 2,
  },
  editIconText: {
    fontSize: 15,
    lineHeight: 19,
  },
  twoColumn: {
    gap: 14,
  },
  tagPanel: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '900',
  },
  bodyText: {
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '600',
  },
  auditPanel: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 10,
  },
  auditHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  auditHeaderCopy: { flex: 1, gap: 4 },
  auditScore: { fontSize: 34, lineHeight: 38, fontWeight: '900' },
  auditIssue: { fontSize: 12, lineHeight: 18, fontWeight: '700' },
  revisionRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  revisionCopy: { flex: 1, gap: 3 },
  revisionTitle: { fontSize: 13, fontWeight: '800' },
  revisionMeta: { fontSize: 11 },
  revisionButton: {
    minWidth: 58,
    minHeight: 34,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  revisionButtonText: { fontSize: 12, fontWeight: '900' },
  tagCluster: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    minHeight: 30,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
  },
  promptCard: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 10,
  },
  promptSection: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 11,
    gap: 5,
  },
  promptLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
  },
  editPanel: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 15,
    gap: 12,
  },
  editContextPanel: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 7,
  },
  editContextTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '900',
  },
  previewPanel: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 9,
  },
  previewEyebrow: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
  },
  previewTitle: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '900',
  },
  previewLead: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '600',
  },
  field: {
    gap: 7,
  },
  label: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
  },
  input: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 13,
    paddingVertical: 11,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
  },
  multilineInput: {
    paddingTop: 12,
  },
  actions: {
    gap: 10,
  },
  secondaryBtn: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '900',
  },
  primaryBtn: {
    minHeight: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    color: '#fff',
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '900',
  },
});
