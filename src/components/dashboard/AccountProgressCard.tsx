import React from 'react';
import type { Account, Trade, PropFirmRule, Transaction } from '../../types';
import {
  calculateCurrentBalance,
  calculateWinRate,
  calculateDrawdown,
  evaluateRuleStatus,
  formatMoney,
  formatSignedMoney,
} from '../../calculations';
import { formatAccountType } from '../../utils/accountScope';
import { Target, Calendar, ShieldCheck, AlertTriangle, XCircle, Info } from 'lucide-react';

interface AccountProgressCardProps {
  account: Account;
  trades: Trade[];
  rules: PropFirmRule[];
  transactions: Transaction[];
}

export function AccountProgressCard({
  account,
  trades,
  rules,
  transactions,
}: AccountProgressCardProps) {
  const currency = account.currency || 'USD';
  const accTrades = trades.filter((t) => t.accountId === account.id);
  const accTxs = transactions.filter((tx) => tx.accountId === account.id);

  // Compute balance and return
  const balanceState = calculateCurrentBalance(account.startingBalance, accTrades, accTxs);
  const winRateStats = calculateWinRate(accTrades);

  const completedTrades = accTrades
    .filter((t) => t.status === 'COMPLETED' && t.realizedPnL !== null)
    .sort((a, b) =>
      (a.completedAt || a.actualEntryTime || '').localeCompare(
        b.completedAt || b.actualEntryTime || ''
      )
    );

  let running = 0;
  const equityCurve = [0];
  for (const t of completedTrades) {
    running += t.realizedPnL ?? 0;
    equityCurve.push(running);
  }
  const drawdownStats = calculateDrawdown(equityCurve);

  const netPnL = balanceState.totalRealizedPnL;
  const returnPercent =
    account.startingBalance > 0
      ? Number(((netPnL / account.startingBalance) * 100).toFixed(2))
      : null;

  // Filter rules for this account
  const accountRules = rules.filter((r) => r.accountId === account.id && r.enabled);

  // Evaluate rules
  const evaluatedRules = accountRules.map((rule) => {
    const evaluation = evaluateRuleStatus(
      rule,
      accTrades,
      balanceState.currentBalance,
      account.startingBalance,
      currency
    );
    return { rule, evaluation };
  });

  return (
    <div className="bg-zinc-900/70 border border-zinc-800 rounded-xl p-4 sm:p-5 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800 pb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700 font-semibold">
              {formatAccountType(account.type)}
            </span>
            <span className="text-[10px] font-mono text-zinc-400">
              Currency: <strong className="text-zinc-200">{currency}</strong>
            </span>
          </div>
          <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
            <span>Account Progress — {account.name}</span>
          </h3>
        </div>
      </div>

      {/* Main Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 font-mono text-xs">
        <div className="p-2.5 bg-zinc-950/80 rounded-lg border border-zinc-800">
          <span className="text-[10px] text-zinc-500 uppercase block">Starting Balance</span>
          <span className="text-sm font-bold text-zinc-200 block mt-0.5">
            {formatMoney(account.startingBalance, currency)}
          </span>
        </div>

        <div className="p-2.5 bg-zinc-950/80 rounded-lg border border-zinc-800">
          <span className="text-[10px] text-zinc-500 uppercase block">Current Balance</span>
          <span className="text-sm font-bold text-zinc-100 block mt-0.5">
            {formatMoney(balanceState.currentBalance, currency)}
          </span>
        </div>

        <div className="p-2.5 bg-zinc-950/80 rounded-lg border border-zinc-800">
          <span className="text-[10px] text-zinc-500 uppercase block">Net P&L</span>
          <span
            className={`text-sm font-bold block mt-0.5 ${
              netPnL > 0
                ? 'text-emerald-400'
                : netPnL < 0
                ? 'text-rose-400'
                : 'text-zinc-300'
            }`}
          >
            {completedTrades.length > 0 ? formatSignedMoney(netPnL, currency) : '—'}
          </span>
        </div>

        <div className="p-2.5 bg-zinc-950/80 rounded-lg border border-zinc-800">
          <span className="text-[10px] text-zinc-500 uppercase block">Return</span>
          <span
            className={`text-sm font-bold block mt-0.5 ${
              returnPercent !== null && returnPercent > 0
                ? 'text-emerald-400'
                : returnPercent !== null && returnPercent < 0
                ? 'text-rose-400'
                : 'text-zinc-300'
            }`}
          >
            {returnPercent !== null && completedTrades.length > 0
              ? `${returnPercent > 0 ? '+' : ''}${returnPercent}%`
              : '—'}
          </span>
        </div>

        <div className="p-2.5 bg-zinc-950/80 rounded-lg border border-zinc-800">
          <span className="text-[10px] text-zinc-500 uppercase block">Trades</span>
          <span className="text-sm font-bold text-zinc-200 block mt-0.5">
            {winRateStats.totalCompleted} settled
          </span>
        </div>

        <div className="p-2.5 bg-zinc-950/80 rounded-lg border border-zinc-800">
          <span className="text-[10px] text-zinc-500 uppercase block">Win Rate</span>
          <span className="text-sm font-bold text-zinc-200 block mt-0.5">
            {winRateStats.totalCompleted > 0 ? `${winRateStats.winRate}%` : '—'}
          </span>
        </div>

        <div className="p-2.5 bg-zinc-950/80 rounded-lg border border-zinc-800">
          <span className="text-[10px] text-zinc-500 uppercase block">Max Drawdown</span>
          <span className="text-sm font-bold text-rose-400 block mt-0.5">
            {completedTrades.length > 0
              ? `-${formatMoney(drawdownStats.maxDrawdown, currency)}`
              : '—'}
          </span>
        </div>
      </div>

      {/* Prop Firm Rule Objectives & Compliance (if configured) */}
      {account.type === 'PROP_FIRM' && (
        <div className="pt-2">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wider font-mono flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-indigo-400" />
              <span>Prop Firm Rule Progress & Guardrails</span>
            </h4>
            <span className="text-[10px] font-mono text-zinc-400">
              Evaluated strictly against configured rules
            </span>
          </div>

          {evaluatedRules.length === 0 ? (
            <div className="p-3 bg-zinc-950/60 rounded-lg border border-zinc-800 text-xs font-mono text-zinc-400 flex items-center gap-2">
              <Info className="w-4 h-4 text-zinc-400 flex-shrink-0" />
              <span>No prop firm rules configured for this account yet.</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {evaluatedRules.map(({ rule, evaluation }) => {
                const isBreached = evaluation.status === 'BREACHED';
                const isWarning = evaluation.status === 'WARNING';
                const isSafe = evaluation.status === 'SAFE';
                const isAchieved = evaluation.achieved === true;
                const isNotConfigured =
                  evaluation.status === 'NOT_CONFIGURED' || evaluation.status === 'UNKNOWN';

                let progressPct: number | null = null;
                if (evaluation.limitValue && evaluation.limitValue > 0) {
                  progressPct = Math.min(
                    100,
                    Math.max(0, Math.round((evaluation.currentValue / evaluation.limitValue) * 100))
                  );
                }

                return (
                  <div
                    key={rule.id}
                    className={`p-3 rounded-lg border font-mono text-xs ${
                      isBreached
                        ? 'bg-rose-950/20 border-rose-800/80 text-rose-300'
                        : isWarning
                        ? 'bg-amber-950/20 border-amber-800/80 text-amber-300'
                        : isAchieved
                        ? 'bg-emerald-950/20 border-emerald-800/80 text-emerald-300'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-semibold text-zinc-200 truncate pr-2">
                        {rule.ruleName}
                      </span>
                      {isBreached ? (
                        <span className="inline-flex items-center gap-1 text-[10px] text-rose-400 font-bold">
                          <XCircle className="w-3 h-3" />
                          <span>Breached</span>
                        </span>
                      ) : isWarning ? (
                        <span className="inline-flex items-center gap-1 text-[10px] text-amber-400 font-bold">
                          <AlertTriangle className="w-3 h-3" />
                          <span>Warning</span>
                        </span>
                      ) : isAchieved ? (
                        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-bold">
                          <ShieldCheck className="w-3 h-3" />
                          <span>Achieved</span>
                        </span>
                      ) : isNotConfigured ? (
                        <span className="text-[10px] text-zinc-400">Not configured</span>
                      ) : (
                        <span className="text-[10px] text-zinc-400">Normal</span>
                      )}
                    </div>

                    <div className="text-[11px] text-zinc-400 mb-2">
                      {isNotConfigured ? '—' : evaluation.displayText}
                    </div>

                    {progressPct !== null && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-zinc-400">
                          <span>Progress</span>
                          <span>{progressPct}%</span>
                        </div>
                        <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              isBreached
                                ? 'bg-rose-500'
                                : isWarning
                                ? 'bg-amber-500'
                                : isAchieved
                                ? 'bg-emerald-400'
                                : 'bg-indigo-500'
                            }`}
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
