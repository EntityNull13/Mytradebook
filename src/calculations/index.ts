import type {
  Trade,
  Exit,
  Plan,
  Setup,
  Transaction,
  TradeResult,
  PropFirmRule,
  PropFirmRuleType,
  RuleEvaluationResult,
  RuleEvaluationStatus,
  ExitType,
  Account,
  AccountType,
} from '../types';
import { formatMoney, formatSignedMoney, type CurrencyBreakdown } from '../utils/currency';
import { getDateKey, getTodayDateKey, DEFAULT_TIMEZONE } from '../utils/date';

export { formatMoney, formatSignedMoney, type CurrencyBreakdown };
export type { RuleEvaluationResult, RuleEvaluationStatus };

/**
 * Result calculation based on realized P&L:
 * null -> undefined (Active / not yet realized)
 * P&L > 0 -> PROFIT
 * P&L < 0 -> LOSS
 * P&L === 0 -> BEP (strict exact 0 per section 38)
 */
export function calculateTradeResult(realizedPnL: number | null): TradeResult | undefined {
  if (realizedPnL === null || realizedPnL === undefined) return undefined;
  if (realizedPnL > 0) return 'PROFIT';
  if (realizedPnL < 0) return 'LOSS';
  return 'BEP';
}

/**
 * Calculate current account balance:
 * Current Balance = Starting Balance + Deposits + Realized Trading P&L - Withdrawals - Fees
 * Active trades with realizedPnL = null are excluded from realized P&L calculations.
 */
export function calculateCurrentBalance(
  startingBalance: number,
  trades: Trade[],
  transactions: Transaction[] = []
): {
  currentBalance: number;
  totalRealizedPnL: number;
  totalDeposits: number;
  totalWithdrawals: number;
  totalFees: number;
} {
  const completedTrades = trades.filter((t) => t.status === 'COMPLETED' && t.realizedPnL !== null);
  const totalRealizedPnL = completedTrades.reduce((acc, t) => acc + (t.realizedPnL ?? 0), 0);
  
  let totalDeposits = 0;
  let totalWithdrawals = 0;
  let totalFees = 0;

  for (const tx of transactions) {
    if (tx.type === 'DEPOSIT') {
      totalDeposits += tx.amount;
    } else if (tx.type === 'WITHDRAWAL' || tx.type === 'PAYOUT') {
      totalWithdrawals += tx.amount;
    } else if (tx.type === 'FEE' || tx.type === 'COMMISSION' || tx.type === 'ACTIVATION_FEE') {
      totalFees += tx.amount;
    } else if (tx.type === 'ADJUSTMENT') {
      totalDeposits += tx.amount;
    }
  }

  const currentBalance = startingBalance + totalDeposits + totalRealizedPnL - totalWithdrawals - totalFees;
  return {
    currentBalance,
    totalRealizedPnL,
    totalDeposits,
    totalWithdrawals,
    totalFees,
  };
}

/**
 * Win Rate calculation:
 * winRate = (winningTrades / completedTrades) * 100
 * Strictly excludes active trades
 */
export function calculateWinRate(trades: Trade[]): {
  winRate: number;
  wins: number;
  losses: number;
  beps: number;
  totalCompleted: number;
} {
  const completed = trades.filter((t) => t.status === 'COMPLETED' && t.realizedPnL !== null);
  if (completed.length === 0) {
    return { winRate: 0, wins: 0, losses: 0, beps: 0, totalCompleted: 0 };
  }

  const wins = completed.filter((t) => (t.realizedPnL ?? 0) > 0).length;
  const losses = completed.filter((t) => (t.realizedPnL ?? 0) < 0).length;
  const beps = completed.filter((t) => (t.realizedPnL ?? 0) === 0).length;
  const winRate = (wins / completed.length) * 100;

  return {
    winRate: Number(winRate.toFixed(1)),
    wins,
    losses,
    beps,
    totalCompleted: completed.length,
  };
}

/**
 * Profit Factor calculation:
 * profitFactor = grossProfit / grossLoss (absolute)
 */
