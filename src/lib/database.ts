import * as Application from 'expo-application';
import * as SQLite from 'expo-sqlite';

import type {
  BackupPayload,
  DashboardSummary,
  DailyCheckin,
  FinanceTransaction,
  JournalContext,
  JournalEntry,
  JournalReminderWindow,
  MonthlyBudget,
  Objective,
  ScheduleBlock,
  WeeklyPlan,
  WeeklyReview,
} from './types';
import { clampPercent, generateId, monthKey, startOfWeekDate, toTimeString, todayIso, weekKey } from './utils';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

const JOURNAL_REMINDERS_META_KEY = 'journal_reminders';
const DEFAULT_JOURNAL_WINDOWS: JournalReminderWindow[] = [
  { key: 'morning', label: 'Morning reflection', hour: 8, minute: 0, enabled: false },
  { key: 'midday', label: 'Midday pulse', hour: 13, minute: 0, enabled: false },
  { key: 'evening', label: 'Evening journal', hour: 21, minute: 30, enabled: true },
];

async function getDb() {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync('personal_ops.db');
  }

  return dbPromise;
}

async function audit(eventType: string, entityType: string, entityId: string, payload: unknown) {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO audit_events (id, event_type, entity_type, entity_id, created_at, payload_json)
     VALUES (?, ?, ?, ?, ?, ?)`,
    generateId('audit'),
    eventType,
    entityType,
    entityId,
    new Date().toISOString(),
    JSON.stringify(payload),
  );
}

export async function initDatabase() {
  const db = await getDb();

  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS schedule_days (
      id TEXT PRIMARY KEY NOT NULL,
      date TEXT NOT NULL UNIQUE,
      day_type TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS schedule_blocks (
      id TEXT PRIMARY KEY NOT NULL,
      day_id TEXT NOT NULL,
      date TEXT NOT NULL,
      block_type TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL,
      source TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS weekly_plans (
      week_key TEXT PRIMARY KEY NOT NULL,
      top_focus_1 TEXT,
      top_focus_2 TEXT,
      top_focus_3 TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS objectives (
      id TEXT PRIMARY KEY NOT NULL,
      pillar TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL,
      priority TEXT NOT NULL,
      start_date TEXT NOT NULL,
      target_date TEXT NOT NULL,
      completion_pct INTEGER NOT NULL,
      proof_type TEXT,
      proof_ref TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS daily_checkins (
      id TEXT PRIMARY KEY NOT NULL,
      date TEXT NOT NULL UNIQUE,
      done_text TEXT,
      blocked_text TEXT,
      tomorrow_text TEXT,
      energy TEXT,
      mood INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS weekly_reviews (
      id TEXT PRIMARY KEY NOT NULL,
      week_key TEXT NOT NULL UNIQUE,
      score INTEGER NOT NULL,
      wins TEXT,
      misses TEXT,
      next_top_3 TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS habit_logs (
      id TEXT PRIMARY KEY NOT NULL,
      date TEXT NOT NULL,
      habit_key TEXT NOT NULL,
      value TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS finance_transactions (
      id TEXT PRIMARY KEY NOT NULL,
      date TEXT NOT NULL,
      label TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT NOT NULL,
      category TEXT NOT NULL,
      bucket TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    );
    CREATE TABLE IF NOT EXISTS monthly_budgets (
      id TEXT PRIMARY KEY NOT NULL,
      month_key TEXT NOT NULL UNIQUE,
      income_total REAL NOT NULL,
      needs_target_pct REAL NOT NULL,
      wants_target_pct REAL NOT NULL,
      savings_target_pct REAL NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS journal_entries (
      id TEXT PRIMARY KEY NOT NULL,
      date TEXT NOT NULL,
      entry_window TEXT NOT NULL,
      prompt_context_json TEXT NOT NULL,
      events_text TEXT,
      wins_text TEXT,
      difficulties_text TEXT,
      feelings_text TEXT,
      lessons_text TEXT,
      tomorrow_text TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS audit_events (
      id TEXT PRIMARY KEY NOT NULL,
      event_type TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      payload_json TEXT NOT NULL
    );
  `);

  await ensureDefaults();
}

