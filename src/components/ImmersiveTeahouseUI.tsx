/**
 * Immersive Teahouse UI (A+C Layout)
 * 
 * A边标HUD + C房间物件热点
 * 符合饮之视觉规范（2026-10-25）
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ScrollView,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { YINZHI_FONTS } from '../utils/appFonts';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// 饮之色值（已锁）
const YZ_COLORS = {
  bg: '#FBF6F3',
  glass: 'rgba(255, 253, 251, 0.66)',
  glassBright: 'rgba(255, 253, 251, 0.72)',
  text: '#3C3032',
  muted: '#8A735C',
  accent: '#6E5430',
  line: '#EADFCE',
  pink: '#E7A0B4',
  gold: '#C4A574',
};

interface StatusBadgeProps {
  status: string;
}

/** 左上状态名牌 */
function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <View style={styles.statusBadge}>
      <Text style={styles.statusText}>{status}</Text>
    </View>
  );
}

interface CircleIconButtonProps {
  icon: string;
  label?: string;
  onPress: () => void;
  size?: number;
  active?: boolean;
}

/** 圆形图标按钮（HUD 入口/饮品/动作） */
function CircleIconButton({ icon, label, onPress, size = 52, active = false }: CircleIconButtonProps) {
  const [pressed, setPressed] = useState(false);
  
  return (
    <View style={{ alignItems: 'center' }}>
      <TouchableOpacity
        style={[
          styles.circleButton,
          { width: size, height: size, borderRadius: size / 2 },
          active && styles.circleButtonActive,
          pressed && { transform: [{ scale: 0.96 }] },
        ]}
        onPress={onPress}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        activeOpacity={0.8}
      >
        <Text style={styles.circleIcon}>{icon}</Text>
      </TouchableOpacity>
      {label && <Text style={styles.circleLabel}>{label}</Text>}
    </View>
  );
}

interface RibbonMessageProps {
  text: string;
  characterName?: string;
}

/** 对话丝带 */
function RibbonMessage({ text, characterName }: RibbonMessageProps) {
  return (
    <View style={styles.ribbonContainer}>
      {characterName && (
        <View style={styles.ribbonNameTag}>
          <Text style={styles.ribbonNameText}>{characterName}</Text>
        </View>
      )}
      <View style={styles.ribbon}>
        <Text style={styles.ribbonText} numberOfLines={3}>
          {text}
        </Text>
      </View>
    </View>
  );
}

interface CalibrationPillsProps {
  onResonate: () => void;
  onAdjust: () => void;
  visible: boolean;
}

/** 回甘/添水校准小胶囊 */
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

/** 四动作圆标 */
function ActionButtons({ onContinue, onReflect, onChallenge, onRest }: ActionButtonsProps) {
  return (
    <View style={styles.actionsRow}>
      <CircleIconButton icon="🍵" label="顺着聊" onPress={onContinue} size={60} />
      <CircleIconButton icon="🪞" label="照照卡住" onPress={onReflect} size={60} />
      <CircleIconButton icon="🧊" label="加冰挑刺" onPress={onChallenge} size={60} />
      <CircleIconButton icon="🍃" label="歇会儿" onPress={onRest} size={60} />
    </View>
  );
}

interface InputCapsuleProps {
  value: string;
  onChangeText: (text: string) => void;
  onSubmit: () => void;
  placeholder?: string;
}

/** 输入胶囊 */
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

