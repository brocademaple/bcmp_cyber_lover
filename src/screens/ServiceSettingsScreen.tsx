import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList, ServiceProvider } from '../types';
import { useSettingsStore, PROVIDER_CONFIGS } from '../store/settingsStore';
import { testConnection, fetchModelList } from '../services/aiService';
import { useThemeColors } from '../utils/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ServiceSettings'>;

const PROVIDERS: { value: ServiceProvider; label: string }[] = [
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'siliconflow', label: '硅基流动' },
  { value: 'custom', label: '自定义' },
];

export default function ServiceSettingsScreen({ navigation }: Props) {
  const C = useThemeColors();
  const { settings, updateService, saveSettings } = useSettingsStore();
  const svc = settings.service;

  const [isTesting, setIsTesting] = useState(false);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [modelList, setModelList] = useState<string[]>([]);
  const [showModelPicker, setShowModelPicker] = useState<'main' | 'vision' | null>(null);

  const handleProviderSelect = (p: ServiceProvider) => {
    updateService({
      provider: p,
      model: PROVIDER_CONFIGS[p].defaultModel,
      baseUrl: PROVIDER_CONFIGS[p].baseUrl,
    });
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    const ok = await testConnection(svc);
    setIsTesting(false);
    Alert.alert(ok ? '连接成功 ✅' : '连接失败 ❌', ok ? '服务连接正常' : '请检查API密钥和网络连接');
  };

  const handleFetchModels = async (type: 'main' | 'vision') => {
    setIsFetchingModels(true);
    const list = await fetchModelList(svc);
    setIsFetchingModels(false);
    if (list.length === 0) {
      Alert.alert('获取失败', '请先配置API密钥');
      return;
    }
    setModelList(list);
    setShowModelPicker(type);
  };

  const handleSave = async () => {
    await saveSettings();
    navigation.goBack();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: C.background }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[styles.sectionTitle, { color: C.text }]}>服务提供商：</Text>

        <View style={[styles.card, { backgroundColor: C.surface, borderColor: C.border }]}>
          {PROVIDERS.map((p) => (
            <TouchableOpacity
              key={p.value}
              style={[styles.radioRow, { borderBottomColor: C.border }]}
              onPress={() => handleProviderSelect(p.value)}
            >
              <View style={[styles.radio, { borderColor: C.primary }]}>
                {svc.provider === p.value && (
                  <View style={[styles.radioFill, { backgroundColor: C.primary }]} />
                )}
              </View>
              <Text style={[styles.radioLabel, { color: C.text }]}>{p.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.fieldLabel, { color: C.textSecondary }]}>输入API密钥：</Text>
        <TextInput
          style={[styles.input, { color: C.text, borderColor: C.border, backgroundColor: C.surface }]}
          value={svc.apiKey}
          onChangeText={(v) => updateService({ apiKey: v })}
          placeholder="sk-..."
          placeholderTextColor={C.textSecondary}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
        />

        {svc.provider === 'custom' && (
          <>
            <Text style={[styles.fieldLabel, { color: C.textSecondary }]}>自定义API地址：</Text>
            <TextInput
              style={[styles.input, { color: C.text, borderColor: C.border, backgroundColor: C.surface }]}
              value={svc.baseUrl}
              onChangeText={(v) => updateService({ baseUrl: v })}
              placeholder="https://your-api.com/v1"
              placeholderTextColor={C.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </>
        )}

        <Text style={[styles.fieldLabel, { color: C.textSecondary }]}>选择模型：</Text>
        <View style={styles.modelRow}>
          <TextInput
            style={[styles.modelInput, { color: C.text, borderColor: C.border, backgroundColor: C.surface }]}
            value={svc.model}
            onChangeText={(v) => updateService({ model: v })}
            placeholder="模型名称"
            placeholderTextColor={C.textSecondary}
            autoCapitalize="none"
          />
          <TouchableOpacity
            style={[styles.fetchBtn, { borderColor: C.primary }]}
            onPress={() => handleFetchModels('main')}
          >
            {isFetchingModels ? (
              <ActivityIndicator size="small" color={C.primary} />
            ) : (
              <Text style={[styles.fetchBtnText, { color: C.primary }]}>获取列表</Text>
            )}
          </TouchableOpacity>
        </View>

        <Text style={[styles.fieldLabel, { color: C.textSecondary }]}>选择辅助视觉模型：</Text>
        <Text style={[styles.fieldDesc, { color: C.textSecondary }]}>用于视频通话中的画面理解（多模态模型）</Text>
        <View style={styles.modelRow}>
          <TextInput
            style={[styles.modelInput, { color: C.text, borderColor: C.border, backgroundColor: C.surface }]}
            value={svc.visionModel}
            onChangeText={(v) => updateService({ visionModel: v })}
            placeholder="视觉模型名称"
            placeholderTextColor={C.textSecondary}
            autoCapitalize="none"
          />
          <TouchableOpacity
            style={[styles.fetchBtn, { borderColor: C.primary }]}
            onPress={() => handleFetchModels('vision')}
          >
            <Text style={[styles.fetchBtnText, { color: C.primary }]}>获取列表</Text>
          </TouchableOpacity>
        </View>

        {/* Model picker */}
        {showModelPicker && modelList.length > 0 && (
          <View style={[styles.modelPickerCard, { backgroundColor: C.surface, borderColor: C.border }]}>
            <Text style={[styles.pickerTitle, { color: C.text }]}>选择模型</Text>
            {modelList.slice(0, 30).map((m) => (
              <TouchableOpacity
                key={m}
                style={[styles.modelOption, { borderBottomColor: C.border }]}
                onPress={() => {
                  if (showModelPicker === 'main') updateService({ model: m });
                  else updateService({ visionModel: m });
                  setShowModelPicker(null);
                }}
              >
                <Text style={[styles.modelOptionText, { color: C.text }]}>{m}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={() => setShowModelPicker(null)}>
              <Text style={[styles.cancelPicker, { color: C.primary }]}>取消</Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity
          style={[styles.testBtn, { borderColor: C.primary }]}
          onPress={handleTestConnection}
          disabled={isTesting}
        >
          {isTesting ? (
            <ActivityIndicator color={C.primary} />
          ) : (
            <Text style={[styles.testBtnText, { color: C.primary }]}>测试连接</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={[styles.saveBtn, { backgroundColor: C.primary }]} onPress={handleSave}>
          <Text style={styles.saveBtnText}>保存</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: C.danger }]} onPress={() => navigation.goBack()}>
          <Text style={styles.saveBtnText}>取消</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  card: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    marginBottom: 16,
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  radioFill: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  radioLabel: { fontSize: 16 },
  fieldLabel: { fontSize: 14, marginBottom: 6, marginTop: 4 },
  fieldDesc: { fontSize: 12, marginBottom: 6, marginTop: -4 },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: 12,
  },
  modelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  modelInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  fetchBtn: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minWidth: 72,
    alignItems: 'center',
  },
  fetchBtnText: { fontSize: 13 },
  modelPickerCard: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    marginBottom: 16,
    maxHeight: 280,
  },
  pickerTitle: {
    fontSize: 14,
    fontWeight: '600',
    padding: 12,
    paddingBottom: 8,
  },
  modelOption: {
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modelOptionText: { fontSize: 14 },
  cancelPicker: { textAlign: 'center', padding: 12, fontSize: 14 },
  testBtn: {
    borderWidth: 1,
    borderRadius: 25,
    paddingVertical: 13,
    alignItems: 'center',
    marginBottom: 10,
  },
  testBtnText: { fontSize: 15 },
  saveBtn: {
    borderRadius: 25,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  cancelBtn: {
    borderRadius: 25,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 24,
  },
});
