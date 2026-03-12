import { useColorScheme } from 'react-native';
import { ThemeMap, ThemeMapDark } from './colors';
import { useSettingsStore } from '../store/settingsStore';

export function useThemeColors() {
  const theme = useSettingsStore((s) => s.settings.advanced.theme);
  const darkMode = useSettingsStore((s) => s.settings.advanced.darkMode);
  const systemScheme = useColorScheme();

  const isDark = darkMode === 'dark' || (darkMode === 'auto' && systemScheme === 'dark');

  return isDark ? (ThemeMapDark[theme] || ThemeMapDark.pink) : (ThemeMap[theme] || ThemeMap.pink);
}