async function ensureDefaults() {
  const now = new Date().toISOString();
  const deviceId = Application.getAndroidId?.() ?? Application.applicationId ?? 'personal-device';
  await setMeta('schema_version', '1');
  await setMeta('active_device_id', deviceId);

  const existingWindows = await getMeta(JOURNAL_REMINDERS_META_KEY);
  if (!existingWindows) {
    await setMeta(JOURNAL_REMINDERS_META_KEY, JSON.stringify(DEFAULT_JOURNAL_WINDOWS));
  }

  const currentMonth = monthKey();
  const budget = await getMonthlyBudget(currentMonth);
  if (!budget) {
    await upsertMonthlyBudget({
      monthKey: currentMonth,
      incomeTotal: 9_000_000,
      needsTargetPct: 0.5,
      wantsTargetPct: 0.3,
      savingsTargetPct: 0.2,
    });
  }

  const today = todayIso();
  const existingDay = await getScheduleDay(today);
  if (!existingDay) {
    await ensureScheduleDay(today);
  }

  await audit('system_init', 'app', 'bootstrap', { now, deviceId });
}

export async function getMeta(key: string) {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM app_meta WHERE key = ?', key);
  return row?.value ?? null;
}

export async function setMeta(key: string, value: string) {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO app_meta (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value=excluded.value`,
    key,
    value,
  );
}

async function ensureScheduleDay(date: string) {
  const db = await getDb();
  const existing = await db.getFirstAsync<{ id: string }>('SELECT id FROM schedule_days WHERE date = ?', date);
  if (existing) {
    return existing.id;
  }

  const day = new Date(date).getDay();
  const dayType = day >= 1 && day <= 4 ? 'workday' : day === 5 ? 'commute' : 'weekend';
  const id = generateId('day');
  const now = new Date().toISOString();
  await db.runAsync(
    'INSERT INTO schedule_days (id, date, day_type, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    id,
    date,
    dayType,
    '',
    now,
    now,
  );
  return id;
}

async function getScheduleDay(date: string) {
  const db = await getDb();
  return db.getFirstAsync<{ id: string; date: string; day_type: string; notes: string }>('SELECT * FROM schedule_days WHERE date = ?', date);
}

export async function listScheduleBlocksByDate(date: string): Promise<ScheduleBlock[]> {
  const db = await getDb();
  return db.getAllAsync<ScheduleBlock>(
    `SELECT id, day_id as dayId, date, block_type as blockType, start_time as startTime, end_time as endTime, title, status, source,
            created_at as createdAt, updated_at as updatedAt
     FROM schedule_blocks WHERE date = ? ORDER BY start_time ASC`,
    date,
  );
}

export async function listWeekBlocks(date: string): Promise<ScheduleBlock[]> {
  const start = startOfWeekDate(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const startIso = start.toISOString().slice(0, 10);
  const endIso = end.toISOString().slice(0, 10);
  const db = await getDb();
  return db.getAllAsync<ScheduleBlock>(
    `SELECT id, day_id as dayId, date, block_type as blockType, start_time as startTime, end_time as endTime, title, status, source,
            created_at as createdAt, updated_at as updatedAt
     FROM schedule_blocks WHERE date BETWEEN ? AND ? ORDER BY date ASC, start_time ASC`,
    startIso,
    endIso,
  );
}

export async function addScheduleBlock(input: {
  date: string;
  blockType: string;
  startTime: string;
  endTime: string;
  title: string;
  status?: string;
  source?: string;
}) {
  const db = await getDb();
  const dayId = await ensureScheduleDay(input.date);
  const id = generateId('block');
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO schedule_blocks
      (id, day_id, date, block_type, start_time, end_time, title, status, source, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    dayId,
    input.date,
    input.blockType,
    input.startTime,
    input.endTime,
    input.title,
    input.status ?? 'planned',
    input.source ?? 'manual',
    now,
    now,
  );
  await audit('schedule_block_added', 'schedule_block', id, input);
}

export async function deleteScheduleBlock(id: string) {
  const db = await getDb();
  await db.runAsync('DELETE FROM schedule_blocks WHERE id = ?', id);
  await audit('schedule_block_deleted', 'schedule_block', id, {});
}

export async function getWeeklyPlan(week = weekKey()): Promise<WeeklyPlan | null> {
  const db = await getDb();
  return db.getFirstAsync<WeeklyPlan>(
    `SELECT week_key as weekKey, top_focus_1 as topFocus1, top_focus_2 as topFocus2, top_focus_3 as topFocus3, notes,
            created_at as createdAt, updated_at as updatedAt
     FROM weekly_plans WHERE week_key = ?`,
    week,
  );
}

export async function upsertWeeklyPlan(input: { weekKey: string; topFocus1: string; topFocus2: string; topFocus3: string; notes: string }) {
  const db = await getDb();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO weekly_plans (week_key, top_focus_1, top_focus_2, top_focus_3, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(week_key)
     DO UPDATE SET top_focus_1=excluded.top_focus_1, top_focus_2=excluded.top_focus_2, top_focus_3=excluded.top_focus_3, notes=excluded.notes, updated_at=excluded.updated_at`,
    input.weekKey,
    input.topFocus1,
    input.topFocus2,
    input.topFocus3,
    input.notes,
    now,
    now,
  );
  await audit('weekly_plan_upserted', 'weekly_plan', input.weekKey, input);
}