export function calculateProfitFactor(trades: Trade[]): number {
  const completed = trades.filter((t) => t.status === 'COMPLETED' && t.realizedPnL !== null);
  let grossProfit = 0;
  let grossLoss = 0;

  for (const t of completed) {
    const pnl = t.realizedPnL ?? 0;
    if (pnl > 0) {
      grossProfit += pnl;
    } else if (pnl < 0) {
      grossLoss += Math.abs(pnl);
    }
  }

  if (grossLoss === 0) {
    return grossProfit > 0 ? 999.99 : 0;
  }
  return Number((grossProfit / grossLoss).toFixed(2));
}

/**
 * Average R and Expectancy
 */
export function calculateExpectancyAndR(trades: Trade[], plans: Plan[]): {
  averageR: number;
  expectancy: number;
  averageWin: number;
  averageLoss: number;
} {
  const completed = trades.filter((t) => t.status === 'COMPLETED' && t.realizedPnL !== null);
  if (completed.length === 0) {
    return { averageR: 0, expectancy: 0, averageWin: 0, averageLoss: 0 };
  }

  const planMap = new Map<string, Plan>();
  plans.forEach((p) => planMap.set(p.id, p));

  let totalR = 0;
  let rCount = 0;
  let totalWinPnL = 0;
  let winCount = 0;
  let totalLossPnL = 0;
  let lossCount = 0;

  for (const t of completed) {
    const pnl = t.realizedPnL ?? 0;
    const p = planMap.get(t.planId);
    if (p && p.risk && p.risk > 0) {
      totalR += pnl / p.risk;
      rCount++;
    }

    if (pnl > 0) {
      totalWinPnL += pnl;
      winCount++;
    } else if (pnl < 0) {
      totalLossPnL += Math.abs(pnl);
      lossCount++;
    }
  }

  const averageWin = winCount > 0 ? totalWinPnL / winCount : 0;
  const averageLoss = lossCount > 0 ? totalLossPnL / lossCount : 0;
  const winRate = winCount / completed.length;
  const lossRate = lossCount / completed.length;
  const expectancy = winRate * averageWin - lossRate * averageLoss;
  const averageR = rCount > 0 ? totalR / rCount : 0;

  return {
    averageR: Number(averageR.toFixed(2)),
    expectancy: Number(expectancy.toFixed(2)),
    averageWin: Number(averageWin.toFixed(2)),
    averageLoss: Number(averageLoss.toFixed(2)),
  };
}

/**
 * Maximum Drawdown from balance curve
 */
export function calculateDrawdown(equityCurve: number[]): {
  maxDrawdown: number;
  maxDrawdownPercent: number;
} {
  if (equityCurve.length < 2) {
    return { maxDrawdown: 0, maxDrawdownPercent: 0 };
  }

  let peak = equityCurve[0];
  let maxDD = 0;
  let maxDDPct = 0;

  for (const point of equityCurve) {
    if (point > peak) {
      peak = point;
    }
    const dd = peak - point;
    if (dd > maxDD) {
      maxDD = dd;
      maxDDPct = peak > 0 ? (dd / peak) * 100 : 0;
    }
  }

  return {
    maxDrawdown: Number(maxDD.toFixed(2)),
    maxDrawdownPercent: Number(maxDDPct.toFixed(2)),
  };
}

/**
 * Plan execution statistics
 */
