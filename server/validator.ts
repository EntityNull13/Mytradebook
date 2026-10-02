import type {
  PublishedJournal,
  PublishedAccount,
  PublishedPlan,
  PublishedTrade,
  PublishedExit,
  PublishedReview,
  PublishedAnalytics,
} from '../src/types/public';

function isNonEmptyString(val: unknown, maxLen = 100): val is string {
  return typeof val === 'string' && val.trim().length > 0 && val.length <= maxLen;
}

function isOptionalString(val: unknown, maxLen = 2000): val is string | undefined {
  return val === undefined || (typeof val === 'string' && val.length <= maxLen);
}

function isFiniteNumber(val: unknown): val is number {
  return typeof val === 'number' && Number.isFinite(val);
}

function isOptionalFiniteNumber(val: unknown): val is number | undefined {
  return val === undefined || (typeof val === 'number' && Number.isFinite(val));
}

function isValidIsoDate(val: unknown): boolean {
  if (typeof val !== 'string' || val.length > 50) return false;
  const time = Date.parse(val);
  return !Number.isNaN(time);
}

function sanitizeString(str: string): string {
  return str.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
}

/**
 * Validates and sanitizes PublishedJournal payload.
 * Returns { valid: true, data: PublishedJournal } or { valid: false, error: string }
 */
