import React, { useEffect, useState } from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RootStackParamList } from '../types';
import { useThemeColors } from '../utils/theme';
import { useSettingsStore } from '../store/settingsStore';
import { NOTO_SERIF_SC } from '../utils/appFonts';

import OnboardingScreen, { ONBOARDING_KEY } from '../screens/OnboardingScreen';
import HomeScreen from '../screens/HomeScreen';
import ChatScreen from '../screens/ChatScreen';
import CallScreen from '../screens/CallScreen';
import SettingsScreen from '../screens/SettingsScreen';
import LifeSettingsScreen from '../screens/LifeSettingsScreen';
import MemorySettingsScreen from '../screens/MemorySettingsScreen';
import AdvancedSettingsScreen from '../screens/AdvancedSettingsScreen';
import ServiceSettingsScreen from '../screens/ServiceSettingsScreen';
import DeveloperDebugScreen from '../screens/DeveloperDebugScreen';
import CharacterEditorScreen from '../screens/CharacterEditorScreen';
import CharacterSettingsScreen from '../screens/CharacterSettingsScreen';
import DataManagementScreen from '../screens/DataManagementScreen';
import { recoverInterruptedRestore } from '../services/appDataPortability';
import { recordAppIssue } from '../services/appDiagnostics';

const Stack = createNativeStackNavigator<RootStackParamList>();

type InitialRoute =
  | { name: 'Onboarding' }
  | { name: 'Main' };

interface Props {
  navigationRef: React.RefObject<NavigationContainerRef<RootStackParamList> | null>;
}

export default function AppNavigator({ navigationRef }: Props) {
  const C = useThemeColors();
  const { loadSettings } = useSettingsStore();
  const [initialRoute, setInitialRoute] = useState<InitialRoute | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        await recoverInterruptedRestore();
      } catch (error) {
        await recordAppIssue('恢复中断回滚', error, true);
      }
      await loadSettings();
      const completed = await AsyncStorage.getItem(ONBOARDING_KEY);
      const loadedSettings = useSettingsStore.getState().settings;
      const hasConfiguredApiKey = loadedSettings.service.apiKey.trim().length > 0;

      if (hasConfiguredApiKey) {
        if (completed !== 'true') {
          await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
        }
        setInitialRoute({ name: 'Main' });
        return;
      }

      setInitialRoute(completed === 'true' ? { name: 'Main' } : { name: 'Onboarding' });
    };
    init();
  }, [loadSettings]);

  if (!initialRoute) {
    // Still loading — render nothing (splash screen would be shown)
    return null;
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator
        initialRouteName={initialRoute.name}
        screenOptions={({ navigation, route }) => {
          const isImmersive = route.name === 'Chat';
          const tintColor = isImmersive ? '#fff' : C.text;
          return {
          headerTransparent: isImmersive,
          headerStyle: { backgroundColor: isImmersive ? 'transparent' : C.background },
          headerShadowVisible: false,
          headerTintColor: tintColor,
          headerTitleStyle: { fontFamily: NOTO_SERIF_SC.bold, fontWeight: undefined, color: tintColor },
          contentStyle: { backgroundColor: C.background },
          headerBackTitleVisible: false,
          headerLeft: navigation.canGoBack()
            ? () => (
                <TouchableOpacity
                  onPress={() => navigation.goBack()}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 21,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: isImmersive ? 'rgba(10,10,18,0.22)' : C.surface + 'CC',
                  }}
                >
                  <Text style={{ color: tintColor, fontFamily: NOTO_SERIF_SC.regular, fontSize: 34, lineHeight: 36 }}>‹</Text>
                </TouchableOpacity>
              )
            : undefined,
          animation: 'slide_from_right',
        };
        }}
      >
        <Stack.Screen
          name="Onboarding"
          component={OnboardingScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Main"
          component={HomeScreen}
          options={{ title: '心动伴侣', headerShown: false }}
        />
        <Stack.Screen
          name="Chat"
          component={ChatScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Call"
          component={CallScreen}
          options={{ headerShown: false, animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="Settings"
          component={SettingsScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="LifeSettings"
          component={LifeSettingsScreen}
          options={{ title: '陪伴提醒' }}
        />
        <Stack.Screen
          name="MemorySettings"
          component={MemorySettingsScreen}
          options={{ title: '记忆' }}
        />
        <Stack.Screen
          name="DataManagement"
          component={DataManagementScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="AdvancedSettings"
          component={AdvancedSettingsScreen}
          options={{ title: '内部参数' }}
        />
        <Stack.Screen
          name="ServiceSettings"
          component={ServiceSettingsScreen}
          options={{ title: '连接服务' }}
        />
        <Stack.Screen
          name="DeveloperDebug"
          component={DeveloperDebugScreen}
          options={{ title: 'AI 调试台' }}
        />
        <Stack.Screen
          name="CharacterEditor"
          component={CharacterEditorScreen}
          options={{ title: '角色编辑' }}
        />
        <Stack.Screen
          name="CharacterSettings"
          component={CharacterSettingsScreen}
          options={{ title: '角色设置' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