export function calculateTriggerRate(plans: Plan[]): {
  totalPlans: number;
  triggeredCount: number;
  triggerRate: number;
  notTriggeredCount: number;
  notTriggeredRate: number;
  invalidCount: number;
  invalidRate: number;
  plannedCount: number;
} {
  const total = plans.length;
  if (total === 0) {
    return {
      totalPlans: 0,
      triggeredCount: 0,
      triggerRate: 0,
      notTriggeredCount: 0,
      notTriggeredRate: 0,
      invalidCount: 0,
      invalidRate: 0,
      plannedCount: 0,
    };
  }

  const triggeredCount = plans.filter((p) => p.status === 'TRIGGERED').length;
  const notTriggeredCount = plans.filter((p) => p.status === 'NOT_TRIGGERED').length;
  const invalidCount = plans.filter((p) => p.status === 'INVALID').length;
  const plannedCount = plans.filter((p) => p.status === 'PLANNED').length;

  return {
    totalPlans: total,
    triggeredCount,
    triggerRate: Number(((triggeredCount / total) * 100).toFixed(1)),
    notTriggeredCount,
    notTriggeredRate: Number(((notTriggeredCount / total) * 100).toFixed(1)),
    invalidCount,
    invalidRate: Number(((invalidCount / total) * 100).toFixed(1)),
    plannedCount,
  };
}

/**
 * Exit statistics
 */
export function calculateExitStatistics(exits: Exit[]): Record<ExitType, number> {
  const counts: Record<ExitType, number> = {
    FULL_TP: 0,
    CUT_PROFIT: 0,
    FULL_SL: 0,
    CUT_LOSS: 0,
    PARTIAL: 0,
    OTHER: 0,
  };

  for (const exit of exits) {
    if (counts[exit.exitType] !== undefined) {
      counts[exit.exitType]++;
    } else {
      counts.OTHER++;
    }
  }

  return counts;
}

/**
 * Daily P&L grouping for calendar and performance tracker
 * Uses user's configured timezone (defaults to Asia/Jakarta)
 * Returns a map of 'YYYY-MM-DD' => { pnl, tradesCount, wins, losses, beps, plansCount }
 */
export function calculateDailyPnL(
  trades: Trade[],
  plans: Plan[] = [],
  timezone: string = DEFAULT_TIMEZONE
): Map<string, { pnl: number; tradesCount: number; wins: number; losses: number; beps: number; plansCount: number }> {
  const dailyMap = new Map<string, { pnl: number; tradesCount: number; wins: number; losses: number; beps: number; plansCount: number }>();

  // Aggregate completed trades only
  for (const trade of trades) {
    if (trade.status !== 'COMPLETED' || trade.realizedPnL === null) continue;
    if (!trade.completedAt && !trade.actualEntryTime) continue;
    const dateStr = getDateKey(trade.completedAt || trade.actualEntryTime, timezone);
    if (!dateStr) continue;

    const existing = dailyMap.get(dateStr) || { pnl: 0, tradesCount: 0, wins: 0, losses: 0, beps: 0, plansCount: 0 };
    const pnl = trade.realizedPnL;
    existing.pnl += pnl;
    existing.tradesCount++;
    if (pnl > 0) existing.wins++;
    else if (pnl < 0) existing.losses++;
    else existing.beps++;
    dailyMap.set(dateStr, existing);
  }

  // Count plans created on that date
  for (const plan of plans) {
    const dateStr = getDateKey(plan.createdAt, timezone);
    if (!dateStr) continue;

    const existing = dailyMap.get(dateStr) || { pnl: 0, tradesCount: 0, wins: 0, losses: 0, beps: 0, plansCount: 0 };
    existing.plansCount++;
    dailyMap.set(dateStr, existing);
  }

  return dailyMap;
}

/**
 * Setup performance statistics (strictly descriptive per section 24, no advisory rankings)
 */
