import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

import { getJournalReminderWindows } from './database';

export function configureNotifications() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export async function syncJournalNotifications() {
  const { granted } = await Notifications.requestPermissionsAsync();
  if (!granted) return;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('journal-reminders', {
      name: 'Journal reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const windows = await getJournalReminderWindows();
  await Notifications.cancelAllScheduledNotificationsAsync();

  for (const window of windows) {
    if (!window.enabled) continue;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Journal check-in',
        body: `${window.label}: capture the day while it is still fresh.`,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: window.hour,
        minute: window.minute,
      },
    });
  }
}
