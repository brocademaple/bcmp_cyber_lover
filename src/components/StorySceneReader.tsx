import React, { useRef, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { CharacterStory } from '../config/luyaStoryLibrary';
import type { StoryLine } from '../config/luyaStoryScenes';
import { createStoryBookmark, saveStoryProgress, type StoryBookmark } from '../services/storyReadingProgress';
import { getStoryScenes, resumeStoryScene, type StoryScene } from '../utils/storyScenes';
import ResilientImage from './ResilientImage';

type Props = { story: CharacterStory; bookmark?: StoryBookmark; onClose: () => void; onBookmark: (bookmark: StoryBookmark) => void };

function lineLabel(line: StoryLine): string {
  if (line.kind === 'narration') return '旁白';
  if (line.kind === 'thought') return `${line.speaker ?? '鹿芽'} · 心里`;
  if (line.kind === 'message') return `${line.speaker ?? '朋友'}${line.speaker?.includes('消息') ? '' : ' · 消息'}`;
  return line.speaker ?? '鹿芽';
}

/** Viewport onto one authored panel. The whole original remains available in the image viewer. */
function SceneArtwork({ scene, width, wholePage = false }: { scene: StoryScene; width: number; wholePage?: boolean }) {
  const [failedPage, setFailedPage] = useState<string | null>(null);
  const crop = wholePage ? { top: 0, height: 1 } : scene.crop;
  const sourceHeight = width / scene.page.aspectRatio;
  return <View style={{ width, height: sourceHeight * crop.height, overflow: 'hidden', backgroundColor: '#E9E4DB' }}>
    <ResilientImage source={scene.page.image} resizeMode="contain" style={{ position: 'absolute', left: 0, top: -sourceHeight * crop.top, width, height: sourceHeight }} accessibilityLabel={wholePage ? `${scene.page.title}完整原画` : `${scene.title}画面`} fallbackLabel="画面暂未加载，剧情文字仍可阅读" onError={() => setFailedPage(scene.page.id)} onLoad={() => setFailedPage(null)} />
    {failedPage === scene.page.id && <View pointerEvents="none" style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center', padding: 16, backgroundColor: '#F3E9E5' }]}><Text accessibilityRole="alert" style={S.source}>画面暂未加载，剧情仍可阅读。点击画面可放大重试。</Text></View>}
  </View>;
}

function Dialogue({ line, compact = false }: { line: StoryLine; compact?: boolean }) {
  const spoken = line.kind === 'speech' || line.kind === 'message';
  return <View style={[S.dialogue, spoken && S.spoken, compact && S.compactDialogue]}>
    <Text style={[S.speaker, spoken && S.spokenSpeaker]}>{lineLabel(line)}</Text>
    <Text style={[S.line, spoken && S.spokenLine]}>{line.text}</Text>
  </View>;
}

export default function StorySceneReader({ story, bookmark, onClose, onBookmark }: Props) {
  const { width, height } = useWindowDimensions();
  const scenes = getStoryScenes(story);
  const [position, setPosition] = useState(() => resumeStoryScene(bookmark, scenes));
  const current = useRef(position);
  const [mode, setMode] = useState<'scene' | 'scroll'>('scene');
  const [contents, setContents] = useState(false);
  const [transcript, setTranscript] = useState(false);
  const [zoomTarget, setZoomTarget] = useState<'scene' | 'page' | null>(null);
  const [zoom, setZoom] = useState(1);
  const [notice, setNotice] = useState<string | null>(null);
  const scroll = useRef<ScrollView>(null);
  const offsets = useRef<Record<number, number>>({});
  const pendingScroll = useRef(false);
  const active = scenes[position.sceneIndex];
  const readingWidth = Math.min(width - 32, 780);
  // Reserve space for this scene's longest line so advancing dialogue keeps the art stable.
  const captionHeight = Math.max(132, ...(active?.lines ?? []).map(line => {
    const charactersPerLine = Math.max(10, Math.floor((readingWidth - 40) / (line.kind === 'speech' || line.kind === 'message' ? 21 : 18)));
    return 69 + Math.ceil(line.text.length / charactersPerLine) * 33;
  }));
  const artHeight = Math.max(140, Math.min(440, height - 300 - captionHeight));
  const artWidth = active ? Math.min(readingWidth, artHeight * active.aspectRatio) : readingWidth;
  const zoomRatio = zoomTarget === 'page' ? active?.page.aspectRatio ?? 0.75 : active?.aspectRatio ?? 0.75;
  const zoomWidth = Math.min(width - 24, Math.max(120, height - 160) * zoomRatio) * zoom;

  const remember = (sceneIndex: number, lineIndex: number) => {
    const scene = scenes[sceneIndex];
    if (!scene) return;
    const next = { sceneIndex, lineIndex };
    current.current = next;
    setPosition(next);
    const savedPosition = { sceneId: scene.sceneId, lineIndex };
    onBookmark(createStoryBookmark(scene.pageIndex, savedPosition));
    void saveStoryProgress(story.id, scene.pageIndex, savedPosition).then(ok => { if (!ok) setNotice('进度暂未保存，可以继续读。'); });
  };
  const close = () => { remember(current.current.sceneIndex, current.current.lineIndex); onClose(); };
  const jump = (index: number, lineIndex = 0) => {
    if (transcript) pendingScroll.current = true;
    remember(Math.max(0, Math.min(index, scenes.length - 1)), lineIndex);
    setContents(false);
    scroll.current?.scrollTo({ y: mode === 'scroll' ? offsets.current[index] ?? 0 : 0, animated: false });
  };
  const next = () => {
    if (!active) return close();
    if (position.lineIndex < active.lines.length - 1 && mode === 'scene') remember(position.sceneIndex, position.lineIndex + 1);
    else if (position.sceneIndex < scenes.length - 1) jump(position.sceneIndex + 1);
    else close();
  };
  const previous = () => {
    if (position.lineIndex > 0 && mode === 'scene') remember(position.sceneIndex, position.lineIndex - 1);
    else if (position.sceneIndex > 0) jump(position.sceneIndex - 1, mode === 'scene' ? scenes[position.sceneIndex - 1].lines.length - 1 : 0);
  };
  const switchMode = () => {
    offsets.current = {};
    pendingScroll.current = true;
    setMode(value => value === 'scene' ? 'scroll' : 'scene');
    setContents(false);
    setTranscript(false);
  };
  const nextLabel = mode === 'scene' && active && position.lineIndex < active.lines.length - 1 ? '下一句' : position.sceneIndex < scenes.length - 1 ? '下个镜头' : '读完故事，返回书架';
  const openArt = () => { setZoom(1); setZoomTarget('scene'); };
  const toggleTranscript = () => {
    if (transcript) pendingScroll.current = true;
    setTranscript(value => !value);
  };

  return <Modal visible animationType="fade" presentationStyle="fullScreen" onRequestClose={() => zoomTarget ? setZoomTarget(null) : transcript ? toggleTranscript() : close()}>
    <SafeAreaView style={S.reader}>
      <View style={S.header}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="返回故事书架" onPress={close} style={S.headerButton}><Text style={S.control}>‹ 书架</Text></TouchableOpacity>
        <View style={S.titleCopy}><Text accessibilityRole="header" numberOfLines={1} style={S.title}>{story.title}</Text><Text style={S.meta}>虚构人物故事 · {position.sceneIndex + 1} / {scenes.length} 镜头</Text></View>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="打开镜头目录" onPress={() => setContents(value => !value)} style={S.headerButton}><Text style={S.control}>目录</Text></TouchableOpacity>
      </View>
      <View style={S.toolbar}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={mode === 'scene' ? '切换图文长卷' : '切换镜头阅读'} onPress={switchMode} style={S.tool}><Text style={S.control}>{mode === 'scene' ? '图文长卷' : '镜头阅读'}</Text></TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={transcript ? '返回剧情画面' : '查看完整文字稿'} onPress={toggleTranscript} style={S.tool}><Text style={S.control}>{transcript ? '返回画面' : '文字稿'}</Text></TouchableOpacity>
        <Text style={S.toolbarHint}>{transcript ? '完整故事' : mode === 'scene' ? '按自己的节奏，慢慢读' : '画面与剧情连续展开'}</Text>
      </View>
      {contents && <ScrollView style={S.contents} contentContainerStyle={{ padding: 12 }}>
        {scenes.map((scene, index) => <TouchableOpacity key={scene.sceneId} accessibilityRole="button" accessibilityLabel={`跳到镜头${index + 1}：${scene.title}`} style={S.contentsRow} onPress={() => { setTranscript(false); jump(index); }}><Text style={S.control}>{index + 1}　{scene.title}</Text><Text style={S.meta}>{index === position.sceneIndex ? '当前' : '›'}</Text></TouchableOpacity>)}
      </ScrollView>}
      {notice && <Text accessibilityRole="alert" style={S.notice}>{notice}</Text>}
      {transcript ? <ScrollView style={S.body} contentContainerStyle={S.transcript}>
        {scenes.map(scene => <View key={scene.sceneId} style={{ gap: 12, marginBottom: 24, width: readingWidth }}><Text accessibilityRole="header" style={S.sceneTitle}>{scene.title}</Text>{scene.lines.map((line, index) => <Dialogue key={index} line={line} compact />)}</View>)}
        <Text style={S.source}>{story.source}</Text>
      </ScrollView> : <ScrollView ref={scroll} key={mode} style={S.body} contentContainerStyle={S.bodyContent} scrollEventThrottle={120} onContentSizeChange={() => {
        if (!pendingScroll.current) return;
        scroll.current?.scrollTo({ y: mode === 'scroll' ? offsets.current[current.current.sceneIndex] ?? 0 : 0, animated: false });
        requestAnimationFrame(() => { pendingScroll.current = false; });
      }} onScroll={event => {
        if (mode !== 'scroll' || pendingScroll.current) return;
        const y = event.nativeEvent.contentOffset.y + 80;
        const atBottom = event.nativeEvent.contentOffset.y + event.nativeEvent.layoutMeasurement.height >= event.nativeEvent.contentSize.height - 2;
        const visible = atBottom ? scenes.length - 1 : scenes.reduce((found, _, index) => offsets.current[index] != null && offsets.current[index] <= y ? index : found, 0);
        if (visible !== current.current.sceneIndex) remember(visible, 0);
      }}>
        {mode === 'scene' && active ? <View style={[S.scene, { width: readingWidth }]}>
          <View style={S.sceneHeading}><Text style={S.setting}>{active.setting}</Text><Text style={S.meta}>{position.lineIndex + 1} / {active.lines.length} 句</Text></View>
          <Text accessibilityRole="header" style={S.sceneTitle}>{active.title}</Text>
          <View style={S.frame}>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={`放大镜头${position.sceneIndex + 1}画面`} onPress={openArt}>
              <SceneArtwork scene={active} width={artWidth} />
              {active.screenNote && <View style={S.screenNote}><Text style={S.screenNoteText}>{active.screenNote}</Text></View>}
            </TouchableOpacity>
            <View style={{ width: '100%' }}><Dialogue line={active.lines[position.lineIndex]} /></View>
          </View>
          <View style={S.beatDots}>{scenes.map((scene, index) => <View key={scene.sceneId} style={[S.dot, index === position.sceneIndex && S.activeDot, index < position.sceneIndex && S.readDot]} />)}</View>
        </View> : scenes.map((scene, index) => <View key={scene.sceneId} onLayout={event => { offsets.current[index] = event.nativeEvent.layout.y; }} style={[S.scrollScene, { width: readingWidth }]}>
          <Text style={S.setting}>{scene.setting}</Text><Text accessibilityRole="header" style={S.sceneTitle}>{scene.title}</Text>
          <View style={S.frame}>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={`放大镜头${index + 1}画面`} onPress={() => { remember(index, 0); openArt(); }}>
              <SceneArtwork scene={scene} width={Math.min(readingWidth, scene.aspectRatio * 540)} />
              {scene.screenNote && <View style={S.screenNote}><Text style={S.screenNoteText}>{scene.screenNote}</Text></View>}
            </TouchableOpacity>
            <View style={{ width: '100%' }}>{scene.lines.map((line, i) => <Dialogue key={i} line={line} compact />)}</View>
          </View>
        </View>)}
        {mode === 'scroll' && <Text style={S.source}>{story.source} · 人物创作故事</Text>}
      </ScrollView>}
      {!transcript && <View style={S.navigation}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="上一段剧情" disabled={position.sceneIndex === 0 && (position.lineIndex === 0 || mode === 'scroll')} onPress={previous} style={[S.previous, position.sceneIndex === 0 && position.lineIndex === 0 && S.disabled]}><Text style={S.control}>‹ 上一段</Text></TouchableOpacity>
        <Text style={S.counter}>{position.sceneIndex + 1} / {scenes.length}</Text>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={nextLabel} onPress={next} style={S.next}><Text style={S.nextText}>{nextLabel === '读完故事，返回书架' ? '读完 ✓' : `${nextLabel} ›`}</Text></TouchableOpacity>
      </View>}
      {zoomTarget && active && <View style={S.zoomOverlay}>
        <View style={S.header}><Text numberOfLines={1} style={[S.title, { flex: 1 }]}>{active.title}</Text><TouchableOpacity accessibilityRole="button" accessibilityLabel="关闭剧情大图" onPress={() => setZoomTarget(null)} style={S.headerButton}><Text style={S.control}>关闭</Text></TouchableOpacity></View>
        <View style={S.toolbar}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="缩小剧情图片" disabled={zoom <= 1} onPress={() => setZoom(Math.max(1, zoom - 0.5))} style={S.tool}><Text style={S.control}>−</Text></TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="恢复剧情图片大小" onPress={() => setZoom(1)} style={S.tool}><Text style={S.control}>{Math.round(zoom * 100)}%</Text></TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="放大剧情图片" disabled={zoom >= 3} onPress={() => setZoom(Math.min(3, zoom + 0.5))} style={S.tool}><Text style={S.control}>＋</Text></TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={zoomTarget === 'scene' ? '查看完整原画' : '返回当前镜头'} onPress={() => { setZoom(1); setZoomTarget(value => value === 'scene' ? 'page' : 'scene'); }} style={S.tool}><Text style={S.control}>{zoomTarget === 'scene' ? '整页原画' : '当前镜头'}</Text></TouchableOpacity>
        </View>
        <ScrollView horizontal contentContainerStyle={{ minWidth: width }}><ScrollView style={{ width: Math.max(width, zoomWidth), flexShrink: 0 }} contentContainerStyle={{ minHeight: height - 160, alignItems: 'center', justifyContent: 'center' }}><SceneArtwork scene={active} width={zoomWidth} wholePage={zoomTarget === 'page'} /></ScrollView></ScrollView>
      </View>}
    </SafeAreaView>
  </Modal>;
}

const S = StyleSheet.create({
  reader: { flex: 1, backgroundColor: '#F4F0E8' }, header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#FCFAF5', borderBottomColor: '#DED8CC', borderBottomWidth: StyleSheet.hairlineWidth },
  headerButton: { minHeight: 44, minWidth: 48, paddingHorizontal: 6, justifyContent: 'center', alignItems: 'center' }, control: { color: '#425847', fontSize: 14, lineHeight: 22 }, titleCopy: { flex: 1, minWidth: 0 }, title: { color: '#33392F', fontSize: 18, lineHeight: 25, fontWeight: '600' }, meta: { fontSize: 11, lineHeight: 18, color: '#878273' },
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#FCFAF5' }, tool: { minHeight: 44, paddingHorizontal: 12, justifyContent: 'center', backgroundColor: '#EEEADF', borderRadius: 10 }, toolbarHint: { fontSize: 11, lineHeight: 18, color: '#817C70', flexShrink: 1 },
  body: { flex: 1 }, bodyContent: { alignItems: 'center', paddingTop: 20, paddingBottom: 24 }, scene: { gap: 12 }, sceneHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, setting: { fontSize: 12, lineHeight: 20, color: '#827C6E' }, sceneTitle: { color: '#424D3E', fontSize: 22, fontWeight: '600', lineHeight: 31 },
  frame: { alignItems: 'center', borderRadius: 18, overflow: 'hidden', backgroundColor: '#E9E4DB', borderWidth: StyleSheet.hairlineWidth, borderColor: '#D5D1C5' },
  dialogue: { minHeight: 132, padding: 20, gap: 10, width: '100%', backgroundColor: '#FCFAF3', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#DED8CC' }, spoken: { backgroundColor: '#E9EEE2' }, compactDialogue: { minHeight: 0, paddingVertical: 16 }, speaker: { color: '#928574', fontSize: 12, lineHeight: 19, letterSpacing: 1 }, spokenSpeaker: { color: '#647952' }, line: { fontSize: 18, lineHeight: 31, color: '#494438' }, spokenLine: { fontSize: 21, lineHeight: 33, fontWeight: '500', color: '#334B36' },
  screenNote: { position: 'absolute', right: 12, bottom: 12, backgroundColor: '#FFFCF2', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, maxWidth: '80%', borderWidth: 1, borderColor: '#D7D6B7' }, screenNoteText: { fontSize: 13, lineHeight: 20, color: '#596A43' },
  beatDots: { flexDirection: 'row', alignSelf: 'center', gap: 6, paddingVertical: 4 }, dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#D8D3C6' }, activeDot: { width: 18, backgroundColor: '#748563' }, readDot: { backgroundColor: '#ADB59F' },
  scrollScene: { gap: 10, marginBottom: 38 }, navigation: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#FCFAF5', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#DED8CC' }, previous: { minHeight: 46, minWidth: 88, alignItems: 'center', justifyContent: 'center' }, next: { minHeight: 46, minWidth: 110, paddingHorizontal: 16, borderRadius: 12, backgroundColor: '#687D58', justifyContent: 'center', alignItems: 'center' }, nextText: { color: '#fff', fontSize: 14, lineHeight: 22, fontWeight: '600' }, counter: { color: '#827B6D', fontSize: 12 }, disabled: { opacity: 0.4 },
  contents: { maxHeight: 240, backgroundColor: '#EEEADC' }, contentsRow: { minHeight: 44, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }, source: { fontSize: 12, lineHeight: 20, color: '#8C8476', paddingHorizontal: 16 }, transcript: { alignItems: 'center', paddingVertical: 22 }, notice: { fontSize: 12, lineHeight: 20, color: '#99663B', paddingHorizontal: 16 }, zoomOverlay: { ...StyleSheet.absoluteFill, backgroundColor: '#F4F0E8', zIndex: 10 },
});