export function calculateSetupPerformance(
  plans: Plan[],
  trades: Trade[],
  setups: Setup[]
): Array<{
  setupId: string;
  setupName: string;
  category?: string;
  plansCount: number;
  triggeredCount: number;
  tradesCount: number;
  winCount: number;
  lossCount: number;
  winRate: number;
  netPnL: number;
}> {
  const planMap = new Map<string, Plan>();
  plans.forEach((p) => planMap.set(p.id, p));

  const results: Array<{
    setupId: string;
    setupName: string;
    category?: string;
    plansCount: number;
    triggeredCount: number;
    tradesCount: number;
    winCount: number;
    lossCount: number;
    winRate: number;
    netPnL: number;
  }> = [];

  for (const setup of setups) {
    const setupPlans = plans.filter((p) => p.setupId === setup.id);
    const triggered = setupPlans.filter((p) => p.status === 'TRIGGERED').length;
    
    // Find matching completed trades
    const setupTrades = trades.filter((t) => {
      const plan = planMap.get(t.planId);
      return plan && plan.setupId === setup.id;
    });

    const completed = setupTrades.filter((t) => t.status === 'COMPLETED' && t.realizedPnL !== null);
    const winCount = completed.filter((t) => (t.realizedPnL ?? 0) > 0).length;
    const lossCount = completed.filter((t) => (t.realizedPnL ?? 0) < 0).length;
    const netPnL = completed.reduce((sum, t) => sum + (t.realizedPnL ?? 0), 0);
    const winRate = completed.length > 0 ? Number(((winCount / completed.length) * 100).toFixed(1)) : 0;

    results.push({
      setupId: setup.id,
      setupName: setup.name,
      category: setup.category,
      plansCount: setupPlans.length,
      triggeredCount: triggered,
      tradesCount: completed.length,
      winCount,
      lossCount,
      winRate,
      netPnL: Number(netPnL.toFixed(2)),
    });
  }

  return results;
}

/**
 * Helper to resolve structured PropFirmRuleType.
 * Strictly uses machine-readable ruleType, NEVER human-readable ruleName.
 */
export function resolveRuleType(rule: PropFirmRule): PropFirmRuleType {
  return rule.ruleType || 'CUSTOM';
}

/**
 * Context required for evaluating Prop Firm Rules.
 */
export interface RuleEvaluationContext {
  accountTrades: Trade[];
  currentBalance: number;
  startingBalance: number;
  currency?: string;
  timezone?: string;
}

/**
 * Helper to extract numeric threshold limit safely from limitValue or value.
 */
function getRuleLimit(rule: PropFirmRule): number {
  if (typeof rule.limitValue === 'number' && !isNaN(rule.limitValue)) {
    return rule.limitValue;
  }
  if (typeof rule.value === 'number' && !isNaN(rule.value)) {
    return rule.value;
  }
  if (typeof rule.value === 'string' && rule.value.trim()) {
    const parsed = parseFloat(rule.value);
    if (!isNaN(parsed)) return parsed;
  }
  return 0;
}

/**
 * Individual Rule Evaluators
 */
function evaluateDailyLoss(rule: PropFirmRule, context: RuleEvaluationContext): RuleEvaluationResult {
  const limit = getRuleLimit(rule);
  if (limit <= 0) {
    return {
      currentValue: 0,
      limitValue: 0,
      displayText: `${rule.ruleName}: No limit configured`,
      status: 'NOT_CONFIGURED',
    };
  }

  const tz = context.timezone || DEFAULT_TIMEZONE;
  const todayKey = getTodayDateKey(tz);
  const todayTrades = context.accountTrades.filter((t) => {
    if (t.status !== 'COMPLETED' || t.realizedPnL === null) return false;
    const tradeDate = getDateKey(t.completedAt || t.actualEntryTime, tz);
    return tradeDate === todayKey;
  });

  const todayLoss = todayTrades.reduce((acc, t) => {
    const pnl = t.realizedPnL ?? 0;
    return pnl < 0 ? acc + Math.abs(pnl) : acc;
  }, 0);

  const isBreached = todayLoss >= limit;
  const isWarning = todayLoss >= limit * 0.75;

  return {
    currentValue: todayLoss,
    limitValue: limit,
    displayText: `Daily Loss: ${formatMoney(todayLoss, context.currency)} / ${formatMoney(limit, context.currency)}`,
    status: isBreached ? 'BREACHED' : isWarning ? 'WARNING' : 'SAFE',
  };
}

