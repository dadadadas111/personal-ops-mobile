export type DayType = 'workday' | 'commute' | 'weekend' | 'holiday';
export type BlockType = 'work' | 'tutoring' | 'growth' | 'english' | 'reset' | 'family' | 'rest';
export type ObjectiveStatus = 'pending' | 'in_progress' | 'done';
export type ObjectivePillar = 'work' | 'freelance' | 'skill' | 'English' | 'health' | 'life_admin';
export type BudgetBucket = 'needs' | 'wants' | 'savings';
export type JournalWindowKey = 'morning' | 'midday' | 'evening';

export interface ScheduleBlock {
  id: string;
  dayId: string;
  date: string;
  blockType: BlockType;
  startTime: string;
  endTime: string;
  title: string;
  status: string;
  source: string;
  createdAt: string;
  updatedAt: string;
}

export interface WeeklyPlan {
  weekKey: string;
  topFocus1: string;
  topFocus2: string;
  topFocus3: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface Objective {
  id: string;
  pillar: ObjectivePillar;
  title: string;
  description: string;
  status: ObjectiveStatus;
  priority: 'low' | 'medium' | 'high';
  startDate: string;
  targetDate: string;
  completionPct: number;
  proofType: string;
  proofRef: string;
  createdAt: string;
  updatedAt: string;
}

export interface DailyCheckin {
  id: string;
  date: string;
  doneText: string;
  blockedText: string;
  tomorrowText: string;
  energy: string;
  mood: number;
  createdAt: string;
  updatedAt: string;
}

export interface WeeklyReview {
  id: string;
  weekKey: string;
  score: number;
  wins: string;
  misses: string;
  nextTop3: string;
  createdAt: string;
  updatedAt: string;
}

export interface FinanceTransaction {
  id: string;
  date: string;
  label: string;
  amount: number;
  currency: string;
  category: string;
  bucket: BudgetBucket;
  notes: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface MonthlyBudget {
  id: string;
  monthKey: string;
  incomeTotal: number;
  needsTargetPct: number;
  wantsTargetPct: number;
  savingsTargetPct: number;
  createdAt: string;
  updatedAt: string;
}

export interface JournalReminderWindow {
  key: JournalWindowKey;
  label: string;
  hour: number;
  minute: number;
  enabled: boolean;
}

export interface JournalEntry {
  id: string;
  date: string;
  entryWindow: JournalWindowKey | 'freeform';
  promptContextJson: string;
  eventsText: string;
  winsText: string;
  difficultiesText: string;
  feelingsText: string;
  lessonsText: string;
  tomorrowText: string;
  createdAt: string;
  updatedAt: string;
}

export interface JournalContext {
  date: string;
  scheduleSummary: string[];
  latestCheckin: DailyCheckin | null;
  financeTotal: number;
}

export interface BackupPayload {
  appVersion: string;
  schemaVersion: number;
  deviceId: string;
  exportedAt: string;
  recordCounts: Record<string, number>;
  data: {
    scheduleBlocks: ScheduleBlock[];
    weeklyPlans: WeeklyPlan[];
    objectives: Objective[];
    dailyCheckins: DailyCheckin[];
    weeklyReviews: WeeklyReview[];
    financeTransactions: FinanceTransaction[];
    monthlyBudgets: MonthlyBudget[];
    journalEntries: JournalEntry[];
  };
}

export interface DashboardSummary {
  weekKey: string;
  tutoringCount: number;
  growthCount: number;
  checkinCount: number;
  journalCount: number;
  weeklyReviewScore: number | null;
  monthIncome: number;
  monthNeeds: number;
  monthWants: number;
  monthSavings: number;
  topCategories: Array<{ category: string; total: number }>;
}
