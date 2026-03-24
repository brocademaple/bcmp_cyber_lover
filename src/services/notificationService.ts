import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

const NOTIFICATION_ID_KEY = '@bcmp_daily_notification_id';

// Pre-written notification texts per character (shown in notification before AI generates greeting)
const NOTIFICATION_TEXTS: Record<string, string[]> = {
  qingning: [
    '今天有没有好好吃饭呀？我有点担心你 🍱',
    '老公，我想你了，快来陪我聊聊天嘛～',
    '嘿嘿，今天的你开心吗？我好想知道哦～',
    '你今天累不累呀？我在等你回来 🌙',
  ],
  sakura: [
    '亲爱的，你今天过得好吗……我一直在想你',
    '夜深了，不知道你现在在做什么呢 🌸',
    '今天有没有发生什么有趣的事？想和你分享',
    '亲爱的，记得好好休息，我在这里陪你 ✨',
  ],
  luna: [
    '……你今天还好吗。我有点想知道。',
    '今晚星星很好看，忽然想到了你。',
    '哼，不许不回来，我在等你。',
    '……好久不见。你有没有想过我。',
  ],
};

const DEFAULT_TEXTS = [
  'TA 想起了你，点进来看看吧 💌',
  '今天也记得来聊聊天哦～',
  '有件事想和你说……快来看看',
];

export function getNotificationText(characterId: string): string {
  const texts = NOTIFICATION_TEXTS[characterId] || DEFAULT_TEXTS;
  return texts[Math.floor(Math.random() * texts.length)];
}

export async function requestNotificationPermission(): Promise<boolean> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  if (existingStatus === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function scheduleDailyNotification(
  characterId: string,
  characterName: string,
  hour: number = 20,
  minute: number = 0
): Promise<void> {
  // Cancel existing scheduled notification
  await cancelDailyNotification();

  const hasPermission = await requestNotificationPermission();
  if (!hasPermission) return;

  const notifText = getNotificationText(characterId);

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: characterName,
      body: notifText,
      data: { characterId, autoGreet: true },
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });

  await AsyncStorage.setItem(NOTIFICATION_ID_KEY, id);
}

export async function cancelDailyNotification(): Promise<void> {
  try {
    const id = await AsyncStorage.getItem(NOTIFICATION_ID_KEY);
    if (id) {
      await Notifications.cancelScheduledNotificationAsync(id);
      await AsyncStorage.removeItem(NOTIFICATION_ID_KEY);
    }
  } catch {
    // ignore
  }
}

export function setupNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}
