import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { adjustObjective, createObjective, getDailyCheckin, getLatestWeeklyReview, listObjectives, saveDailyCheckin, saveWeeklyReview } from '../lib/database';
import { todayIso, weekKey } from '../lib/utils';
import type { DailyCheckin, Objective, WeeklyReview } from '../lib/types';
import { Button, EmptyState, Input, ScreenContainer, SectionCard } from '../ui/components';
import { palette } from '../ui/theme';
import { useAppStore } from '../state/useAppStore';

export function ProgressScreen() {
  const bumpRevision = useAppStore((s) => s.bumpRevision);
  const revision = useAppStore((s) => s.revision);
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [checkin, setCheckin] = useState<DailyCheckin | null>(null);
  const [review, setReview] = useState<WeeklyReview | null>(null);

  const [objectiveTitle, setObjectiveTitle] = useState('');
  const [pillar, setPillar] = useState('work');
  const [targetDate, setTargetDate] = useState(todayIso());

  const [doneText, setDoneText] = useState('');
  const [blockedText, setBlockedText] = useState('');
  const [tomorrowText, setTomorrowText] = useState('');
  const [energy, setEnergy] = useState('normal');
  const [mood, setMood] = useState('7');

  const [weeklyScore, setWeeklyScore] = useState('7');
  const [wins, setWins] = useState('');
  const [misses, setMisses] = useState('');
  const [nextTop3, setNextTop3] = useState('');

  const load = useCallback(async () => {
    const today = todayIso();
    const [items, latestCheckin, latestReview] = await Promise.all([
      listObjectives(),
      getDailyCheckin(today),
      getLatestWeeklyReview(),
    ]);
    setObjectives(items);
    setCheckin(latestCheckin);
    setReview(latestReview);
    if (latestCheckin) {
      setDoneText(latestCheckin.doneText ?? '');
      setBlockedText(latestCheckin.blockedText ?? '');
      setTomorrowText(latestCheckin.tomorrowText ?? '');
      setEnergy(latestCheckin.energy ?? 'normal');
      setMood(String(latestCheckin.mood ?? 7));
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load, revision]));

  async function handleCreateObjective() {
    if (!objectiveTitle.trim()) return;
    await createObjective({
      pillar: pillar as Objective['pillar'],
      title: objectiveTitle.trim(),
      description: '',
      priority: 'high',
      startDate: todayIso(),
      targetDate,
      proofType: 'manual',
      proofRef: '',
    });
    setObjectiveTitle('');
    await load();
    bumpRevision();
  }

  async function handleSaveCheckin() {
    await saveDailyCheckin({
      date: todayIso(),
      doneText,
      blockedText,
      tomorrowText,
      energy,
      mood: Number.parseInt(mood, 10) || 7,
    });
    await load();
    bumpRevision();
  }

  async function handleSaveReview() {
    await saveWeeklyReview({
      weekKey: weekKey(),
      score: Number.parseInt(weeklyScore, 10) || 7,
      wins,
      misses,
      nextTop3,
    });
    await load();
    bumpRevision();
  }

  return (
    <ScreenContainer>
      <SectionCard title="Objectives" subtitle="Career, freelance, skill, English, health, admin.">
        <Input value={objectiveTitle} onChangeText={setObjectiveTitle} placeholder="Objective title" />
        <Input value={pillar} onChangeText={setPillar} placeholder="work / freelance / skill" />
        <Input value={targetDate} onChangeText={setTargetDate} placeholder="YYYY-MM-DD" />
        <Button title="Add objective" onPress={() => void handleCreateObjective()} />
        {objectives.length ? objectives.map((objective) => (
          <View key={objective.id} style={{ borderWidth: 1, borderColor: palette.border, borderRadius: 12, padding: 12, gap: 8 }}>
            <Text style={{ color: palette.text, fontWeight: '700' }}>{objective.title}</Text>
            <Text style={{ color: palette.textMuted }}>{objective.pillar} · {objective.completionPct}% · {objective.status}</Text>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              <Button title="+10%" tone="secondary" onPress={() => void adjustObjective(objective.id, 10, 'in_progress').then(load).then(bumpRevision)} />
              <Button title="Done" tone="secondary" onPress={() => void adjustObjective(objective.id, 100, 'done').then(load).then(bumpRevision)} />
            </View>
          </View>
        )) : <EmptyState message="No objectives yet." />}
      </SectionCard>

      <SectionCard title="Daily check-in" subtitle={checkin ? 'Editing today\'s entry' : 'Capture momentum daily.'}>
        <Input value={doneText} onChangeText={setDoneText} placeholder="What got done?" multiline />
        <Input value={blockedText} onChangeText={setBlockedText} placeholder="What got blocked?" multiline />
        <Input value={tomorrowText} onChangeText={setTomorrowText} placeholder="Top task for tomorrow" multiline />
        <Input value={energy} onChangeText={setEnergy} placeholder="low / normal / good" />
        <Input value={mood} onChangeText={setMood} placeholder="1-10" />
        <Button title="Save daily check-in" onPress={() => void handleSaveCheckin()} />
      </SectionCard>

      <SectionCard title="Weekly review" subtitle={review ? `Latest: ${review.weekKey}` : 'Close the week cleanly.'}>
        <Input value={weeklyScore} onChangeText={setWeeklyScore} placeholder="Score 1-10" />
        <Input value={wins} onChangeText={setWins} placeholder="What went well?" multiline />
        <Input value={misses} onChangeText={setMisses} placeholder="What slipped?" multiline />
        <Input value={nextTop3} onChangeText={setNextTop3} placeholder="Next top 3 priorities" multiline />
        <Button title="Save weekly review" onPress={() => void handleSaveReview()} />
      </SectionCard>
    </ScreenContainer>
  );
}
