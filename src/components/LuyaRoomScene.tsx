import React, { useState } from 'react';
import { type ImageSourcePropType, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { LuyaRoomItem, LuyaRoomState } from '../types/luya';
import ResilientImage from './ResilientImage';

export const ROOM_WALLS = { cream: '#E9DFC9', blue: '#35516B', sage: '#9BAF99' };
export const ROOM_WALL_NAMES = { cream: '奶油白', blue: '深蓝色', sage: '鼠尾草绿' };
export const ROOM_ZONES = { luya_private: '鹿芽的角落', shared: '公共区域', user_private: '你的角落' };
const ZONES = ['luya_private', 'shared', 'user_private'] as const;
export type RoomOrnamentKind = 'plant' | 'books' | 'lamp' | 'frame' | 'keepsake';
export function getRoomOrnamentKind(item: Pick<LuyaRoomItem, 'name' | 'id'>): RoomOrnamentKind {
  if (item.id === 'luya_original_books' || /书|笔记/.test(item.name)) return 'books';
  if (item.id === 'luya_original_lamp' || /灯/.test(item.name)) return 'lamp';
  if (/植物|盆栽|绿植|花/.test(item.name)) return 'plant';
  if (/相框|照片|画/.test(item.name)) return 'frame';
  return 'keepsake';
}
/** Visual projection only: the saved item, ownership, and source remain unchanged. */
export function RoomOrnament({ kind }: { kind: RoomOrnamentKind }) {
  if (kind === 'plant') return <View style={styles.plant}><View style={styles.stem} /><View style={[styles.leaf, styles.leafLeft]} /><View style={[styles.leaf, styles.leafRight]} /><View style={[styles.leaf, styles.leafTop]} /><View style={styles.pot} /></View>;
  if (kind === 'lamp') return <View style={styles.lamp}><View style={styles.lampShade} /><View style={styles.lampStem} /><View style={styles.lampFoot} /></View>;
  if (kind === 'books') return <View style={styles.books}><View style={styles.bookOne} /><View style={styles.bookTwo} /><View style={styles.bookThree} /></View>;
  if (kind === 'frame') return <View style={styles.frame}><View style={styles.frameSky} /><View style={styles.frameHill} /><View style={styles.frameSun} /></View>;
  return <View style={styles.keepsake}><View style={styles.ribbonV} /><View style={styles.ribbonH} /></View>;
}
interface Props {
  room: LuyaRoomState;
  daySource: ImageSourcePropType;
  nightSource: ImageSourcePropType;
  portraitDaySource?: ImageSourcePropType;
  portraitNightSource?: ImageSourcePropType;
  now: number;
  onSelectItem?: (item: LuyaRoomItem) => void;
  onSelectZone?: (zone: LuyaRoomItem['zone']) => void;
}
export default function LuyaRoomScene({ room, daySource, nightSource, portraitDaySource, portraitNightSource, now, onSelectItem, onSelectZone }: Props) {
  const [size, setSize] = useState({ width: 390, height: 780 });
  const hour = new Date(now + 8 * 60 * 60 * 1000).getUTCHours();
  const daylight = hour >= 7 && hour < 18;
  const portrait = daylight ? portraitDaySource : portraitNightSource;
  const landscape = daylight ? daySource : nightSource;
  const imageRatio = portrait ? 3 / 4 : 1.5;
  const imageWidth = Math.min(size.width, size.height * imageRatio);
  const imageHeight = imageWidth / imageRatio;
  const zoneWidth = imageWidth / 3;
  const columns = zoneWidth >= 120 ? 2 : 1;
  const visibleLimit = columns === 2 ? 3 : 1;
  const ornamentWidth = 50;
  const columnStep = 62;
  const rowStep = 80;
  const zoneTop = Math.max(100, Math.min(imageHeight * 0.83, size.height - 190 - (size.height - imageHeight) / 2 - 48));
  const rows = columns === 2 ? 2 : 1;
  const ornamentTop = Math.max(12, Math.min(imageHeight * 0.52, zoneTop - rows * rowStep - 12));
  const bright = room.light === 'bright';
  return <View onLayout={event => { const { width, height } = event.nativeEvent.layout; setSize(previous => previous.width === width && previous.height === height ? previous : { width, height }); }} style={[styles.scene, { backgroundColor: ROOM_WALLS[room.wallColor] }]}>
    <ResilientImage accessible={false} source={portrait ?? landscape} fallbackSources={[landscape]} resizeMode="cover" blurRadius={18} style={styles.portraitImage} />
    <LinearGradient pointerEvents="none" colors={daylight ? ['rgba(220,200,167,0.12)', 'transparent', 'rgba(102,78,49,0.12)'] : ['rgba(36,41,37,0.10)', 'transparent', 'rgba(30,27,23,0.16)']} style={StyleSheet.absoluteFill} />
    <View style={{ position: 'absolute', left: (size.width - imageWidth) / 2, top: (size.height - imageHeight) / 2, width: imageWidth, height: imageHeight }}>
    <ResilientImage source={portrait ?? landscape} fallbackSources={portrait ? [landscape] : [daylight ? nightSource : daySource]} accessibilityLabel={`共同房间，${daylight ? '日间' : '夜间'}，${ROOM_WALL_NAMES[room.wallColor]}，${bright ? '明亮主灯' : '柔和暖灯'}`} resizeMode="contain" style={styles.portraitImage} />
    {/* Soft edges follow the open right wall; the original texture and furniture stay visible. */}
    {room.wallColor !== 'cream' && <View pointerEvents="none" style={styles.wallTint}>
      {Array.from({ length: 24 }, (_, index) => {
        const opacity = Math.sin(Math.PI * (index + 0.5) / 24) * (room.wallColor === 'blue' ? 0.6 : 0.42);
        return <LinearGradient key={index} colors={['transparent', ROOM_WALLS[room.wallColor], ROOM_WALLS[room.wallColor], 'transparent']} locations={[0, 0.24, 0.78, 1]} style={{ position: 'absolute', left: `${index * 100 / 24}%`, width: `${100 / 24}%`, top: 0, bottom: 0, opacity }} />;
      })}
    </View>}
    <LinearGradient pointerEvents="none" colors={bright ? ['rgba(255,253,210,0.14)', 'rgba(255,253,226,0.08)', 'transparent'] : ['transparent', 'rgba(249,188,92,0.025)', 'rgba(246,173,77,0.08)']} style={styles.lightWash} />

    {ZONES.map((zone, zoneIndex) => {
      const items = room.items.filter(item => item.zone === zone);
      // A newly added item remains visible even when its zone contains more than the scene can fit.
      const visibleItems = columns === 1 ? items.slice(-1) : items.length > visibleLimit ? [items[0], ...items.slice(-(visibleLimit - 1))] : items;
      const span = ornamentWidth + (columns - 1) * columnStep;
      const startLeft = zoneIndex * zoneWidth + (zoneWidth - span) / 2;
      return <React.Fragment key={zone}>
        {visibleItems.map((item, index) => <TouchableOpacity key={item.id} accessibilityRole="button" accessibilityLabel={`查看物品：${item.name}，${ROOM_ZONES[zone]}`} onPress={() => onSelectItem?.(item)} style={[styles.ornament, { left: startLeft + (index % columns) * columnStep, top: ornamentTop + Math.floor(index / columns) * rowStep, width: ornamentWidth }]}>
          <RoomOrnament kind={getRoomOrnamentKind(item)} />
          <Text numberOfLines={1} style={styles.itemLabel}>{item.name}</Text>
        </TouchableOpacity>)}
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={`${ROOM_ZONES[zone]}，${items.length} 件物品，打开物品列表`} onPress={() => onSelectZone?.(zone)} style={[styles.zoneLink, { left: zoneIndex * zoneWidth + 8, width: zoneWidth - 16, top: zoneTop }]}>
          <Text style={styles.zoneLabel}>{ROOM_ZONES[zone]}</Text><Text style={styles.zoneCount}>全部 {items.length} 件 ›</Text>
        </TouchableOpacity>
      </React.Fragment>;
    })}
    </View>
  </View>;
}
const styles = StyleSheet.create({
  scene: { flex: 1, overflow: 'hidden' }, portraitImage: { ...StyleSheet.absoluteFill, width: '100%', height: '100%' }, 
  wallTint: { position: 'absolute', right: '2%', top: '8%', width: '28%', height: '34%' }, lightWash: { ...StyleSheet.absoluteFill },
  ornament: { position: 'absolute', width: 50, height: 72, alignItems: 'center', justifyContent: 'flex-end', shadowColor: '#241D15', shadowOffset: { width: 1, height: 3 }, shadowOpacity: 0.28, shadowRadius: 3 }, itemLabel: { maxWidth: 50, marginTop: 5, fontSize: 10, lineHeight: 14, color: '#FFF8EA', backgroundColor: '#3E3529D9', paddingVertical: 4, paddingHorizontal: 5, borderRadius: 7 },
  zoneLink: { position: 'absolute', minHeight: 48, padding: 8, borderRadius: 13, backgroundColor: '#FAF5EAE8', alignItems: 'center', borderWidth: 1, borderColor: '#FFFFFFA8' }, zoneLabel: { color: '#3F493A', fontSize: 12, fontWeight: '600' }, zoneCount: { color: '#5B6855', fontSize: 11, marginTop: 4 },
  lamp: { width: 31, height: 38, alignItems: 'center' }, lampShade: { height: 16, width: 31, borderTopLeftRadius: 12, borderTopRightRadius: 12, backgroundColor: '#DCB474', borderBottomWidth: 2, borderBottomColor: '#FFE4A9' }, lampStem: { width: 4, height: 17, backgroundColor: '#715744' }, lampFoot: { width: 23, height: 5, borderRadius: 4, backgroundColor: '#715744' },
  books: { width: 35, height: 30, justifyContent: 'flex-end' }, bookOne: { width: 29, height: 8, backgroundColor: '#7E9B86', borderRadius: 2, marginLeft: 3, transform: [{ rotate: '-8deg' }] }, bookTwo: { width: 35, height: 8, backgroundColor: '#B9976E', borderRadius: 2, borderBottomWidth: 2, borderColor: '#F3E6CD' }, bookThree: { width: 34, height: 8, backgroundColor: '#53656C', borderRadius: 2, marginLeft: 2, borderBottomWidth: 2, borderColor: '#E9DFCC' },
  plant: { width: 35, height: 44, alignItems: 'center' }, stem: { position: 'absolute', top: 6, height: 24, width: 3, backgroundColor: '#537054' }, leaf: { position: 'absolute', width: 15, height: 10, borderTopLeftRadius: 14, borderBottomRightRadius: 14, backgroundColor: '#6F8861' }, leafLeft: { left: 2, top: 12, transform: [{ rotate: '20deg' }] }, leafRight: { right: 2, top: 18, transform: [{ rotate: '-20deg' }] }, leafTop: { top: 3, left: 14, transform: [{ rotate: '-55deg' }] }, pot: { position: 'absolute', bottom: 0, width: 26, height: 18, borderBottomLeftRadius: 8, borderBottomRightRadius: 8, backgroundColor: '#B98365', borderTopWidth: 4, borderTopColor: '#CA9879' },
  frame: { width: 33, height: 37, borderWidth: 4, borderColor: '#AD825B', borderRadius: 3, backgroundColor: '#EDDABD', overflow: 'hidden' }, frameSky: { ...StyleSheet.absoluteFill, backgroundColor: '#AEC3BC' }, frameHill: { position: 'absolute', left: -4, bottom: -10, width: 30, height: 30, borderRadius: 15, backgroundColor: '#788C65' }, frameSun: { position: 'absolute', top: 4, right: 3, height: 7, width: 7, borderRadius: 4, backgroundColor: '#F3DC9B' },
  keepsake: { width: 31, height: 29, borderRadius: 4, backgroundColor: '#DFC8A5', borderWidth: 1, borderColor: '#A88660', overflow: 'hidden' }, ribbonV: { position: 'absolute', left: 12, top: 0, bottom: 0, width: 5, backgroundColor: '#9EA993' }, ribbonH: { position: 'absolute', top: 7, left: 0, right: 0, height: 5, backgroundColor: '#9EA993' },
});