export async function listObjectives(): Promise<Objective[]> {
  const db = await getDb();
  return db.getAllAsync<Objective>(
    `SELECT id, pillar, title, description, status, priority, start_date as startDate, target_date as targetDate,
            completion_pct as completionPct, proof_type as proofType, proof_ref as proofRef,
            created_at as createdAt, updated_at as updatedAt
     FROM objectives ORDER BY target_date ASC, created_at DESC`,
  );
}

export async function createObjective(input: Omit<Objective, 'id' | 'createdAt' | 'updatedAt' | 'completionPct' | 'status'> & { completionPct?: number; status?: string }) {
  const db = await getDb();
  const id = generateId('obj');
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO objectives
      (id, pillar, title, description, status, priority, start_date, target_date, completion_pct, proof_type, proof_ref, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    input.pillar,
    input.title,
    input.description,
    input.status ?? 'pending',
    input.priority,
    input.startDate,
    input.targetDate,
    clampPercent(input.completionPct ?? 0),
    input.proofType,
    input.proofRef,
    now,
    now,
  );
  await audit('objective_created', 'objective', id, input);
}

export async function adjustObjective(id: string, deltaPct: number, nextStatus?: string) {
  const db = await getDb();
  const current = await db.getFirstAsync<{ completion_pct: number }>('SELECT completion_pct FROM objectives WHERE id = ?', id);
  if (!current) return;
  const updated = clampPercent((current.completion_pct ?? 0) + deltaPct);
  const now = new Date().toISOString();
  await db.runAsync(
    `UPDATE objectives SET completion_pct = ?, status = COALESCE(?, status), updated_at = ? WHERE id = ?`,
    updated,
    nextStatus ?? null,
    now,
    id,
  );
  await audit('objective_adjusted', 'objective', id, { deltaPct, nextStatus, updated });
}

export async function saveDailyCheckin(input: Omit<DailyCheckin, 'id' | 'createdAt' | 'updatedAt'>) {
  const db = await getDb();
  const existing = await db.getFirstAsync<{ id: string }>('SELECT id FROM daily_checkins WHERE date = ?', input.date);
  const id = existing?.id ?? generateId('checkin');
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO daily_checkins (id, date, done_text, blocked_text, tomorrow_text, energy, mood, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(date)
     DO UPDATE SET done_text=excluded.done_text, blocked_text=excluded.blocked_text, tomorrow_text=excluded.tomorrow_text,
                   energy=excluded.energy, mood=excluded.mood, updated_at=excluded.updated_at`,
    id,
    input.date,
    input.doneText,
    input.blockedText,
    input.tomorrowText,
    input.energy,
    input.mood,
    now,
    now,
  );
  await audit('daily_checkin_saved', 'daily_checkin', id, input);
}

export async function getDailyCheckin(date: string): Promise<DailyCheckin | null> {
  const db = await getDb();
  return db.getFirstAsync<DailyCheckin>(
    `SELECT id, date, done_text as doneText, blocked_text as blockedText, tomorrow_text as tomorrowText, energy, mood,
            created_at as createdAt, updated_at as updatedAt
     FROM daily_checkins WHERE date = ?`,
    date,
  );
}

export async function getLatestWeeklyReview(): Promise<WeeklyReview | null> {
  const db = await getDb();
  return db.getFirstAsync<WeeklyReview>(
    `SELECT id, week_key as weekKey, score, wins, misses, next_top_3 as nextTop3, created_at as createdAt, updated_at as updatedAt
     FROM weekly_reviews ORDER BY week_key DESC LIMIT 1`,
  );
}

export async function saveWeeklyReview(input: Omit<WeeklyReview, 'id' | 'createdAt' | 'updatedAt'>) {
  const db = await getDb();
  const existing = await db.getFirstAsync<{ id: string }>('SELECT id FROM weekly_reviews WHERE week_key = ?', input.weekKey);
  const id = existing?.id ?? generateId('review');
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO weekly_reviews (id, week_key, score, wins, misses, next_top_3, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(week_key)
     DO UPDATE SET score=excluded.score, wins=excluded.wins, misses=excluded.misses, next_top_3=excluded.next_top_3, updated_at=excluded.updated_at`,
    id,
    input.weekKey,
    input.score,
    input.wins,
    input.misses,
    input.nextTop3,
    now,
    now,
  );
  await audit('weekly_review_saved', 'weekly_review', id, input);
}

