import { useCallback, useMemo, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { addScheduleBlock, deleteScheduleBlock, getWeeklyPlan, listScheduleBlocksByDate, listWeekBlocks, upsertWeeklyPlan } from '../lib/database';
import { addDays, todayIso, weekKey } from '../lib/utils';
import type { ScheduleBlock, WeeklyPlan } from '../lib/types';
import { Button, EmptyState, Input, ScreenContainer, SectionCard } from '../ui/components';
import { palette } from '../ui/theme';
import { useAppStore } from '../state/useAppStore';

const defaultDate = todayIso();

export function ScheduleScreen() {
  const bumpRevision = useAppStore((s) => s.bumpRevision);
  const revision = useAppStore((s) => s.revision);
  const [date, setDate] = useState(defaultDate);
  const [blocks, setBlocks] = useState<ScheduleBlock[]>([]);
  const [weekBlocks, setWeekBlocks] = useState<ScheduleBlock[]>([]);
  const [plan, setPlan] = useState<WeeklyPlan | null>(null);
  const [title, setTitle] = useState('');
  const [blockType, setBlockType] = useState('growth');
  const [startTime, setStartTime] = useState('20:00');
  const [endTime, setEndTime] = useState('21:00');
  const [focus1, setFocus1] = useState('');
  const [focus2, setFocus2] = useState('');
  const [focus3, setFocus3] = useState('');
  const [notes, setNotes] = useState('');

  const load = useCallback(async () => {
    const [dayBlocks, weekly, weeklyPlan] = await Promise.all([
      listScheduleBlocksByDate(date),
      listWeekBlocks(date),
      getWeeklyPlan(weekKey(new Date(date))),
    ]);

    setBlocks(dayBlocks);
    setWeekBlocks(weekly);
    setPlan(weeklyPlan);
    if (weeklyPlan) {
      setFocus1(weeklyPlan.topFocus1 ?? '');
      setFocus2(weeklyPlan.topFocus2 ?? '');
      setFocus3(weeklyPlan.topFocus3 ?? '');
      setNotes(weeklyPlan.notes ?? '');
    }
  }, [date]);

  useFocusEffect(useCallback(() => { void load(); }, [load, revision]));

  const weekPreview = useMemo(() => {
    const base = new Date(date);
    return Array.from({ length: 7 }, (_, index) => addDays(base, index - ((base.getDay() + 6) % 7)).toISOString().slice(0, 10));
  }, [date]);

  async function handleAddBlock() {
    if (!title.trim()) return;
    await addScheduleBlock({ date, blockType, startTime, endTime, title: title.trim() });
    setTitle('');
    await load();
    bumpRevision();
  }

  async function handleDelete(id: string) {
    await deleteScheduleBlock(id);
    await load();
    bumpRevision();
  }

  async function handleSavePlan() {
    const key = weekKey(new Date(date));
    await upsertWeeklyPlan({ weekKey: key, topFocus1: focus1, topFocus2: focus2, topFocus3: focus3, notes });
    await load();
    bumpRevision();
  }

  return (
    <ScreenContainer>
      <SectionCard title="Day setup" subtitle="Use YYYY-MM-DD and HH:MM to keep it quick.">
        <Input value={date} onChangeText={setDate} placeholder="2026-05-10" />
        <Input value={title} onChangeText={setTitle} placeholder="Block title" />
        <Input value={blockType} onChangeText={setBlockType} placeholder="growth / tutoring / work" />
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}><Input value={startTime} onChangeText={setStartTime} placeholder="20:00" /></View>
          <View style={{ flex: 1 }}><Input value={endTime} onChangeText={setEndTime} placeholder="21:00" /></View>
        </View>
        <Button title="Add block" onPress={() => void handleAddBlock()} />
      </SectionCard>

      <SectionCard title={`Blocks for ${date}`} subtitle="Tutoring nights and growth slots live here.">
        {blocks.length ? blocks.map((block) => (
          <View key={block.id} style={{ borderWidth: 1, borderColor: palette.border, borderRadius: 12, padding: 12, gap: 8 }}>
            <Text style={{ color: palette.text, fontWeight: '700' }}>{block.startTime}–{block.endTime} · {block.title}</Text>
            <Text style={{ color: palette.textMuted }}>{block.blockType}</Text>
            <Button title="Delete" tone="secondary" onPress={() => void handleDelete(block.id)} />
          </View>
        )) : <EmptyState message="No blocks for this day yet." />}
      </SectionCard>

      <SectionCard title="Weekly focus" subtitle={plan?.weekKey ?? weekKey(new Date(date))}>
        <Input value={focus1} onChangeText={setFocus1} placeholder="Focus 1" />
        <Input value={focus2} onChangeText={setFocus2} placeholder="Focus 2" />
        <Input value={focus3} onChangeText={setFocus3} placeholder="Focus 3" />
        <Input value={notes} onChangeText={setNotes} placeholder="Weekly notes" multiline />
        <Button title="Save weekly plan" onPress={() => void handleSavePlan()} />
      </SectionCard>

      <SectionCard title="Week preview">
        {weekPreview.map((day) => {
          const count = weekBlocks.filter((item) => item.date === day).length;
          return <Text key={day} style={{ color: palette.textMuted }}>{day} · {count} block(s)</Text>;
        })}
      </SectionCard>
    </ScreenContainer>
  );
}
