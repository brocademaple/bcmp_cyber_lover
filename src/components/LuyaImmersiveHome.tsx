import React, { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  ImageSourcePropType,
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ResilientImage from './ResilientImage';
import { YINZHI_BODY, YINZHI_TITLE } from '../utils/appFonts';

const GOLD = '#C4A574';
const INK = '#1F1A1B';
const INK_SOFT = '#3C3032';
const WIDE_BREAKPOINT = 768;

const HOME_PORTRAIT = require('../../assets/luya-home-v3.jpg');
/** Approximate 2.5D layers from luya-home-v3 (no cutout): blurred stage, sharp mid, soft edge haze. */
const HOME_BG = require('../../assets/luya-25d/luya-home-v3-bg.jpg');
const HOME_MID = require('../../assets/luya-25d/luya-home-v3-mid.jpg');
const HOME_FG = require('../../assets/luya-25d/luya-home-v3-fg.png');

type Props = {
  characterName: string;
  relationshipLabel: string;
  activityText: string;
  moodLabel: string;
  lifeSceneLabel: string;
  homeArtMode: 'life' | 'classic';
  showLifeScene: boolean;
  lifeSceneSource?: ImageSourcePropType;
  classicFallbackSources?: ImageSourcePropType[];
  artFallbackExplanation?: string | null;
  statusSavedNotice?: string | null;
  identitySource?: ImageSourcePropType;
  avatarFallbackSources?: ImageSourcePropType[];
  isFocused: boolean;
  onToggleArtMode: (mode: 'life' | 'classic') => void;
  onOpenChat: () => void;
  onOpenRoom: () => void;
  onOpenBottles: () => void;
  onOpenSettings: () => void;
  onOpenProfile: () => void;
  onOpenStatus: () => void;
  onLifeSceneError?: () => void;
};

function LineIcon({ mark, size = 18 }: { mark: string; size?: number }) {
  return (
    <View style={[styles.lineIconRing, { width: size + 14, height: size + 14, borderRadius: (size + 14) / 2 }]}>
      <Text style={[styles.lineIconMark, { fontSize: size, lineHeight: size + 2 }]}>{mark}</Text>
    </View>
  );
}

export default function LuyaImmersiveHome({
  characterName,
  relationshipLabel,
  activityText,
  moodLabel,
  lifeSceneLabel,
  homeArtMode,
  showLifeScene,
  lifeSceneSource,
  classicFallbackSources = [],
  artFallbackExplanation,
  statusSavedNotice,
  identitySource,
  avatarFallbackSources = [],
  isFocused,
  onToggleArtMode,
  onOpenChat,
  onOpenRoom,
  onOpenBottles,
  onOpenSettings,
  onOpenProfile,
  onOpenStatus,
  onLifeSceneError,
}: Props) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isWide = width >= WIDE_BREAKPOINT || width > height;

  const breath = useRef(new Animated.Value(0)).current;
  const drift = useRef(new Animated.Value(0)).current;
  const parallaxX = useRef(new Animated.Value(0)).current;
  const parallaxY = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const breathLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, { toValue: 1, duration: 3400, useNativeDriver: true }),
        Animated.timing(breath, { toValue: 0, duration: 3400, useNativeDriver: true }),
      ])
    );
    const driftLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, { toValue: 1, duration: 5600, useNativeDriver: true }),
        Animated.timing(drift, { toValue: 0, duration: 5600, useNativeDriver: true }),
      ])
    );
    breathLoop.start();
    driftLoop.start();
    return () => {
      breathLoop.stop();
      driftLoop.stop();
    };
  }, [breath, drift]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) + Math.abs(g.dy) > 2,
        onPanResponderMove: (_, g) => {
          const nx = Math.max(-1, Math.min(1, g.dx / 110));
          const ny = Math.max(-1, Math.min(1, g.dy / 110));
          parallaxX.setValue(nx);
          parallaxY.setValue(ny);
        },
        onPanResponderRelease: () => {
          Animated.parallel([
            Animated.spring(parallaxX, { toValue: 0, useNativeDriver: true, friction: 7, tension: 48 }),
            Animated.spring(parallaxY, { toValue: 0, useNativeDriver: true, friction: 7, tension: 48 }),
          ]).start();
        },
        onPanResponderTerminate: () => {
          Animated.parallel([
            Animated.spring(parallaxX, { toValue: 0, useNativeDriver: true, friction: 7 }),
            Animated.spring(parallaxY, { toValue: 0, useNativeDriver: true, friction: 7 }),
          ]).start();
        },
      }),
    [parallaxX, parallaxY]
  );

  // Idle drift adds a slow automatic sway so layered depth reads even without touch.
  const idleX = drift.interpolate({ inputRange: [0, 1], outputRange: [-0.35, 0.35] });
  const idleY = drift.interpolate({ inputRange: [0, 1], outputRange: [0.2, -0.25] });
  const combinedX = Animated.add(parallaxX, idleX);
  const combinedY = Animated.add(parallaxY, idleY);

  // Depth: bg least, mid + breath, soft fg most + opposite bias.
  const bgScale = breath.interpolate({ inputRange: [0, 1], outputRange: [1.08, 1.1] });
  const bgTx = Animated.multiply(combinedX, 6);
  const bgTy = Animated.multiply(combinedY, 4);

  const midScale = breath.interpolate({ inputRange: [0, 1], outputRange: [1.03, 1.07] });
  const midTx = Animated.add(
    breath.interpolate({ inputRange: [0, 1], outputRange: [0, 5] }),
    Animated.multiply(combinedX, 16)
  );
  const midTy = Animated.add(
    breath.interpolate({ inputRange: [0, 1], outputRange: [0, -8] }),
    Animated.multiply(combinedY, 12)
  );

  const hazeTx = Animated.multiply(combinedX, -14);
  const hazeTy = Animated.multiply(combinedY, -10);
  const hazeOpacity = breath.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0.78] });

  const fgTx = Animated.multiply(combinedX, -8);
  const fgTy = Animated.multiply(combinedY, -5);

  const useLayeredPortrait = !(showLifeScene && lifeSceneSource);
  const displayedSource = useLayeredPortrait ? HOME_MID : lifeSceneSource!;
  const fallbacks = useLayeredPortrait
    ? [HOME_PORTRAIT, ...classicFallbackSources]
    : [HOME_PORTRAIT, ...classicFallbackSources];

  const controls = (
    <Animated.View
      style={[
        styles.controlsPanel,
        isWide ? styles.controlsPanelWide : styles.controlsPanelPhone,
        { transform: [{ translateX: fgTx }, { translateY: fgTy }], paddingBottom: Math.max(insets.bottom, 12) },
      ]}
    >
      <View style={styles.nameplate}>
        <View style={styles.cornerTL} />
        <View style={styles.cornerTR} />
        <View style={styles.cornerBL} />
        <View style={styles.cornerBR} />
        <TouchableOpacity onPress={onOpenProfile} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel="查看鹿芽档案">
          <Text style={styles.nameTitle}>{characterName}</Text>
          <Text style={styles.nameMeta}>{relationshipLabel} · {moodLabel}</Text>
        </TouchableOpacity>
        <Text style={styles.guideLine} numberOfLines={2}>{activityText}</Text>
        {statusSavedNotice ? <Text style={styles.notice}>{statusSavedNotice}</Text> : null}
      </View>

      <TouchableOpacity
        style={styles.cta}
        onPress={onOpenChat}
        activeOpacity={0.88}
        accessibilityRole="button"
        accessibilityLabel="和鹿芽说话"
      >
        <Text style={styles.ctaText}>和鹿芽说话</Text>
      </TouchableOpacity>

      <View style={styles.circleRow}>
        <TouchableOpacity style={styles.circleEntry} onPress={onOpenRoom} accessibilityRole="button" accessibilityLabel="鹿芽的房间">
          <LineIcon mark="⌂" />
          <Text style={styles.circleLabel}>房间</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.circleEntry} onPress={onOpenBottles} accessibilityRole="button" accessibilityLabel="瓶子与理解">
          <LineIcon mark="◎" />
          <Text style={styles.circleLabel}>瓶子</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.circleEntry} onPress={onOpenSettings} accessibilityRole="button" accessibilityLabel="打开设置">
          <LineIcon mark="⚙" />
          <Text style={styles.circleLabel}>设置</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.toolbarRow}>
        <View style={styles.artSwitch}>
          {(['life', 'classic'] as const).map((mode) => {
            const selected = mode === 'life' ? showLifeScene : !showLifeScene;
            return (
              <TouchableOpacity
                key={mode}
                onPress={() => onToggleArtMode(mode)}
                style={[styles.artSwitchOption, selected && styles.artSwitchOptionOn]}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={mode === 'life' ? '展示当前生活画面' : '展示经典立绘'}
              >
                <Text style={[styles.artSwitchText, selected && styles.artSwitchTextOn]}>
                  {mode === 'life' ? '生活' : '立绘'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <TouchableOpacity style={styles.statusChip} onPress={onOpenStatus} accessibilityRole="button" accessibilityLabel={`当前状态：${moodLabel}，调整状态`}>
          <Text style={styles.statusChipText}>{moodLabel} · 调整</Text>
        </TouchableOpacity>
      </View>
      {artFallbackExplanation ? <Text style={styles.fallbackHint}>{artFallbackExplanation}</Text> : null}
      {!showLifeScene ? <Text style={styles.sceneCaption}>{lifeSceneLabel}</Text> : <Text style={styles.sceneCaption}>{lifeSceneLabel}</Text>}
    </Animated.View>
  );

  return (
    <View style={[styles.stage, { paddingTop: insets.top }]} {...panResponder.panHandlers}>
      <View style={[styles.stageInner, isWide && styles.stageInnerWide]}>
        <View style={[styles.artStage, isWide && styles.artStageWide]}>
          {useLayeredPortrait ? (
            <>
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.portraitWrap,
                  styles.layerBg,
                  {
                    transform: [
                      { translateX: bgTx },
                      { translateY: bgTy },
                      { scale: bgScale },
                    ],
                  },
                ]}
              >
                <ResilientImage
                  source={HOME_BG}
                  fallbackSources={[HOME_PORTRAIT]}
                  retryKey={Number(isFocused)}
                  style={styles.portraitImage}
                  resizeMode="cover"
                  accessibilityLabel=""
                />
              </Animated.View>

              <Animated.View
                style={[
                  styles.portraitWrap,
                  {
                    transform: [
                      { translateX: midTx },
                      { translateY: midTy },
                      { scale: midScale },
                    ],
                  },
                ]}
              >
                <ResilientImage
                  key={`immersive-mid-${homeArtMode}`}
                  source={HOME_MID}
                  fallbackSources={fallbacks}
                  retryKey={Number(isFocused)}
                  style={styles.portraitImage}
                  resizeMode="cover"
                  accessibilityLabel={`鹿芽立绘：${characterName}`}
                />
              </Animated.View>

              <Animated.View
                pointerEvents="none"
                style={[
                  styles.portraitWrap,
                  styles.layerHaze,
                  {
                    opacity: hazeOpacity,
                    transform: [{ translateX: hazeTx }, { translateY: hazeTy }, { scale: 1.06 }],
                  },
                ]}
              >
                <ResilientImage
                  source={HOME_FG}
                  fallbackSources={[]}
                  retryKey={Number(isFocused)}
                  style={styles.portraitImage}
                  resizeMode="cover"
                  accessibilityLabel=""
                />
              </Animated.View>
            </>
          ) : (
            <Animated.View
              style={[
                styles.portraitWrap,
                {
                  transform: [
                    { translateX: midTx },
                    { translateY: midTy },
                    { scale: midScale },
                  ],
                },
              ]}
            >
              <ResilientImage
                key={`immersive-${homeArtMode}-life`}
                source={displayedSource}
                fallbackSources={fallbacks}
                retryKey={Number(isFocused)}
                style={styles.portraitImage}
                resizeMode="cover"
                accessibilityLabel={`鹿芽生活插画：${lifeSceneLabel}`}
                onError={() => {
                  onLifeSceneError?.();
                }}
              />
            </Animated.View>
          )}

          <LinearGradient
            colors={['rgba(251,246,243,0.08)', 'rgba(251,246,243,0)', 'rgba(20,14,16,0.28)']}
            locations={[0, 0.45, 1]}
            style={styles.shade}
            pointerEvents="none"
          />

          <View style={[styles.topBar, { paddingTop: 8 }]}>
            <TouchableOpacity style={styles.brandChip} onPress={onOpenProfile} activeOpacity={0.85} accessibilityRole="button">
              {identitySource ? (
                <ResilientImage
                  source={identitySource}
                  fallbackSources={avatarFallbackSources}
                  retryKey={Number(isFocused)}
                  style={styles.brandAvatar}
                  resizeMode="cover"
                  accessibilityLabel="鹿芽头像"
                />
              ) : null}
              <View>
                <Text style={styles.brandTitle}>饮之</Text>
                <Text style={styles.brandSub}>{characterName}</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.statusPill} onPress={onOpenStatus} accessibilityRole="button" accessibilityLabel="当前状态">
              <Text style={styles.statusPillText}>{moodLabel}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {controls}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    flex: 1,
    backgroundColor: '#FBF6F3',
  },
  stageInner: {
    flex: 1,
  },
  stageInnerWide: {
    flexDirection: 'row',
    maxWidth: 1180,
    alignSelf: 'center',
    width: '100%',
  },
  artStage: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
  },
  artStageWide: {
    position: 'relative',
    flex: 1.15,
    minHeight: 420,
    margin: 16,
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(196,165,116,0.55)',
  },
  portraitWrap: {
    ...StyleSheet.absoluteFill,
  },
  layerBg: {
    zIndex: 0,
  },
  layerHaze: {
    zIndex: 2,
  },
  portraitImage: {
    width: '100%',
    height: '100%',
  },
  shade: {
    ...StyleSheet.absoluteFill,
  },
  topBar: {
    position: 'absolute',
    top: 10,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 5,
  },
  brandChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(196,165,116,0.7)',
    backgroundColor: 'rgba(255,253,251,0.18)',
  },
  brandAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GOLD,
  },
  brandTitle: {
    fontFamily: YINZHI_TITLE,
    fontSize: 16,
    color: INK,
  },
  brandSub: {
    fontFamily: YINZHI_BODY.regular,
    fontSize: 11,
    color: INK_SOFT,
  },
  statusPill: {
    minHeight: 34,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GOLD,
    backgroundColor: 'rgba(255,253,251,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusPillText: {
    fontFamily: YINZHI_BODY.medium,
    fontSize: 12,
    color: INK,
  },
  controlsPanel: {
    zIndex: 6,
    gap: 12,
  },
  controlsPanelPhone: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 8,
  },
  controlsPanelWide: {
    flex: 0.9,
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 24,
    maxWidth: 420,
  },
  nameplate: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(196,165,116,0.75)',
    backgroundColor: 'rgba(255,253,251,0.22)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 4,
    position: 'relative',
  },
  cornerTL: { position: 'absolute', top: -1, left: -1, width: 12, height: 12, borderTopWidth: 1.5, borderLeftWidth: 1.5, borderColor: GOLD },
  cornerTR: { position: 'absolute', top: -1, right: -1, width: 12, height: 12, borderTopWidth: 1.5, borderRightWidth: 1.5, borderColor: GOLD },
  cornerBL: { position: 'absolute', bottom: -1, left: -1, width: 12, height: 12, borderBottomWidth: 1.5, borderLeftWidth: 1.5, borderColor: GOLD },
  cornerBR: { position: 'absolute', bottom: -1, right: -1, width: 12, height: 12, borderBottomWidth: 1.5, borderRightWidth: 1.5, borderColor: GOLD },
  nameTitle: {
    fontFamily: YINZHI_TITLE,
    fontSize: 28,
    color: INK,
  },
  nameMeta: {
    fontFamily: YINZHI_BODY.regular,
    fontSize: 12,
    color: INK_SOFT,
    marginTop: 2,
  },
  guideLine: {
    fontFamily: YINZHI_BODY.regular,
    fontSize: 14,
    lineHeight: 21,
    color: INK,
    marginTop: 6,
  },
  notice: {
    fontFamily: YINZHI_BODY.regular,
    fontSize: 12,
    color: INK_SOFT,
    marginTop: 4,
  },
  cta: {
    minHeight: 52,
    borderRadius: 999,
    borderWidth: 1.25,
    borderColor: GOLD,
    backgroundColor: 'rgba(231,160,180,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  ctaText: {
    fontFamily: YINZHI_BODY.medium,
    fontSize: 16,
    color: INK,
  },
  circleRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  circleEntry: {
    alignItems: 'center',
    gap: 6,
    minWidth: 72,
  },
  lineIconRing: {
    borderWidth: 1,
    borderColor: GOLD,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lineIconMark: {
    color: INK,
    fontFamily: YINZHI_BODY.medium,
    textAlign: 'center',
  },
  circleLabel: {
    fontFamily: YINZHI_BODY.regular,
    fontSize: 12,
    color: INK,
  },
  toolbarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  artSwitch: {
    flexDirection: 'row',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(196,165,116,0.7)',
    padding: 3,
    backgroundColor: 'rgba(255,253,251,0.12)',
  },
  artSwitchOption: {
    minHeight: 34,
    paddingHorizontal: 12,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  artSwitchOptionOn: {
    backgroundColor: 'rgba(231,160,180,0.22)',
  },
  artSwitchText: {
    fontFamily: YINZHI_BODY.regular,
    fontSize: 12,
    color: INK_SOFT,
  },
  artSwitchTextOn: {
    color: INK,
    fontFamily: YINZHI_BODY.medium,
  },
  statusChip: {
    minHeight: 34,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GOLD,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusChipText: {
    fontFamily: YINZHI_BODY.regular,
    fontSize: 12,
    color: INK,
  },
  fallbackHint: {
    fontFamily: YINZHI_BODY.regular,
    fontSize: 11,
    color: INK_SOFT,
  },
  sceneCaption: {
    fontFamily: YINZHI_BODY.regular,
    fontSize: 11,
    color: INK_SOFT,
    textAlign: Platform.OS === 'web' ? 'left' : 'center',
  },
});