function evaluateMaxOverallLoss(rule: PropFirmRule, context: RuleEvaluationContext): RuleEvaluationResult {
  const limit = getRuleLimit(rule);
  if (limit <= 0) {
    return {
      currentValue: 0,
      limitValue: 0,
      displayText: `${rule.ruleName}: No limit configured`,
      status: 'NOT_CONFIGURED',
    };
  }

  const overallLoss = Math.max(0, context.startingBalance - context.currentBalance);
  const isBreached = overallLoss >= limit;
  const isWarning = overallLoss >= limit * 0.75;

  return {
    currentValue: overallLoss,
    limitValue: limit,
    displayText: `Overall Loss: ${formatMoney(overallLoss, context.currency)} / ${formatMoney(limit, context.currency)}`,
    status: isBreached ? 'BREACHED' : isWarning ? 'WARNING' : 'SAFE',
  };
}

function evaluateTrailingDrawdown(rule: PropFirmRule, context: RuleEvaluationContext): RuleEvaluationResult {
  const limit = getRuleLimit(rule);
  if (limit <= 0) {
    return {
      currentValue: 0,
      limitValue: 0,
      displayText: `${rule.ruleName}: No limit configured`,
      status: 'NOT_CONFIGURED',
    };
  }

  let peakBalance = context.startingBalance;
  let running = context.startingBalance;
  const sorted = [...context.accountTrades]
    .filter((t) => t.status === 'COMPLETED' && t.realizedPnL !== null)
    .sort((a, b) => (a.completedAt || '').localeCompare(b.completedAt || ''));

  for (const t of sorted) {
    running += (t.realizedPnL ?? 0);
    if (running > peakBalance) peakBalance = running;
  }

  const trailingLoss = Math.max(0, peakBalance - context.currentBalance);
  const isBreached = trailingLoss >= limit;
  const isWarning = trailingLoss >= limit * 0.75;

  return {
    currentValue: trailingLoss,
    limitValue: limit,
    displayText: `Trailing Drawdown: ${formatMoney(trailingLoss, context.currency)} / ${formatMoney(limit, context.currency)}`,
    status: isBreached ? 'BREACHED' : isWarning ? 'WARNING' : 'SAFE',
  };
}

function evaluateProfitTarget(rule: PropFirmRule, context: RuleEvaluationContext): RuleEvaluationResult {
  const limit = getRuleLimit(rule);
  if (limit <= 0) {
    return {
      currentValue: 0,
      limitValue: 0,
      displayText: `${rule.ruleName}: No target configured`,
      status: 'NOT_CONFIGURED',
    };
  }

  const profitMade = Math.max(0, context.currentBalance - context.startingBalance);
  const isAchieved = profitMade >= limit;

  return {
    currentValue: profitMade,
    limitValue: limit,
    displayText: `Profit Target: ${formatMoney(profitMade, context.currency)} / ${formatMoney(limit, context.currency)}${isAchieved ? ' (Reached)' : ''}`,
    status: 'SAFE',
    achieved: isAchieved,
  };
}

function evaluateMinTradingDays(rule: PropFirmRule, context: RuleEvaluationContext): RuleEvaluationResult {
  const limit = getRuleLimit(rule);
  if (limit <= 0) {
    return {
      currentValue: 0,
      limitValue: 0,
      displayText: `${rule.ruleName}: No days target configured`,
      status: 'NOT_CONFIGURED',
    };
  }

  const tz = context.timezone || DEFAULT_TIMEZONE;
  const tradingDays = new Set<string>();
  for (const t of context.accountTrades) {
    if (t.status === 'COMPLETED' && t.realizedPnL !== null) {
      const key = getDateKey(t.completedAt || t.actualEntryTime, tz);
      if (key) tradingDays.add(key);
    }
  }
  const daysCount = tradingDays.size;
  const isAchieved = daysCount >= limit;

  return {
    currentValue: daysCount,
    limitValue: limit,
    displayText: `Trading Days: ${daysCount} of ${limit} days${isAchieved ? ' (Complete)' : ''}`,
    status: 'SAFE',
    achieved: isAchieved,
  };
}

