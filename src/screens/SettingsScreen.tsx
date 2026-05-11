import { useCallback, useState } from 'react';
import { Alert, Switch, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { getJournalReminderWindows, saveJournalReminderWindows } from '../lib/database';
import { exportBackupFile, importBackupFile } from '../lib/backup';
import { syncJournalNotifications } from '../lib/journalReminders';
import type { JournalReminderWindow } from '../lib/types';
import { Button, Input, ScreenContainer, SectionCard } from '../ui/components';
import { palette } from '../ui/theme';
import { useAppStore } from '../state/useAppStore';

function timeString(window: JournalReminderWindow) {
  return `${String(window.hour).padStart(2, '0')}:${String(window.minute).padStart(2, '0')}`;
}

function parseTime(value: string) {
  const [h, m] = value.split(':');
  return { hour: Number.parseInt(h, 10) || 0, minute: Number.parseInt(m, 10) || 0 };
}

export function SettingsScreen() {
  const bumpRevision = useAppStore((s) => s.bumpRevision);
  const revision = useAppStore((s) => s.revision);
  const [windows, setWindows] = useState<JournalReminderWindow[]>([]);

  const load = useCallback(async () => {
    setWindows(await getJournalReminderWindows());
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load, revision]));

  async function handleSaveReminders() {
    await saveJournalReminderWindows(windows);
    await syncJournalNotifications();
    bumpRevision();
    Alert.alert('Saved', 'Journal reminder windows updated.');
  }

  async function handleExport() {
    const uri = await exportBackupFile();
    Alert.alert('Backup exported', uri);
  }

  async function handleImport() {
    const imported = await importBackupFile();
    if (imported) {
      bumpRevision();
      Alert.alert('Restore complete', 'Backup imported successfully.');
    }
  }

  return (
    <ScreenContainer>
      <SectionCard title="Journal reminders" subtitle="Choose the windows where the app nudges you to write.">
        {windows.map((window, index) => (
          <View key={window.key} style={{ borderWidth: 1, borderColor: palette.border, borderRadius: 12, padding: 12, gap: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: palette.text, fontWeight: '700' }}>{window.label}</Text>
              <Switch
                value={window.enabled}
                onValueChange={(enabled) => setWindows((current) => current.map((item, idx) => idx === index ? { ...item, enabled } : item))}
              />
            </View>
            <Input
              value={timeString(window)}
              onChangeText={(value) => {
                const parsed = parseTime(value);
                setWindows((current) => current.map((item, idx) => idx === index ? { ...item, ...parsed } : item));
              }}
              placeholder="21:30"
            />
          </View>
        ))}
        <Button title="Save reminder settings" onPress={() => void handleSaveReminders()} />
      </SectionCard>

      <SectionCard title="Backup & restore" subtitle="Manual snapshot now, Drive flow later.">
        <Button title="Export backup" onPress={() => void handleExport()} />
        <Button title="Import backup" tone="secondary" onPress={() => void handleImport()} />
      </SectionCard>

      <SectionCard title="Operational note">
        <Text style={{ color: palette.textMuted, lineHeight: 22 }}>
          Phase 1 treats one device as authoritative. Export before major changes or reinstalling, then restore on the next device.
        </Text>
      </SectionCard>
    </ScreenContainer>
  );
}
