// 粉色主题（默认）
export const PinkTheme = {
  primary: '#ff6b9d',
  primaryLight: '#ffb3d9',
  primaryDark: '#c2185b',
  accent: '#ffc1e3',
  accentLight: '#ffe0f0',
  background: '#fff5f8',
  surface: '#ffffff',
  text: '#4a1942',
  textSecondary: '#b8739f',
  bubbleUser: '#ff6b9d',
  bubbleAssistant: '#ffffff',
  bubbleUserText: '#ffffff',
  bubbleAssistantText: '#4a1942',
  border: '#ffd4e5',
  inputBg: '#fff0f5',
  shadow: 'rgba(255, 107, 157, 0.2)',
  chatBackgroundOverlay: 'rgba(0,0,0,0.48)',
};

export const PinkThemeDark = {
  primary: '#ff6b9d',
  primaryLight: '#ff8fb3',
  primaryDark: '#c2185b',
  accent: '#d4779d',
  accentLight: '#5a3a4d',
  background: '#1a0d15',
  surface: '#2d1a26',
  text: '#ffd4e5',
  textSecondary: '#b8739f',
  bubbleUser: '#ff6b9d',
  bubbleAssistant: '#2d1a26',
  bubbleUserText: '#ffffff',
  bubbleAssistantText: '#ffd4e5',
  border: '#4a2d3f',
  inputBg: '#3d2433',
  shadow: 'rgba(255, 107, 157, 0.3)',
  chatBackgroundOverlay: 'rgba(0,0,0,0.55)',
};

// 蓝色主题
export const BlueTheme = {
  primary: '#5dade2',
  primaryLight: '#85c1e9',
  primaryDark: '#2874a6',
  accent: '#aed6f1',
  accentLight: '#d6eaf8',
  background: '#f0f8ff',
  surface: '#ffffff',
  text: '#1a3a52',
  textSecondary: '#5d8aa8',
  bubbleUser: '#5dade2',
  bubbleAssistant: '#ffffff',
  bubbleUserText: '#ffffff',
  bubbleAssistantText: '#1a3a52',
  border: '#d4e6f1',
  inputBg: '#ebf5fb',
  shadow: 'rgba(93, 173, 226, 0.2)',
  chatBackgroundOverlay: 'rgba(0,0,0,0.48)',
};

export const BlueThemeDark = {
  primary: '#5dade2',
  primaryLight: '#7dbee8',
  primaryDark: '#2874a6',
  accent: '#5d8aa8',
  accentLight: '#2d4a5a',
  background: '#0d1a24',
  surface: '#1a2f3f',
  text: '#d6eaf8',
  textSecondary: '#85c1e9',
  bubbleUser: '#5dade2',
  bubbleAssistant: '#1a2f3f',
  bubbleUserText: '#ffffff',
  bubbleAssistantText: '#d6eaf8',
  border: '#2d4a5a',
  inputBg: '#243847',
  shadow: 'rgba(93, 173, 226, 0.3)',
  chatBackgroundOverlay: 'rgba(0,0,0,0.55)',
};

// 黄色主题
export const YellowTheme = {
  primary: '#f9ca24',
  primaryLight: '#ffeaa7',
  primaryDark: '#f39c12',
  accent: '#fdcb6e',
  accentLight: '#fff9e6',
  background: '#fffef7',
  surface: '#ffffff',
  text: '#5a3e1b',
  textSecondary: '#b8860b',
  bubbleUser: '#f9ca24',
  bubbleAssistant: '#ffffff',
  bubbleUserText: '#5a3e1b',
  bubbleAssistantText: '#5a3e1b',
  border: '#ffe8b3',
  inputBg: '#fffaed',
  shadow: 'rgba(249, 202, 36, 0.2)',
  chatBackgroundOverlay: 'rgba(0,0,0,0.48)',
};

export const YellowThemeDark = {
  primary: '#f9ca24',
  primaryLight: '#fdd757',
  primaryDark: '#f39c12',
  accent: '#b8860b',
  accentLight: '#4a3a1a',
  background: '#1a1508',
  surface: '#2d2415',
  text: '#fff9e6',
  textSecondary: '#fdcb6e',
  bubbleUser: '#f9ca24',
  bubbleAssistant: '#2d2415',
  bubbleUserText: '#5a3e1b',
  bubbleAssistantText: '#fff9e6',
  border: '#4a3a1a',
  inputBg: '#3d3020',
  shadow: 'rgba(249, 202, 36, 0.3)',
  chatBackgroundOverlay: 'rgba(0,0,0,0.55)',
};

// 紫色主题
export const PurpleTheme = {
  primary: '#a29bfe',
  primaryLight: '#dfe6e9',
  primaryDark: '#6c5ce7',
  accent: '#d6a2e8',
  accentLight: '#f3e5f5',
  background: '#f8f5ff',
  surface: '#ffffff',
  text: '#4a148c',
  textSecondary: '#9575cd',
  bubbleUser: '#a29bfe',
  bubbleAssistant: '#ffffff',
  bubbleUserText: '#ffffff',
  bubbleAssistantText: '#4a148c',
  border: '#e1d5f7',
  inputBg: '#f3e5f5',
  shadow: 'rgba(162, 155, 254, 0.2)',
  chatBackgroundOverlay: 'rgba(0,0,0,0.48)',
};

export const PurpleThemeDark = {
  primary: '#a29bfe',
  primaryLight: '#b8b1fe',
  primaryDark: '#6c5ce7',
  accent: '#9575cd',
  accentLight: '#3d2a5a',
  background: '#120d1a',
  surface: '#241a2f',
  text: '#f3e5f5',
  textSecondary: '#d6a2e8',
  bubbleUser: '#a29bfe',
  bubbleAssistant: '#241a2f',
  bubbleUserText: '#ffffff',
  bubbleAssistantText: '#f3e5f5',
  border: '#3d2a5a',
  inputBg: '#332447',
  shadow: 'rgba(162, 155, 254, 0.3)',
  chatBackgroundOverlay: 'rgba(0,0,0,0.55)',
};

export const Colors = PinkTheme;

export const ThemeMap = {
  pink: PinkTheme,
  blue: BlueTheme,
  yellow: YellowTheme,
  purple: PurpleTheme,
};

export const ThemeMapDark = {
  pink: PinkThemeDark,
  blue: BlueThemeDark,
  yellow: YellowThemeDark,
  purple: PurpleThemeDark,
};

export type ThemeType = keyof typeof ThemeMap;