export function validatePublishedJournalPayload(
  payload: unknown
): { valid: true; data: PublishedJournal } | { valid: false; error: string } {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { valid: false, error: 'Payload must be a JSON object' };
  }

  const raw = payload as Record<string, unknown>;

  // Journal name
  if (!isNonEmptyString(raw.journalName, 100)) {
    return { valid: false, error: 'journalName must be a non-empty string under 100 characters' };
  }

  // Bio
  if (!isOptionalString(raw.bio, 1000)) {
    return { valid: false, error: 'bio must be a string under 1000 characters' };
  }

  // Booleans
  if (typeof raw.showBalances !== 'boolean') {
    return { valid: false, error: 'showBalances must be a boolean' };
  }
  if (typeof raw.showPositionSizes !== 'boolean') {
    return { valid: false, error: 'showPositionSizes must be a boolean' };
  }
  if (typeof raw.includeReviews !== 'boolean') {
    return { valid: false, error: 'includeReviews must be a boolean' };
  }

  // Accounts
  if (!Array.isArray(raw.accounts)) {
    return { valid: false, error: 'accounts must be an array' };
  }
  if (raw.accounts.length > 100) {
    return { valid: false, error: 'accounts array exceeds maximum limit of 100 items' };
  }

  const accounts: PublishedAccount[] = [];
  for (let i = 0; i < raw.accounts.length; i++) {
    const acc = raw.accounts[i];
    if (!acc || typeof acc !== 'object') {
      return { valid: false, error: `accounts[${i}] must be an object` };
    }
    if (!isNonEmptyString(acc.id, 100)) {
      return { valid: false, error: `accounts[${i}].id must be a valid string` };
    }
    if (!isNonEmptyString(acc.name, 100)) {
      return { valid: false, error: `accounts[${i}].name must be a valid string` };
    }
    if (!isNonEmptyString(acc.currency, 10)) {
      return { valid: false, error: `accounts[${i}].currency must be a valid string` };
    }
    if (!isOptionalFiniteNumber(acc.initialBalance) || !isOptionalFiniteNumber(acc.currentBalance)) {
      return { valid: false, error: `accounts[${i}] balance numbers must be finite` };
    }

    accounts.push({
      id: sanitizeString(acc.id),
      name: sanitizeString(acc.name),
      currency: sanitizeString(acc.currency),
      initialBalance: acc.initialBalance,
      currentBalance: acc.currentBalance,
    });
  }

  // Plans
  if (!Array.isArray(raw.plans)) {
    return { valid: false, error: 'plans must be an array' };
  }
  if (raw.plans.length > 5000) {
    return { valid: false, error: 'plans array exceeds maximum limit of 5000 items' };
  }

  const validPlanStatuses = new Set(['PLANNED', 'TRIGGERED', 'NOT_TRIGGERED', 'INVALID', 'ARCHIVED']);
  const plans: PublishedPlan[] = [];
  for (let i = 0; i < raw.plans.length; i++) {
    const p = raw.plans[i];
    if (!p || typeof p !== 'object') {
      return { valid: false, error: `plans[${i}] must be an object` };
    }
    if (!isNonEmptyString(p.id, 100) || !isNonEmptyString(p.accountId, 100) || !isNonEmptyString(p.symbol, 50)) {
      return { valid: false, error: `plans[${i}] requires valid id, accountId, and symbol` };
    }
    if (p.direction !== 'BUY' && p.direction !== 'SELL') {
      return { valid: false, error: `plans[${i}].direction must be BUY or SELL` };
    }
    if (!isFiniteNumber(p.plannedEntry)) {
      return { valid: false, error: `plans[${i}].plannedEntry must be a finite number` };
    }
    if (!isOptionalFiniteNumber(p.sl) || !isOptionalFiniteNumber(p.tp) || !isOptionalFiniteNumber(p.plannedRiskReward)) {
      return { valid: false, error: `plans[${i}] price targets must be finite numbers` };
    }
    if (!validPlanStatuses.has(p.status as string)) {
      return { valid: false, error: `plans[${i}].status is invalid` };
    }
    if (!isValidIsoDate(p.createdAt)) {
      return { valid: false, error: `plans[${i}].createdAt must be a valid date` };
    }

    plans.push({
      id: sanitizeString(p.id),
      accountId: sanitizeString(p.accountId),
      symbol: sanitizeString(p.symbol),
      direction: p.direction,
      plannedEntry: p.plannedEntry,
      sl: p.sl,
      tp: p.tp,
      plannedRiskReward: p.plannedRiskReward,
      timeframe: p.timeframe ? sanitizeString(String(p.timeframe).slice(0, 50)) : undefined,
      setupName: p.setupName ? sanitizeString(String(p.setupName).slice(0, 100)) : undefined,
      marketBias: (['BULLISH', 'BEARISH', 'NEUTRAL'].includes(p.marketBias) ? p.marketBias : undefined),
      entryReason: p.entryReason ? sanitizeString(String(p.entryReason).slice(0, 2000)) : undefined,
      invalidReason: p.invalidReason ? sanitizeString(String(p.invalidReason).slice(0, 2000)) : undefined,
      status: p.status,
      createdAt: p.createdAt,
    });
  }

  // Trades
  if (!Array.isArray(raw.trades)) {
    return { valid: false, error: 'trades must be an array' };
  }
  if (raw.trades.length > 10000) {
    return { valid: false, error: 'trades array exceeds maximum limit of 10000 items' };
  }

  const validTradeStatuses = new Set(['ACTIVE', 'COMPLETED']);
  const validTradeResults = new Set(['PROFIT', 'LOSS', 'BEP']);
  const trades: PublishedTrade[] = [];

  for (let i = 0; i < raw.trades.length; i++) {
    const t = raw.trades[i];
    if (!t || typeof t !== 'object') {
      return { valid: false, error: `trades[${i}] must be an object` };
    }
    if (!isNonEmptyString(t.id, 100) || !isNonEmptyString(t.accountId, 100) || !isNonEmptyString(t.symbol, 50)) {
      return { valid: false, error: `trades[${i}] requires valid id, accountId, and symbol` };
    }
    if (t.direction !== 'BUY' && t.direction !== 'SELL') {
      return { valid: false, error: `trades[${i}].direction must be BUY or SELL` };
    }
    if (!isFiniteNumber(t.actualEntry) || !isFiniteNumber(t.realizedPnL)) {
      return { valid: false, error: `trades[${i}] actualEntry and realizedPnL must be finite numbers` };
    }
    if (!isOptionalFiniteNumber(t.actualPositionSize) || !isOptionalFiniteNumber(t.initialStopLoss) || !isOptionalFiniteNumber(t.takeProfit) || !isOptionalFiniteNumber(t.realizedRMultiple)) {
      return { valid: false, error: `trades[${i}] optional numeric values must be finite` };
    }
    if (!validTradeStatuses.has(t.status as string)) {
      return { valid: false, error: `trades[${i}].status must be ACTIVE or COMPLETED` };
    }
    if (t.result !== undefined && !validTradeResults.has(t.result as string)) {
      return { valid: false, error: `trades[${i}].result must be PROFIT, LOSS, or BEP` };
    }
    if (!isValidIsoDate(t.actualEntryTime)) {
      return { valid: false, error: `trades[${i}].actualEntryTime must be a valid date` };
    }
    if (t.completedAt !== undefined && !isValidIsoDate(t.completedAt)) {
      return { valid: false, error: `trades[${i}].completedAt must be a valid date` };
    }

    // Exits
    const exits: PublishedExit[] = [];
    if (Array.isArray(t.exits)) {
      if (t.exits.length > 50) {
        return { valid: false, error: `trades[${i}].exits exceeds limit of 50 exits` };
      }
      for (let j = 0; j < t.exits.length; j++) {
        const ex = t.exits[j];
        if (!ex || typeof ex !== 'object') {
          return { valid: false, error: `trades[${i}].exits[${j}] must be an object` };
        }
        if (!isNonEmptyString(ex.id, 100) || !isNonEmptyString(ex.exitType, 50)) {
          return { valid: false, error: `trades[${i}].exits[${j}] invalid id or exitType` };
        }
        if (!isFiniteNumber(ex.price) || !isFiniteNumber(ex.realizedPnL)) {
          return { valid: false, error: `trades[${i}].exits[${j}] price and realizedPnL must be finite numbers` };
        }
        if (!isOptionalFiniteNumber(ex.closedSize)) {
          return { valid: false, error: `trades[${i}].exits[${j}].closedSize must be finite` };
        }
        if (!isValidIsoDate(ex.executedAt)) {
          return { valid: false, error: `trades[${i}].exits[${j}].executedAt must be a valid date` };
        }
        exits.push({
          id: sanitizeString(ex.id),
          exitType: sanitizeString(ex.exitType),
          price: ex.price,
          closedSize: ex.closedSize,
          realizedPnL: ex.realizedPnL,
          executedAt: ex.executedAt,
          notes: ex.notes ? sanitizeString(String(ex.notes).slice(0, 1000)) : undefined,
        });
      }
    }

    // Review
    let review: PublishedReview | undefined = undefined;
    if (t.review && typeof t.review === 'object') {
      const rev = t.review as Record<string, unknown>;
      const followedPlan = ['YES', 'PARTIALLY', 'NO'].includes(rev.followedPlan as string)
        ? (rev.followedPlan as 'YES' | 'PARTIALLY' | 'NO')
        : undefined;

      review = {
        followedPlan,
        whatHappened: rev.whatHappened ? sanitizeString(String(rev.whatHappened).slice(0, 2000)) : undefined,
        whatWentWell: rev.whatWentWell ? sanitizeString(String(rev.whatWentWell).slice(0, 2000)) : undefined,
        whatCouldImprove: rev.whatCouldImprove ? sanitizeString(String(rev.whatCouldImprove).slice(0, 2000)) : undefined,
        lessonLearned: rev.lessonLearned ? sanitizeString(String(rev.lessonLearned).slice(0, 2000)) : undefined,
        notes: rev.notes ? sanitizeString(String(rev.notes).slice(0, 2000)) : undefined,
      };
    }

    trades.push({
      id: sanitizeString(t.id),
      accountId: sanitizeString(t.accountId),
      planId: t.planId ? sanitizeString(String(t.planId).slice(0, 100)) : undefined,
      symbol: sanitizeString(t.symbol),
      direction: t.direction,
      actualEntry: t.actualEntry,
      actualEntryTime: t.actualEntryTime,
      actualPositionSize: t.actualPositionSize,
      initialStopLoss: t.initialStopLoss,
      takeProfit: t.takeProfit,
      plannedRiskReward: t.plannedRiskReward,
      status: t.status,
      result: t.result,
      realizedPnL: t.realizedPnL,
      realizedRMultiple: t.realizedRMultiple,
      completedAt: t.completedAt,
      setupName: t.setupName ? sanitizeString(String(t.setupName).slice(0, 100)) : undefined,
      exits,
      review,
    });
  }

  // Analytics
  if (!raw.analytics || typeof raw.analytics !== 'object') {
    return { valid: false, error: 'analytics must be an object' };
  }
  const an = raw.analytics as Record<string, unknown>;
  const analyticsNumFields = [
    'totalTrades',
    'winningTrades',
    'losingTrades',
    'bepTrades',
    'winRate',
    'netPnL',
    'profitFactor',
    'averageWin',
    'averageLoss',
    'expectancy',
    'averageR',
    'maxDrawdown',
  ];

  for (const field of analyticsNumFields) {
    if (!isFiniteNumber(an[field])) {
      return { valid: false, error: `analytics.${field} must be a finite number` };
    }
  }

  const analytics: PublishedAnalytics = {
    totalTrades: Math.max(0, Math.round(Number(an.totalTrades))),
    winningTrades: Math.max(0, Math.round(Number(an.winningTrades))),
    losingTrades: Math.max(0, Math.round(Number(an.losingTrades))),
    bepTrades: Math.max(0, Math.round(Number(an.bepTrades))),
    winRate: Math.min(100, Math.max(0, Number(an.winRate))),
    netPnL: Number(an.netPnL),
    profitFactor: Math.max(0, Number(an.profitFactor)),
    averageWin: Number(an.averageWin),
    averageLoss: Number(an.averageLoss),
    expectancy: Number(an.expectancy),
    averageR: Number(an.averageR),
    maxDrawdown: Number(an.maxDrawdown),
  };

  const id = isNonEmptyString(raw.id, 100) ? sanitizeString(raw.id) : `pub_${Date.now()}`;
  const nowIso = new Date().toISOString();
  const publishedAt = isValidIsoDate(raw.publishedAt) ? String(raw.publishedAt) : nowIso;
  const updatedAt = nowIso;

  const sanitizedJournal: PublishedJournal = {
    id,
    isPublished: true,
    publishedAt,
    updatedAt,
    journalName: sanitizeString(raw.journalName),
    bio: raw.bio ? sanitizeString(raw.bio) : undefined,
    showBalances: raw.showBalances,
    showPositionSizes: raw.showPositionSizes,
    includeReviews: raw.includeReviews,
    accounts,
    plans,
    trades,
    analytics,
  };

  return { valid: true, data: sanitizedJournal };
}