/** C · 房间物件热点（淡金双环光圈） */
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
      style={[styles.hotspot, { left: x, top: y, width: size, height: size, borderRadius: size / 2 }]}
      onPress={onPress}
      activeOpacity={0.6}
    >
      <Animated.View style={[styles.hotspotRingOuter, { opacity: pulse }]} />
      <Animated.View style={[styles.hotspotRingInner, { opacity: pulse }]} />
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
  drinks: { id: string; icon: string; active: boolean }[];
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
      
      {/* 右上：生茶罐 + 封瓶卷轴 */}
      <View style={[styles.topRight, { top: insets.top + 12 }]}>
        <CircleIconButton icon="📝" onPress={onOpenIngest} size={48} />
        <View style={{ width: 12 }} />
        <CircleIconButton icon="🏺" onPress={onOpenArchive} size={48} />
      </View>
      
      {/* 左侧：三杯饮品竖排 */}
      <View style={[styles.leftDrinks, { top: screenHeight * 0.28 }]}>
        {drinks.map((drink) => (
          <View key={drink.id} style={{ marginBottom: 16 }}>
            <CircleIconButton
              icon={drink.icon}
              onPress={() => onDrinkSelect(drink.id)}
              size={52}
              active={drink.active}
            />
          </View>
        ))}
      </View>
      
      {/* 底部区域 */}
      <View style={[styles.bottomZone, { bottom: insets.bottom + 8 }]}>
        {/* 对话丝带 */}
        {currentMessage && (
          <RibbonMessage text={currentMessage} characterName={characterName} />
        )}
        
        {/* 回甘/添水校准 */}
        <CalibrationPills
          onResonate={onResonate}
          onAdjust={onAdjust}
          visible={showCalibration}
        />
        
        {/* 四动作圆标 */}
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
      
      {/* C · 房间物件热点 */}
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
  
  // 状态名牌
  statusBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: YZ_COLORS.glassBright,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: `${YZ_COLORS.gold}99`,
    ...(Platform.OS === 'web' && {
      backdropFilter: 'blur(14px)',
    }),
  },
  statusText: {
    fontFamily: YINZHI_FONTS.title,
    fontSize: 14,
    lineHeight: 20,
    color: YZ_COLORS.text,
    fontWeight: '500',
  },
  
  // 圆形按钮
  circleButton: {
    backgroundColor: YZ_COLORS.glass,
    borderWidth: 1.5,
    borderColor: `${YZ_COLORS.gold}99`,
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web' && {
      backdropFilter: 'blur(12px)',
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
  circleIcon: {
    fontSize: 20,
  },
  circleLabel: {
    marginTop: 4,
    fontFamily: YINZHI_FONTS.body,
    fontSize: 11,
    lineHeight: 16,
    color: YZ_COLORS.accent,
  },
  
  // 对话丝带
  ribbonContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  ribbonNameTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: YZ_COLORS.glass,
    borderWidth: 1,
    borderColor: `${YZ_COLORS.gold}66`,
    borderRadius: 12,
    marginRight: -6,
    marginBottom: 4,
    zIndex: 1,
    ...(Platform.OS === 'web' && {
      backdropFilter: 'blur(10px)',
    }),
  },
  ribbonNameText: {
    fontFamily: YINZHI_FONTS.body,
    fontSize: 11,
    color: YZ_COLORS.accent,
  },
  ribbon: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: YZ_COLORS.glassBright,
    borderRadius: 20,
    borderTopLeftRadius: 4,
    borderWidth: 1,
    borderColor: `${YZ_COLORS.gold}66`,
    minHeight: 44,
    maxHeight: '14%',
    ...(Platform.OS === 'web' && {
      backdropFilter: 'blur(16px)',
    }),
  },
  ribbonText: {
    fontFamily: YINZHI_FONTS.body,
    fontSize: 16,
    lineHeight: 23,
    color: YZ_COLORS.text,
  },
  
  // 校准胶囊
  calibrationRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 8,
  },
  calibrationPill: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    minWidth: 70,
    alignItems: 'center',
  },
  pillResonate: {
    backgroundColor: `${YZ_COLORS.pink}22`,
    borderColor: `${YZ_COLORS.pink}99`,
  },
  pillAdjust: {
    backgroundColor: 'transparent',
    borderColor: `${YZ_COLORS.gold}99`,
  },
  pillText: {
    fontFamily: YINZHI_FONTS.body,
    fontSize: 13,
    color: YZ_COLORS.text,
  },
  
  // 四动作行
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  
  // 输入胶囊
  inputCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: YZ_COLORS.glass,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: `${YZ_COLORS.gold}99`,
    minHeight: 40,
    ...(Platform.OS === 'web' && {
      backdropFilter: 'blur(14px)',
    }),
  },
  input: {
    flex: 1,
    fontFamily: YINZHI_FONTS.body,
    fontSize: 15,
    lineHeight: 22,
    color: YZ_COLORS.text,
    paddingVertical: 0,
  },
  sendButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: YZ_COLORS.pink,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  sendIcon: {
    fontSize: 16,
    color: '#fff',
    lineHeight: 18,
  },
  
  // 房间热点
  hotspot: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hotspotRingOuter: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: `${YZ_COLORS.gold}66`,
  },
  hotspotRingInner: {
    position: 'absolute',
    width: '80%',
    height: '80%',
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: `${YZ_COLORS.gold}AA`,
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