function evaluateMinProfitableDays(rule: PropFirmRule, context: RuleEvaluationContext): RuleEvaluationResult {
  const limit = getRuleLimit(rule);
  if (limit <= 0) {
    return {
      currentValue: 0,
      limitValue: 0,
      displayText: `${rule.ruleName}: No days target configured`,
      status: 'NOT_CONFIGURED',
    };
  }

  const tz = context.timezone || DEFAULT_TIMEZONE;
  const dayPnLMap = new Map<string, number>();
  for (const t of context.accountTrades) {
    if (t.status === 'COMPLETED' && t.realizedPnL !== null) {
      const key = getDateKey(t.completedAt || t.actualEntryTime, tz);
      if (key) {
        dayPnLMap.set(key, (dayPnLMap.get(key) || 0) + (t.realizedPnL ?? 0));
      }
    }
  }

  let profitableDays = 0;
  for (const pnl of dayPnLMap.values()) {
    if (pnl > 0) profitableDays++;
  }
  const isAchieved = profitableDays >= limit;

  return {
    currentValue: profitableDays,
    limitValue: limit,
    displayText: `Profitable Days: ${profitableDays} of ${limit} days${isAchieved ? ' (Complete)' : ''}`,
    status: 'SAFE',
    achieved: isAchieved,
  };
}

function evaluateMaxRiskPerSymbol(rule: PropFirmRule, _context: RuleEvaluationContext): RuleEvaluationResult {
  const limit = getRuleLimit(rule);
  return {
    currentValue: 0,
    limitValue: limit,
    displayText: `Max Risk / Symbol: ${limit ? `${limit}%` : 'Manual plan validation'}`,
    status: 'NOT_EVALUABLE',
  };
}

function evaluateNewsRestriction(rule: PropFirmRule, _context: RuleEvaluationContext): RuleEvaluationResult {
  return {
    currentValue: 0,
    displayText: `${rule.ruleName}: Not evaluable (No live economic calendar feed)`,
    status: 'NOT_EVALUABLE',
  };
}

function evaluateHoldingRestriction(rule: PropFirmRule, _context: RuleEvaluationContext): RuleEvaluationResult {
  return {
    currentValue: 0,
    displayText: `${rule.ruleName}: Not evaluable (Manual market session review)`,
    status: 'NOT_EVALUABLE',
  };
}

function evaluateAutomationRestriction(rule: PropFirmRule, _context: RuleEvaluationContext): RuleEvaluationResult {
  return {
    currentValue: 0,
    displayText: `${rule.ruleName}: Not evaluable (Manual platform review)`,
    status: 'NOT_EVALUABLE',
  };
}

function evaluateAccountLifecycle(rule: PropFirmRule, _context: RuleEvaluationContext): RuleEvaluationResult {
  return {
    currentValue: 0,
    displayText: `${rule.ruleName}: Manual verification`,
    status: 'NOT_EVALUABLE',
  };
}

function evaluatePayoutRestriction(rule: PropFirmRule, _context: RuleEvaluationContext): RuleEvaluationResult {
  return {
    currentValue: 0,
    displayText: `${rule.ruleName}: Manual schedule`,
    status: 'NOT_EVALUABLE',
  };
}

function evaluateCustomRule(rule: PropFirmRule, _context: RuleEvaluationContext): RuleEvaluationResult {
  return {
    currentValue: 0,
    displayText: `${rule.ruleName}: Custom condition (Manual audit)`,
    status: 'NOT_EVALUABLE',
  };
}

/**
 * Rule Evaluator Registry mapping machine-readable PropFirmRuleType to evaluator functions.
 */
export const RULE_EVALUATORS: Record<
  PropFirmRuleType,
  (rule: PropFirmRule, context: RuleEvaluationContext) => RuleEvaluationResult
