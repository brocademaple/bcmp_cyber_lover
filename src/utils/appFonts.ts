import { Platform } from 'react-native';

/**
 * 饮之字体（完整本地 OFL，勿改用 Google Fonts 精简子集——曾导致缺字豆腐块）
 * 注册名（useFonts / Font.loadAsync 的 key）：
 *   ZCOOLXiaoWei          ← assets/fonts/ZCOOLXiaoWei-Regular.ttf（站酷小薇，标题/字标）
 *   GenSenRounded2TW-R    ← assets/fonts/GenSenRounded2TW-R.otf（源泉圆体 Regular，正文）
 *   GenSenRounded2TW-M    ← assets/fonts/GenSenRounded2TW-M.otf（源泉圆体 Medium，按钮/强调）
 *
 * Web：标题用小薇优先、缺字落到圆体的 font-family 栈。
 * Native：RN 无 CSS 式多字体回退；标题用完整小薇文件，正文用圆体。
 * 自定义字体只有单一字重时，样式里不要再设 fontWeight: '700'|'900'，否则 iOS 可能回退系统字体。
 */
export const YINZHI_FONT_FILES = {
  ZCOOLXiaoWei: require('../../assets/fonts/ZCOOLXiaoWei-Regular.ttf'),
  'GenSenRounded2TW-R': require('../../assets/fonts/GenSenRounded2TW-R.otf'),
  'GenSenRounded2TW-M': require('../../assets/fonts/GenSenRounded2TW-M.otf'),
} as const;

const TITLE_NATIVE = 'ZCOOLXiaoWei';
const BODY_R_NATIVE = 'GenSenRounded2TW-R';
const BODY_M_NATIVE = 'GenSenRounded2TW-M';

const TITLE_WEB = 'ZCOOLXiaoWei, GenSenRounded2TW-R, system-ui, sans-serif';
const BODY_R_WEB = 'GenSenRounded2TW-R, system-ui, sans-serif';
const BODY_M_WEB = 'GenSenRounded2TW-M, GenSenRounded2TW-R, system-ui, sans-serif';

const isWeb = Platform.OS === 'web';

/** 标题 / 字标：站酷小薇（Web 带圆体回退） */
export const YINZHI_TITLE = isWeb ? TITLE_WEB : TITLE_NATIVE;

/** 正文 / 选项 / 按钮：源泉圆体 */
export const YINZHI_BODY = {
  regular: isWeb ? BODY_R_WEB : BODY_R_NATIVE,
  medium: isWeb ? BODY_M_WEB : BODY_M_NATIVE,
  // 无独立 Bold 文件，强调用 Medium
  bold: isWeb ? BODY_M_WEB : BODY_M_NATIVE,
} as const;

/**
 * 兼容旧导出名（历史屏幕大量引用）。
 * 实际字体：SERIF → 站酷小薇（标题），SANS → 源泉圆体（正文）。不是 Noto。
 */
export const NOTO_SERIF_SC = {
  regular: YINZHI_TITLE,
  bold: YINZHI_TITLE,
  black: YINZHI_TITLE,
} as const;

export const NOTO_SANS_SC = {
  regular: YINZHI_BODY.regular,
  medium: YINZHI_BODY.medium,
  bold: YINZHI_BODY.bold,
} as const;