export async function getMonthlyBudget(month = monthKey()): Promise<MonthlyBudget | null> {
  const db = await getDb();
  return db.getFirstAsync<MonthlyBudget>(
    `SELECT id, month_key as monthKey, income_total as incomeTotal, needs_target_pct as needsTargetPct,
            wants_target_pct as wantsTargetPct, savings_target_pct as savingsTargetPct,
            created_at as createdAt, updated_at as updatedAt
     FROM monthly_budgets WHERE month_key = ?`,
    month,
  );
}

export async function upsertMonthlyBudget(input: Omit<MonthlyBudget, 'id' | 'createdAt' | 'updatedAt'>) {
  const db = await getDb();
  const existing = await db.getFirstAsync<{ id: string }>('SELECT id FROM monthly_budgets WHERE month_key = ?', input.monthKey);
  const id = existing?.id ?? generateId('budget');
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO monthly_budgets (id, month_key, income_total, needs_target_pct, wants_target_pct, savings_target_pct, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(month_key)
     DO UPDATE SET income_total=excluded.income_total, needs_target_pct=excluded.needs_target_pct,
                   wants_target_pct=excluded.wants_target_pct, savings_target_pct=excluded.savings_target_pct, updated_at=excluded.updated_at`,
    id,
    input.monthKey,
    input.incomeTotal,
    input.needsTargetPct,
    input.wantsTargetPct,
    input.savingsTargetPct,
    now,
    now,
  );
  await audit('monthly_budget_upserted', 'monthly_budget', id, input);
}

export async function addFinanceTransaction(input: Omit<FinanceTransaction, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'currency' | 'notes'> & { notes?: string; currency?: string }) {
  const db = await getDb();
  const id = generateId('txn');
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO finance_transactions (id, date, label, amount, currency, category, bucket, notes, created_at, updated_at, deleted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
    id,
    input.date,
    input.label,
    input.amount,
    input.currency ?? 'VND',
    input.category,
    input.bucket,
    input.notes ?? '',
    now,
    now,
  );
  await audit('finance_transaction_added', 'finance_transaction', id, input);
}

export async function listTransactionsForMonth(month = monthKey()): Promise<FinanceTransaction[]> {
  const db = await getDb();
  return db.getAllAsync<FinanceTransaction>(
    `SELECT id, date, label, amount, currency, category, bucket, notes, created_at as createdAt, updated_at as updatedAt, deleted_at as deletedAt
     FROM finance_transactions WHERE substr(date, 1, 7) = ? AND deleted_at IS NULL ORDER BY date DESC, created_at DESC`,
    month,
  );
}

export async function deleteTransaction(id: string) {
  const db = await getDb();
  const now = new Date().toISOString();
  await db.runAsync('UPDATE finance_transactions SET deleted_at = ?, updated_at = ? WHERE id = ?', now, now, id);
  await audit('finance_transaction_deleted', 'finance_transaction', id, {});
}

export async function getFinanceSummary(month = monthKey()) {
  const budget = await getMonthlyBudget(month);
  const db = await getDb();
  const rows = await db.getAllAsync<{ bucket: string; total: number }>(
    `SELECT bucket, SUM(amount) as total
     FROM finance_transactions
     WHERE substr(date, 1, 7) = ? AND deleted_at IS NULL
     GROUP BY bucket`,
    month,
  );

  const totals = { needs: 0, wants: 0, savings: 0 };
  for (const row of rows) {
    if (row.bucket in totals) {
      totals[row.bucket as keyof typeof totals] = row.total ?? 0;
    }
  }

  return {
    month,
    incomeTotal: budget?.incomeTotal ?? 9_000_000,
    needs: totals.needs,
    wants: totals.wants,
    savings: totals.savings,
    needsPct: budget ? totals.needs / Math.max(1, budget.incomeTotal) : 0,
    wantsPct: budget ? totals.wants / Math.max(1, budget.incomeTotal) : 0,
    savingsPct: budget ? totals.savings / Math.max(1, budget.incomeTotal) : 0,
  };
}

export async function getDailyFinanceTotal(date: string) {
  const db = await getDb();
  const row = await db.getFirstAsync<{ total: number }>(
    'SELECT SUM(amount) as total FROM finance_transactions WHERE date = ? AND deleted_at IS NULL',
    date,
  );
  return row?.total ?? 0;
}

export async function getJournalReminderWindows(): Promise<JournalReminderWindow[]> {
  const raw = await getMeta(JOURNAL_REMINDERS_META_KEY);
  if (!raw) return DEFAULT_JOURNAL_WINDOWS;
  try {
    const parsed = JSON.parse(raw) as JournalReminderWindow[];
    return parsed;
  } catch {
    return DEFAULT_JOURNAL_WINDOWS;
  }
}

export async function saveJournalReminderWindows(windows: JournalReminderWindow[]) {
  await setMeta(JOURNAL_REMINDERS_META_KEY, JSON.stringify(windows));
  await audit('journal_windows_saved', 'settings', JOURNAL_REMINDERS_META_KEY, windows);
}

export async function getJournalContext(date: string): Promise<JournalContext> {
  const scheduleBlocks = await listScheduleBlocksByDate(date);
  const latestCheckin = await getDailyCheckin(date);
  const financeTotal = await getDailyFinanceTotal(date);
  return {
    date,
    scheduleSummary: scheduleBlocks.map((block) => `${block.startTime}-${block.endTime} ${block.title}`),
    latestCheckin,
    financeTotal,
  };
}

export async function listJournalEntries(limit = 14): Promise<JournalEntry[]> {
  const db = await getDb();
  return db.getAllAsync<JournalEntry>(
    `SELECT id, date, entry_window as entryWindow, prompt_context_json as promptContextJson,
            events_text as eventsText, wins_text as winsText, difficulties_text as difficultiesText,
            feelings_text as feelingsText, lessons_text as lessonsText, tomorrow_text as tomorrowText,
            created_at as createdAt, updated_at as updatedAt
     FROM journal_entries ORDER BY date DESC, updated_at DESC LIMIT ?`,
    limit,
  );
}

export async function saveJournalEntry(input: Omit<JournalEntry, 'id' | 'createdAt' | 'updatedAt'>) {
  const db = await getDb();
  const now = new Date().toISOString();
  const id = generateId('journal');
  await db.runAsync(
    `INSERT INTO journal_entries
      (id, date, entry_window, prompt_context_json, events_text, wins_text, difficulties_text, feelings_text, lessons_text, tomorrow_text, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    input.date,
    input.entryWindow,
    input.promptContextJson,
    input.eventsText,
    input.winsText,
    input.difficultiesText,
    input.feelingsText,
    input.lessonsText,
    input.tomorrowText,
    now,
    now,
  );
  await audit('journal_entry_saved', 'journal_entry', id, input);
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const currentWeek = weekKey();
  const weekStart = startOfWeekDate();
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  const startIso = weekStart.toISOString().slice(0, 10);
  const endIso = weekEnd.toISOString().slice(0, 10);
  const month = monthKey();
  const db = await getDb();

  const tutoringRow = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM schedule_blocks WHERE block_type = 'tutoring' AND date BETWEEN ? AND ?`,
    startIso,
    endIso,
  );
  const growthRow = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM schedule_blocks WHERE block_type = 'growth' AND date BETWEEN ? AND ?`,
    startIso,
    endIso,
  );
  const checkinRow = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM daily_checkins WHERE date BETWEEN ? AND ?`,
    startIso,
    endIso,
  );
  const journalRow = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM journal_entries WHERE date BETWEEN ? AND ?`,
    startIso,
    endIso,
  );
  const weeklyReview = await getLatestWeeklyReview();
  const finance = await getFinanceSummary(month);
  const topCategories = await db.getAllAsync<{ category: string; total: number }>(
    `SELECT category, SUM(amount) as total FROM finance_transactions WHERE substr(date, 1, 7) = ? AND deleted_at IS NULL GROUP BY category ORDER BY total DESC LIMIT 5`,
    month,
  );

  return {
    weekKey: currentWeek,
    tutoringCount: tutoringRow?.count ?? 0,
    growthCount: growthRow?.count ?? 0,
    checkinCount: checkinRow?.count ?? 0,
    journalCount: journalRow?.count ?? 0,
    weeklyReviewScore: weeklyReview?.score ?? null,
    monthIncome: finance.incomeTotal,
    monthNeeds: finance.needs,
    monthWants: finance.wants,
    monthSavings: finance.savings,
    topCategories,
  };
}

