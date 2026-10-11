import React, { useEffect, useRef } from 'react';
import { useFonts } from 'expo-font';
import { Platform, Text, TextInput } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { NavigationContainerRef } from '@react-navigation/native';
import AppNavigator from './src/navigation/AppNavigator';
import { setupNotificationHandler } from './src/services/notificationService';
import { RootStackParamList } from './src/types';
import AppErrorBoundary from './src/components/AppErrorBoundary';
import ImageRecoveryProbe from './src/dev/ImageRecoveryProbe';
import { YINZHI_BODY, YINZHI_FONT_FILES } from './src/utils/appFonts';

/** Body default so screens without explicit fontFamily still use GenSenRounded2. Once only. */
let yinzhiDefaultFontsApplied = false;
function applyYinzhiDefaultFonts() {
  if (yinzhiDefaultFontsApplied) return;
  yinzhiDefaultFontsApplied = true;
  const body = { fontFamily: YINZHI_BODY.regular };
  const T = Text as typeof Text & { defaultProps?: { style?: unknown } };
  T.defaultProps = T.defaultProps ?? {};
  T.defaultProps.style = [body, T.defaultProps.style].filter(Boolean);
  const TI = TextInput as typeof TextInput & { defaultProps?: { style?: unknown } };
  TI.defaultProps = TI.defaultProps ?? {};
  TI.defaultProps.style = [body, TI.defaultProps.style].filter(Boolean);
}

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

  applyYinzhiDefaultFonts();

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
