import 'react-native-gesture-handler';

import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ActivityIndicator, Text, View } from 'react-native';
import { useEffect } from 'react';

import { DashboardScreen } from './src/screens/DashboardScreen';
import { FinanceScreen } from './src/screens/FinanceScreen';
import { JournalScreen } from './src/screens/JournalScreen';
import { ProgressScreen } from './src/screens/ProgressScreen';
import { ScheduleScreen } from './src/screens/ScheduleScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { initDatabase } from './src/lib/database';
import { configureNotifications, syncJournalNotifications } from './src/lib/journalReminders';
import { useAppStore } from './src/state/useAppStore';
import { palette } from './src/ui/theme';

const Tab = createBottomTabNavigator();

function Boot() {
  const { dbReady, error, setDbReady, setError } = useAppStore();

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        if (mounted) {
          setError(null);
        }

        configureNotifications();
        await initDatabase();
        if (mounted) {
          setDbReady(true);
        }

        void syncJournalNotifications().catch((error) => {
          if (mounted) {
            setError(error instanceof Error ? error.message : 'Failed to sync journal reminders');
          }
        });
      } catch (error) {
        if (mounted) {
          setError(error instanceof Error ? error.message : 'Failed to initialize app');
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [setDbReady, setError]);

  if (!dbReady && error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24, backgroundColor: palette.background }}>
        <Text style={{ color: palette.text, fontWeight: '700', fontSize: 18, textAlign: 'center' }}>
          We couldn&apos;t finish preparing your local workspace.
        </Text>
        <Text style={{ marginTop: 12, color: palette.textMuted, textAlign: 'center', lineHeight: 22 }}>
          {error}
        </Text>
      </View>
    );
  }

  if (!dbReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: palette.background }}>
        <ActivityIndicator size="large" color={palette.primary} />
        <Text style={{ marginTop: 12, color: palette.textMuted }}>Preparing your local workspace…</Text>
      </View>
    );
  }

  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: palette.surface },
        headerTitleStyle: { color: palette.text, fontWeight: '700' },
        tabBarActiveTintColor: palette.primary,
        tabBarInactiveTintColor: palette.textMuted,
        tabBarStyle: { backgroundColor: palette.surface, borderTopColor: palette.border },
      }}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Schedule" component={ScheduleScreen} />
      <Tab.Screen name="Progress" component={ProgressScreen} />
      <Tab.Screen name="Finance" component={FinanceScreen} />
      <Tab.Screen name="Journal" component={JournalScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Boot />
        <StatusBar style="dark" />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
