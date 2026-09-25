import type {
  Account,
  Plan,
  Trade,
  Exit,
  TradeReview,
  Setup,
  PublishedJournal,
  PublishOptions,
  PublishedAccount,
  PublishedPlan,
  PublishedTrade,
  PublishedExit,
  PublishedReview,
  PublishedAnalytics,
} from '../types';
import {
  calculateWinRate,
  calculateProfitFactor,
  calculateExpectancyAndR,
  calculateDrawdown,
  calculateCurrentBalance,
} from '../calculations';

const PUBLIC_JOURNAL_CACHE_KEY = 'tb_public_journal_cache';

/**
 * Fetch the latest published snapshot for public visitors.
 * Does NOT require authentication.
 * Includes automatic retry with backoff and local cache fallback
 * to gracefully handle server restarts, cold starts, and offline usage.
 */
export async function fetchPublicJournal(
  retries = 2,
  delayMs = 400
): Promise<{
  isPublished: boolean;
  journal?: PublishedJournal;
  message?: string;
}> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const res = await fetch('/api/public/journal', {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
        },
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        if (res.status === 404) {
          return { isPublished: false, message: 'No public journal published yet.' };
        }
        return { isPublished: false, message: 'Failed to load public journal' };
      }

      const data = await res.json();
      if (data && data.isPublished && data.journal) {
        // Cache in localStorage for offline resilience
        try {
          localStorage.setItem(PUBLIC_JOURNAL_CACHE_KEY, JSON.stringify(data.journal));
        } catch {
          // Ignore storage quota/disabled errors
        }
      } else {
        try {
          localStorage.removeItem(PUBLIC_JOURNAL_CACHE_KEY);
        } catch {
          // Ignore
        }
      }

      return data;
    } catch (err: unknown) {
      // If we have retries remaining, wait with exponential backoff and retry
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, delayMs * (attempt + 1)));
        continue;
      }

      // After retries exhausted, check if we have a locally cached version
      try {
        const cachedRaw = localStorage.getItem(PUBLIC_JOURNAL_CACHE_KEY);
        if (cachedRaw) {
          const cachedJournal = JSON.parse(cachedRaw) as PublishedJournal;
          if (cachedJournal && cachedJournal.isPublished) {
            console.info('Serving public journal from offline local cache');
            return {
              isPublished: true,
              journal: cachedJournal,
              message: 'Viewing cached public journal (server unavailable)',
            };
          }
        }
      } catch {
        // Ignore cache parse errors
      }

      // Log non-fatal warning instead of console.error to avoid false-positive error triggers on cold starts
      console.warn('Unable to reach public journal endpoint (offline or server starting):', err);
      return { isPublished: false, message: 'Public journal unavailable offline' };
    }
  }

  return { isPublished: false, message: 'Unable to reach public journal' };
}

/**
 * Sanitize and bundle private data into a clean, safe public snapshot and publish it.
 * Requires admin authentication.
 */
