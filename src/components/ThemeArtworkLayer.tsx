import React from 'react';
import { Image, ImageSourcePropType, StyleSheet, View } from 'react-native';
import { useThemeId } from '../utils/theme';

type ArtworkVariant = 'home' | 'chat';

interface Props {
  variant: ArtworkVariant;
  collapsed?: boolean;
}

interface ArtworkItem {
  source: ImageSourcePropType;
  style: object;
}

export default function ThemeArtworkLayer({ variant, collapsed = false }: Props) {
  const themeId = useThemeId();
  const items =
    themeId === 'softSweet'
      ? variant === 'home'
        ? sweetHome
        : sweetChat
      : themeId === 'urbanClear'
        ? variant === 'home'
          ? urbanHome
          : urbanChat
        : [];

  if (items.length === 0) return null;

  return (
    <View
      pointerEvents="none"
      style={[styles.layer, collapsed && styles.collapsedLayer]}
    >
      {items.map((item, index) => (
        <Image
          key={`${variant}-${themeId}-${index}`}
          source={item.source}
          style={[styles.artwork, item.style]}
          resizeMode="contain"
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 3,
  },
  collapsedLayer: {
    opacity: 0.72,
  },
  artwork: {
    position: 'absolute',
  },
  sweetHomeBubble: {
    top: 118,
    right: -92,
    width: 220,
    height: 56,
    opacity: 0.62,
    transform: [{ rotate: '-3deg' }],
  },
  sweetHomeCharm: {
    top: 210,
    left: -62,
    width: 124,
    height: 178,
    opacity: 0.66,
    transform: [{ rotate: '-5deg' }],
  },
  sweetHomeRibbon: {
    bottom: 236,
    left: 26,
    width: 310,
    height: 70,
    opacity: 0.9,
  },
  sweetHomeFrame: {
    top: 282,
    right: -28,
    width: 132,
    height: 74,
    opacity: 0.64,
    transform: [{ rotate: '4deg' }],
  },
  sweetHomeBow: {
    bottom: 166,
    left: 30,
    width: 182,
    height: 42,
    opacity: 0.86,
  },
  sweetChatBubble: {
    top: 82,
    right: -58,
    width: 278,
    height: 70,
    opacity: 0.54,
    transform: [{ rotate: '-2deg' }],
  },
  sweetChatInput: {
    bottom: 16,
    left: 18,
    width: 220,
    height: 46,
    opacity: 0.38,
  },
  sweetChatBow: {
    bottom: 110,
    right: 24,
    width: 150,
    height: 38,
    opacity: 0.54,
  },
  urbanHomeCity: {
    top: 192,
    left: -82,
    width: 188,
    height: 108,
    opacity: 0.68,
  },
  urbanHomePendants: {
    top: 30,
    right: -10,
    width: 210,
    height: 86,
    opacity: 0.9,
  },
  urbanHomeWindow: {
    bottom: 318,
    right: -62,
    width: 132,
    height: 132,
    opacity: 0.7,
  },
  urbanHomeSlider: {
    bottom: 178,
    left: 18,
    width: 238,
    height: 76,
    opacity: 0.76,
  },
  urbanHomeNight: {
    top: 286,
    right: -18,
    width: 106,
    height: 122,
    opacity: 0.64,
  },
  urbanChatRose: {
    top: 52,
    right: -38,
    width: 300,
    height: 56,
    opacity: 0.42,
  },
  urbanChatPearl: {
    top: 112,
    left: 72,
    width: 270,
    height: 54,
    opacity: 0.3,
  },
  urbanChatCity: {
    bottom: 116,
    left: -48,
    width: 218,
    height: 124,
    opacity: 0.36,
  },
  urbanChatWindow: {
    bottom: 184,
    right: -36,
    width: 136,
    height: 136,
    opacity: 0.44,
  },
});

const sweetHome: ArtworkItem[] = [
  { source: require('../../assets/style/soft-sweet/bubble-pink.png'), style: styles.sweetHomeBubble },
  { source: require('../../assets/style/soft-sweet/heart-charm-card.png'), style: styles.sweetHomeCharm },
  { source: require('../../assets/style/soft-sweet/ribbon-panel.png'), style: styles.sweetHomeRibbon },
  { source: require('../../assets/style/soft-sweet/bow-divider.png'), style: styles.sweetHomeBow },
];

const sweetChat: ArtworkItem[] = [
  { source: require('../../assets/style/soft-sweet/bubble-pink.png'), style: styles.sweetChatBubble },
  { source: require('../../assets/style/soft-sweet/input-bar.png'), style: styles.sweetChatInput },
  { source: require('../../assets/style/soft-sweet/bow-divider.png'), style: styles.sweetChatBow },
];

const urbanHome: ArtworkItem[] = [
  { source: require('../../assets/style/urban-luxury/city-glass-card.png'), style: styles.urbanHomeCity },
  { source: require('../../assets/style/urban-luxury/crystal-pendants.png'), style: styles.urbanHomePendants },
  { source: require('../../assets/style/urban-luxury/slider-pendant.png'), style: styles.urbanHomeSlider },
];

const urbanChat: ArtworkItem[] = [
  { source: require('../../assets/style/urban-luxury/rose-chat-bubble.png'), style: styles.urbanChatRose },
  { source: require('../../assets/style/urban-luxury/pearl-chat-bubble.png'), style: styles.urbanChatPearl },
  { source: require('../../assets/style/urban-luxury/city-glass-card.png'), style: styles.urbanChatCity },
  { source: require('../../assets/style/urban-luxury/round-window.png'), style: styles.urbanChatWindow },
];
