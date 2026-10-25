/**
 * Immersive Teahouse UI (A+C Layout)
 * 
 * ⚠️ 重写版本：使用定制素材，禁止CSS方框堆砌
 * - 对话丝带：ribbon 图做底，不是白圆角 View
 * - 圆标：全部用图片，不是 emoji
 * - 热点：gold-rings 双环，不是 CSS 圆
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Image,
  ImageBackground,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { YINZHI_FONTS } from '../utils/appFonts';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// 饮之色值（已锁）
const YZ_COLORS = {
  bg: '#FBF6F3',
  text: '#3C3032',
  muted: '#8A735C',
  accent: '#6E5430',
  line: '#EADFCE',
  pink: '#E7A0B4',
  gold: '#C4A574',
};

// 定制素材路径
const ASSETS = {
  ribbon: require('../../assets/ui/yinzhi-hud/ribbon_b6d8.jpg'),
  goldRings: require('../../assets/ui/yinzhi-hud/gold-rings_900a.jpg'),
  // 圆标图标（从 circle-icons 裁切，这里先用占位）
  iconTea: require('../../assets/ui/yinzhi-hud/circle-icons_5ca6.jpg'),
  iconCoffee: require('../../assets/ui/yinzhi-hud/icon-coffee_0eda.jpg'),
  iconFlower: require('../../assets/ui/yinzhi-hud/circle-icons_5ca6.jpg'),
  iconJar: require('../../assets/ui/yinzhi-hud/circle-icons_5ca6.jpg'),
  iconScroll: require('../../assets/ui/yinzhi-hud/circle-icons_5ca6.jpg'),
  // 四动作圆标
  actionCircles: require('../../assets/ui/yinzhi-hud/action-circles_25d0.jpg'),
};

interface StatusBadgeProps {
  status: string;
}

/** 左上状态名牌（用细金边半透，不是大白卡） */
function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <View style={styles.statusBadge}>
      <Text style={styles.statusText}>{status}</Text>
    </View>
  );
}

interface CircleIconButtonProps {
  iconSource?: any;
  label?: string;
  onPress: () => void;
  size?: number;
  active?: boolean;
}

/** 圆形图标按钮（用真实图片，不是emoji） */
function CircleIconButton({ iconSource, label, onPress, size = 52, active = false }: CircleIconButtonProps) {
  return (
    <View style={{ alignItems: 'center' }}>
      <TouchableOpacity
        style={[
          styles.circleButton,
          { width: size, height: size, borderRadius: size / 2 },
          active && styles.circleButtonActive,
        ]}
        onPress={onPress}
        activeOpacity={0.8}
      >
        {iconSource && (
          <Image
            source={iconSource}
            style={{ width: size * 0.5, height: size * 0.5 }}
            resizeMode="contain"
          />
        )}
      </TouchableOpacity>
      {label && <Text style={styles.circleLabel}>{label}</Text>}
    </View>
  );
}

interface RibbonMessageProps {
  text: string;
  characterName?: string;
}

/** 对话丝带（用 ribbon 图做底，不是白圆角View） */
function RibbonMessage({ text, characterName }: RibbonMessageProps) {
  return (
    <View style={styles.ribbonContainer}>
      {characterName && (
        <View style={styles.ribbonNameTag}>
          <Text style={styles.ribbonNameText}>{characterName}</Text>
        </View>
      )}
      <ImageBackground
        source={ASSETS.ribbon}
        style={styles.ribbon}
        imageStyle={styles.ribbonImage}
        resizeMode="stretch"
      >
        <Text style={styles.ribbonText} numberOfLines={3}>
          {text}
        </Text>
      </ImageBackground>
    </View>
  );
}

interface CalibrationPillsProps {
  onResonate: () => void;
  onAdjust: () => void;
  visible: boolean;
}

/** 回甘/添水校准小胶囊（细金边，不是粗圆角框） */
function CalibrationPills({ onResonate, onAdjust, visible }: CalibrationPillsProps) {
  if (!visible) return null;
  
  return (
    <View style={styles.calibrationRow}>
      <TouchableOpacity style={[styles.calibrationPill, styles.pillResonate]} onPress={onResonate}>
        <Text style={styles.pillText}>回甘</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.calibrationPill, styles.pillAdjust]} onPress={onAdjust}>
        <Text style={styles.pillText}>添水</Text>
      </TouchableOpacity>
    </View>
  );
}

interface ActionButtonsProps {
  onContinue: () => void;
  onReflect: () => void;
  onChallenge: () => void;
  onRest: () => void;
}