export async function exportBackupPayload(): Promise<BackupPayload> {
  const db = await getDb();
  const [scheduleBlocks, weeklyPlans, objectives, dailyCheckins, weeklyReviews, financeTransactions, monthlyBudgets, journalEntries] = await Promise.all([
    db.getAllAsync<ScheduleBlock>(`SELECT id, day_id as dayId, date, block_type as blockType, start_time as startTime, end_time as endTime, title, status, source, created_at as createdAt, updated_at as updatedAt FROM schedule_blocks`),
    db.getAllAsync<WeeklyPlan>(`SELECT week_key as weekKey, top_focus_1 as topFocus1, top_focus_2 as topFocus2, top_focus_3 as topFocus3, notes, created_at as createdAt, updated_at as updatedAt FROM weekly_plans`),
    db.getAllAsync<Objective>(`SELECT id, pillar, title, description, status, priority, start_date as startDate, target_date as targetDate, completion_pct as completionPct, proof_type as proofType, proof_ref as proofRef, created_at as createdAt, updated_at as updatedAt FROM objectives`),
    db.getAllAsync<DailyCheckin>(`SELECT id, date, done_text as doneText, blocked_text as blockedText, tomorrow_text as tomorrowText, energy, mood, created_at as createdAt, updated_at as updatedAt FROM daily_checkins`),
    db.getAllAsync<WeeklyReview>(`SELECT id, week_key as weekKey, score, wins, misses, next_top_3 as nextTop3, created_at as createdAt, updated_at as updatedAt FROM weekly_reviews`),
    db.getAllAsync<FinanceTransaction>(`SELECT id, date, label, amount, currency, category, bucket, notes, created_at as createdAt, updated_at as updatedAt, deleted_at as deletedAt FROM finance_transactions`),
    db.getAllAsync<MonthlyBudget>(`SELECT id, month_key as monthKey, income_total as incomeTotal, needs_target_pct as needsTargetPct, wants_target_pct as wantsTargetPct, savings_target_pct as savingsTargetPct, created_at as createdAt, updated_at as updatedAt FROM monthly_budgets`),
    db.getAllAsync<JournalEntry>(`SELECT id, date, entry_window as entryWindow, prompt_context_json as promptContextJson, events_text as eventsText, wins_text as winsText, difficulties_text as difficultiesText, feelings_text as feelingsText, lessons_text as lessonsText, tomorrow_text as tomorrowText, created_at as createdAt, updated_at as updatedAt FROM journal_entries`),
  ]);

  return {
    appVersion: Application.nativeApplicationVersion ?? '1.0.0',
    schemaVersion: 1,
    deviceId: (await getMeta('active_device_id')) ?? 'personal-device',
    exportedAt: new Date().toISOString(),
    recordCounts: {
      scheduleBlocks: scheduleBlocks.length,
      weeklyPlans: weeklyPlans.length,
      objectives: objectives.length,
      dailyCheckins: dailyCheckins.length,
      weeklyReviews: weeklyReviews.length,
      financeTransactions: financeTransactions.length,
      monthlyBudgets: monthlyBudgets.length,
      journalEntries: journalEntries.length,
    },
    data: {
      scheduleBlocks,
      weeklyPlans,
      objectives,
      dailyCheckins,
      weeklyReviews,
      financeTransactions,
      monthlyBudgets,
      journalEntries,
    },
  };
}

