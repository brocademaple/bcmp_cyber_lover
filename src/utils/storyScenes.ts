import type { CharacterStory, StoryPage } from '../config/luyaStoryLibrary';
import { LUYA_SCENE_SCRIPT, type SceneScript } from '../config/luyaStoryScenes';
import type { StoryBookmark } from '../services/storyReadingProgress';

export type StoryScene = SceneScript & { page: StoryPage; pageIndex: number; sceneId: string; aspectRatio: number };
export function getStoryScenes(story: Pick<CharacterStory, 'pages'>): StoryScene[] {
  return story.pages.flatMap((page, pageIndex) => {
    const fallback: SceneScript = { id: 'whole', title: page.title, setting: '', crop: { top: 0, height: 1 }, lines: page.paragraphs.map(text => ({ kind: 'narration', text })) };
    return (LUYA_SCENE_SCRIPT[page.id] ?? [fallback]).map(scene => ({ ...scene, page, pageIndex, sceneId: `${page.id}:${scene.id}`, aspectRatio: page.aspectRatio / scene.crop.height }));
  });
}
export function resumeStoryScene(bookmark: StoryBookmark | undefined, scenes: StoryScene[]): { sceneIndex: number; lineIndex: number } {
  if (!scenes.length) return { sceneIndex: 0, lineIndex: 0 };
  const exact = bookmark?.sceneId ? scenes.findIndex(scene => scene.sceneId === bookmark.sceneId) : -1;
  const oldPage = Math.min(bookmark?.pageIndex ?? 0, Math.max(...scenes.map(scene => scene.pageIndex)));
  const sceneIndex = exact >= 0 ? exact : Math.max(0, scenes.findIndex(scene => scene.pageIndex === oldPage));
  return { sceneIndex, lineIndex: exact >= 0 ? Math.min(bookmark?.lineIndex ?? 0, Math.max(0, scenes[sceneIndex].lines.length - 1)) : 0 };
}