/** 四动作圆标（用 action-circles 图，不是emoji） */
function ActionButtons({ onContinue, onReflect, onChallenge, onRest }: ActionButtonsProps) {
  // TODO: 裁切 action-circles 为四个独立图标
  // 当前用占位，文案固定：顺着聊/照照卡住/加冰挑刺/歇会儿
  return (
    <View style={styles.actionsRow}>
      <CircleIconButton iconSource={ASSETS.actionCircles} label="顺着聊" onPress={onContinue} size={60} />
      <CircleIconButton iconSource={ASSETS.actionCircles} label="照照卡住" onPress={onReflect} size={60} />
      <CircleIconButton iconSource={ASSETS.actionCircles} label="加冰挑刺" onPress={onChallenge} size={60} />
      <CircleIconButton iconSource={ASSETS.actionCircles} label="歇会儿" onPress={onRest} size={60} />
    </View>
  );
}

interface InputCapsuleProps {
  value: string;
  onChangeText: (text: string) => void;
  onSubmit: () => void;
  placeholder?: string;
}

/** 输入胶囊（细金边，不是粗白圆角） */
function InputCapsule({ value, onChangeText, onSubmit, placeholder }: InputCapsuleProps) {
  return (
    <View style={styles.inputCapsule}>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        placeholder={placeholder || '聊点什么…'}
        placeholderTextColor={YZ_COLORS.muted}
        returnKeyType="send"
      />
      {value.trim() && (
        <TouchableOpacity style={styles.sendButton} onPress={onSubmit}>
          <Text style={styles.sendIcon}>↑</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

interface HotspotProps {
  x: number;
  y: number;
  size?: number;
  onPress: () => void;
}

/** C · 房间物件热点（用 gold-rings 图，不是CSS圆） */
function RoomHotspot({ x, y, size = 48, onPress }: HotspotProps) {
  const pulse = useRef(new Animated.Value(0.35)).current;
  
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.7,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.35,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [pulse]);
  
  return (
    <TouchableOpacity
      style={[styles.hotspot, { left: x, top: y, width: size, height: size }]}
      onPress={onPress}
      activeOpacity={0.6}
    >
      <Animated.Image
        source={ASSETS.goldRings}
        style={[styles.hotspotImage, { opacity: pulse }]}
        resizeMode="contain"
      />
    </TouchableOpacity>
  );
}

export interface ImmersiveTeahouseUIProps {
  // 状态
  characterStatus: string;
  characterName?: string;
  currentMessage?: string;
  
  // 右上入口
  onOpenIngest: () => void;
  onOpenArchive: () => void;
  
  // 左侧饮品
  drinks: { id: string; icon: string; iconSource?: any; active: boolean }[];
  onDrinkSelect: (drinkId: string) => void;
  
  // 校准
  showCalibration: boolean;
  onResonate: () => void;
  onAdjust: () => void;
  
  // 四动作
  onContinue: () => void;
  onReflect: () => void;
  onChallenge: () => void;
  onRest: () => void;
  
  // 输入
  inputValue: string;
  onInputChange: (text: string) => void;
  onInputSubmit: () => void;
  
  // 房间热点
  hotspots?: { id: string; x: number; y: number; onPress: () => void }[];
}

export default function ImmersiveTeahouseUI({
  characterStatus,
  characterName,
  currentMessage,
  onOpenIngest,
  onOpenArchive,
  drinks,
  onDrinkSelect,
  showCalibration,
  onResonate,
  onAdjust,
  onContinue,
  onReflect,
  onChallenge,
  onRest,
  inputValue,
  onInputChange,
  onInputSubmit,
  hotspots = [],
}: ImmersiveTeahouseUIProps) {
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = Dimensions.get('window');
  
  return (
    <View style={styles.container}>
      {/* 左上：状态名牌 */}
      <View style={[styles.topLeft, { top: insets.top + 12 }]}>
        <StatusBadge status={characterStatus} />
      </View>
      
      {/* 右上：生茶罐 + 封瓶卷轴（用图片不是emoji） */}
      <View style={[styles.topRight, { top: insets.top + 12 }]}>
        <CircleIconButton iconSource={ASSETS.iconJar} onPress={onOpenIngest} size={48} />
        <View style={{ width: 12 }} />
        <CircleIconButton iconSource={ASSETS.iconScroll} onPress={onOpenArchive} size={48} />
      </View>
      
      {/* 左侧：三杯饮品竖排（用图片不是emoji，第三个不是齿轮） */}
      <View style={[styles.leftDrinks, { top: screenHeight * 0.28 }]}>
        {drinks.map((drink) => (
          <View key={drink.id} style={{ marginBottom: 16 }}>
            <CircleIconButton
              iconSource={drink.iconSource}
              onPress={() => onDrinkSelect(drink.id)}
              size={52}
              active={drink.active}
            />
          </View>
        ))}
      </View>
      
      {/* 底部区域 */}
      <View style={[styles.bottomZone, { bottom: insets.bottom + 8 }]}>
        {/* 对话丝带（用 ribbon 图，不是白圆角View） */}
        {currentMessage && (
          <RibbonMessage text={currentMessage} characterName={characterName} />
        )}
        
        {/* 回甘/添水校准 */}
        <CalibrationPills
          onResonate={onResonate}
          onAdjust={onAdjust}
          visible={showCalibration}
        />
        
        {/* 四动作圆标（用图片，不是emoji） */}
        <ActionButtons
          onContinue={onContinue}
          onReflect={onReflect}
          onChallenge={onChallenge}
          onRest={onRest}
        />
        
        {/* 输入胶囊 */}
        <InputCapsule
          value={inputValue}
          onChangeText={onInputChange}
          onSubmit={onInputSubmit}
          placeholder="聊点什么…"
        />
      </View>
      
      {/* C · 房间物件热点（用 gold-rings 图） */}
      {hotspots.map((hotspot) => (
        <RoomHotspot
          key={hotspot.id}
          x={hotspot.x}
          y={hotspot.y}
          onPress={hotspot.onPress}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    pointerEvents: 'box-none',
  },
  
  // 状态名牌（细金边，不是大白卡）
  statusBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: 'rgba(255, 253, 251, 0.72)',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: `${YZ_COLORS.gold}99`,
    ...(Platform.OS === 'web' && {
      backdropFilter: 'blur(12px)',
    }),
  },
  statusText: {
    fontFamily: YINZHI_FONTS.title,
    fontSize: 13,
    lineHeight: 18,
    color: YZ_COLORS.text,
    fontWeight: '500',
  },
  
  // 圆形按钮（用图片，不是emoji）
  circleButton: {
    backgroundColor: 'rgba(255, 253, 251, 0.66)',
    borderWidth: 1,
    borderColor: `${YZ_COLORS.gold}99`,
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web' && {
      backdropFilter: 'blur(10px)',
    }),
  },
  circleButtonActive: {
    borderColor: YZ_COLORS.gold,
    shadowColor: YZ_COLORS.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  circleLabel: {
    marginTop: 4,
    fontFamily: YINZHI_FONTS.body,
    fontSize: 11,
    lineHeight: 15,
    color: YZ_COLORS.accent,
  },
  
  // 对话丝带（用 ribbon 图，不是白圆角View）
  ribbonContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  ribbonNameTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: 'rgba(255, 253, 251, 0.66)',
    borderWidth: 1,
    borderColor: `${YZ_COLORS.gold}66`,
    borderRadius: 12,
    marginRight: -6,
    marginBottom: 4,
    zIndex: 1,
    ...(Platform.OS === 'web' && {
      backdropFilter: 'blur(8px)',
    }),
  },
  ribbonNameText: {
    fontFamily: YINZHI_FONTS.body,
    fontSize: 11,
    color: YZ_COLORS.accent,
  },
  ribbon: {
    flex: 1,
    minHeight: 50,
    maxHeight: '14%',
    paddingHorizontal: 16,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  ribbonImage: {
    borderRadius: 16,
  },
  ribbonText: {
    fontFamily: YINZHI_FONTS.body,
    fontSize: 15,
    lineHeight: 22,
    color: YZ_COLORS.text,
  },
  
  // 校准胶囊（细金边，不是粗圆角框）
  calibrationRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 8,
  },
  calibrationPill: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    minWidth: 66,
    alignItems: 'center',
  },
  pillResonate: {
    backgroundColor: `${YZ_COLORS.pink}18`,
    borderColor: `${YZ_COLORS.pink}99`,
  },
  pillAdjust: {
    backgroundColor: 'transparent',
    borderColor: `${YZ_COLORS.gold}99`,
  },
  pillText: {
    fontFamily: YINZHI_FONTS.body,
    fontSize: 12,
    color: YZ_COLORS.text,
  },
  
  // 四动作行（用图片，不是emoji）
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  
  // 输入胶囊（细金边）
  inputCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: 'rgba(255, 253, 251, 0.66)',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: `${YZ_COLORS.gold}99`,
    minHeight: 38,
    ...(Platform.OS === 'web' && {
      backdropFilter: 'blur(12px)',
    }),
  },
  input: {
    flex: 1,
    fontFamily: YINZHI_FONTS.body,
    fontSize: 14,
    lineHeight: 20,
    color: YZ_COLORS.text,
    paddingVertical: 0,
  },
  sendButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: YZ_COLORS.pink,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  sendIcon: {
    fontSize: 15,
    color: '#fff',
    lineHeight: 17,
  },
  
  // 房间热点（用 gold-rings 图，不是CSS圆）
  hotspot: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hotspotImage: {
    width: '100%',
    height: '100%',
  },
  
  // 定位
  topLeft: {
    position: 'absolute',
    left: 16,
  },
  topRight: {
    position: 'absolute',
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  leftDrinks: {
    position: 'absolute',
    left: 16,
  },
  bottomZone: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
});
