import type { TradeDirection, PlanStatus, TradeResult, TradeStatus, FollowedPlan } from './index';

export interface PublishedAccount {
  id: string;
  name: string;
  currency: string;
  initialBalance?: number;
  currentBalance?: number;
}

export interface PublishedExit {
  id: string;
  exitType: string;
  price: number;
  closedSize?: number;
  realizedPnL: number;
  executedAt: string;
  notes?: string;
}

export interface PublishedReview {
  followedPlan?: FollowedPlan;
  whatHappened?: string;
  whatWentWell?: string;
  whatCouldImprove?: string;
  lessonLearned?: string;
  notes?: string;
}

export interface PublishedTrade {
  id: string;
  accountId: string;
  planId?: string;
  symbol: string;
  direction: TradeDirection;
  actualEntry: number;
  actualEntryTime: string;
  actualPositionSize?: number;
  initialStopLoss?: number;
  takeProfit?: number;
  plannedRiskReward?: number;
  status: TradeStatus;
  result?: TradeResult;
  realizedPnL: number;
  realizedRMultiple?: number;
  completedAt?: string;
  setupName?: string;
  exits: PublishedExit[];
  review?: PublishedReview;
}

export interface PublishedPlan {
  id: string;
  accountId: string;
  symbol: string;
  direction: TradeDirection;
  plannedEntry: number;
  sl?: number;
  tp?: number;
  plannedRiskReward?: number;
  timeframe?: string;
  setupName?: string;
  marketBias?: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  entryReason?: string;
  invalidReason?: string;
  status: PlanStatus;
  createdAt: string;
}

export interface PublishedAnalytics {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  bepTrades: number;
  winRate: number;
  netPnL: number;
  profitFactor: number;
  averageWin: number;
  averageLoss: number;
  expectancy: number;
  averageR: number;
  maxDrawdown: number;
}

export interface PublishedJournal {
  id: string;
  isPublished: boolean;
  publishedAt: string;
  updatedAt: string;
  journalName: string;
  bio?: string;
  showBalances: boolean;
  showPositionSizes: boolean;
  includeReviews: boolean;
  accounts: PublishedAccount[];
  plans: PublishedPlan[];
  trades: PublishedTrade[];
  analytics: PublishedAnalytics;
}

export interface PublishOptions {
  journalName?: string;
  bio?: string;
  showBalances: boolean;
  showPositionSizes: boolean;
  includeReviews: boolean;
  includeActiveTrades: boolean;
  includePlannedPlans: boolean;
  accountIds: string[]; // 'ALL' or specific account IDs
}
