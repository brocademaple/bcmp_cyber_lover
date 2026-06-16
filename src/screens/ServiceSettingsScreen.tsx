import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList, ServiceProvider } from '../types';
import { useSettingsStore, PROVIDER_CONFIGS } from '../store/settingsStore';
import { fetchModelList } from '../services/aiService';
import { useThemeColors } from '../utils/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ServiceSettings'>;
type CapabilityTarget = 'all' | 'chat' | 'vision';
type TestTone = 'idle' | 'success' | 'error';

interface TestState {
  tone: TestTone;
  title: string;
  detail: string;
}

const PROVIDERS: {
  value: ServiceProvider;
  label: string;
  badge: string;
  description: string;
  useCase: string;
}[] = [
  {
    value: 'siliconflow',
    label: '硅基流动',
    badge: '推荐',
    description: '模型池灵活，适合文字聊天和视觉能力一起接入。',
    useCase: '聊天 / 视觉 / 多模型',
  },
  {
    value: 'deepseek',
    label: 'DeepSeek',
    badge: '稳定',
    description: '文字回复轻量稳定，适合先把聊天主链路跑通。',
    useCase: '文字聊天',
  },
  {
    value: 'custom',
    label: '自定义',
    badge: '高级',
    description: '接入兼容 OpenAI 的服务端点，适合已有代理或私有网关。',
    useCase: 'OpenAI-compatible',
  },
];

function resolveBaseUrl(provider: ServiceProvider, customUrl?: string) {
  if (provider === 'custom') return customUrl?.trim() || '';
  return PROVIDER_CONFIGS[provider].baseUrl;
}

function getFailureCopy(status: number) {
  if (status === 401 || status === 403) {
    return { title: '密钥无法通过验证', detail: '请检查 API Key 是否完整，或是否已在服务平台开启权限。' };
  }
  if (status === 404) {
    return { title: '服务地址不可用', detail: '模型列表接口没有响应，请检查 Base URL 是否兼容 OpenAI /v1。' };
  }
  if (status >= 500) {
    return { title: '服务暂时不可用', detail: '服务端返回异常，稍后重试或切换其他服务。' };
  }
  return { title: '连接没有通过', detail: `服务返回 ${status}，请检查密钥、模型或服务地址。` };
}

