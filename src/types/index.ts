// PRD Data Model Types

export type AccountType = 'PERSONAL' | 'PROP_FIRM' | 'DEMO' | 'OTHER';
export type AccountStatus = 'ACTIVE' | 'ARCHIVED' | 'CLOSED';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  currency: string;
  startingBalance: number;
  status: AccountStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type PhaseType = 'CHALLENGE' | 'VERIFICATION' | 'FUNDED' | 'PAYOUT' | 'SCALING' | 'CUSTOM';
export type PhaseStatus = 'ACTIVE' | 'PASSED' | 'FAILED' | 'ARCHIVED';

export interface AccountPhase {
  id: string;
  accountId: string;
  name: string;
  type: PhaseType;
  status: PhaseStatus;
  startingBalance: number;
  startedAt: string;
  endedAt?: string;
  notes?: string;
}

export type RuleCategory = 
  | 'ACCOUNT_OBJECTIVE' 
  | 'DRAWDOWN' 
  | 'RISK' 
  | 'NEWS' 
  | 'AUTOMATION' 
  | 'TRADING_BEHAVIOR' 
  | 'ACCOUNT_RELATIONSHIP' 
  | 'HOLDING' 
  | 'PAYOUT' 
  | 'LIFECYCLE';

export type PropFirmRuleType =
  | 'DAILY_LOSS_LIMIT'
  | 'MAX_OVERALL_LOSS'
  | 'TRAILING_DRAWDOWN'
  | 'PROFIT_TARGET'
  | 'MIN_TRADING_DAYS'
  | 'MIN_PROFITABLE_DAYS'
  | 'MAX_RISK_PER_SYMBOL'
  | 'NEWS_RESTRICTION'
  | 'HOLDING_RESTRICTION'
  | 'AUTOMATION_RESTRICTION'
  | 'ACCOUNT_LIFECYCLE'
  | 'PAYOUT_RESTRICTION'
  | 'CUSTOM';

export type RuleAnswer = 'YES' | 'NO' | 'UNKNOWN';

export type RuleEvaluationStatus =
  | 'SAFE'
  | 'WARNING'
  | 'BREACHED'
  | 'NOT_EVALUABLE'
  | 'NOT_CONFIGURED'
  | 'UNKNOWN';

export interface RuleEvaluationResult {
  currentValue: number;
  limitValue?: number;
  displayText: string;
  status: RuleEvaluationStatus;
  achieved?: boolean;
}

export interface PropFirmRule {
  id: string;
  accountId: string;
  phaseId?: string;
  category: RuleCategory;
  ruleType: PropFirmRuleType;
  ruleName: string;
  enabled: boolean;
  answer?: RuleAnswer;
  limitValue?: number;
  value?: number | string;
  unit?: 'PERCENT' | 'CURRENCY' | 'DAYS' | 'TRADES' | 'TEXT';
  description?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type TradeDirection = 'BUY' | 'SELL';
export type PlanStatus = 'PLANNED' | 'TRIGGERED' | 'NOT_TRIGGERED' | 'INVALID' | 'ARCHIVED';

export interface Plan {
  id: string;
  planGroupId?: string;
  accountId: string;
  phaseId?: string;
  symbol: string;
  direction: TradeDirection;
  plannedEntry: number;
  sl?: number;
  tp?: number;
  positionSize?: number;
  risk?: number;
  setupId?: string;
  timeframe?: string;
  marketBias?: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  entryReason?: string;
  confidence?: number; // 1-5
  notes?: string;
  screenshotId?: string;
  status: PlanStatus;
  invalidReason?: string;
  notTriggeredReason?: string;
  duplicatedFromPlanId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlanGroup {
  id: string;
  accountId?: string;
  name: string;
  symbol: string;
  direction?: TradeDirection;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export type TradeStatus = 'ACTIVE' | 'COMPLETED';
export type TradeResult = 'PROFIT' | 'LOSS' | 'BEP';

export interface Trade {
  id: string;
  planId: string;
  accountId: string;
  phaseId?: string;
  actualEntry: number;
  actualEntryTime: string;
  actualPositionSize: number;
  status: TradeStatus;
  realizedPnL: number | null; // null for ACTIVE trades; calculated upon COMPLETION
  result?: TradeResult;
  completedAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type ExitType = 
  | 'FULL_TP' 
  | 'CUT_PROFIT' 
  | 'FULL_SL' 
  | 'CUT_LOSS' 
  | 'PARTIAL' 
  | 'OTHER';

export interface Exit {
  id: string;
  tradeId: string;
  executedAt: string;
  price: number;
  closedSize: number;
  exitType: ExitType;
  realizedPnL: number;
  reason?: string;
  notes?: string;
}

export type FollowedPlan = 'YES' | 'PARTIALLY' | 'NO';

export interface TradeReview {
  id: string;
  tradeId: string;
  followedPlan: FollowedPlan;
  whatHappened?: string;
  whatWentWell?: string;
  whatCouldImprove?: string;
  lessonLearned?: string;
  notes?: string;
  screenshotId?: string;
  createdAt: string;
}

export interface Setup {
  id: string;
  name: string;
  description?: string;
  category?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export type TransactionType = 
  | 'DEPOSIT' 
  | 'WITHDRAWAL' 
  | 'PAYOUT' 
  | 'FEE' 
  | 'COMMISSION' 
  | 'ACTIVATION_FEE' 
  | 'ADJUSTMENT' 
  | 'OTHER';

export interface Transaction {
  id: string;
  accountId: string;
  phaseId?: string;
  type: TransactionType;
  amount: number;
  date: string;
  notes?: string;
  createdAt: string;
}

export type EvidenceType = 'BEFORE_ENTRY' | 'RUNNING' | 'EXIT' | 'REVIEW' | 'AFTER_TRADE' | 'OTHER';

export interface Evidence {
  id: string;
  name: string;
  dataUrl: string; // Base64 compressed image data
  type: EvidenceType;
  tradeId?: string;
  planId?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  createdAt: string;
}

export interface MigrationRecord {
  id: 'migration_metadata';
  demoCleanup: number;
  migratedAt: string;
}

export interface AppSettings {
  id: 'app_settings';
  theme: 'light' | 'dark' | 'system';
  timezone: string;
  dateFormat: string;
  currencyDisplay: string;
  autoBackup: boolean;
  cloudBackupConnected: boolean;
  cloudBackupFolder?: string;
  lastBackupAt?: string;
  lastBackupType?: 'LOCAL' | 'CLOUD';
  demoCleanup?: number;
}

export interface BackupManifest {
  schemaVersion: number;
  appVersion: string;
  backupVersion: number;
  createdAt: string;
  isEncrypted: boolean;
  counts: {
    accounts: number;
    accountPhases: number;
    propFirmRules: number;
    plans: number;
    planGroups: number;
    trades: number;
    exits: number;
    reviews: number;
    setups: number;
    transactions: number;
    evidence: number;
  };
}

export interface BackupContainer {
  manifest: BackupManifest;
  database: {
    accounts: Account[];
    accountPhases: AccountPhase[];
    propFirmRules: PropFirmRule[];
    plans: Plan[];
    planGroups: PlanGroup[];
    trades: Trade[];
    exits: Exit[];
    reviews: TradeReview[];
    setups: Setup[];
    transactions: Transaction[];
  };
  settings: AppSettings;
  evidence?: Evidence[];
}

export * from './public';
