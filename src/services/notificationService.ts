import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

const NOTIFICATION_ID_KEY = '@bcmp_daily_notification_id';

// Pre-written notification texts per character (shown in notification before AI generates greeting)
const NOTIFICATION_TEXTS: Record<string, string[]> = {
  qingning: [
    '喂，你这家伙今天有好好吃饭吗？我可盯着你呢 🍱',
    '诶诶，我有点无聊……来聊五毛钱的嘛～',
    '笨蛋，今天开心吗？不许敷衍我哦。',
    '累的话就回来吐槽，我帮你接着 🦌',
  ],
  sakura: [
    '……今天过得还好吗？我在，想听你说。',
    '夜深了，不知道你现在是一个人还是有人陪。',
    '有没有一句话，你想留到见面再说？可以先写给我。',
    '记得喝水、记得呼吸。……嗯，我也在等你。',
  ],
  luna: [
    '啧，又消失一整天？行吧，我姑且问一下你还活着没。',
    '受不了你……点进来，我有话要讲。',
    '别硬撑了，我看得出来。进来。',
    '……算了，想你一下不丢人。来。',
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