export async function publishJournalSnapshot(
  data: {
    accounts: Account[];
    plans: Plan[];
    trades: Trade[];
    exits: Exit[];
    reviews: TradeReview[];
    setups: Setup[];
  },
  options: PublishOptions
): Promise<{ success: boolean; error?: string; publishedAt?: string }> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // 1. Filter accounts
    const targetAccounts = options.accountIds.includes('ALL')
      ? data.accounts
      : data.accounts.filter((a) => options.accountIds.includes(a.id));

    const targetAccountIds = new Set(targetAccounts.map((a) => a.id));

    // 2. Prepare Published Accounts
    const publishedAccounts: PublishedAccount[] = targetAccounts.map((acc) => {
      const accTrades = data.trades.filter((t) => t.accountId === acc.id);
      const balanceCalc = calculateCurrentBalance(acc.startingBalance, accTrades);

      return {
        id: acc.id,
        name: acc.name,
        currency: acc.currency,
        initialBalance: options.showBalances ? acc.startingBalance : undefined,
        currentBalance: options.showBalances ? balanceCalc.currentBalance : undefined,
      };
    });

    // 3. Setup, Review, and Plan lookup maps
    const setupMap = new Map(data.setups.map((s) => [s.id, s.name]));
    const reviewMap = new Map(data.reviews.map((r) => [r.tradeId, r]));
    const planMap = new Map(data.plans.map((p) => [p.id, p]));

    // 4. Filter and sanitize Trades
    const filteredTrades = data.trades.filter((t) => {
      if (!targetAccountIds.has(t.accountId)) return false;
      if (!options.includeActiveTrades && t.status === 'ACTIVE') return false;
      return true;
    });

    const publishedTrades: PublishedTrade[] = filteredTrades.map((t) => {
      const linkedPlan = planMap.get(t.planId);

      const tradeExits: PublishedExit[] = data.exits
        .filter((e) => e.tradeId === t.id)
        .map((e) => ({
          id: e.id,
          exitType: e.exitType,
          price: e.price,
          closedSize: options.showPositionSizes ? e.closedSize : undefined,
          realizedPnL: e.realizedPnL,
          executedAt: e.executedAt,
          notes: e.notes || undefined,
        }));

      let publishedReview: PublishedReview | undefined = undefined;
      if (options.includeReviews) {
        const rev = reviewMap.get(t.id);
        if (rev) {
          publishedReview = {
            followedPlan: rev.followedPlan,
            whatHappened: rev.whatHappened,
            whatWentWell: rev.whatWentWell,
            whatCouldImprove: rev.whatCouldImprove,
            lessonLearned: rev.lessonLearned,
            notes: rev.notes,
          };
        }
      }

      // Calculate planned risk:reward ratio if SL and TP exist
      let plannedRiskReward: number | undefined = undefined;
      if (linkedPlan?.sl && linkedPlan?.tp && linkedPlan.plannedEntry) {
        const riskDistance = Math.abs(linkedPlan.plannedEntry - linkedPlan.sl);
        const rewardDistance = Math.abs(linkedPlan.tp - linkedPlan.plannedEntry);
        if (riskDistance > 0) {
          plannedRiskReward = Number((rewardDistance / riskDistance).toFixed(2));
        }
      }

      // Calculate realized R-Multiple if risk is known
      let realizedRMultiple: number | undefined = undefined;
      if (t.realizedPnL !== null && linkedPlan?.risk && linkedPlan.risk > 0) {
        realizedRMultiple = Number((t.realizedPnL / linkedPlan.risk).toFixed(2));
      }

      return {
        id: t.id,
        accountId: t.accountId,
        planId: t.planId,
        symbol: linkedPlan?.symbol || 'UNKNOWN',
        direction: linkedPlan?.direction || 'BUY',
        actualEntry: t.actualEntry,
        actualEntryTime: t.actualEntryTime,
        actualPositionSize: options.showPositionSizes ? t.actualPositionSize : undefined,
        initialStopLoss: linkedPlan?.sl,
        takeProfit: linkedPlan?.tp,
        plannedRiskReward,
        status: t.status,
        result: t.result,
        realizedPnL: t.realizedPnL || 0,
        realizedRMultiple,
        completedAt: t.completedAt,
        setupName: linkedPlan?.setupId ? setupMap.get(linkedPlan.setupId) : undefined,
        exits: tradeExits,
        review: publishedReview,
      };
    });

    // 5. Filter and sanitize Plans
    const filteredPlans = data.plans.filter((p) => {
      if (!targetAccountIds.has(p.accountId)) return false;
      if (!options.includePlannedPlans && p.status === 'PLANNED') return false;
      return true;
    });

    const publishedPlans: PublishedPlan[] = filteredPlans.map((p) => {
      let plannedRiskReward: number | undefined = undefined;
      if (p.sl && p.tp && p.plannedEntry) {
        const riskDistance = Math.abs(p.plannedEntry - p.sl);
        const rewardDistance = Math.abs(p.tp - p.plannedEntry);
        if (riskDistance > 0) {
          plannedRiskReward = Number((rewardDistance / riskDistance).toFixed(2));
        }
      }

      return {
        id: p.id,
        accountId: p.accountId,
        symbol: p.symbol,
        direction: p.direction,
        plannedEntry: p.plannedEntry,
        sl: p.sl,
        tp: p.tp,
        plannedRiskReward,
        timeframe: p.timeframe,
        setupName: p.setupId ? setupMap.get(p.setupId) : undefined,
        marketBias: p.marketBias,
        entryReason: p.entryReason,
        invalidReason: p.invalidReason,
        status: p.status,
        createdAt: p.createdAt,
      };
    });

    // 6. Calculate Published Analytics
    const completedFilteredTrades = filteredTrades.filter(
      (t) => t.status === 'COMPLETED' && t.realizedPnL !== null
    );

    const winRateData = calculateWinRate(filteredTrades);
    const profitFactor = calculateProfitFactor(filteredTrades);
    const expAndR = calculateExpectancyAndR(filteredTrades, data.plans);

    // Build equity curve for drawdown calculation
    let runningNet = 0;
    const equityPoints = [0];
    completedFilteredTrades.forEach((t) => {
      runningNet += t.realizedPnL || 0;
      equityPoints.push(runningNet);
    });
    const ddData = calculateDrawdown(equityPoints);

    const totalNetPnL = completedFilteredTrades.reduce((acc, t) => acc + (t.realizedPnL || 0), 0);

    const publishedAnalytics: PublishedAnalytics = {
      totalTrades: completedFilteredTrades.length,
      winningTrades: winRateData.wins,
      losingTrades: winRateData.losses,
      bepTrades: winRateData.beps,
      winRate: winRateData.winRate,
      netPnL: totalNetPnL,
      profitFactor,
      averageWin: expAndR.averageWin,
      averageLoss: expAndR.averageLoss,
      expectancy: expAndR.expectancy,
      averageR: expAndR.averageR,
      maxDrawdown: ddData.maxDrawdownPercent,
    };

    // 7. Build final published container
    const publishedJournal: PublishedJournal = {
      id: 'published_journal',
      isPublished: true,
      publishedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      journalName: options.journalName || 'Tradebook Public Journal',
      bio: options.bio || 'Transparent trading journal and performance analytics.',
      showBalances: options.showBalances,
      showPositionSizes: options.showPositionSizes,
      includeReviews: options.includeReviews,
      accounts: publishedAccounts,
      plans: publishedPlans,
      trades: publishedTrades,
      analytics: publishedAnalytics,
    };

    // 8. Send to server
    const res = await fetch('/api/admin/publish', {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify(publishedJournal),
    });

    const resData = await res.json();
    if (!res.ok || !resData.success) {
      return { success: false, error: resData.error || 'Failed to publish journal' };
    }

    try {
      localStorage.setItem(PUBLIC_JOURNAL_CACHE_KEY, JSON.stringify(publishedJournal));
    } catch {
      // Ignore cache write error
    }

    return {
      success: true,
      publishedAt: resData.publishedAt,
    };
  } catch (err) {
    console.error('Publish error:', err);
    return {
      success: false,
      error: 'Cannot connect to server. Please check your internet connection to publish.',
    };
  }
}

/**
 * Unpublishes the journal (makes public view show "No public journal published yet").
 */
export async function unpublishJournalSnapshot(): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch('/api/admin/unpublish', {
      method: 'POST',
      credentials: 'include',
    });

    const resData = await res.json();
    if (!res.ok || !resData.success) {
      return { success: false, error: resData.error || 'Failed to unpublish journal' };
    }

    try {
      localStorage.removeItem(PUBLIC_JOURNAL_CACHE_KEY);
    } catch {
      // Ignore
    }

    return { success: true };
  } catch (err) {
    console.error('Unpublish error:', err);
    return { success: false, error: 'Network error while unpublishing' };
  }
}
