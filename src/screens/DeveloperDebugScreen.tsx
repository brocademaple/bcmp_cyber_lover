import React, { useEffect, useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeColors } from '../utils/theme';
import { useChatStore } from '../store/chatStore';
import { useSettingsStore } from '../store/settingsStore';
import { useDebugStore } from '../store/debugStore';
import {
  buildDailyGreetingDebugSnapshot,
  buildPromptDebugSnapshot,
  buildServiceTestDebugSnapshot,
  buildVisionAgentDebugSnapshot,
} from '../services/aiService';
import { buildMemoryDecisionDebugSnapshot } from '../services/memoryDecisionService';
import { buildDailyDiaryFromMessages, buildRollupDiary, getMonthlyKey, getWeeklyKey } from '../services/diaryService';
import { buildMemorySummaryDebugSurface } from '../services/memoryService';
import { explainEmotionTransition } from '../services/relationshipService';
import { exportDebugTurnTraces } from '../services/debugTraceExport';
import { Character, DebugAgentSurface, DebugPromptSnapshot, Message } from '../types';
import { oldestFirst } from '../utils/chatHistory';

type DebugTab = 'persona' | 'prompt' | 'agents' | 'emotion' | 'trace';

const TABS: Array<{ key: DebugTab; label: string }> = [
  { key: 'persona', label: 'Persona' },
  { key: 'prompt', label: 'Prompt' },
  { key: 'agents', label: 'Agents' },
  { key: 'emotion', label: 'Emotion' },
  { key: 'trace', label: 'Trace' },
];

