import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AppState, Image, ImageProps, ImageSourcePropType, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { buildImageSources, findLocalImageSource, imageSourceIdentity } from '../utils/resilientImageSources';

export interface ResilientImageProps extends Omit<ImageProps, 'source'> {
  source?: ImageSourcePropType;
  fallbackSources?: ImageSourcePropType[];
  /** Change on a fresh page visit to retry a previously unavailable preferred image. */
  retryKey?: string | number;
  fallbackLabel?: string;
  retryLabel?: string;
  /** Optional explanation when a substitute illustration must not look like original content. */
  fallbackNotice?: string;
}

/** Each source is attempted once. Recovery is explicit, or on return from background. */
export default function ResilientImage({ source, fallbackSources = [], retryKey, ...props }: ResilientImageProps) {
  const sources = buildImageSources(source, fallbackSources);
  const sourceKey = sources.map(imageSourceIdentity).join('|');
  return <ImageAttempt key={`${sourceKey}:${retryKey ?? ''}`} {...props} sources={sources} />;
}

function ImageAttempt({ sources, style, onError, onLoad, fallbackLabel = '图片暂时未能显示', retryLabel = '重新加载', fallbackNotice, ...props }: Omit<ResilientImageProps, 'source' | 'fallbackSources' | 'retryKey'> & { sources: ImageSourcePropType[] }) {
  const [sourceIndex, setSourceIndex] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const onLoadRef = useRef(onLoad);
  const onErrorRef = useRef(onError);
  const attemptKey = `${sourceIndex}:${attempt}`;
  const activeAttemptRef = useRef(attemptKey);
  const settledAttemptRef = useRef<string | null>(null);
  const failed = sourceIndex >= sources.length;
  const localPreview = findLocalImageSource(sources);
  const { tintColor, ...frameStyle } = StyleSheet.flatten(style) ?? {};
  const imageStyle = [StyleSheet.absoluteFill, { width: '100%' as const, height: '100%' as const, tintColor }];

  // RN Web may deliver a cached load when a callback identity changes. Keep the
  // native handlers stable for an attempt; update callers only after commit.
  useLayoutEffect(() => {
    onLoadRef.current = onLoad;
    onErrorRef.current = onError;
    activeAttemptRef.current = attemptKey;
  }, [onLoad, onError, attemptKey]);

  const handleLoad = useCallback<NonNullable<ImageProps['onLoad']>>((event) => {
    if (activeAttemptRef.current !== attemptKey || settledAttemptRef.current === attemptKey) return;
    settledAttemptRef.current = attemptKey;
    setLoaded(true);
    onLoadRef.current?.(event);
  }, [attemptKey]);

  const handleError = useCallback<NonNullable<ImageProps['onError']>>((event) => {
    if (activeAttemptRef.current !== attemptKey || settledAttemptRef.current === attemptKey) return;
    settledAttemptRef.current = attemptKey;
    setLoaded(false);
    setSourceIndex((index) => index === sourceIndex ? index + 1 : index);
    onErrorRef.current?.(event);
  }, [attemptKey, sourceIndex]);
  const retry = () => {
    setSourceIndex(0);
    setLoaded(false);
    setAttempt((value) => value + 1);
  };

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && failed && sources.length > 0) {
        setSourceIndex(0);
        setLoaded(false);
        setAttempt((value) => value + 1);
      }
    });
    return () => subscription.remove();
  }, [failed, sources.length]);

  return (
    <View style={[styles.frame, frameStyle as ViewStyle]} pointerEvents={failed ? 'auto' : 'box-none'}>
      {!loaded && !failed && localPreview && localPreview !== sources[sourceIndex] && (
        <Image source={localPreview} style={imageStyle} resizeMode={props.resizeMode} accessible={false} />
      )}
      {!failed && (
        <Image
          {...props}
          key={`${sourceIndex}:${attempt}`}
          source={sources[sourceIndex]}
          style={imageStyle}
          onLoad={handleLoad}
          onError={handleError}
        />
      )}
      {failed && (
        <Pressable style={styles.retry} onPress={retry} accessibilityRole="button" accessibilityLabel={`${props.accessibilityLabel ?? fallbackLabel}，${retryLabel}`}>
          <Text style={styles.failureText} numberOfLines={2}>{fallbackLabel}</Text>
          <Text style={styles.retryText}>{retryLabel}</Text>
        </Pressable>
      )}
      {!failed && sourceIndex > 0 && fallbackNotice && (
        <Pressable style={styles.fallbackNotice} onPress={retry} accessibilityRole="button" accessibilityLabel={`${fallbackNotice}，重试原图`}>
          <Text style={styles.noticeText}>{fallbackNotice} · 重试原图</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden' },
  retry: { flex: 1, minHeight: 44, padding: 4, alignItems: 'center', justifyContent: 'center', gap: 3, backgroundColor: '#F3E9E5' },
  failureText: { fontSize: 11, color: '#725B55', textAlign: 'center' },
  retryText: { fontSize: 12, fontWeight: '600', color: '#794B51', textAlign: 'center' },
  fallbackNotice: { position: 'absolute', left: 8, right: 8, bottom: 44, minHeight: 44, padding: 8, justifyContent: 'center', borderRadius: 12, backgroundColor: '#FFF8F2ED' },
  noticeText: { color: '#725B55', fontSize: 12, lineHeight: 18, textAlign: 'center' },
});
