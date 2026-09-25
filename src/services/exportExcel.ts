import * as XLSX from 'xlsx';
import { db } from '../db/database';
import {
  calculateDailyPnL,
  calculateSetupPerformance,
  calculateExitStatistics,
  calculateCurrentBalance,
} from '../calculations';

export async function exportToExcel(): Promise<void> {
  const [
    accounts,
    accountPhases,
    propFirmRules,
    plans,
    trades,
    exits,
    reviews,
    setups,
    transactions,
  ] = await Promise.all([
    db.accounts.toArray(),
    db.accountPhases.toArray(),
    db.propFirmRules.toArray(),
    db.plans.toArray(),
    db.trades.toArray(),
    db.exits.toArray(),
    db.reviews.toArray(),
    db.setups.toArray(),
    db.transactions.toArray(),
  ]);

  const wb = XLSX.utils.book_new();

  // 1. Account Summary
  const accountSummaryData = accounts.map((acc) => {
    const accTrades = trades.filter((t) => t.accountId === acc.id);
    const accTxs = transactions.filter((tx) => tx.accountId === acc.id);
    const bal = calculateCurrentBalance(acc.startingBalance, accTrades, accTxs);
    return {
      'Account ID': acc.id,
      'Account Name': acc.name,
      Type: acc.type,
      Currency: acc.currency,
      'Starting Balance': acc.startingBalance,
      'Current Balance': Number(bal.currentBalance.toFixed(2)),
      'Net Trading P&L': Number(bal.totalRealizedPnL.toFixed(2)),
      Deposits: bal.totalDeposits,
      Withdrawals: bal.totalWithdrawals,
      Fees: bal.totalFees,
      Status: acc.status,
      Notes: acc.notes || '',
    };
  });
  const wsAccounts = XLSX.utils.json_to_sheet(accountSummaryData);
  XLSX.utils.book_append_sheet(wb, wsAccounts, 'Account Summary');

  // 2. Daily Performance
  const dailyPnLMap = calculateDailyPnL(trades, plans);
  const dailyData = Array.from(dailyPnLMap.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, stats]) => ({
      Date: date,
      'Realized P&L': stats.pnl,
      'Completed Trades': stats.tradesCount,
      Wins: stats.wins,
      Losses: stats.losses,
      BEPs: stats.beps,
      'Plans Created': stats.plansCount,
    }));
  const wsDaily = XLSX.utils.json_to_sheet(dailyData.length ? dailyData : [{ Date: 'No trading data' }]);
  XLSX.utils.book_append_sheet(wb, wsDaily, 'Daily Performance');

  // 3. Plans
  const plansData = plans.map((p) => ({
    'Plan ID': p.id,
    'Account ID': p.accountId,
    Symbol: p.symbol,
    Direction: p.direction,
    'Planned Entry': p.plannedEntry,
    SL: p.sl ?? '',
    TP: p.tp ?? '',
    'Position Size': p.positionSize ?? '',
    Risk: p.risk ?? '',
    Status: p.status,
    'Market Bias': p.marketBias ?? '',
    Timeframe: p.timeframe ?? '',
    Confidence: p.confidence ?? '',
    'Entry Reason': p.entryReason ?? '',
    'Invalid Reason': p.invalidReason ?? '',
    'Not Triggered Reason': p.notTriggeredReason ?? '',
    'Created At': p.createdAt,
  }));
  const wsPlans = XLSX.utils.json_to_sheet(plansData.length ? plansData : [{ Info: 'No plans recorded' }]);
  XLSX.utils.book_append_sheet(wb, wsPlans, 'Plans');

  // 4. Trades
  const tradesData = trades.map((t) => ({
    'Trade ID': t.id,
    'Plan ID': t.planId,
    'Account ID': t.accountId,
    'Actual Entry': t.actualEntry,
    'Actual Entry Time': t.actualEntryTime,
    'Actual Size': t.actualPositionSize,
    Status: t.status,
    'Realized P&L': t.realizedPnL,
    Result: t.result ?? '',
    'Completed At': t.completedAt ?? '',
    Notes: t.notes ?? '',
  }));
  const wsTrades = XLSX.utils.json_to_sheet(tradesData.length ? tradesData : [{ Info: 'No trades recorded' }]);
  XLSX.utils.book_append_sheet(wb, wsTrades, 'Trades');

  // 5. Exits
  const exitsData = exits.map((e) => ({
    'Exit ID': e.id,
    'Trade ID': e.tradeId,
    'Executed At': e.executedAt,
    Price: e.price,
    'Closed Size': e.closedSize,
    'Exit Type': e.exitType,
    'Realized P&L': e.realizedPnL,
    Reason: e.reason ?? '',
  }));
  const wsExits = XLSX.utils.json_to_sheet(exitsData.length ? exitsData : [{ Info: 'No exits recorded' }]);
  XLSX.utils.book_append_sheet(wb, wsExits, 'Exits');

  // 6. Reviews
  const reviewsData = reviews.map((r) => ({
    'Review ID': r.id,
    'Trade ID': r.tradeId,
    'Followed Plan': r.followedPlan,
    'What Happened': r.whatHappened ?? '',
    'What Went Well': r.whatWentWell ?? '',
    'What Could Improve': r.whatCouldImprove ?? '',
    'Lesson Learned': r.lessonLearned ?? '',
    'Created At': r.createdAt,
  }));
  const wsReviews = XLSX.utils.json_to_sheet(reviewsData.length ? reviewsData : [{ Info: 'No reviews recorded' }]);
  XLSX.utils.book_append_sheet(wb, wsReviews, 'Reviews');

  // 7. Setup Analysis
  const setupPerformance = calculateSetupPerformance(plans, trades, setups);
  const setupData = setupPerformance.map((s) => ({
    'Setup Name': s.setupName,
    Category: s.category ?? '',
    'Plans Count': s.plansCount,
    'Triggered Count': s.triggeredCount,
    'Completed Trades': s.tradesCount,
    'Win Rate (%)': s.winRate,
    'Net P&L': s.netPnL,
  }));
  const wsSetups = XLSX.utils.json_to_sheet(setupData.length ? setupData : [{ Info: 'No setup analysis' }]);
  XLSX.utils.book_append_sheet(wb, wsSetups, 'Setup Analysis');

  // 8. Exit Analysis
  const exitStats = calculateExitStatistics(exits);
  const exitStatsData = Object.entries(exitStats).map(([exitType, count]) => ({
    'Exit Type': exitType,
    Frequency: count,
  }));
  const wsExitStats = XLSX.utils.json_to_sheet(exitStatsData);
  XLSX.utils.book_append_sheet(wb, wsExitStats, 'Exit Analysis');

  // 9. Prop Firm Rules
  const propRulesData = propFirmRules.map((r) => ({
    'Rule ID': r.id,
    'Account ID': r.accountId,
    Category: r.category,
    'Rule Name': r.ruleName,
    'Limit Value': r.limitValue ?? '',
    Unit: r.unit ?? '',
    Enabled: r.enabled ? 'YES' : 'NO',
  }));
  const wsPropRules = XLSX.utils.json_to_sheet(propRulesData.length ? propRulesData : [{ Info: 'No prop firm rules' }]);
  XLSX.utils.book_append_sheet(wb, wsPropRules, 'Prop Firm Rules');

  // 10. Transactions
  const txData = transactions.map((tx) => ({
    'Transaction ID': tx.id,
    'Account ID': tx.accountId,
    Type: tx.type,
    Amount: tx.amount,
    Date: tx.date,
    Notes: tx.notes ?? '',
  }));
  const wsTx = XLSX.utils.json_to_sheet(txData.length ? txData : [{ Info: 'No transactions recorded' }]);
  XLSX.utils.book_append_sheet(wb, wsTx, 'Transactions');

  // 11. Data Dictionary
  const dictionaryData = [
    { Term: 'PLAN', Definition: 'Trading intent and parameters prior to actual execution. Saved separately from Trade.' },
    { Term: 'TRADE', Definition: 'Actual execution triggered from a Plan with real fill price and size.' },
    { Term: 'NOT_TRIGGERED', Definition: 'Price never reached planned entry before trade setup passed.' },
    { Term: 'INVALID', Definition: 'Plan invalidated due to structure change, news, or cancellation before entry.' },
    { Term: 'EXIT TYPE', Definition: 'Categorization of exit execution (FULL_TP, CUT_PROFIT, FULL_SL, CUT_LOSS, BEP, PARTIAL).' },
    { Term: 'RESULT', Definition: 'Mathematical outcome strictly based on realized P&L: PROFIT (>0), LOSS (<0), BEP (===0).' },
    { Term: 'LOCAL-FIRST', Definition: 'Primary database resides in browser IndexedDB. No backend required.' },
    { Term: '.tjbackup', Definition: 'Encrypted or plain portable container for full journal backup and recovery.' },
  ];
  const wsDict = XLSX.utils.json_to_sheet(dictionaryData);
  XLSX.utils.book_append_sheet(wb, wsDict, 'Data Dictionary');

  // Write and trigger download
  const dateStr = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `Tradebook-Report-${dateStr}.xlsx`);
}
