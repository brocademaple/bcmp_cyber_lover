import { describe, expect, it } from 'vitest';
import { buildImageSources, findLocalImageSource, imageSourceIdentity } from '../src/utils/resilientImageSources';

describe('reliable character image candidates', () => {
  it('preserves a custom preferred image before bundled fallback, without duplicate retries', () => {
    const custom = { uri: 'https://example.test/custom-character.png' };
    expect(buildImageSources(custom, [{ ...custom }, 42, 42, 73])).toEqual([custom, 42, 73]);
  });

  it('finds a safe local preview without replacing a preferred remote source', () => {
    const remote = { uri: 'https://example.test/avatar.png' };
    const localFile = { uri: 'file:///documents/custom-avatar.png' };
    const sources = buildImageSources(remote, [localFile, 42]);
    expect(sources[0]).toEqual(remote);
    expect(findLocalImageSource(sources)).toEqual(localFile);
    expect(findLocalImageSource([remote])).toBeUndefined();
  });

  it('accepts both Metro numeric assets and web resolved asset URLs', () => {
    const webAsset = { uri: '/assets/headshot.png', width: 512, height: 512 };
    expect(findLocalImageSource([webAsset])).toEqual(webAsset);
    expect(findLocalImageSource([16])).toBe(16);
  });

  it('does not treat a different authenticated request as an already failed source', () => {
    const first = { uri: 'https://example.test/avatar.png', headers: { Authorization: 'first' } };
    const refreshed = { uri: first.uri, headers: { Authorization: 'refreshed' } };
    expect(buildImageSources(first, [refreshed])).toHaveLength(2);
    expect(imageSourceIdentity(first)).not.toContain('Authorization');
    expect(imageSourceIdentity(first)).not.toContain('first');
  });

  it('skips an empty URI instead of starting a request with no usable source', () => {
    expect(buildImageSources({ uri: '' }, [42])).toEqual([42]);
    expect(buildImageSources()).toEqual([]);
  });
});
