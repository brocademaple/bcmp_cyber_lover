import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const isSecureStoreAvailable = Platform.OS === 'ios' || Platform.OS === 'android';
const fallbackPrefix = '@secure_fallback_';

export async function saveSecure(key: string, value: string): Promise<void> {
  if (isSecureStoreAvailable) {
    await SecureStore.setItemAsync(key, value);
    return;
  }
  await AsyncStorage.setItem(fallbackPrefix + key, value);
}

export async function getSecure(key: string): Promise<string | null> {
  if (isSecureStoreAvailable) {
    return await SecureStore.getItemAsync(key);
  }
  return await AsyncStorage.getItem(fallbackPrefix + key);
}

export async function deleteSecure(key: string): Promise<void> {
  if (isSecureStoreAvailable) {
    await SecureStore.deleteItemAsync(key);
    return;
  }
  await AsyncStorage.removeItem(fallbackPrefix + key);
}
