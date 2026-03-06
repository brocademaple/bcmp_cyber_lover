import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { RootStackParamList, Character } from '../types';
import { useChatStore } from '../store/chatStore';
import { useSettingsStore } from '../store/settingsStore';
import { useThemeColors } from '../utils/theme';
import { Colors } from '../utils/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Main'>;

function CharacterCard({ character, onPress, onEdit }: {
  character: Character;
  onPress: () => void;
  onEdit: () => void;
}) {
  const C = useThemeColors();
  return (
    <TouchableOpacity style={[styles.card, { backgroundColor: C.surface, borderColor: C.border }]} onPress={onPress} activeOpacity={0.8}>
      <LinearGradient
        colors={[C.primaryLight + '22', C.accent + '11']}
        style={styles.cardGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <View style={[styles.avatarBig, { backgroundColor: C.primaryLight + '33' }]}>
        <Text style={styles.avatarBigText}>{character.avatar}</Text>
      </View>
      <View style={styles.cardContent}>
        <Text style={[styles.cardName, { color: C.text }]}>{character.name}</Text>
        <Text style={[styles.cardPersonality, { color: C.textSecondary }]}>{character.personality}</Text>
        <Text style={[styles.cardGreeting, { color: C.textSecondary }]} numberOfLines={2}>
          {character.greeting}
        </Text>
      </View>
      <TouchableOpacity onPress={onEdit} style={styles.editBtn}>
        <Text style={[styles.editBtnText, { color: C.primary }]}>编辑</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

export default function HomeScreen({ navigation }: Props) {
  const C = useThemeColors();
  const { characters, loadCharacters } = useChatStore();
  const { loadSettings } = useSettingsStore();

  useEffect(() => {
    loadCharacters();
    loadSettings();
  }, []);

  const handleOpenChat = (character: Character) => {
    navigation.navigate('Chat', { characterId: character.id });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: C.background }]}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primaryDark} />

      {/* Header */}
      <LinearGradient
        colors={[Colors.primaryDark, Colors.primary]}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Text style={styles.headerTitle}>AI 伴侣</Text>
        <Text style={styles.headerSub}>选择你的专属伴侣</Text>
        <TouchableOpacity
          style={styles.settingsBtn}
          onPress={() => navigation.navigate('Settings')}
        >
          <Text style={styles.settingsBtnText}>⚙️</Text>
        </TouchableOpacity>
      </LinearGradient>

      <FlatList
        data={characters}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <CharacterCard
            character={item}
            onPress={() => handleOpenChat(item)}
            onEdit={() => navigation.navigate('CharacterEditor', { characterId: item.id })}
          />
        )}
        ListFooterComponent={
          <TouchableOpacity
            style={[styles.addBtn, { borderColor: C.primary }]}
            onPress={() => navigation.navigate('CharacterEditor', {})}
          >
            <Text style={[styles.addBtnText, { color: C.primary }]}>＋ 创建新角色</Text>
          </TouchableOpacity>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    position: 'relative',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
  },
  headerSub: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
  },
  settingsBtn: {
    position: 'absolute',
    top: 16,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsBtnText: { fontSize: 22 },
  list: { padding: 16, gap: 12 },
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
    elevation: 2,
    shadowColor: '#7b3f5e',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  cardGradient: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
  },
  avatarBig: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  avatarBigText: { fontSize: 36 },
  cardContent: { flex: 1 },
  cardName: { fontSize: 18, fontWeight: '600', marginBottom: 2 },
  cardPersonality: { fontSize: 12, marginBottom: 4 },
  cardGreeting: { fontSize: 13, lineHeight: 18 },
  editBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  editBtnText: { fontSize: 14 },
  addBtn: {
    borderWidth: 1.5,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    borderStyle: 'dashed',
    marginTop: 4,
  },
  addBtnText: { fontSize: 16, fontWeight: '500' },
});
