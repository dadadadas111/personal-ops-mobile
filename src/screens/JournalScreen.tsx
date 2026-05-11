import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { getJournalContext, listJournalEntries, saveJournalEntry } from '../lib/database';
import { formatCurrency, todayIso } from '../lib/utils';
import type { JournalContext, JournalEntry } from '../lib/types';
import { Button, EmptyState, Input, ScreenContainer, SectionCard } from '../ui/components';
import { palette } from '../ui/theme';
import { useAppStore } from '../state/useAppStore';

export function JournalScreen() {
  const bumpRevision = useAppStore((s) => s.bumpRevision);
  const revision = useAppStore((s) => s.revision);
  const [date, setDate] = useState(todayIso());
  const [entryWindow, setEntryWindow] = useState<'morning' | 'midday' | 'evening' | 'freeform'>('evening');
  const [context, setContext] = useState<JournalContext | null>(null);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [eventsText, setEventsText] = useState('');
  const [winsText, setWinsText] = useState('');
  const [difficultiesText, setDifficultiesText] = useState('');
  const [feelingsText, setFeelingsText] = useState('');
  const [lessonsText, setLessonsText] = useState('');
  const [tomorrowText, setTomorrowText] = useState('');

  const load = useCallback(async () => {
    const [journalContext, journalEntries] = await Promise.all([
      getJournalContext(date),
      listJournalEntries(),
    ]);
    setContext(journalContext);
    setEntries(journalEntries);
  }, [date]);

  useFocusEffect(useCallback(() => { void load(); }, [load, revision]));

  async function handleSave() {
    const promptContext = context ?? { date, scheduleSummary: [], latestCheckin: null, financeTotal: 0 };
    await saveJournalEntry({
      date,
      entryWindow,
      promptContextJson: JSON.stringify(promptContext),
      eventsText,
      winsText,
      difficultiesText,
      feelingsText,
      lessonsText,
      tomorrowText,
    });
    setEventsText('');
    setWinsText('');
    setDifficultiesText('');
    setFeelingsText('');
    setLessonsText('');
    setTomorrowText('');
    await load();
    bumpRevision();
  }

  return (
    <ScreenContainer>
      <SectionCard title="Journal context" subtitle="The app pulls in the shape of your day so writing is easier.">
        <Input value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" />
        <Input value={entryWindow} onChangeText={(value) => setEntryWindow(value as typeof entryWindow)} placeholder="morning / midday / evening / freeform" />
        {context ? (
          <View style={{ gap: 8 }}>
            <Text style={{ color: palette.textMuted }}>Schedule</Text>
            {context.scheduleSummary.length ? context.scheduleSummary.map((item) => <Text key={item} style={{ color: palette.text }}>{item}</Text>) : <Text style={{ color: palette.textMuted }}>No blocks logged for this day.</Text>}
            <Text style={{ color: palette.textMuted }}>Finance total: {formatCurrency(context.financeTotal)}</Text>
            <Text style={{ color: palette.textMuted }}>
              Latest check-in: {context.latestCheckin?.tomorrowText || 'No daily check-in recorded yet.'}
            </Text>
          </View>
        ) : null}
      </SectionCard>

      <SectionCard title="Guided entry" subtitle="Tell the day in a way future-you can actually understand.">
        <Input value={eventsText} onChangeText={setEventsText} placeholder="What happened today? Mention real events, people, and decisions." multiline />
        <Input value={winsText} onChangeText={setWinsText} placeholder="What went well?" multiline />
        <Input value={difficultiesText} onChangeText={setDifficultiesText} placeholder="What was difficult?" multiline />
        <Input value={feelingsText} onChangeText={setFeelingsText} placeholder="How did you feel through the day?" multiline />
        <Input value={lessonsText} onChangeText={setLessonsText} placeholder="What did you learn or notice?" multiline />
        <Input value={tomorrowText} onChangeText={setTomorrowText} placeholder="What do you want from tomorrow?" multiline />
        <Button title="Save journal entry" onPress={() => void handleSave()} />
      </SectionCard>

      <SectionCard title="Recent entries">
        {entries.length ? entries.map((entry) => (
          <View key={entry.id} style={{ borderWidth: 1, borderColor: palette.border, borderRadius: 12, padding: 12, gap: 6 }}>
            <Text style={{ color: palette.text, fontWeight: '700' }}>{entry.date} · {entry.entryWindow}</Text>
            <Text style={{ color: palette.textMuted }} numberOfLines={3}>{entry.eventsText || 'No event text'}</Text>
          </View>
        )) : <EmptyState message="No journal entries yet." />}
      </SectionCard>
    </ScreenContainer>
  );
}
