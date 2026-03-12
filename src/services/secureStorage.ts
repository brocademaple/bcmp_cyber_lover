import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const isSecureStoreAvailable = Platform.OS === 'ios' || Platform.OS === 'android';

export async function saveSecure(key: string, value: string): Promise<void> {
  if (isSecureStoreAvailable) {
    await SecureStore.setItemAsync(key, value);
  }
}

export async function getSecure(key: string): Promise<string | null> {
  if (isSecureStoreAvailable) {
    return await SecureStore.getItemAsync(key);
  }
  return null;
}

export async function deleteSecure(key: string): Promise<void> {
  if (isSecureStoreAvailable) {
    await SecureStore.deleteItemAsync(key);
  }
}
