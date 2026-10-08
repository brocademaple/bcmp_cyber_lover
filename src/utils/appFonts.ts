import { Platform } from 'react-native';

// Platform fonts avoid blocking startup on six large bundled CJK font files.
// Keep these exported names stable so existing screen styles remain compatible.
const systemSans = Platform.select({
  ios: 'System',
  android: 'sans-serif',
  web: 'system-ui',
  default: 'System',
});

const systemSerif = Platform.select({
  ios: 'Songti SC',
  android: 'serif',
  web: 'ui-serif',
  default: 'serif',
});

export const NOTO_SERIF_SC = {
  regular: systemSerif,
  bold: systemSerif,
  black: systemSerif,
} as const;

export const NOTO_SANS_SC = {
  regular: systemSans,
  medium: systemSans,
  bold: systemSans,
} as const;
