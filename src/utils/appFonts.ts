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

// 饮之视觉规范字体（A+C 沉浸式 UI）
// 标题/名牌：站酷小薇（本地完整字库）
// 丝带/标签：GenSenRounded2 TW Regular
export const YINZHI_FONTS = {
  // 标题、字标、状态名牌
  title: Platform.select({
    web: 'ZCOOL XiaoWei, GenSenRounded2 TW, sans-serif',
    default: systemSans, // TODO: 移动端本地字库集成
  }),
  // 对话丝带、标签、按钮、输入
  body: Platform.select({
    web: 'GenSenRounded2 TW, sans-serif',
    default: systemSans,
  }),
  // 强调
  emphasis: Platform.select({
    web: 'GenSenRounded2 TW, sans-serif',
    default: systemSans,
  }),
} as const;