function formatTime(ts?: number) {
  if (!ts) return '暂无';
  return new Date(ts).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function sampleMessage(role: 'user' | 'assistant', content: string, timestamp: number): Message {
  return {
    id: `debug_${role}_${timestamp}`,
    role,
    content,
    timestamp,
  };
}

function Card({
  title,
  children,
  muted,
}: {
  title: string;
  children: React.ReactNode;
  muted?: string;
}) {
  const C = useThemeColors();
  return (
    <View style={[styles.card, { backgroundColor: C.surface, borderColor: C.border }]}>
      <View style={styles.cardHeader}>
        <Text style={[styles.cardTitle, { color: C.text }]}>{title}</Text>
        {muted ? <Text style={[styles.cardMuted, { color: C.textSecondary }]}>{muted}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function CodeBlock({ title, content }: { title?: string; content: string }) {
  const C = useThemeColors();
  return (
    <View style={[styles.codeBlock, { backgroundColor: C.inputBg, borderColor: C.border }]}>
      {title ? <Text style={[styles.codeTitle, { color: C.primary }]}>{title}</Text> : null}
      <Text style={[styles.codeText, { color: C.text }]} selectable>
        {content || '空'}
      </Text>
    </View>
  );
}

function KeyValue({ label, value }: { label: string; value: string | number }) {
  const C = useThemeColors();
  return (
    <View style={[styles.kvRow, { borderColor: C.border }]}>
      <Text style={[styles.kvLabel, { color: C.textSecondary }]}>{label}</Text>
      <Text style={[styles.kvValue, { color: C.text }]} selectable>{String(value)}</Text>
    </View>
  );
}

function SnapshotView({ snapshot }: { snapshot: DebugPromptSnapshot }) {
  const C = useThemeColors();
  return (
    <Card title={snapshot.title} muted={snapshot.kind}>
      <View style={styles.kvGrid}>
        {snapshot.requestSummary.map((item) => (
          <KeyValue key={`${snapshot.kind}-${item.label}`} label={item.label} value={item.value} />
        ))}
      </View>
      {snapshot.sections.map((section) => (
        <CodeBlock
          key={`${snapshot.kind}-${section.title}`}
          title={`${section.active === false ? '未启用 · ' : ''}${section.title}`}
          content={section.content}
        />
      ))}
      <Text style={[styles.subTitle, { color: C.text }]}>API Messages Preview</Text>
      {snapshot.apiMessagesPreview.map((message, index) => (
        <CodeBlock
          key={`${snapshot.kind}-message-${index}`}
          title={`${index + 1}. ${message.role}${message.hasImage ? ' · image' : ''}`}
          content={message.contentPreview}
        />
      ))}
      {snapshot.notes.map((note) => (
        <Text key={note} style={[styles.note, { color: C.textSecondary }]}>- {note}</Text>
      ))}
    </Card>
  );
}

function AgentSurfaceView({ surface }: { surface: DebugAgentSurface }) {
  const C = useThemeColors();
  return (
    <Card title={surface.title} muted={surface.description}>
      {surface.requestSummary?.map((item) => (
        <KeyValue key={`${surface.title}-${item.label}`} label={item.label} value={item.value} />
      ))}
      {surface.sections.map((section) => (
        <CodeBlock
          key={`${surface.title}-${section.title}`}
          title={`${section.active === false ? '未启用 · ' : ''}${section.title}`}
          content={section.content}
        />
      ))}
      {surface.notes?.map((note) => (
        <Text key={note} style={[styles.note, { color: C.textSecondary }]}>- {note}</Text>
      ))}
    </Card>
  );
}

export default function DeveloperDebugScreen() {
  const C = useThemeColors();
  const { settings } = useSettingsStore();
  const { characters, messages } = useChatStore();
  const { traces, tracesLoaded, loadTraces, clearTraces } = useDebugStore();
  const [activeTab, setActiveTab] = useState<DebugTab>('persona');
  const [selectedCharacterId, setSelectedCharacterId] = useState(settings.selectedCharacterId);
  const [emotionInput, setEmotionInput] = useState('今天有点累，但还是想和你说说话');
  const [exportStatus, setExportStatus] = useState('');
  const selectedCharacter = characters.find((character) => character.id === selectedCharacterId) ?? characters[0];
  const selectedMessages = selectedCharacter ? messages[selectedCharacter.id] ?? [] : [];
  const effectiveNow = settings.advanced.debugNowTs ?? Date.now();

  useEffect(() => {
    void loadTraces();
  }, [loadTraces]);

  const promptSnapshot = useMemo(() => {
    if (!selectedCharacter) return null;
    return buildPromptDebugSnapshot({
      character: selectedCharacter,
      chatHistory: selectedMessages,
      config: settings.service,
      memory: settings.memory,
      advanced: settings.advanced,
      userText: emotionInput,
      nowTs: effectiveNow,
    });
  }, [effectiveNow, emotionInput, selectedCharacter, selectedMessages, settings.advanced, settings.memory, settings.service]);

  const dailyGreetingSnapshot = useMemo(() => {
    if (!selectedCharacter) return null;
    return buildDailyGreetingDebugSnapshot(selectedCharacter, settings.service, settings.advanced, effectiveNow);
  }, [effectiveNow, selectedCharacter, settings.advanced, settings.service]);

  const visionSnapshot = useMemo(() => {
    if (!selectedCharacter) return null;
    return buildVisionAgentDebugSnapshot(selectedCharacter, settings.service);
  }, [selectedCharacter, settings.service]);

  const serviceSnapshot = useMemo(() => buildServiceTestDebugSnapshot(settings.service), [settings.service]);

  const memoryAgent = useMemo(() => {
    if (!selectedCharacter) return null;
    const ordered = oldestFirst(selectedMessages);
    const lastUser = [...ordered].reverse().find((message) => message.role === 'user');
    const lastAssistant = [...ordered].reverse().find((message) => message.role === 'assistant');
    return buildMemoryDecisionDebugSnapshot({
      character: selectedCharacter,
      userMessage: lastUser ?? sampleMessage('user', emotionInput, effectiveNow),
      assistantMessage: lastAssistant ?? sampleMessage('assistant', '我在听，你慢慢说。', effectiveNow),
      recentMessages: ordered.length ? ordered : [
        sampleMessage('user', emotionInput, effectiveNow),
        sampleMessage('assistant', '我在听，你慢慢说。', effectiveNow),
      ],
      service: settings.service,
      memory: settings.memory,
      advanced: settings.advanced,
    });
  }, [effectiveNow, emotionInput, selectedCharacter, selectedMessages, settings.advanced, settings.memory, settings.service]);

  const emotionExplanation = useMemo(() => {
    if (!selectedCharacter) return null;
    return explainEmotionTransition(selectedCharacter, emotionInput, effectiveNow);
  }, [effectiveNow, emotionInput, selectedCharacter]);

  const diarySurface = useMemo<DebugAgentSurface | null>(() => {
    if (!selectedCharacter) return null;
    const daily = buildDailyDiaryFromMessages(selectedCharacter.name, selectedMessages, effectiveNow);
    const existingDaily = (selectedCharacter.diaries ?? []).filter((diary) => diary.period === 'daily');
    const weeklyKey = getWeeklyKey(effectiveNow);
    const monthlyKey = getMonthlyKey(effectiveNow);
    const weekly = buildRollupDiary(selectedCharacter.name, 'weekly', weeklyKey, existingDaily, effectiveNow);
    const monthly = buildRollupDiary(selectedCharacter.name, 'monthly', monthlyKey, existingDaily, effectiveNow);
    return {
      title: '日记/沉淀逻辑',
      description: '本地规则生成，不走 LLM。聊天后由 chatStore 生成日报、周记、月记。',
      sections: [
        { title: '日报规则', content: '按本地日期筛选当天消息，取最近用户消息 8 条、角色回复 4 条，拼成角色日记。', active: true },
        { title: '周记/月记规则', content: '从已有 daily diary 中按周/月聚合，再保留最近 90 篇。', active: true },
        { title: '当前日报预览', content: daily.content, active: true },
        { title: '当前周记预览', content: weekly.content, active: true },
        { title: '当前月记预览', content: monthly.content, active: true },
      ],
      requestSummary: [
        { label: 'LLM', value: 'not used' },
        { label: 'Messages', value: String(selectedMessages.length) },
        { label: 'Daily Key', value: daily.periodKey },
      ],
      notes: ['这是本地沉淀逻辑，用于调试关系资产生成，不会调用模型。'],
    };
  }, [effectiveNow, selectedCharacter, selectedMessages]);

  const memorySummarySurface = useMemo(() => {
    if (!selectedCharacter) return null;
    return buildMemorySummaryDebugSurface(selectedMessages, selectedCharacter, settings.memory);
  }, [selectedCharacter, selectedMessages, settings.memory]);

  const handleClearTraces = async () => {
    await clearTraces();
    setExportStatus('已清空持久化 trace');
  };

  const handleExportTraces = async () => {
    if (traces.length === 0) {
      setExportStatus('没有可导出的 trace');
      return;
    }

    try {
      const result = await exportDebugTurnTraces(traces, effectiveNow);
      setExportStatus(`已导出 ${result.traceCount} 条 trace\nMarkdown: ${result.markdownUri}\nHTML: ${result.htmlUri}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : '导出失败';
      setExportStatus(message);
    }
  };

  if (!selectedCharacter) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: C.background }]}>
        <Text style={[styles.emptyText, { color: C.textSecondary }]}>暂无角色可调试</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: C.background }]}>
      <ScrollView contentContainerStyle={styles.scroll} contentInsetAdjustmentBehavior="automatic">
        <View style={styles.hero}>
          <Text style={[styles.pageTitle, { color: C.text }]}>AI 调试台</Text>
          <Text style={[styles.pageDesc, { color: C.textSecondary }]}>
            只读外显当前 AI/Agent 封装。API Key 不展示，模拟输入不会写入真实状态。
          </Text>
        </View>

        <View style={styles.characterRow}>
          {characters.map((character) => {
            const active = character.id === selectedCharacter.id;
            return (
              <TouchableOpacity
                key={character.id}
                style={[
                  styles.characterChip,
                  { borderColor: active ? C.primary : C.border, backgroundColor: active ? C.primary : C.surface },
                ]}
                onPress={() => setSelectedCharacterId(character.id)}
                activeOpacity={0.8}
              >
                <Text style={[styles.characterChipText, { color: active ? '#fff' : C.text }]}>{character.name}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={[styles.tabRow, { backgroundColor: C.surface, borderColor: C.border }]}>
          {TABS.map((tab) => {
            const active = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tabButton, active && { backgroundColor: C.primary }]}
                onPress={() => setActiveTab(tab.key)}
                activeOpacity={0.8}
              >
                <Text style={[styles.tabText, { color: active ? '#fff' : C.textSecondary }]}>{tab.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {activeTab === 'persona' && (
          <>
            {characters.map((character) => (
              <Card
                key={character.id}
                title={`${character.name} Persona`}
                muted={`${character.personality} · ${character.theme ?? 'default'}`}
              >
                <KeyValue label="当前心情" value={character.emotionalState?.mood ?? 'neutral'} />
                <KeyValue label="亲密度" value={`${character.emotionalState?.intimacy ?? 50}/100`} />
                <KeyValue label="精力" value={`${character.emotionalState?.energy ?? 80}/100`} />
                <KeyValue label="上次互动" value={formatTime(character.emotionalState?.lastInteraction)} />
                <CodeBlock title="System Prompt" content={character.systemPrompt} />
                <CodeBlock title="Profile" content={[
                  `背景：${character.profile?.backstory ?? '未配置'}`,
                  `兴趣：${character.profile?.hobbies.join('、') || '未配置'}`,
                  `口头禅：${character.profile?.catchphrases.join('、') || '未配置'}`,
                  `禁忌：${character.profile?.taboos.join('、') || '未配置'}`,
                  `目标：${character.profile?.goals.join('、') || '未配置'}`,
                ].join('\n')} />
                <CodeBlock title="Relationship Rules" content={[
                  `亲密触发：${character.relationshipRules?.affinityTriggers.join('、') || '未配置'}`,
                  `记忆触发：${character.relationshipRules?.memoryTriggers.join('、') || '未配置'}`,
                  `询问风格：${character.relationshipRules?.askMemoryStyle || '未配置'}`,
                ].join('\n')} />
                <CodeBlock title="Memories" content={(character.memories ?? []).slice(-8).map((memory) => `- [${memory.importance}] ${memory.tags.join('/')} · ${memory.content}`).join('\n') || '暂无长期记忆'} />
              </Card>
            ))}
          </>
        )}

        {activeTab === 'prompt' && (
          <>
            {promptSnapshot && <SnapshotView snapshot={promptSnapshot} />}
            {dailyGreetingSnapshot && <SnapshotView snapshot={dailyGreetingSnapshot} />}
          </>
        )}

        {activeTab === 'agents' && (
          <>
            {memoryAgent && <AgentSurfaceView surface={memoryAgent} />}
            {memorySummarySurface && <AgentSurfaceView surface={memorySummarySurface} />}
            {visionSnapshot && <SnapshotView snapshot={visionSnapshot} />}
            <SnapshotView snapshot={serviceSnapshot} />
            {diarySurface && <AgentSurfaceView surface={diarySurface} />}
          </>
        )}

        {activeTab === 'emotion' && emotionExplanation && (
          <Card title="心情与关系模拟" muted="预览，不保存">
            <TextInput
              style={[styles.input, { color: C.text, backgroundColor: C.inputBg, borderColor: C.border }]}
              value={emotionInput}
              onChangeText={setEmotionInput}
              multiline
              placeholder="输入一条用户消息，预览心情变化"
              placeholderTextColor={C.textSecondary}
            />
            <KeyValue label="Affinity Delta" value={`+${emotionExplanation.affinityDelta}`} />
            <KeyValue label="命中亲密规则" value={emotionExplanation.matchedAffinityRules.join(' / ') || '未命中，默认 +1'} />
            <KeyValue label="Mood Reason" value={emotionExplanation.moodReason} />
            <KeyValue label="Energy Reason" value={emotionExplanation.energyReason} />
            <CodeBlock title="Before" content={JSON.stringify(emotionExplanation.before, null, 2)} />
            <CodeBlock title="After" content={JSON.stringify(emotionExplanation.after, null, 2)} />
            <CodeBlock title="对回复体验的影响" content={emotionExplanation.stateInfluence.map((item) => `- ${item}`).join('\n')} />
          </Card>
        )}

        {activeTab === 'trace' && (
          <Card title="最近真实 Turn Trace" muted="持久化，最多 50 条，可导出到 docs/private/chat-logic">
            <View style={styles.traceActions}>
              <TouchableOpacity style={[styles.actionButton, { borderColor: C.border }]} onPress={handleClearTraces} activeOpacity={0.8}>
                <Text style={[styles.actionButtonText, { color: C.primary }]}>清空持久 trace</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  { borderColor: C.border },
                  traces.length === 0 && styles.disabledButton,
                ]}
                onPress={handleExportTraces}
                activeOpacity={0.8}
                disabled={traces.length === 0}
              >
                <Text style={[styles.actionButtonText, { color: traces.length === 0 ? C.textSecondary : C.primary }]}>导出 Markdown / HTML</Text>
              </TouchableOpacity>
            </View>
            {exportStatus ? <CodeBlock title="导出状态" content={exportStatus} /> : null}
            {!tracesLoaded ? (
              <Text style={[styles.emptyText, { color: C.textSecondary }]}>正在加载持久化 trace...</Text>
            ) : traces.length === 0 ? (
              <Text style={[styles.emptyText, { color: C.textSecondary }]}>还没有真实聊天 trace。发送一条消息后会持久保存并显示。</Text>
            ) : traces.map((trace) => (
              <View key={trace.id} style={[styles.traceCard, { borderColor: C.border, backgroundColor: C.inputBg }]}>
                <KeyValue label="时间" value={formatTime(trace.timestamp)} />
                <KeyValue label="角色" value={trace.characterName} />
                <KeyValue label="模型" value={trace.model} />
                <KeyValue label="记忆判断" value={trace.memoryDecision} />
                <KeyValue label="亲密度 delta" value={trace.affinityDelta ?? '未运行'} />
                {trace.userMessageId ? <KeyValue label="用户消息 ID" value={trace.userMessageId} /> : null}
                {trace.assistantMessageId ? <KeyValue label="AI 消息 ID" value={trace.assistantMessageId} /> : null}
                <CodeBlock title="用户消息" content={trace.userText} />
                <CodeBlock title="Prompt 摘要" content={trace.promptSummary} />
                {trace.promptRequestSummary?.length ? (
                  <CodeBlock
                    title="Prompt 请求摘要"
                    content={trace.promptRequestSummary.map((item) => `${item.label}: ${item.value}`).join('\n')}
                  />
                ) : null}
                {trace.promptSections?.length ? (
                  <CodeBlock
                    title="Prompt 分段"
                    content={trace.promptSections.map((section) => `[${section.active === false ? 'off' : 'on'}] ${section.title}\n${section.content}`).join('\n\n---\n\n')}
                  />
                ) : null}
                {trace.promptMessagesPreview?.length ? (
                  <CodeBlock
                    title="API Messages Preview"
                    content={trace.promptMessagesPreview.map((message, index) => `${index + 1}. ${message.role}${message.hasImage ? ' + image' : ''}\n${message.contentPreview}`).join('\n\n')}
                  />
                ) : null}
                {trace.memoryDecisionDetail ? <CodeBlock title="记忆判断详情" content={trace.memoryDecisionDetail} /> : null}
                {trace.emotionBefore && <CodeBlock title="Emotion Before" content={JSON.stringify(trace.emotionBefore, null, 2)} />}
                {trace.emotionAfter && <CodeBlock title="Emotion After" content={JSON.stringify(trace.emotionAfter, null, 2)} />}
                {trace.assistantText ? <CodeBlock title="AI 回复" content={trace.assistantText} /> : null}
                {trace.errorMessage ? <CodeBlock title="Error" content={trace.errorMessage} /> : null}
              </View>
            ))}
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16, paddingTop: 8, paddingBottom: 32 },
  hero: { marginBottom: 16 },
  pageTitle: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '900',
  },
  pageDesc: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 21,
  },
  characterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  characterChip: {
    minHeight: 36,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  characterChipText: {
    fontSize: 13,
    fontWeight: '900',
  },
  tabRow: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 4,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 14,
  },
  tabButton: {
    minHeight: 34,
    borderRadius: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '900',
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 22,
    padding: 14,
    marginBottom: 14,
  },
  cardHeader: {
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '900',
  },
  cardMuted: {
    marginTop: 3,
    fontSize: 12,
    lineHeight: 18,
  },
  kvGrid: {
    gap: 6,
    marginBottom: 8,
  },
  kvRow: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 7,
    gap: 4,
  },
  kvLabel: {
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  kvValue: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  subTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '900',
    marginTop: 6,
    marginBottom: 8,
  },
  codeBlock: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 11,
    marginBottom: 10,
  },
  codeTitle: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '900',
    marginBottom: 5,
  },
  codeText: {
    fontSize: 12,
    lineHeight: 18,
  },
  note: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 2,
  },
  input: {
    minHeight: 92,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 10,
    textAlignVertical: 'top',
  },
  traceActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  actionButton: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '900',
  },
  disabledButton: {
    opacity: 0.55,
  },
  traceCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    padding: 12,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 21,
    padding: 14,
  },
});
