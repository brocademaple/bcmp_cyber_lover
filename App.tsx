import React, { useEffect, useRef } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { NavigationContainerRef } from '@react-navigation/native';
import AppNavigator from './src/navigation/AppNavigator';
import { setupNotificationHandler } from './src/services/notificationService';
import { RootStackParamList } from './src/types';

setupNotificationHandler();

export default function App() {
  const navigationRef = useRef<NavigationContainerRef<RootStackParamList>>(null);

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

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppNavigator navigationRef={navigationRef} />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
