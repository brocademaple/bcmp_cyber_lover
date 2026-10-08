import { describe, expect, it } from 'vitest';
import { LUYA_SCENE_SCRIPT } from '../src/config/luyaStoryScenes';
import { getStoryScenes, resumeStoryScene } from '../src/utils/storyScenes';

const page = (id: string) => ({ id, image: 1, title: id, aspectRatio: 0.75, paragraphs: ['A story paragraph.'] });
const scenes = getStoryScenes({ pages: [page('unknown-year-01'), page('unknown-year-02')] });

describe('story-to-image continuity', () => {
  it('keeps every panel inside its source image, ordered without overlaps and with readable text', () => {
    for (const pageScenes of Object.values(LUYA_SCENE_SCRIPT)) {
      let previousEnd = 0;
      for (const scene of pageScenes) {
        expect(scene.crop.top).toBeGreaterThanOrEqual(previousEnd);
        expect(scene.crop.height).toBeGreaterThan(0);
        expect(scene.crop.top + scene.crop.height).toBeLessThanOrEqual(1.00001);
        expect(scene.lines.length).toBeGreaterThan(0);
        expect(scene.lines.every(line => line.text.trim() && (line.kind === 'narration' || line.speaker))).toBe(true);
        previousEnd = scene.crop.top + scene.crop.height;
      }
    }
  });
  it('adapts old page bookmarks to the first scene of that page without losing progress', () => {
    expect(scenes).toHaveLength(6);
    expect(resumeStoryScene({ pageIndex: 1, updatedAt: 1 }, scenes)).toEqual({ sceneIndex: 3, lineIndex: 0 });
    expect(resumeStoryScene(undefined, scenes)).toEqual({ sceneIndex: 0, lineIndex: 0 });
  });
  it('resumes a stable scene ID after new scenes are inserted, and clamps a shortened dialogue', () => {
    const bookmark = { pageIndex: 1, sceneId: scenes[5].sceneId, lineIndex: 10, updatedAt: 1 };
    expect(resumeStoryScene(bookmark, scenes)).toEqual({ sceneIndex: 5, lineIndex: 2 });
    expect(resumeStoryScene(bookmark, [scenes[0], ...scenes])).toEqual({ sceneIndex: 6, lineIndex: 2 });
  });
  it('falls back to the correct page when a scene is removed and handles fewer pages', () => {
    expect(resumeStoryScene({ pageIndex: 1, sceneId: 'removed', lineIndex: 5, updatedAt: 1 }, scenes)).toEqual({ sceneIndex: 3, lineIndex: 0 });
    expect(resumeStoryScene({ pageIndex: 5, updatedAt: 1 }, scenes.slice(0, 3))).toEqual({ sceneIndex: 0, lineIndex: 0 });
  });
  it('gives future un-scripted pages a complete-image, text-readable fallback', () => {
    const fallback = getStoryScenes({ pages: [page('new-page')] });
    expect(fallback[0].crop).toEqual({ top: 0, height: 1 });
    expect(fallback[0].lines[0].text).toBe('A story paragraph.');
    expect(resumeStoryScene(undefined, [])).toEqual({ sceneIndex: 0, lineIndex: 0 });
  });
});
