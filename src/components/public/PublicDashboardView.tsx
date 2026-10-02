import {
  TrendingUp,
  Award,
  BarChart2,
  Percent,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Wallet,
} from 'lucide-react';
import type { PublishedJournal, PublishedTrade } from '../../types/public';
import { formatMoney } from '../../calculations';

interface PublicDashboardViewProps {
  journal: PublishedJournal;
  selectedAccountId: string;
  onTradeClick: (trade: PublishedTrade) => void;
  onViewAllTrades: () => void;
  onViewAllPlans: () => void;
}

export function PublicDashboardView({
  journal,
  selectedAccountId,
  onTradeClick,
  onViewAllTrades,
  onViewAllPlans,
}: PublicDashboardViewProps) {
  const { analytics, accounts, trades, plans, showBalances } = journal;

  // Filter accounts if selected
  const filteredAccounts = selectedAccountId === 'ALL'
    ? accounts
    : accounts.filter((a) => a.id === selectedAccountId);

  // Filter trades
  const filteredTrades = selectedAccountId === 'ALL'
    ? trades
    : trades.filter((t) => t.accountId === selectedAccountId);

  // Filter plans
  const filteredPlans = selectedAccountId === 'ALL'
    ? plans
    : plans.filter((p) => p.accountId === selectedAccountId);

  const completedTrades = filteredTrades.filter((t) => t.status === 'COMPLETED');
  const recentTrades = completedTrades.slice(0, 5);
  const activePlans = filteredPlans.filter((p) => p.status === 'PLANNED').slice(0, 4);

  // Currency
  const defaultCurrency = accounts[0]?.currency || 'USD';

  return (
    <div className="space-y-6">
      {/* Bio / Description banner if present */}
      {journal.bio && (
        <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-300 leading-relaxed">
          {journal.bio}
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Realized Net P&L */}
        <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 shadow-xs">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-medium">Realized Net P&L</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div
            className={`text-xl sm:text-2xl font-bold font-mono ${
              completedTrades.length === 0
                ? 'text-zinc-400'
                : analytics.netPnL >= 0
                ? 'text-emerald-400'
                : 'text-rose-400'
            }`}
          >
            {completedTrades.length > 0 ? (
              <>
                {analytics.netPnL >= 0 ? '+' : ''}
                {formatMoney(analytics.netPnL, defaultCurrency)}
              </>
            ) : (
              '—'
            )}
          </div>
          <span className="text-[11px] text-zinc-500 mt-1 block">
            Across {completedTrades.length} closed trades
          </span>
        </div>

        {/* Win Rate */}
        <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 shadow-xs">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-medium">Win Rate</span>
            <Percent className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-zinc-100">
            {completedTrades.length > 0 ? `${analytics.winRate.toFixed(1)}%` : '—'}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-zinc-500 mt-1 font-mono">
            <span className="text-emerald-400">{analytics.winningTrades}W</span>
            <span>·</span>
            <span className="text-rose-400">{analytics.losingTrades}L</span>
            <span>·</span>
            <span className="text-zinc-400">{analytics.bepTrades}BEP</span>
          </div>
        </div>

        {/* Profit Factor */}
        <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 shadow-xs">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-medium">Profit Factor</span>
            <Award className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-zinc-100">
            {completedTrades.length > 0 && analytics.profitFactor ? analytics.profitFactor.toFixed(2) : '—'}
          </div>
          <span className="text-[11px] text-zinc-500 mt-1 block">
            Exp: {completedTrades.length > 0 ? (analytics.expectancy >= 0 ? '+' : '') + formatMoney(analytics.expectancy, defaultCurrency) : '—'}
          </span>
        </div>

        {/* Average R-Multiple */}
        <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 shadow-xs">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-medium">Average R</span>
            <BarChart2 className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-zinc-100">
            {completedTrades.length > 0 ? (
              <>
                {analytics.averageR >= 0 ? '+' : ''}
                {analytics.averageR.toFixed(2)}R
              </>
            ) : (
              '—'
            )}
          </div>
          <span className="text-[11px] text-zinc-500 mt-1 block">
            Max DD: {completedTrades.length > 0 && analytics.maxDrawdown ? analytics.maxDrawdown.toFixed(1) : 0}%
          </span>
        </div>
      </div>

      {/* Published Accounts (if balances are displayed) */}
      {showBalances && filteredAccounts.some((a) => a.currentBalance !== undefined) && (
        <div className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
            <Wallet className="w-3.5 h-3.5 text-zinc-500" />
            <span>Published Accounts</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredAccounts.map((acc) => (
              <div
                key={acc.id}
                className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 flex items-center justify-between"
              >
                <div>
                  <span className="text-xs font-semibold text-zinc-200 block">{acc.name}</span>
                  <span className="text-[10px] text-zinc-500 uppercase font-mono mt-0.5 block">
                    Starting: {formatMoney(acc.initialBalance || 0, acc.currency)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-zinc-400 uppercase tracking-wider block">Balance</span>
                  <span className="text-sm font-bold font-mono text-emerald-400">
                    {formatMoney(acc.currentBalance || 0, acc.currency)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main split: Plans & Recent Trades */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Planned Setups */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              Planned Trading Setups ({activePlans.length})
            </h2>
            {filteredPlans.length > 4 && (
              <button
                onClick={onViewAllPlans}
                className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
              >
                View all ({filteredPlans.length})
              </button>
            )}
          </div>

          {activePlans.length === 0 ? (
            <div className="p-8 rounded-xl bg-zinc-900/40 border border-zinc-800 text-center">
              <Clock className="w-6 h-6 text-zinc-600 mx-auto mb-2" />
              <p className="text-xs text-zinc-400">No active planned setups right now.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {activePlans.map((plan) => (
                <div
                  key={plan.id}
                  className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between hover:border-zinc-700 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                        plan.direction === 'BUY'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : 'bg-rose-950 text-rose-300 border border-rose-800'
                      }`}
                    >
                      {plan.direction}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold font-mono text-zinc-100">{plan.symbol}</span>
                        <span className="text-[10px] font-mono text-zinc-400 bg-zinc-800 px-1.5 py-0.2 rounded">
                          {plan.timeframe}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 line-clamp-1 mt-0.5">
                        {plan.entryReason || 'Planned setup'}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[11px] font-mono text-zinc-300 block">
                      Entry: {plan.plannedEntry}
                    </span>
                    <span className="text-[10px] font-mono text-zinc-500 block">
                      R:R 1:{plan.plannedRiskReward ? plan.plannedRiskReward.toFixed(1) : '-'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Trades */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              Recent Closed Trades
            </h2>
            {completedTrades.length > 5 && (
              <button
                onClick={onViewAllTrades}
                className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
              >
                View all ({completedTrades.length})
              </button>
            )}
          </div>

          {recentTrades.length === 0 ? (
            <div className="p-8 rounded-xl bg-zinc-900/40 border border-zinc-800 text-center">
              <p className="text-xs text-zinc-400">No closed trades published yet.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {recentTrades.map((trade) => {
                const isProfit = (trade.realizedPnL || 0) > 0;
                const isLoss = (trade.realizedPnL || 0) < 0;

                return (
                  <div
                    key={trade.id}
                    onClick={() => onTradeClick(trade)}
                    className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-all cursor-pointer flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center font-mono text-xs ${
                          trade.direction === 'BUY'
                            ? 'bg-emerald-950/70 text-emerald-400 border border-emerald-800/80'
                            : 'bg-rose-950/70 text-rose-400 border border-rose-800/80'
                        }`}
                      >
                        {trade.direction === 'BUY' ? (
                          <ArrowUpRight className="w-4 h-4" />
                        ) : (
                          <ArrowDownRight className="w-4 h-4" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold font-mono text-zinc-100">{trade.symbol}</span>
                          <span
                            className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded ${
                              trade.result === 'PROFIT'
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                : trade.result === 'LOSS'
                                ? 'bg-rose-950 text-rose-300 border border-rose-800'
                                : 'bg-zinc-800 text-zinc-400'
                            }`}
                          >
                            {trade.result}
                          </span>
                        </div>
                        <span className="text-[10px] text-zinc-500 font-mono mt-0.5 block">
                          {new Date(trade.actualEntryTime).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span
                        className={`text-xs sm:text-sm font-bold font-mono block ${
                          isProfit ? 'text-emerald-400' : isLoss ? 'text-rose-400' : 'text-zinc-400'
                        }`}
                      >
                        {trade.realizedPnL >= 0 ? '+' : ''}
                        {formatMoney(trade.realizedPnL, defaultCurrency)}
                      </span>
                      <span className="text-[10px] font-mono text-zinc-400 block">
                        {(trade.realizedRMultiple || 0) >= 0 ? '+' : ''}
                        {(trade.realizedRMultiple || 0).toFixed(2)}R
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
