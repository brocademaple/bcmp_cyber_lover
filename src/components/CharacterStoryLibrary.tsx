import React, { useEffect, useRef, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ResilientImage from './ResilientImage';
import { LUYA_ARTWORKS, LUYA_BACKGROUND, LUYA_STORIES, type CharacterArtwork, type CharacterStory, type StoryPage } from '../config/luyaStoryLibrary';
import { readStoryProgress, type StoryBookmark } from '../services/storyReadingProgress';
import StorySceneReader from './StorySceneReader';
import { getStoryScenes, resumeStoryScene } from '../utils/storyScenes';
import { useThemeColors } from '../utils/theme';

type Props = { section: 'stories' | 'art' };
type ZoomImage = { title: string; image: StoryPage['image']; aspectRatio: number };

export default function CharacterStoryLibrary({ section }: Props) {
  const C = useThemeColors();
  const { width, height } = useWindowDimensions();
  const [bookmarks, setBookmarks] = useState<Record<string, StoryBookmark>>({});
  const [story, setStory] = useState<CharacterStory | null>(null);
  const [zoomImage, setZoomImage] = useState<ZoomImage | null>(null);
  const [zoom, setZoom] = useState(1);
  const [artFilter, setArtFilter] = useState<'全部' | CharacterArtwork['category']>('全部');
  const [showBackground, setShowBackground] = useState(false);
  const openRequest = useRef(0);
  const zoomWidth = zoomImage ? Math.min(width - 24, Math.max(120, height - 160) * zoomImage.aspectRatio) * zoom : width - 24;
  const columns = width >= 1000 ? 3 : width >= 680 ? 2 : 1;
  const cardWidth = (Math.min(width - 40, 1120) - (columns - 1) * 16) / columns;

  useEffect(() => {
    let alive = true;
    void readStoryProgress().then(snapshot => { if (alive) setBookmarks(snapshot.entries); });
    return () => { alive = false; openRequest.current += 1; };
  }, []);

  const openStory = async (item: CharacterStory) => {
    const request = ++openRequest.current;
    const snapshot = await readStoryProgress();
    if (request !== openRequest.current) return;
    setBookmarks(snapshot.entries);
    setStory(item);
  };
  const openZoom = (item: ZoomImage) => { setZoom(1); setZoomImage(item); };
  const artworkItems = LUYA_ARTWORKS.filter(item => artFilter === '全部' || item.category === artFilter);

  return <>
    <View style={styles.library}>
      <Text accessibilityRole="header" style={[styles.heading, { color: C.text }]}>{section === 'stories' ? '她自己的生活' : '认识不同的鹿芽'}</Text>
      <Text style={[styles.intro, { color: C.textSecondary }]}>{section === 'stories' ? '从小传改编的虚构故事。读一读她怎么做事、怎么和朋友相处。' : '日常造型、人物三视图与生活场景。点击图片可以放大查看。'}</Text>
      {section === 'stories' ? <View style={styles.grid}>
        {LUYA_STORIES.map(item => {
          const bookmark = bookmarks[item.id];
          const scenes = getStoryScenes(item);
          const resumed = resumeStoryScene(bookmark, scenes);
          return <TouchableOpacity key={item.id} accessibilityRole="button" accessibilityLabel={`阅读${item.title}，${item.format}，${scenes.length}个镜头`} style={[styles.bookCard, columns === 1 && styles.compactBook, { width: cardWidth, backgroundColor: C.surface, borderColor: C.border }]} onPress={() => { void openStory(item); }}>
            <ResilientImage source={item.pages[0].image} style={[styles.cover, columns === 1 ? { width: width < 360 ? 80 : 108, alignSelf: 'center', marginLeft: 12, borderRadius: 8 } : { height: 300, aspectRatio: undefined }]} resizeMode="contain" accessibilityLabel={`${item.title}封面`} />
            <View style={[styles.bookCopy, columns === 1 && styles.compactCopy]}>
              <Text style={[styles.bookMeta, { color: C.textSecondary }]}>{item.provenance} · {item.format} · {scenes.length} 个镜头</Text>
              <Text accessibilityRole="header" style={[styles.bookTitle, columns === 1 && styles.compactTitle, { color: C.text }]}>{item.title}</Text>
              <Text style={[styles.bookSubtitle, { color: C.textSecondary }]}>{item.subtitle}</Text>
              <Text style={[styles.tags, { color: C.textSecondary }]}>{item.tags.join(' · ')}</Text>
              <View style={[styles.readButton, { backgroundColor: C.primary }]}><Text style={styles.readButtonText}>{bookmark ? `继续 · 镜头 ${resumed.sceneIndex + 1}` : '开始阅读'}　›</Text></View>
            </View>
          </TouchableOpacity>;
        })}
      </View> : <>
        <View style={[styles.backgroundCard, { backgroundColor: C.surface, borderColor: C.border }]}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="人物小传与背景" accessibilityState={{ expanded: showBackground }} onPress={() => setShowBackground(value => !value)} style={styles.backgroundToggle}>
            <Text style={[styles.artTitle, { color: C.text }]}>人物小传与背景</Text><Text style={{ color: C.textSecondary }}>{showBackground ? '收起 −' : '展开 ＋'}</Text>
          </TouchableOpacity>
          {showBackground && <View style={styles.backgroundBody}>{LUYA_BACKGROUND.map(item => <View key={item.title} style={{ gap: 6 }}><Text accessibilityRole="header" style={[styles.backgroundTitle, { color: C.text }]}>{item.title}</Text><Text style={[styles.bookSubtitle, { color: C.textSecondary }]}>{item.text}</Text></View>)}</View>}
        </View>
        <View style={styles.filterRow}>{(['全部', '造型', '三视图', '场景'] as const).map(filter => <TouchableOpacity key={filter} accessibilityRole="button" accessibilityState={{ selected: filter === artFilter }} accessibilityLabel={`图集分类：${filter}`} onPress={() => setArtFilter(filter)} style={[styles.filter, { backgroundColor: filter === artFilter ? C.primary : C.surface, borderColor: C.border }]}><Text style={{ color: filter === artFilter ? '#fff' : C.text }}>{filter}</Text></TouchableOpacity>)}</View>
        <View style={styles.grid}>{artworkItems.map(item => <TouchableOpacity key={item.id} accessibilityRole="button" accessibilityLabel={`查看${item.title}`} onPress={() => openZoom(item)} style={[styles.artCard, { width: cardWidth, backgroundColor: C.surface, borderColor: C.border }]}>
          <ResilientImage source={item.image} style={{ width: cardWidth - 2, aspectRatio: item.aspectRatio, backgroundColor: '#F8F5EF' }} resizeMode="contain" accessibilityLabel={item.title} />
          <View style={styles.bookCopy}><Text style={[styles.bookMeta, { color: C.textSecondary }]}>{item.category}</Text><Text style={[styles.artTitle, { color: C.text }]}>{item.title}</Text><Text style={[styles.bookSubtitle, { color: C.textSecondary }]}>{item.description}</Text></View>
        </TouchableOpacity>)}</View>
      </>}
    </View>

    {story && <StorySceneReader key={story.id} story={story} bookmark={bookmarks[story.id]} onClose={() => setStory(null)} onBookmark={bookmark => setBookmarks(previous => ({ ...previous, [story.id]: bookmark }))} />}

    <Modal visible={zoomImage !== null && story === null} animationType="fade" presentationStyle="fullScreen" onRequestClose={() => setZoomImage(null)}>
      <SafeAreaView style={styles.reader}>
        <View style={styles.readerHeader}><Text numberOfLines={1} style={[styles.readerTitle, { flex: 1 }]}>{zoomImage?.title}</Text><TouchableOpacity accessibilityRole="button" accessibilityLabel="关闭设定大图" onPress={() => setZoomImage(null)} style={styles.readerControl}><Text style={styles.controlText}>关闭</Text></TouchableOpacity></View>
        <ZoomControls zoom={zoom} setZoom={setZoom} />
        {zoomImage && <ScrollView horizontal contentContainerStyle={{ minWidth: width, alignItems: 'center', justifyContent: 'center' }}><ScrollView style={{ width: Math.max(width, zoomWidth), flexShrink: 0 }} contentContainerStyle={{ minHeight: height - 160, justifyContent: 'center', alignItems: 'center' }}><ResilientImage source={zoomImage.image} style={{ width: zoomWidth, aspectRatio: zoomImage.aspectRatio }} resizeMode="contain" accessibilityLabel={zoomImage.title} /></ScrollView></ScrollView>}
      </SafeAreaView>
    </Modal>
  </>;
}

function ZoomControls({ zoom, setZoom }: { zoom: number; setZoom: (value: number) => void }) {
  return <View style={styles.readerTools}>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel="缩小图片" disabled={zoom <= 1} onPress={() => setZoom(Math.max(1, zoom - 0.5))} style={[styles.tool, zoom <= 1 && styles.disabled]}><Text style={styles.toolText}>−</Text></TouchableOpacity>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel="恢复完整图片" onPress={() => setZoom(1)} style={styles.tool}><Text style={styles.toolText}>{Math.round(zoom * 100)}% · 完整</Text></TouchableOpacity>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel="放大图片" disabled={zoom >= 3} onPress={() => setZoom(Math.min(3, zoom + 0.5))} style={[styles.tool, zoom >= 3 && styles.disabled]}><Text style={styles.toolText}>＋</Text></TouchableOpacity>
    <Text style={styles.readingTip}>放大后可拖动查看</Text>
  </View>;
}

const styles = StyleSheet.create({
  library: { width: '100%', maxWidth: 1160, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 24, paddingBottom: 28 },
  heading: { fontSize: 25, fontWeight: '600', lineHeight: 34 }, intro: { fontSize: 14, lineHeight: 22, marginTop: 8, marginBottom: 22 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 }, bookCard: { borderRadius: 20, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
  compactBook: { flexDirection: 'row' }, compactCopy: { flex: 1, minWidth: 0, padding: 14 }, compactTitle: { fontSize: 20, lineHeight: 28 },
  cover: { width: '100%', aspectRatio: 3 / 4, backgroundColor: '#F8F5EF' }, bookCopy: { padding: 18, gap: 7 }, bookMeta: { fontSize: 12, lineHeight: 18 },
  bookTitle: { fontSize: 23, lineHeight: 31, fontWeight: '600' }, bookSubtitle: { fontSize: 14, lineHeight: 22 }, tags: { fontSize: 12, lineHeight: 19, marginTop: 4 },
  readButton: { minHeight: 46, marginTop: 8, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 }, readButtonText: { color: '#fff', fontSize: 14, lineHeight: 21, fontWeight: '600' },
  artCard: { borderRadius: 18, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth }, artTitle: { fontSize: 18, fontWeight: '600', lineHeight: 26 },
  backgroundCard: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, marginBottom: 18 }, backgroundToggle: { minHeight: 58, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, backgroundBody: { paddingHorizontal: 16, paddingBottom: 18, gap: 18 }, backgroundTitle: { fontSize: 15, lineHeight: 23, fontWeight: '600' },
  filterRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 20 }, filter: { minHeight: 44, paddingHorizontal: 16, justifyContent: 'center', borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
  reader: { flex: 1, backgroundColor: '#F4F0E8' }, readerHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#D8D1C7', backgroundColor: '#FBF8F2' },
  readerControl: { minHeight: 44, minWidth: 52, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 }, controlText: { color: '#34483D', fontSize: 14, fontWeight: '500', lineHeight: 22 },
  readerTitleCopy: { flex: 1, minWidth: 0 }, readerTitle: { fontSize: 18, lineHeight: 25, fontWeight: '600', color: '#302F29' }, readerLabel: { fontSize: 11, lineHeight: 18, color: '#777469' },
  readerTools: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#FBF8F2' }, tool: { minHeight: 44, paddingHorizontal: 13, borderRadius: 10, justifyContent: 'center', backgroundColor: '#ECE8DF' }, toolText: { color: '#425446', fontSize: 13, lineHeight: 20 }, readingTip: { color: '#817C71', fontSize: 11, lineHeight: 18 },
  readerScroll: { flex: 1 }, readerContent: { alignItems: 'center', paddingTop: 18, paddingBottom: 30 }, storyPage: { gap: 12, marginBottom: 28 }, pageEyebrow: { color: '#777467', fontSize: 12, lineHeight: 19 },
  pageText: { gap: 12, maxWidth: 700 }, paragraph: { color: '#363C32', fontSize: 16, lineHeight: 28 }, sourceNote: { color: '#807C71', fontSize: 12, lineHeight: 20, maxWidth: 700, paddingHorizontal: 16 },
  pageNavigation: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderColor: '#D8D1C7', backgroundColor: '#FBF8F2' }, pageButton: { minHeight: 48, minWidth: 88, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#E5EBDD' }, pageCounter: { color: '#767369', fontSize: 13 }, disabled: { opacity: 0.4 },
  contents: { paddingHorizontal: 16, backgroundColor: '#EDEADF', borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#D8D1C7' }, contentsRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progressNotice: { color: '#8A603F', fontSize: 12, lineHeight: 20, paddingHorizontal: 16, paddingVertical: 4 }, zoomOverlay: { ...StyleSheet.absoluteFill, backgroundColor: '#F4F0E8', zIndex: 10 },
});
