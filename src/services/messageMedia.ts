import { Message } from '../types';

export type PortableMediaFile = {
  mimeType: string;
  dataBase64: string;
  checksum: string;
};

export function resolveMessageMediaUri(uri: string): string {
  return uri;
}

export async function persistMessageImage(uri: string, _mimeType?: string): Promise<string> {
  return uri;
}

export async function messageImageToProviderUrl(uri: string): Promise<string> {
  if (!uri.startsWith('blob:')) return uri;
  const response = await fetch(uri);
  const blob = await response.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('无法读取图片'));
    reader.readAsDataURL(blob);
  });
}

export async function collectPortableMedia(messages: Message[]) {
  return { messages, mediaFiles: {} as Record<string, PortableMediaFile> };
}

export async function restorePortableMedia(_mediaFiles: Record<string, PortableMediaFile>) {}
