import React, { useEffect, useRef } from 'react';
import { useFonts } from 'expo-font';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { NavigationContainerRef } from '@react-navigation/native';
import AppNavigator from './src/navigation/AppNavigator';
import { setupNotificationHandler } from './src/services/notificationService';
import { RootStackParamList } from './src/types';
import AppErrorBoundary from './src/components/AppErrorBoundary';
import ImageRecoveryProbe from './src/dev/ImageRecoveryProbe';
import { YINZHI_FONT_FILES } from './src/utils/appFonts';

setupNotificationHandler();

export default function App() {
  const [fontsLoaded] = useFonts(YINZHI_FONT_FILES);
  const navigationRef = useRef<NavigationContainerRef<RootStackParamList>>(null);
  const isImageRecoveryProbe = __DEV__ && Platform.OS === 'web' && typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('experienceProbe') === 'images';
  useEffect(() => {
    // Handle notification tap: navigate to the character's chat
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as {
        characterId?: string;
        autoGreet?: boolean;
      };
      if (data?.characterId) {
        // Small delay to ensure navigation is ready
        setTimeout(() => {
          navigationRef.current?.navigate('Chat', {
            characterId: data.characterId!,
            autoGreet: true,
          });
        }, 300);
      }
    });

    return () => subscription.remove();
  }, []);

  if (!fontsLoaded) {
    // Wait for 站酷小薇 / 源泉圆体 so first paint does not flash system fonts.
    return null;
  }

  return (
    <AppErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          {isImageRecoveryProbe ? <ImageRecoveryProbe /> : <AppNavigator navigationRef={navigationRef} />}
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </AppErrorBoundary>
  );
}
