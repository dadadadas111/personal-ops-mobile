import { useCallback, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { addFinanceTransaction, deleteTransaction, getFinanceSummary, getMonthlyBudget, listTransactionsForMonth, upsertMonthlyBudget } from '../lib/database';
import { formatCurrency, monthKey, todayIso } from '../lib/utils';
import type { FinanceTransaction, MonthlyBudget } from '../lib/types';
import { Button, EmptyState, Input, ProgressBar, ScreenContainer, SectionCard, StatRow } from '../ui/components';
import { palette } from '../ui/theme';
import { useAppStore } from '../state/useAppStore';

export function FinanceScreen() {
  const bumpRevision = useAppStore((s) => s.bumpRevision);
  const revision = useAppStore((s) => s.revision);
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
  const [budget, setBudget] = useState<MonthlyBudget | null>(null);
  const [summary, setSummary] = useState<{ month: string; incomeTotal: number; needs: number; wants: number; savings: number; needsPct: number; wantsPct: number; savingsPct: number } | null>(null);
  const [date, setDate] = useState(todayIso());
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('food_basic');
  const [bucket, setBucket] = useState('needs');
  const [income, setIncome] = useState('9000000');

  const load = useCallback(async () => {
    const month = monthKey(date);
    const [items, currentBudget, financeSummary] = await Promise.all([
      listTransactionsForMonth(month),
      getMonthlyBudget(month),
      getFinanceSummary(month),
    ]);
    setTransactions(items);
    setBudget(currentBudget);
    setSummary(financeSummary);
    if (currentBudget) {
      setIncome(String(currentBudget.incomeTotal));
    }
  }, [date]);

  useFocusEffect(useCallback(() => { void load(); }, [load, revision]));

  async function handleAddTransaction() {
    const parsedAmount = Number.parseFloat(amount);
    if (!label.trim() || Number.isNaN(parsedAmount)) return;
    await addFinanceTransaction({ date, label: label.trim(), amount: parsedAmount, category, bucket: bucket as FinanceTransaction['bucket'] });
    setLabel('');
    setAmount('');
    await load();
    bumpRevision();
  }

  async function handleSaveBudget() {
    await upsertMonthlyBudget({
      monthKey: monthKey(date),
      incomeTotal: Number.parseFloat(income) || 9_000_000,
      needsTargetPct: 0.5,
      wantsTargetPct: 0.3,
      savingsTargetPct: 0.2,
    });
    await load();
    bumpRevision();
  }

  async function handleDelete(id: string) {
    await deleteTransaction(id);
    await load();
    bumpRevision();
  }

  return (
    <ScreenContainer>
      <SectionCard title="Monthly budget" subtitle={summary?.month ?? monthKey(date)}>
        <Input value={income} onChangeText={setIncome} placeholder="Monthly income" keyboardType="numeric" />
        <Button title="Save budget" onPress={() => void handleSaveBudget()} />
      </SectionCard>

      <SectionCard title="Add transaction" subtitle="Fast logging wins.">
        <Input value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" />
        <Input value={label} onChangeText={setLabel} placeholder="Lunch, Grab, Coffee…" />
        <Input value={amount} onChangeText={setAmount} placeholder="60000" keyboardType="numeric" />
        <Input value={category} onChangeText={setCategory} placeholder="food_basic / transport / cafe" />
        <Input value={bucket} onChangeText={setBucket} placeholder="needs / wants / savings" />
        <Button title="Add transaction" onPress={() => void handleAddTransaction()} />
      </SectionCard>

      {summary ? (
        <SectionCard title="Month summary" subtitle={`Income: ${formatCurrency(summary.incomeTotal)}`}>
          <StatRow label="Needs" value={formatCurrency(summary.needs)} />
          <ProgressBar value={summary.needsPct * 100} color={palette.warning} />
          <StatRow label="Wants" value={formatCurrency(summary.wants)} />
          <ProgressBar value={summary.wantsPct * 100} color={palette.danger} />
          <StatRow label="Savings" value={formatCurrency(summary.savings)} />
          <ProgressBar value={summary.savingsPct * 100} color={palette.success} />
        </SectionCard>
      ) : null}

      <SectionCard title="Transactions">
        {transactions.length ? transactions.map((txn) => (
          <View key={txn.id} style={{ borderWidth: 1, borderColor: palette.border, borderRadius: 12, padding: 12, gap: 6 }}>
            <Text style={{ color: palette.text, fontWeight: '700' }}>{txn.label} · {formatCurrency(txn.amount)}</Text>
            <Text style={{ color: palette.textMuted }}>{txn.date} · {txn.category} · {txn.bucket}</Text>
            <Button title="Delete" tone="secondary" onPress={() => void handleDelete(txn.id)} />
          </View>
        )) : <EmptyState message="No transactions yet." />}
      </SectionCard>
    </ScreenContainer>
  );
}
