import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { getDashboardSummary } from '../lib/database';
import { formatCurrency } from '../lib/utils';
import type { DashboardSummary } from '../lib/types';
import { EmptyState, ProgressBar, ScreenContainer, SectionCard, StatRow } from '../ui/components';
import { palette } from '../ui/theme';
import { useAppStore } from '../state/useAppStore';

export function DashboardScreen() {
  const revision = useAppStore((s) => s.revision);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);

  const load = useCallback(async () => {
    setSummary(await getDashboardSummary());
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load, revision]),
  );

  if (!summary) {
    return <ScreenContainer><EmptyState message="Loading dashboard…" /></ScreenContainer>;
  }

  return (
    <ScreenContainer>
      <SectionCard title="This week" subtitle={summary.weekKey}>
        <StatRow label="Tutoring nights" value={String(summary.tutoringCount)} />
        <StatRow label="Growth blocks" value={String(summary.growthCount)} />
        <StatRow label="Check-ins" value={String(summary.checkinCount)} />
        <StatRow label="Journal entries" value={String(summary.journalCount)} />
        <StatRow label="Weekly review score" value={summary.weeklyReviewScore ? `${summary.weeklyReviewScore}/10` : '—'} />
      </SectionCard>

      <SectionCard title="This month" subtitle={formatCurrency(summary.monthIncome)}>
        <StatRow label="Needs" value={formatCurrency(summary.monthNeeds)} />
        <ProgressBar value={(summary.monthNeeds / Math.max(1, summary.monthIncome)) * 100} color={palette.warning} />
        <StatRow label="Wants" value={formatCurrency(summary.monthWants)} />
        <ProgressBar value={(summary.monthWants / Math.max(1, summary.monthIncome)) * 100} color={palette.danger} />
        <StatRow label="Savings" value={formatCurrency(summary.monthSavings)} />
        <ProgressBar value={(summary.monthSavings / Math.max(1, summary.monthIncome)) * 100} color={palette.success} />
      </SectionCard>

      <SectionCard title="Top categories">
        {summary.topCategories.length ? summary.topCategories.map((item) => (
          <View key={item.category} style={{ gap: 4 }}>
            <StatRow label={item.category} value={formatCurrency(item.total)} />
            <ProgressBar value={(item.total / Math.max(1, summary.monthIncome)) * 100} />
          </View>
        )) : <EmptyState message="No finance data yet." />}
      </SectionCard>

      <SectionCard title="How to use this app well">
        <Text style={{ color: palette.textMuted, lineHeight: 22 }}>
          Keep one authoritative device, log quick updates daily, and export a backup before major edits or reinstalls.
        </Text>
      </SectionCard>
    </ScreenContainer>
  );
}