> = {
  DAILY_LOSS_LIMIT: evaluateDailyLoss,
  MAX_OVERALL_LOSS: evaluateMaxOverallLoss,
  TRAILING_DRAWDOWN: evaluateTrailingDrawdown,
  PROFIT_TARGET: evaluateProfitTarget,
  MIN_TRADING_DAYS: evaluateMinTradingDays,
  MIN_PROFITABLE_DAYS: evaluateMinProfitableDays,
  MAX_RISK_PER_SYMBOL: evaluateMaxRiskPerSymbol,
  NEWS_RESTRICTION: evaluateNewsRestriction,
  HOLDING_RESTRICTION: evaluateHoldingRestriction,
  AUTOMATION_RESTRICTION: evaluateAutomationRestriction,
  ACCOUNT_LIFECYCLE: evaluateAccountLifecycle,
  PAYOUT_RESTRICTION: evaluatePayoutRestriction,
  CUSTOM: evaluateCustomRule,
};

/**
 * Generic Prop Firm Rule evaluation engine.
 * Evaluation logic strictly evaluates ruleType through RULE_EVALUATORS, NOT human-readable ruleName.
 * Engine is generic and strictly descriptive (never gives trading advice).
 */
export function evaluateRule(
  rule: PropFirmRule,
  context: RuleEvaluationContext
): RuleEvaluationResult {
  if (rule.answer === 'NO') {
    return {
      currentValue: 0,
      limitValue: 0,
      displayText: `${rule.ruleName}: Not applicable (Disabled)`,
      status: 'NOT_CONFIGURED',
    };
  }

  if (rule.answer === 'UNKNOWN') {
    return {
      currentValue: 0,
      limitValue: 0,
      displayText: `${rule.ruleName}: Unconfigured`,
      status: 'UNKNOWN',
    };
  }

  if (!rule.enabled) {
    return {
      currentValue: 0,
      limitValue: 0,
      displayText: `${rule.ruleName}: Disabled`,
      status: 'NOT_CONFIGURED',
    };
  }

  const ruleType = resolveRuleType(rule);
  const evaluator = RULE_EVALUATORS[ruleType] || evaluateCustomRule;
  return evaluator(rule, context);
}

/**
 * Convenience wrapper for evaluating rule status with standard account parameters.
 */
export function evaluateRuleStatus(
  rule: PropFirmRule,
  accountTrades: Trade[],
  currentBalance: number,
  startingBalance: number,
  currency: string = 'USD',
  timezone: string = DEFAULT_TIMEZONE
): RuleEvaluationResult {
  return evaluateRule(rule, {
    accountTrades,
    currentBalance,
    startingBalance,
    currency,
    timezone,
  });
}

/**
 * Groups account metrics by currency (Section 1 & 20)
 * Prevents invalid mathematical addition of different currencies
 */
export function groupAccountsByCurrency(
  accounts: Account[],
  trades: Trade[],
  transactions: Transaction[]
): CurrencyBreakdown[] {
  const currencyMap = new Map<string, {
    currency: string;
    balance: number;
    netPnL: number;
    startingBalance: number;
    deposits: number;
    withdrawalsAndFees: number;
    accountsCount: number;
    tradesCount: number;
  }>();

  for (const acc of accounts) {
    const curr = (acc.currency || 'USD').toUpperCase();
    const accTrades = trades.filter((t) => t.accountId === acc.id);
    const accTxs = transactions.filter((tx) => tx.accountId === acc.id);
    const bal = calculateCurrentBalance(acc.startingBalance, accTrades, accTxs);

    const existing = currencyMap.get(curr) || {
      currency: curr,
      balance: 0,
      netPnL: 0,
      startingBalance: 0,
      deposits: 0,
      withdrawalsAndFees: 0,
      accountsCount: 0,
      tradesCount: 0,
    };

    existing.balance += bal.currentBalance;
    existing.netPnL += bal.totalRealizedPnL;
    existing.startingBalance += acc.startingBalance;
    existing.deposits += bal.totalDeposits;
    existing.withdrawalsAndFees += bal.totalWithdrawals + bal.totalFees;
    existing.accountsCount += 1;
    existing.tradesCount += accTrades.length;

    currencyMap.set(curr, existing);
  }

  return Array.from(currencyMap.values());
}

