import type { ImageSourcePropType } from 'react-native';

/** Stable identity includes request headers, without exposing URLs in React keys. */
export function imageSourceIdentity(source: ImageSourcePropType): string {
  const serialized = JSON.stringify(source);
  let hash = 2166136261;
  for (let index = 0; index < serialized.length; index += 1) {
    hash = Math.imul(hash ^ serialized.charCodeAt(index), 16777619);
  }
  return `${serialized.length}:${hash >>> 0}`;
}

export function buildImageSources(
  source?: ImageSourcePropType,
  fallbacks: ImageSourcePropType[] = [],
): ImageSourcePropType[] {
  const seen = new Set<string>();
  return [source, ...fallbacks].filter((candidate): candidate is ImageSourcePropType => {
    if (candidate == null || (typeof candidate === 'object' && !Array.isArray(candidate) && !candidate.uri)) return false;
    const key = imageSourceIdentity(candidate);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function findLocalImageSource(sources: ImageSourcePropType[]): ImageSourcePropType | undefined {
  return sources.find((source) => typeof source === 'number'
    || (!Array.isArray(source) && typeof source.uri === 'string' && !/^https?:\/\//i.test(source.uri)));
}
