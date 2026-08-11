import React from 'react';
import { StyleSheet, Text, TextInput, TextStyle } from 'react-native';
import { NotoSansSC_400Regular } from '@expo-google-fonts/noto-sans-sc/400Regular';
import { NotoSansSC_500Medium } from '@expo-google-fonts/noto-sans-sc/500Medium';
import { NotoSansSC_700Bold } from '@expo-google-fonts/noto-sans-sc/700Bold';
import { NotoSerifSC_400Regular } from '@expo-google-fonts/noto-serif-sc/400Regular';
import { NotoSerifSC_700Bold } from '@expo-google-fonts/noto-serif-sc/700Bold';
import { NotoSerifSC_900Black } from '@expo-google-fonts/noto-serif-sc/900Black';

const patchedFlag = Symbol.for('bcmp.notoSerifSCPatched');

export const NOTO_SERIF_SC = {
  regular: 'NotoSerifSC_400Regular',
  bold: 'NotoSerifSC_700Bold',
  black: 'NotoSerifSC_900Black',
} as const;

export const NOTO_SANS_SC = {
  regular: 'NotoSansSC_400Regular',
  medium: 'NotoSansSC_500Medium',
  bold: 'NotoSansSC_700Bold',
} as const;

export const APP_FONT_SOURCES = {
  NotoSansSC_400Regular,
  NotoSansSC_500Medium,
  NotoSansSC_700Bold,
  NotoSerifSC_400Regular,
  NotoSerifSC_700Bold,
  NotoSerifSC_900Black,
};

function hasExplicitFontFamily(style: unknown) {
  const flat = StyleSheet.flatten(style) as TextStyle | undefined;
  return Boolean(flat?.fontFamily);
}

function resolveFontFamily(style: unknown) {
  const flat = StyleSheet.flatten(style) as TextStyle | undefined;
  const rawWeight = flat?.fontWeight;
  const weight =
    typeof rawWeight === 'number'
      ? rawWeight
      : rawWeight === 'bold'
        ? 700
        : Number.parseInt(String(rawWeight || '400'), 10);

  if (weight >= 900) return NOTO_SERIF_SC.black;
  if (weight >= 600) return NOTO_SERIF_SC.bold;
  return NOTO_SERIF_SC.regular;
}

function patchTextComponent(Component: typeof Text | typeof TextInput) {
  const target = Component as typeof Component & {
    render?: (...args: unknown[]) => React.ReactElement;
    [patchedFlag]?: boolean;
  };

  if (target[patchedFlag] || typeof target.render !== 'function') return;

  const originalRender = target.render;
  target.render = function renderWithNotoSerifSC(...args: unknown[]) {
    const element = originalRender.apply(this, args);
    if (!React.isValidElement(element)) {
      return element;
    }

    const typedElement = element as React.ReactElement<{ style?: unknown }>;
    if (hasExplicitFontFamily(typedElement.props.style)) {
      return typedElement;
    }

    return React.cloneElement(typedElement, {
      style: [
        typedElement.props.style,
        {
          fontFamily: resolveFontFamily(typedElement.props.style),
          fontWeight: undefined,
        },
      ],
    });
  };
  target[patchedFlag] = true;
}

export function installNotoSerifSCGlobalFont() {
  patchTextComponent(Text);
  patchTextComponent(TextInput);
}