export default function ServiceSettingsScreen() {
  const C = useThemeColors();
  const { settings, updateService, saveSettings } = useSettingsStore();
  const svc = settings.service;
  const connected = svc.apiKey.trim().length > 0;
  const baseUrl = resolveBaseUrl(svc.provider, svc.baseUrl);
  const providerLabel = PROVIDER_CONFIGS[svc.provider].label;

  const [showSecret, setShowSecret] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [fetchingTarget, setFetchingTarget] = useState<'chat' | 'vision' | null>(null);
  const [modelList, setModelList] = useState<string[]>([]);
  const [showModelPicker, setShowModelPicker] = useState<'chat' | 'vision' | null>(null);
  const [saveNotice, setSaveNotice] = useState('尚未保存本次调整');
  const [testState, setTestState] = useState<TestState>({
    tone: 'idle',
    title: '等待验证',
    detail: '保存密钥后，可以在这里验证服务、聊天模型和视觉模型是否可用。',
  });

  const handleProviderSelect = (p: ServiceProvider) => {
    updateService({
      provider: p,
      model: PROVIDER_CONFIGS[p].defaultModel,
      baseUrl: PROVIDER_CONFIGS[p].baseUrl,
    });
    setSaveNotice('服务已切换，记得保存');
    setTestState({
      tone: 'idle',
      title: '等待重新验证',
      detail: '服务类型改变后，需要重新测试连接状态。',
    });
  };

  const runConnectionTest = async (target: CapabilityTarget) => {
    if (!svc.apiKey.trim()) {
      setTestState({
        tone: 'error',
        title: '密钥缺失',
        detail: '先填入 API Key，再测试服务连接。',
      });
      return;
    }
    if (!baseUrl) {
      setTestState({
        tone: 'error',
        title: '服务地址缺失',
        detail: '自定义服务需要填写兼容 OpenAI 的 Base URL。',
      });
      return;
    }
    if ((target === 'chat' || target === 'all') && !svc.model.trim()) {
      setTestState({
        tone: 'error',
        title: '聊天模型缺失',
        detail: '请先填写聊天模型名称。',
      });
      return;
    }
    if (target === 'vision' && !svc.visionModel.trim()) {
      setTestState({
        tone: 'error',
        title: '视觉模型缺失',
        detail: '请先填写视觉模型名称。',
      });
      return;
    }

    setIsTesting(true);
    setTestState({ tone: 'idle', title: '正在验证', detail: '正在读取服务模型列表。' });
    try {
      const response = await fetch(`${baseUrl}/models`, {
        headers: { Authorization: `Bearer ${svc.apiKey.trim()}` },
      });
      if (!response.ok) {
        const copy = getFailureCopy(response.status);
        setTestState({ tone: 'error', ...copy });
        return;
      }
      const data = await response.json().catch(() => ({ data: [] }));
      const ids: string[] = Array.isArray(data.data) ? data.data.map((m: { id?: string }) => m.id).filter(Boolean) : [];
      const missingChat = ids.length > 0 && (target === 'chat' || target === 'all') && !ids.includes(svc.model);
      const missingVision = ids.length > 0 && (target === 'vision' || target === 'all') && !!svc.visionModel && !ids.includes(svc.visionModel);
      if (missingChat || missingVision) {
        setTestState({
          tone: 'error',
          title: '模型不可用',
          detail: missingChat ? `模型列表里没有 ${svc.model}。` : `模型列表里没有 ${svc.visionModel}。`,
        });
        return;
      }
      setTestState({
        tone: 'success',
        title: target === 'vision' ? '视觉能力已通过' : '连接验证通过',
        detail: ids.length > 0 ? `已读取 ${ids.length} 个模型，当前配置可以继续使用。` : '服务已响应，当前配置可以继续使用。',
      });
    } catch {
      setTestState({
        tone: 'error',
        title: '网络连接失败',
        detail: '没有连到服务端，请检查网络、Base URL 或服务平台状态。',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleFetchModels = async (type: 'chat' | 'vision') => {
    if (!connected) {
      setTestState({ tone: 'error', title: '密钥缺失', detail: '填入 API Key 后才能同步模型列表。' });
      return;
    }
    setIsFetchingModels(true);
    setFetchingTarget(type);
    const list = await fetchModelList(svc);
    setIsFetchingModels(false);
    setFetchingTarget(null);
    if (list.length === 0) {
      setTestState({ tone: 'error', title: '暂时拿不到模型列表', detail: '请检查密钥、网络或服务地址。' });
      return;
    }
    setModelList(list);
    setShowModelPicker(type);
    setTestState({ tone: 'success', title: '模型列表已同步', detail: `已读取 ${list.length} 个模型。` });
  };

  const handleSave = async () => {
    await saveSettings();
    setSaveNotice(connected ? '已保存到安全存储' : '密钥已清空并保存');
    setTestState({
      tone: 'success',
      title: '连接配置已保存',
      detail: connected ? '聊天页会使用这套服务配置。' : '当前没有可用密钥，聊天时会提示先连接服务。',
    });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: C.background }]}>
      <ScrollView contentContainerStyle={styles.scroll} contentInsetAdjustmentBehavior="automatic">
        <View style={styles.hero}>
          <Text style={[styles.pageTitle, { color: C.text }]}>连接服务</Text>
          <Text style={[styles.pageDesc, { color: C.textSecondary }]}>
            像控制台一样管理服务、密钥和模型能力。连接完成后，聊天、好感和记忆才会进入真实体验。
          </Text>
        </View>

        <View style={styles.dashboardGrid}>
          <MetricCard label="当前服务" value={providerLabel} tone="ready" colors={C} />
          <MetricCard label="密钥状态" value={connected ? '已填写' : '缺失'} tone={connected ? 'ready' : 'pending'} colors={C} />
          <MetricCard label="聊天模型" value={svc.model ? '已选择' : '待填写'} tone={svc.model ? 'ready' : 'pending'} colors={C} />
          <MetricCard label="最近测试" value={testState.tone === 'success' ? '通过' : testState.tone === 'error' ? '需处理' : '待验证'} tone={testState.tone === 'success' ? 'ready' : testState.tone === 'error' ? 'error' : 'pending'} colors={C} />
        </View>

        <View
          style={[
            styles.testBanner,
            {
              backgroundColor: testState.tone === 'success' ? 'rgba(38, 166, 91, 0.14)' : testState.tone === 'error' ? 'rgba(226, 85, 99, 0.14)' : C.surface,
              borderColor: testState.tone === 'success' ? 'rgba(38, 166, 91, 0.34)' : testState.tone === 'error' ? C.danger : C.border,
            },
          ]}
        >
          <Text style={[styles.testBannerTitle, { color: testState.tone === 'error' ? C.danger : C.text }]}>{testState.title}</Text>
          <Text style={[styles.testBannerDetail, { color: C.textSecondary }]}>{testState.detail}</Text>
        </View>

        <Text style={[styles.groupLabel, { color: C.primary }]}>选择服务</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.providerRail}
        >
          {PROVIDERS.map((p) => {
            const active = svc.provider === p.value;
            return (
              <TouchableOpacity
                key={p.value}
                style={[
                  styles.providerCard,
                  { backgroundColor: active ? C.primary : C.surface, borderColor: active ? C.primary : C.border },
                ]}
                onPress={() => handleProviderSelect(p.value)}
                activeOpacity={0.82}
              >
                <View style={styles.providerHeader}>
                  <Text style={[styles.providerName, { color: active ? '#fff' : C.text }]}>{p.label}</Text>
                  <View style={[styles.providerBadge, { backgroundColor: active ? 'rgba(255,255,255,0.2)' : C.inputBg }]}>
                    <Text style={[styles.providerBadgeText, { color: active ? '#fff' : C.primary }]}>{active ? '当前' : p.badge}</Text>
                  </View>
                </View>
                <Text style={[styles.providerUseCase, { color: active ? 'rgba(255,255,255,0.82)' : C.primary }]}>{p.useCase}</Text>
                <Text style={[styles.providerDesc, { color: active ? 'rgba(255,255,255,0.82)' : C.textSecondary }]}>{p.description}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={[styles.vaultCard, { backgroundColor: C.surface, borderColor: C.border }]}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={[styles.cardTitle, { color: C.text }]}>凭证保险箱</Text>
              <Text style={[styles.cardDesc, { color: C.textSecondary }]}>{saveNotice}</Text>
            </View>
            <TouchableOpacity style={[styles.smallPill, { borderColor: C.border }]} onPress={() => setShowSecret((v) => !v)}>
              <Text style={[styles.smallPillText, { color: C.primary }]}>{showSecret ? '隐藏' : '显示'}</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={[styles.secretInput, { color: C.text, borderColor: C.border, backgroundColor: C.inputBg }]}
            value={svc.apiKey}
            onChangeText={(v) => {
              updateService({ apiKey: v });
              setSaveNotice('密钥已修改，记得保存');
            }}
            placeholder="sk-..."
            placeholderTextColor={C.textSecondary}
            secureTextEntry={!showSecret}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <View style={styles.vaultActions}>
            <TouchableOpacity
              style={[styles.secondaryMiniBtn, { borderColor: C.border }]}
              onPress={() => {
                updateService({ apiKey: '' });
                setSaveNotice('密钥已清空，保存后生效');
                setTestState({ tone: 'idle', title: '等待验证', detail: '密钥清空后，需要重新填写才能连接。' });
              }}
            >
              <Text style={[styles.secondaryMiniText, { color: C.textSecondary }]}>清空密钥</Text>
            </TouchableOpacity>
            <Text style={[styles.vaultHint, { color: C.textSecondary }]}>密钥只保存在本机安全存储。</Text>
          </View>

          {svc.provider === 'custom' && (
            <View style={styles.customEndpoint}>
              <Text style={[styles.inlineLabel, { color: C.textSecondary }]}>Base URL</Text>
              <TextInput
                style={[styles.secretInput, { color: C.text, borderColor: C.border, backgroundColor: C.inputBg }]}
                value={svc.baseUrl}
                onChangeText={(v) => {
                  updateService({ baseUrl: v });
                  setSaveNotice('服务地址已修改，记得保存');
                }}
                placeholder="https://your-api.com/v1"
                placeholderTextColor={C.textSecondary}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Text style={[styles.endpointHint, { color: C.textSecondary }]}>OpenAI-compatible endpoint，系统会请求 /models 和 /chat/completions。</Text>
            </View>
          )}
        </View>

        <View style={styles.capabilityGrid}>
          <CapabilityCard
            title="聊天模型"
            subtitle="负责日常回复、关系好感和记忆确认"
            value={svc.model}
            placeholder="模型名称"
            onChangeText={(v) => updateService({ model: v })}
            onSync={() => handleFetchModels('chat')}
            onTest={() => runConnectionTest('chat')}
            loading={isFetchingModels && fetchingTarget === 'chat'}
            testing={isTesting}
            colors={C}
          />
          <CapabilityCard
            title="视觉模型"
            subtitle="用于画面理解、图片聊天和后续漫画素材辅助"
            value={svc.visionModel}
            placeholder="视觉模型名称"
            onChangeText={(v) => updateService({ visionModel: v })}
            onSync={() => handleFetchModels('vision')}
            onTest={() => runConnectionTest('vision')}
            loading={isFetchingModels && fetchingTarget === 'vision'}
            testing={isTesting}
            colors={C}
          />
        </View>

        {showModelPicker && modelList.length > 0 && (
          <View style={[styles.modelPickerCard, { backgroundColor: C.surface, borderColor: C.border }]}>
            <Text style={[styles.pickerTitle, { color: C.text }]}>选择{showModelPicker === 'chat' ? '聊天' : '视觉'}模型</Text>
            {modelList.slice(0, 30).map((m) => (
              <TouchableOpacity
                key={m}
                style={[styles.modelOption, { borderBottomColor: C.border }]}
                onPress={() => {
                  if (showModelPicker === 'chat') updateService({ model: m });
                  else updateService({ visionModel: m });
                  setShowModelPicker(null);
                  setSaveNotice('模型已修改，记得保存');
                }}
              >
                <Text style={[styles.modelOptionText, { color: C.text }]} selectable>{m}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={() => setShowModelPicker(null)}>
              <Text style={[styles.cancelPicker, { color: C.primary }]}>收起列表</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.secondaryBtn, { borderColor: C.primary }]}
            onPress={() => runConnectionTest('all')}
            disabled={isTesting}
          >
            {isTesting ? (
              <ActivityIndicator color={C.primary} />
            ) : (
              <Text style={[styles.secondaryBtnText, { color: C.primary }]}>验证全部</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: C.primary }]} onPress={handleSave}>
            <Text style={styles.primaryBtnText}>保存配置</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function MetricCard({
  label,
  value,
  tone,
  colors,
}: {
  label: string;
  value: string;
  tone: 'ready' | 'pending' | 'error';
  colors: ReturnType<typeof useThemeColors>;
}) {
  const toneColor = tone === 'ready' ? colors.primary : tone === 'error' ? colors.danger : colors.textSecondary;
  return (
    <View style={[styles.metricCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.metricValue, { color: toneColor }]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function CapabilityCard({
  title,
  subtitle,
  value,
  placeholder,
  onChangeText,
  onSync,
  onTest,
  loading,
  testing,
  colors,
}: {
  title: string;
  subtitle: string;
  value: string;
  placeholder: string;
  onChangeText: (text: string) => void;
  onSync: () => void;
  onTest: () => void;
  loading: boolean;
  testing: boolean;
  colors: ReturnType<typeof useThemeColors>;
}) {
  return (
    <View style={[styles.capabilityCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.cardTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>{subtitle}</Text>
      <TextInput
        style={[styles.modelInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBg }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
        autoCapitalize="none"
        secureTextEntry={false}
      />
      <View style={styles.capabilityActions}>
        <TouchableOpacity style={[styles.capabilityBtn, { borderColor: colors.border }]} onPress={onSync}>
          {loading ? <ActivityIndicator size="small" color={colors.primary} /> : <Text style={[styles.capabilityBtnText, { color: colors.primary }]}>同步模型</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={[styles.capabilityBtn, { borderColor: colors.border }]} onPress={onTest} disabled={testing}>
          <Text style={[styles.capabilityBtnText, { color: colors.primary }]}>{testing ? '验证中' : '测试能力'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 32, gap: 16 },
  hero: { gap: 6 },
  pageTitle: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '900',
  },
  pageDesc: {
    fontSize: 15,
    lineHeight: 22,
  },
  dashboardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricCard: {
    width: '48%',
    minHeight: 82,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 22,
    padding: 14,
    justifyContent: 'space-between',
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: '800',
  },
  metricValue: {
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '900',
  },
  testBanner: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 24,
    padding: 16,
    gap: 6,
  },
  testBannerTitle: {
    fontSize: 18,
    fontWeight: '900',
  },
  testBannerDetail: {
    fontSize: 13,
    lineHeight: 20,
  },
  groupLabel: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.6,
    marginTop: 2,
  },
  providerRail: {
    gap: 10,
    paddingRight: 4,
  },
  providerCard: {
    width: 238,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 24,
    padding: 16,
    gap: 7,
  },
  providerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  providerName: { fontSize: 20, fontWeight: '900' },
  providerBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  providerBadgeText: { fontSize: 11, fontWeight: '900' },
  providerUseCase: { fontSize: 12, fontWeight: '900' },
  providerDesc: { fontSize: 13, lineHeight: 19 },
  vaultCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 26,
    padding: 16,
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  cardTitle: { fontSize: 19, fontWeight: '900' },
  cardDesc: { fontSize: 12, lineHeight: 18, marginTop: 3 },
  smallPill: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  smallPillText: { fontSize: 12, fontWeight: '900' },
  secretInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  vaultActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  secondaryMiniBtn: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  secondaryMiniText: { fontSize: 12, fontWeight: '900' },
  vaultHint: { flex: 1, fontSize: 12, lineHeight: 17 },
  customEndpoint: {
    gap: 8,
    paddingTop: 6,
  },
  inlineLabel: { fontSize: 12, fontWeight: '900' },
  endpointHint: { fontSize: 12, lineHeight: 18 },
  capabilityGrid: { gap: 12 },
  capabilityCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 26,
    padding: 16,
    gap: 10,
  },
  modelInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
  },
  capabilityActions: {
    flexDirection: 'row',
    gap: 10,
  },
  capabilityBtn: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    paddingVertical: 11,
    alignItems: 'center',
  },
  capabilityBtnText: { fontSize: 13, fontWeight: '900' },
  modelPickerCard: {
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    maxHeight: 280,
  },
  pickerTitle: {
    fontSize: 14,
    fontWeight: '900',
    padding: 14,
    paddingBottom: 9,
  },
  modelOption: {
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modelOptionText: { fontSize: 14 },
  cancelPicker: { textAlign: 'center', padding: 13, fontSize: 14, fontWeight: '900' },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 2,
  },
  secondaryBtn: {
    flex: 0.8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 28,
    paddingVertical: 15,
    alignItems: 'center',
  },
  secondaryBtnText: { fontSize: 15, fontWeight: '900' },
  primaryBtn: {
    flex: 1,
    borderRadius: 28,
    paddingVertical: 15,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '900' },
});
