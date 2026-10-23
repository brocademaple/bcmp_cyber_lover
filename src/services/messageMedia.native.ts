import * as FileSystem from 'expo-file-system/legacy';
import { Message } from '../types';
import { fnv1aChecksum } from './dataIntegrity';

const MEDIA_SCHEME = 'bcmp-media://';
const MEDIA_DIRECTORY = 'bcmp-media/images';

export type PortableMediaFile = {
  mimeType: string;
  dataBase64: string;
  checksum: string;
};

function mediaRoot(): string {
  if (!FileSystem.documentDirectory) throw new Error('当前平台没有可写的媒体目录');
  return `${FileSystem.documentDirectory}${MEDIA_DIRECTORY}/`;
}

function safeExtension(uri: string, mimeType?: string): string {
  const mimeExtension = mimeType?.split('/')[1]?.toLowerCase();
  if (mimeExtension && /^[a-z0-9]+$/.test(mimeExtension)) {
    return mimeExtension === 'jpeg' ? 'jpg' : mimeExtension;
  }
  const pathExtension = uri.split('?')[0].match(/\.([a-zA-Z0-9]{2,5})$/)?.[1]?.toLowerCase();
  return pathExtension && /^[a-z0-9]+$/.test(pathExtension) ? pathExtension : 'jpg';
}

function mimeTypeForPath(path: string): string {
  const extension = path.split('.').pop()?.toLowerCase();
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  if (extension === 'heic' || extension === 'heif') return 'image/heic';
  return 'image/jpeg';
}

function relativePathFromStoredUri(uri: string): string | null {
  if (!uri.startsWith(MEDIA_SCHEME)) return null;
  const relativePath = uri.slice(MEDIA_SCHEME.length);
  if (!relativePath || relativePath.includes('..') || relativePath.startsWith('/')) return null;
  return relativePath;
}

export function resolveMessageMediaUri(uri: string): string {
  const relativePath = relativePathFromStoredUri(uri);
  if (!relativePath) return uri;
  return `${FileSystem.documentDirectory ?? ''}${MEDIA_DIRECTORY}/${relativePath}`;
}

export async function persistMessageImage(uri: string, mimeType?: string): Promise<string> {
  if (!uri || uri.startsWith(MEDIA_SCHEME) || uri.startsWith('data:') || /^https?:\/\//i.test(uri)) {
    return uri;
  }

  const root = mediaRoot();
  await FileSystem.makeDirectoryAsync(root, { intermediates: true });
  const extension = safeExtension(uri, mimeType);
  const fileName = `image-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${extension}`;
  const destination = `${root}${fileName}`;
  await FileSystem.copyAsync({ from: uri, to: destination });
  return `${MEDIA_SCHEME}${fileName}`;
}

export async function messageImageToProviderUrl(uri: string): Promise<string> {
  if (uri.startsWith('data:') || /^https?:\/\//i.test(uri)) return uri;
  const resolved = resolveMessageMediaUri(uri);
  const dataBase64 = await FileSystem.readAsStringAsync(resolved, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return `data:${mimeTypeForPath(resolved)};base64,${dataBase64}`;
}

export async function collectPortableMedia(messages: Message[]): Promise<{
  messages: Message[];
  mediaFiles: Record<string, PortableMediaFile>;
}> {
  const mediaFiles: Record<string, PortableMediaFile> = {};
  const normalized: Message[] = [];

  for (const message of messages) {
    if (!message.imageUri || /^https?:\/\//i.test(message.imageUri) || message.imageUri.startsWith('data:')) {
      normalized.push(message);
      continue;
    }

    try {
      const storedUri = await persistMessageImage(message.imageUri);
      const relativePath = relativePathFromStoredUri(storedUri);
      if (!relativePath) {
        normalized.push(message);
        continue;
      }
      const resolved = resolveMessageMediaUri(storedUri);
      const dataBase64 = await FileSystem.readAsStringAsync(resolved, {
        encoding: FileSystem.EncodingType.Base64,
      });
      mediaFiles[relativePath] = {
        mimeType: mimeTypeForPath(relativePath),
        dataBase64,
        checksum: fnv1aChecksum(dataBase64),
      };
      normalized.push({ ...message, imageUri: storedUri });
    } catch {
      normalized.push(message);
    }
  }

  return { messages: normalized, mediaFiles };
}

export async function restorePortableMedia(
  mediaFiles: Record<string, PortableMediaFile>
): Promise<void> {
  const root = mediaRoot();
  await FileSystem.makeDirectoryAsync(root, { intermediates: true });

  for (const [relativePath, media] of Object.entries(mediaFiles)) {
    if (!relativePath || relativePath.includes('..') || relativePath.startsWith('/')) {
      throw new Error('备份包含不安全的媒体路径');
    }
    if (fnv1aChecksum(media.dataBase64) !== media.checksum) {
      throw new Error(`媒体文件校验失败：${relativePath}`);
    }
    const destination = `${root}${relativePath}`;
    const temporary = `${destination}.tmp`;
    await FileSystem.writeAsStringAsync(temporary, media.dataBase64, {
      encoding: FileSystem.EncodingType.Base64,
    });
    try {
      await FileSystem.moveAsync({ from: temporary, to: destination });
    } catch {
      await FileSystem.deleteAsync(destination, { idempotent: true });
      await FileSystem.moveAsync({ from: temporary, to: destination });
    }
  }
}
