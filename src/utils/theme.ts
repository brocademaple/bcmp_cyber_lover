import { useColorScheme } from 'react-native';
import { Colors, DarkColors } from './colors';
import { useSettingsStore } from '../store/settingsStore';

export function useThemeColors() {
  const systemScheme = useColorScheme();
  const darkModeSetting = useSettingsStore((s) => s.settings.advanced.darkMode);

  const isDark =
    darkModeSetting === 'dark' ||
    (darkModeSetting === 'auto' && systemScheme === 'dark');

  return isDark ? DarkColors : Colors;
}