export async function importBackupPayload(payload: BackupPayload) {
  const db = await getDb();

  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.execAsync(`
      DELETE FROM schedule_blocks;
      DELETE FROM weekly_plans;
      DELETE FROM objectives;
      DELETE FROM daily_checkins;
      DELETE FROM weekly_reviews;
      DELETE FROM finance_transactions;
      DELETE FROM monthly_budgets;
      DELETE FROM journal_entries;
    `);

    for (const item of payload.data.scheduleBlocks) {
      await ensureScheduleDay(item.date);
      await txn.runAsync(
        `INSERT INTO schedule_blocks (id, day_id, date, block_type, start_time, end_time, title, status, source, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        item.id,
        item.dayId,
        item.date,
        item.blockType,
        item.startTime,
        item.endTime,
        item.title,
        item.status,
        item.source,
        item.createdAt,
        item.updatedAt,
      );
    }

    for (const item of payload.data.weeklyPlans) {
      await txn.runAsync(
        `INSERT INTO weekly_plans (week_key, top_focus_1, top_focus_2, top_focus_3, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        item.weekKey,
        item.topFocus1,
        item.topFocus2,
        item.topFocus3,
        item.notes,
        item.createdAt,
        item.updatedAt,
      );
    }

    for (const item of payload.data.objectives) {
      await txn.runAsync(
        `INSERT INTO objectives (id, pillar, title, description, status, priority, start_date, target_date, completion_pct, proof_type, proof_ref, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        item.id,
        item.pillar,
        item.title,
        item.description,
        item.status,
        item.priority,
        item.startDate,
        item.targetDate,
        item.completionPct,
        item.proofType,
        item.proofRef,
        item.createdAt,
        item.updatedAt,
      );
    }

    for (const item of payload.data.dailyCheckins) {
      await txn.runAsync(
        `INSERT INTO daily_checkins (id, date, done_text, blocked_text, tomorrow_text, energy, mood, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        item.id,
        item.date,
        item.doneText,
        item.blockedText,
        item.tomorrowText,
        item.energy,
        item.mood,
        item.createdAt,
        item.updatedAt,
      );
    }

    for (const item of payload.data.weeklyReviews) {
      await txn.runAsync(
        `INSERT INTO weekly_reviews (id, week_key, score, wins, misses, next_top_3, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        item.id,
        item.weekKey,
        item.score,
        item.wins,
        item.misses,
        item.nextTop3,
        item.createdAt,
        item.updatedAt,
      );
    }

    for (const item of payload.data.financeTransactions) {
      await txn.runAsync(
        `INSERT INTO finance_transactions (id, date, label, amount, currency, category, bucket, notes, created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        item.id,
        item.date,
        item.label,
        item.amount,
        item.currency,
        item.category,
        item.bucket,
        item.notes,
        item.createdAt,
        item.updatedAt,
        item.deletedAt,
      );
    }

    for (const item of payload.data.monthlyBudgets) {
      await txn.runAsync(
        `INSERT INTO monthly_budgets (id, month_key, income_total, needs_target_pct, wants_target_pct, savings_target_pct, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        item.id,
        item.monthKey,
        item.incomeTotal,
        item.needsTargetPct,
        item.wantsTargetPct,
        item.savingsTargetPct,
        item.createdAt,
        item.updatedAt,
      );
    }

    for (const item of payload.data.journalEntries) {
      await txn.runAsync(
        `INSERT INTO journal_entries (id, date, entry_window, prompt_context_json, events_text, wins_text, difficulties_text, feelings_text, lessons_text, tomorrow_text, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        item.id,
        item.date,
        item.entryWindow,
        item.promptContextJson,
        item.eventsText,
        item.winsText,
        item.difficultiesText,
        item.feelingsText,
        item.lessonsText,
        item.tomorrowText,
        item.createdAt,
        item.updatedAt,
      );
    }
  });

  await setMeta('last_restore_at', new Date().toISOString());
  await audit('backup_imported', 'backup', 'restore', { exportedAt: payload.exportedAt });
}
