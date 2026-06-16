import { useColorScheme } from 'react-native';
import { ThemeMap, ThemeMapDark } from './colors';
import { useSettingsStore } from '../store/settingsStore';
import { useChatStore } from '../store/chatStore';

export function useThemeColors() {
  const selectedCharacterId = useSettingsStore((s) => s.settings.selectedCharacterId);
  const advanced = useSettingsStore((s) => s.settings.advanced);
  const characterTheme = useChatStore(
    (s) => s.characters.find((c) => c.id === selectedCharacterId)?.theme
  );
  const systemScheme = useColorScheme();

  const theme = advanced.themeMode === 'manual'
    ? advanced.theme
    : (characterTheme || advanced.theme || 'pink');
  const isDark = advanced.darkMode === 'dark' || (advanced.darkMode === 'auto' && systemScheme === 'dark');

  return isDark ? (ThemeMapDark[theme] || ThemeMapDark.pink) : (ThemeMap[theme] || ThemeMap.pink);
}