export interface AccountPerformanceItem {
  accountId: string;
  accountName: string;
  accountType: AccountType;
  currency: string;
  startingBalance: number;
  currentBalance: number;
  tradesCount: number;
  winRate: number;
  wins: number;
  losses: number;
  beps: number;
  netPnL: number;
  maxDrawdown: number;
  profitFactor: number;
}

/**
 * Account performance statistics strictly for statistical breakdown (Section 8).
 * Purely descriptive, no rankings, no winners/losers, no advice.
 */
export function calculateAccountPerformanceBreakdown(
  accounts: Account[],
  trades: Trade[],
  transactions: Transaction[] = []
): AccountPerformanceItem[] {
  return accounts.map((acc) => {
    const accTrades = trades.filter((t) => t.accountId === acc.id);
    const accTxs = transactions.filter((tx) => tx.accountId === acc.id);
    const balanceState = calculateCurrentBalance(acc.startingBalance, accTrades, accTxs);
    const winRateStats = calculateWinRate(accTrades);
    const pf = calculateProfitFactor(accTrades);

    const completed = accTrades
      .filter((t) => t.status === 'COMPLETED' && t.realizedPnL !== null)
      .sort((a, b) =>
        (a.completedAt || a.actualEntryTime || '').localeCompare(
          b.completedAt || b.actualEntryTime || ''
        )
      );

    let running = 0;
    const curve = [0];
    for (const t of completed) {
      running += t.realizedPnL ?? 0;
      curve.push(running);
    }
    const dd = calculateDrawdown(curve);

    return {
      accountId: acc.id,
      accountName: acc.name,
      accountType: acc.type,
      currency: (acc.currency || 'USD').toUpperCase(),
      startingBalance: acc.startingBalance,
      currentBalance: balanceState.currentBalance,
      tradesCount: winRateStats.totalCompleted,
      winRate: winRateStats.winRate,
      wins: winRateStats.wins,
      losses: winRateStats.losses,
      beps: winRateStats.beps,
      netPnL: balanceState.totalRealizedPnL,
      maxDrawdown: dd.maxDrawdown,
      profitFactor: pf,
    };
  });
}

export interface AccountTypeSummaryItem {
  type: AccountType;
  typeName: string;
  accountsCount: number;
  tradesCount: number;
  currencyPnL: Record<string, number>;
}

/**
 * Account Type summary (Section 9).
 * Strictly descriptive. Preserves multi-currency safety by grouping P&L by currency.
 */
export function calculateAccountTypeSummary(
  accounts: Account[],
  trades: Trade[]
): AccountTypeSummaryItem[] {
  const types: AccountType[] = ['PERSONAL', 'PROP_FIRM', 'DEMO', 'OTHER'];
  const typeLabels: Record<AccountType, string> = {
    PERSONAL: 'Personal',
    PROP_FIRM: 'Prop Firm',
    DEMO: 'Demo',
    OTHER: 'Other',
  };

  return types.map((type) => {
    const typeAccounts = accounts.filter((a) => a.type === type);
    const typeAccountIds = new Set(typeAccounts.map((a) => a.id));
    const typeTrades = trades.filter(
      (t) => typeAccountIds.has(t.accountId) && t.status === 'COMPLETED' && t.realizedPnL !== null
    );

    const currencyPnL: Record<string, number> = {};
    for (const acc of typeAccounts) {
      const curr = (acc.currency || 'USD').toUpperCase();
      if (currencyPnL[curr] === undefined) {
        currencyPnL[curr] = 0;
      }
      const accTrades = typeTrades.filter((t) => t.accountId === acc.id);
      const accPnL = accTrades.reduce((sum, t) => sum + (t.realizedPnL ?? 0), 0);
      currencyPnL[curr] += accPnL;
    }

    return {
      type,
      typeName: typeLabels[type] || type,
      accountsCount: typeAccounts.length,
      tradesCount: typeTrades.length,
      currencyPnL,
    };
  });
}

