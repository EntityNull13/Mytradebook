import { useState, useMemo } from 'react';
import {
  calculateWinRate,
  calculateProfitFactor,
  calculateExpectancyAndR,
  calculateDrawdown,
  calculateTriggerRate,
  calculateExitStatistics,
  calculateSetupPerformance,
  calculateAccountPerformanceBreakdown,
  formatMoney,
  formatSignedMoney,
} from '../../calculations';
import type { Trade, Plan, Exit, Setup, Account, Transaction } from '../../types';
import {
  parseAccountScope,
  getScopedAccounts,
  getScopedAccountIds,
  formatAccountType,
} from '../../utils/accountScope';
import { ActiveScopeBanner } from '../common/AccountScopeSelector';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import {
  BarChart3,
  TrendingUp,
  ShieldAlert,
  Target,
  LogOut,
  Coins,
  Calendar,
  Filter,
  Layers,
} from 'lucide-react';

export type DateRangeFilter =
  | 'ALL'
  | 'TODAY'
  | 'THIS_WEEK'
  | 'THIS_MONTH'
  | 'LAST_MONTH'
  | 'THIS_YEAR';

interface AnalyticsViewProps {
  trades: Trade[];
  plans: Plan[];
  exits: Exit[];
  setups: Setup[];
  accounts: Account[];
  transactions?: Transaction[];
  selectedScope: string;
  onSelectScope: (scope: string) => void;
}

export function AnalyticsView({
  trades,
  plans,
  exits,
  setups,
  accounts,
  transactions = [],
  selectedScope,
  onSelectScope,
}: AnalyticsViewProps) {
  // Complementary filter states (Section 14 & 15)
  const [dateRange, setDateRange] = useState<DateRangeFilter>('ALL');
  const [selectedSymbol, setSelectedSymbol] = useState<string>('ALL');
  const [selectedSetupId, setSelectedSetupId] = useState<string>('ALL');

  // Step 1: Filter Accounts by Scope (Section 2 & 15)
  const scopedAccounts = useMemo(
    () => getScopedAccounts(accounts, selectedScope),
    [accounts, selectedScope]
  );

  const scopedAccountIds = useMemo(
    () => getScopedAccountIds(accounts, selectedScope),
    [accounts, selectedScope]
  );

  // Distinct currencies in scoped accounts
  const availableCurrencies = useMemo(() => {
    const list = Array.from(
      new Set(scopedAccounts.map((a) => (a.currency || 'USD').toUpperCase()))
    );
    return list.length > 0 ? list : ['USD'];
  }, [scopedAccounts]);

  const [activeCurrency, setActiveCurrency] = useState<string>(availableCurrencies[0] || 'USD');

  // Sync activeCurrency if no longer in available list
  const currentCurrency = availableCurrencies.includes(activeCurrency)
    ? activeCurrency
    : availableCurrencies[0] || 'USD';

  // Step 2, 3, 4: Filter Chain (Account Scope -> Date Filter -> Symbol Filter -> Setup Filter)
  // Maps for efficient lookups
  const planMap = useMemo(() => new Map<string, Plan>(plans.map((p) => [p.id, p])), [plans]);
  const accountMap = useMemo(
    () => new Map<string, Account>(accounts.map((a) => [a.id, a])),
    [accounts]
  );

  // Helper date checker
  const isDateInRange = (dateStr: string | undefined | null): boolean => {
    if (!dateStr || dateRange === 'ALL') return true;
    const target = new Date(dateStr);
    if (isNaN(target.getTime())) return true;

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const targetStr = target.toISOString().slice(0, 10);

    if (dateRange === 'TODAY') {
      return targetStr === todayStr;
    }

    if (dateRange === 'THIS_WEEK') {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(now.getDate() - 7);
      return target >= oneWeekAgo && target <= now;
    }

    if (dateRange === 'THIS_MONTH') {
      return targetStr.slice(0, 7) === todayStr.slice(0, 7);
    }

    if (dateRange === 'LAST_MONTH') {
      const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const prevMonthStr = prevMonth.toISOString().slice(0, 7);
      return targetStr.slice(0, 7) === prevMonthStr;
    }

    if (dateRange === 'THIS_YEAR') {
      return targetStr.slice(0, 4) === todayStr.slice(0, 4);
    }

    return true;
  };

  // Base scope-filtered plans & trades
  const scopedPlans = useMemo(
    () => plans.filter((p) => scopedAccountIds.has(p.accountId)),
    [plans, scopedAccountIds]
  );

  const scopedTrades = useMemo(
    () => trades.filter((t) => scopedAccountIds.has(t.accountId)),
    [trades, scopedAccountIds]
  );

  // Apply Date, Symbol, Setup filters
  const filteredPlans = useMemo(() => {
    return scopedPlans.filter((p) => {
      if (!isDateInRange(p.createdAt)) return false;
      if (selectedSymbol !== 'ALL' && p.symbol !== selectedSymbol) return false;
      if (selectedSetupId !== 'ALL' && p.setupId !== selectedSetupId) return false;
      return true;
    });
  }, [scopedPlans, dateRange, selectedSymbol, selectedSetupId]);

  const filteredPlanIds = useMemo(
    () => new Set(filteredPlans.map((p) => p.id)),
    [filteredPlans]
  );

  const filteredTrades = useMemo(() => {
    return scopedTrades.filter((t) => {
      const tradeDate = t.completedAt || t.actualEntryTime;
      if (!isDateInRange(tradeDate)) return false;

      const plan = planMap.get(t.planId);
      if (selectedSymbol !== 'ALL' && plan && plan.symbol !== selectedSymbol) return false;
      if (selectedSetupId !== 'ALL' && plan && plan.setupId !== selectedSetupId) return false;

      return true;
    });
  }, [scopedTrades, dateRange, selectedSymbol, selectedSetupId, planMap]);

  const filteredTradeIds = useMemo(
    () => new Set(filteredTrades.map((t) => t.id)),
    [filteredTrades]
  );

  const filteredExits = useMemo(
    () => exits.filter((e) => filteredTradeIds.has(e.tradeId)),
    [exits, filteredTradeIds]
  );

  // Available symbols & setups in current scope for filter dropdowns
  const availableSymbols = useMemo(() => {
    const syms = new Set<string>();
    scopedPlans.forEach((p) => syms.add(p.symbol));
    scopedTrades.forEach((t) => {
      const plan = planMap.get(t.planId);
      if (plan) syms.add(plan.symbol);
    });
    return Array.from(syms).sort();
  }, [scopedPlans, scopedTrades, planMap]);

  // Section 10: Multi-currency isolation
  // Currency-isolated dataset for monetary metrics
  const currencyAccounts = useMemo(() => {
    return scopedAccounts.filter(
      (a) => (a.currency || 'USD').toUpperCase() === currentCurrency
    );
  }, [scopedAccounts, currentCurrency]);

  const currencyAccountIds = useMemo(
    () => new Set(currencyAccounts.map((a) => a.id)),
    [currencyAccounts]
  );

  const currencyTrades = useMemo(
    () => filteredTrades.filter((t) => currencyAccountIds.has(t.accountId)),
    [filteredTrades, currencyAccountIds]
  );

  const currencyPlans = useMemo(
    () => filteredPlans.filter((p) => currencyAccountIds.has(p.accountId)),
    [filteredPlans, currencyAccountIds]
  );

  const currencyTradeIds = useMemo(
    () => new Set(currencyTrades.map((t) => t.id)),
    [currencyTrades]
  );

  const currencyExits = useMemo(
    () => exits.filter((e) => currencyTradeIds.has(e.tradeId)),
    [exits, currencyTradeIds]
  );

  const completedTrades = useMemo(
    () => currencyTrades.filter((t) => t.status === 'COMPLETED' && t.realizedPnL !== null),
    [currencyTrades]
  );

  // Dimensionless scope toggle (Currency vs All Currencies within scope)
  const [dimensionlessScope, setDimensionlessScope] = useState<'CURRENCY' | 'ALL'>('CURRENCY');

  const baseTradesForDimensionless = useMemo(() => {
    if (dimensionlessScope === 'ALL') {
      return filteredTrades;
    }
    return currencyTrades;
  }, [dimensionlessScope, filteredTrades, currencyTrades]);

  const basePlansForDimensionless = useMemo(() => {
    if (dimensionlessScope === 'ALL') {
      return filteredPlans;
    }
    return currencyPlans;
  }, [dimensionlessScope, filteredPlans, currencyPlans]);

  // Performance calculations
  const winRateStats = calculateWinRate(baseTradesForDimensionless);
  const profitFactor = calculateProfitFactor(baseTradesForDimensionless);
  const expectancyStats = calculateExpectancyAndR(currencyTrades, currencyPlans);
  const planStats = calculateTriggerRate(basePlansForDimensionless);
  const exitStats = calculateExitStatistics(
    dimensionlessScope === 'ALL' ? filteredExits : currencyExits
  );
  const setupPerformance = calculateSetupPerformance(currencyPlans, currencyTrades, setups);

  // Section 8: Account Performance Breakdown (evaluated on all scoped accounts)
  const accountPerformanceBreakdown = useMemo(() => {
    return calculateAccountPerformanceBreakdown(scopedAccounts, filteredTrades, transactions);
  }, [scopedAccounts, filteredTrades, transactions]);

  // Section 7: Risk Dynamics
  const { averageRisk, largestRisk, largestLoss } = useMemo(() => {
    // Plans with risk amount in current currency
    const plansWithRisk = currencyPlans.filter((p) => p.sl && p.plannedEntry);
    let totalRisk = 0;
    let maxRisk = 0;

    plansWithRisk.forEach((p) => {
      const riskPerUnit = Math.abs(p.plannedEntry - (p.sl || p.plannedEntry));
      if (riskPerUnit > maxRisk) maxRisk = riskPerUnit;
      totalRisk += riskPerUnit;
    });

    const avgRisk = plansWithRisk.length > 0 ? totalRisk / plansWithRisk.length : 0;

    // Largest loss among completed trades
    let maxLoss = 0;
    completedTrades.forEach((t) => {
      const pnl = t.realizedPnL ?? 0;
      if (pnl < 0 && Math.abs(pnl) > maxLoss) {
        maxLoss = Math.abs(pnl);
      }
    });

    return {
      averageRisk: Number(avgRisk.toFixed(2)),
      largestRisk: Number(maxRisk.toFixed(2)),
      largestLoss: Number(maxLoss.toFixed(2)),
    };
  }, [currencyPlans, completedTrades]);

  // Cumulative equity curve data points (STRICTLY IN CURRENT CURRENCY)
  const { equityPoints, chartData, netPnL, maxConsecutiveWins, maxConsecutiveLosses } = useMemo(() => {
    let runningPnL = 0;
    const points: number[] = [0];
    const data = [{ index: 0, date: 'Start', pnl: 0, cumulativePnL: 0 }];

    const sortedCompleted = [...completedTrades].sort((a, b) =>
      (a.completedAt || a.actualEntryTime || '').localeCompare(
        b.completedAt || b.actualEntryTime || ''
      )
    );

    let consWins = 0;
    let maxWins = 0;
    let consLosses = 0;
    let maxLosses = 0;

    sortedCompleted.forEach((t, i) => {
      const pnl = t.realizedPnL ?? 0;
      runningPnL += pnl;
      points.push(runningPnL);
      data.push({
        index: i + 1,
        date: (t.completedAt || t.actualEntryTime || '').slice(0, 10),
        pnl: pnl,
        cumulativePnL: Number(runningPnL.toFixed(2)),
      });

      if (pnl > 0) {
        consWins++;
        consLosses = 0;
        if (consWins > maxWins) maxWins = consWins;
      } else if (pnl < 0) {
        consLosses++;
        consWins = 0;
        if (consLosses > maxLosses) maxLosses = consLosses;
      }
    });

    return {
      equityPoints: points,
      chartData: data,
      netPnL: Number(runningPnL.toFixed(2)),
      maxConsecutiveWins: maxWins,
      maxConsecutiveLosses: maxLosses,
    };
  }, [completedTrades]);

  const drawdownStats = calculateDrawdown(equityPoints);

  const parsedScope = parseAccountScope(selectedScope);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-zinc-100 tracking-tight flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-zinc-400" />
            <span>Descriptive Performance Analytics</span>
          </h2>
          <p className="text-xs text-zinc-400">
            Mathematical evaluation derived strictly from verified trade records (Non-advisory)
          </p>
        </div>
      </div>

      {/* Account Scope Active Banner (Section 4 & 5) */}
      <ActiveScopeBanner
        accounts={accounts}
        selectedScope={selectedScope}
        onSelectScope={onSelectScope}
      />

      {/* Filter Bar: Account Scope + Date + Symbol + Setup (Section 14 & 15) */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-3 sm:p-4 space-y-3">
        <div className="flex items-center gap-2 text-xs font-mono font-semibold text-zinc-300">
          <Filter className="w-3.5 h-3.5 text-zinc-400" />
          <span>Filter Pipeline: Scope → Date → Symbol → Setup</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {/* Date Filter */}
          <div>
            <label className="text-[10px] uppercase font-mono text-zinc-400 block mb-1">
              Time Horizon
            </label>
            <div className="relative">
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as DateRangeFilter)}
                className="w-full appearance-none bg-zinc-950 text-zinc-200 text-xs font-mono px-3 py-1.5 rounded-lg border border-zinc-800 hover:border-zinc-700 focus:outline-none focus:border-zinc-500 cursor-pointer"
              >
                <option value="ALL">All Time</option>
                <option value="TODAY">Today</option>
                <option value="THIS_WEEK">This Week (Past 7 Days)</option>
                <option value="THIS_MONTH">This Month</option>
                <option value="LAST_MONTH">Last Month</option>
                <option value="THIS_YEAR">This Year</option>
              </select>
            </div>
          </div>

          {/* Symbol Filter */}
          <div>
            <label className="text-[10px] uppercase font-mono text-zinc-400 block mb-1">
              Asset / Symbol
            </label>
            <div className="relative">
              <select
                value={selectedSymbol}
                onChange={(e) => setSelectedSymbol(e.target.value)}
                className="w-full appearance-none bg-zinc-950 text-zinc-200 text-xs font-mono px-3 py-1.5 rounded-lg border border-zinc-800 hover:border-zinc-700 focus:outline-none focus:border-zinc-500 cursor-pointer"
              >
                <option value="ALL">All Symbols ({availableSymbols.length})</option>
                {availableSymbols.map((sym) => (
                  <option key={sym} value={sym}>
                    {sym}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Setup Filter */}
          <div>
            <label className="text-[10px] uppercase font-mono text-zinc-400 block mb-1">
              Strategy Setup
            </label>
            <div className="relative">
              <select
                value={selectedSetupId}
                onChange={(e) => setSelectedSetupId(e.target.value)}
                className="w-full appearance-none bg-zinc-950 text-zinc-200 text-xs font-mono px-3 py-1.5 rounded-lg border border-zinc-800 hover:border-zinc-700 focus:outline-none focus:border-zinc-500 cursor-pointer"
              >
                <option value="ALL">All Setups ({setups.length})</option>
                {setups.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.category ? `(${s.category})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {(dateRange !== 'ALL' || selectedSymbol !== 'ALL' || selectedSetupId !== 'ALL') && (
          <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[11px] font-mono">
            <span className="text-zinc-400">
              Active filters: {dateRange !== 'ALL' ? `[${dateRange}] ` : ''}
              {selectedSymbol !== 'ALL' ? `[${selectedSymbol}] ` : ''}
              {selectedSetupId !== 'ALL' ? '[Setup filtered]' : ''}
            </span>
            <button
              onClick={() => {
                setDateRange('ALL');
                setSelectedSymbol('ALL');
                setSelectedSetupId('ALL');
              }}
              className="text-zinc-400 hover:text-zinc-100 underline cursor-pointer"
            >
              Reset filters
            </button>
          </div>
        )}
      </div>

      {/* Multi-Currency Portfolio Switcher (Section 10) */}
      {availableCurrencies.length > 1 && (
        <div className="p-3 bg-zinc-900/90 border border-zinc-800 rounded-xl text-xs font-mono flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Coins className="w-4 h-4 text-amber-400" />
            <span className="text-zinc-300">
              <strong>Multi-Currency Protection:</strong> Monetary metrics isolated to{' '}
              <strong className="text-amber-400">{currentCurrency}</strong>.
            </span>
          </div>

          <div className="flex items-center gap-1 self-start sm:self-auto">
            <span className="text-[10px] text-zinc-500 uppercase mr-1">Currency:</span>
            {availableCurrencies.map((curr) => (
              <button
                key={curr}
                onClick={() => setActiveCurrency(curr)}
                className={`px-2.5 py-1 text-xs font-mono rounded font-semibold transition-colors ${
                  currentCurrency === curr
                    ? 'bg-zinc-100 text-zinc-950 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                }`}
              >
                {curr}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Primary KPI Grid (Section 7) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-zinc-900/80 p-4 rounded-xl border border-zinc-800">
          <span className="text-[11px] font-mono text-zinc-400 uppercase block">
            Net Realized P&L ({currentCurrency})
          </span>
          <span
            className={`text-xl sm:text-2xl font-bold font-mono ${
              netPnL > 0 ? 'text-emerald-400' : netPnL < 0 ? 'text-rose-400' : 'text-zinc-200'
            }`}
          >
            {completedTrades.length > 0 ? formatSignedMoney(netPnL, currentCurrency) : '—'}
          </span>
          <span className="text-[10px] text-zinc-500 font-mono mt-1 block">
            {completedTrades.length} trades settled
          </span>
        </div>

        <div className="bg-zinc-900/80 p-4 rounded-xl border border-zinc-800">
          <span className="text-[11px] font-mono text-zinc-400 uppercase block">Win Rate</span>
          <span className="text-xl sm:text-2xl font-bold font-mono text-zinc-100">
            {winRateStats.totalCompleted > 0 ? `${winRateStats.winRate}%` : '—'}
          </span>
          <span className="text-[10px] text-zinc-500 font-mono mt-1 block">
            {winRateStats.totalCompleted > 0
              ? `${winRateStats.wins}W · ${winRateStats.losses}L · ${winRateStats.beps}BEP`
              : 'No trade history'}
          </span>
        </div>

        <div className="bg-zinc-900/80 p-4 rounded-xl border border-zinc-800">
          <span className="text-[11px] font-mono text-zinc-400 uppercase block">Profit Factor</span>
          <span className="text-xl sm:text-2xl font-bold font-mono text-zinc-100">
            {winRateStats.totalCompleted > 0 ? profitFactor : '—'}
          </span>
          <span className="text-[10px] text-zinc-500 font-mono mt-1 block">
            Avg R: {completedTrades.length > 0 ? `${expectancyStats.averageR}R` : '—'}
          </span>
        </div>

        <div className="bg-zinc-900/80 p-4 rounded-xl border border-zinc-800">
          <span className="text-[11px] font-mono text-zinc-400 uppercase block">
            Max Drawdown ({currentCurrency})
          </span>
          <span className="text-xl sm:text-2xl font-bold font-mono text-rose-400">
            {completedTrades.length > 0
              ? formatMoney(drawdownStats.maxDrawdown, currentCurrency)
              : '—'}
          </span>
          <span className="text-[10px] text-zinc-500 font-mono mt-1 block">
            {drawdownStats.maxDrawdownPercent > 0
              ? `-${drawdownStats.maxDrawdownPercent}% from peak`
              : 'Peak to trough drop'}
          </span>
        </div>
      </div>

      {/* Section 8: ACCOUNT PERFORMANCE BREAKDOWN */}
      <div className="bg-zinc-900/70 border border-zinc-800 rounded-xl p-4 sm:p-5 overflow-hidden">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
              <Layers className="w-4 h-4 text-zinc-400" />
              <span>Account Performance Breakdown</span>
            </h3>
            <p className="text-[11px] text-zinc-400">
              Statistical summary per account within current scope (Section 8 — Strictly non-advisory)
            </p>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
            {accountPerformanceBreakdown.length} Accounts
          </span>
        </div>

        {accountPerformanceBreakdown.length === 0 ? (
          <p className="text-xs text-zinc-500 italic py-4">No accounts in active scope.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-400 uppercase text-[10px]">
                  <th className="pb-2 font-semibold">Account</th>
                  <th className="pb-2 font-semibold">Type</th>
                  <th className="pb-2 font-semibold text-right">Trades</th>
                  <th className="pb-2 font-semibold text-right">Win Rate</th>
                  <th className="pb-2 font-semibold text-right">Net P&L</th>
                  <th className="pb-2 font-semibold text-right">Max DD</th>
                  <th className="pb-2 font-semibold text-right">Profit Factor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {accountPerformanceBreakdown.map((item) => (
                  <tr key={item.accountId} className="hover:bg-zinc-800/30">
                    <td className="py-2.5 font-bold text-zinc-200">
                      {item.accountName}
                      <span className="text-[10px] text-zinc-500 font-normal ml-1.5">
                        ({item.currency})
                      </span>
                    </td>
                    <td className="py-2.5 text-zinc-400">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">
                        {formatAccountType(item.accountType)}
                      </span>
                    </td>
                    <td className="py-2.5 text-right text-zinc-300">{item.tradesCount}</td>
                    <td className="py-2.5 text-right font-semibold text-zinc-200">
                      {item.tradesCount > 0 ? `${item.winRate}%` : '—'}
                    </td>
                    <td
                      className={`py-2.5 text-right font-bold ${
                        item.netPnL > 0
                          ? 'text-emerald-400'
                          : item.netPnL < 0
                          ? 'text-rose-400'
                          : 'text-zinc-400'
                      }`}
                    >
                      {item.tradesCount > 0
                        ? formatSignedMoney(item.netPnL, item.currency)
                        : '—'}
                    </td>
                    <td className="py-2.5 text-right text-rose-400 font-mono">
                      {item.tradesCount > 0
                        ? `-${formatMoney(item.maxDrawdown, item.currency)}`
                        : '—'}
                    </td>
                    <td className="py-2.5 text-right text-zinc-300">
                      {item.tradesCount > 0 ? item.profitFactor : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Equity Curve Chart */}
      <div className="bg-zinc-900/70 border border-zinc-800 rounded-xl p-4 sm:p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <span>Cumulative Realized P&L Curve ({currentCurrency})</span>
            </h3>
            <p className="text-[11px] text-zinc-500 font-mono">
              Historical performance trajectory strictly in {currentCurrency}
            </p>
          </div>
        </div>

        {chartData.length <= 1 ? (
          <div className="h-48 flex items-center justify-center text-xs text-zinc-500 font-mono">
            No completed trade data available to plot equity curve in {currentCurrency}.
          </div>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor={netPnL >= 0 ? '#10b981' : '#f43f5e'}
                      stopOpacity={0.3}
                    />
                    <stop
                      offset="95%"
                      stopColor={netPnL >= 0 ? '#10b981' : '#f43f5e'}
                      stopOpacity={0.0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis dataKey="date" stroke="#71717a" fontSize={11} tickLine={false} />
                <YAxis
                  stroke="#71717a"
                  fontSize={11}
                  tickLine={false}
                  tickFormatter={(v) => formatMoney(Number(v), currentCurrency)}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#18181b',
                    borderColor: '#27272a',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontFamily: 'monospace',
                  }}
                  formatter={(value: unknown) => {
                    const num = typeof value === 'number' ? value : 0;
                    return [formatSignedMoney(num, currentCurrency), 'Cumulative P&L'];
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="cumulativePnL"
                  stroke={netPnL >= 0 ? '#10b981' : '#f43f5e'}
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#pnlGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Dual Section: Planning Integrity & Risk Dynamics (Section 7) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Planning Analytics */}
        <div className="bg-zinc-900/70 border border-zinc-800 rounded-xl p-4 sm:p-5">
          <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2 mb-3">
            <Target className="w-4 h-4 text-cyan-400" />
            <span>Planning & Trigger Discipline</span>
          </h3>

          <div className="space-y-3 font-mono text-xs">
            <div className="flex justify-between items-center py-1 border-b border-zinc-800/80">
              <span className="text-zinc-400">Total Plans Formulated</span>
              <span className="text-zinc-100 font-bold">{planStats.totalPlans}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-zinc-800/80">
              <span className="text-zinc-400">Trigger Rate</span>
              <span className="text-emerald-400 font-bold">
                {planStats.totalPlans > 0 ? `${planStats.triggerRate}% (${planStats.triggeredCount})` : '—'}
              </span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-zinc-800/80">
              <span className="text-zinc-400">Not Triggered Rate</span>
              <span className="text-zinc-300 font-bold">
                {planStats.totalPlans > 0 ? `${planStats.notTriggeredRate}% (${planStats.notTriggeredCount})` : '—'}
              </span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-zinc-800/80">
              <span className="text-zinc-400">Invalidated Rate</span>
              <span className="text-amber-400 font-bold">
                {planStats.totalPlans > 0 ? `${planStats.invalidRate}% (${planStats.invalidCount})` : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* Risk & Loss Dynamics (Section 7: Risk metrics) */}
        <div className="bg-zinc-900/70 border border-zinc-800 rounded-xl p-4 sm:p-5">
          <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2 mb-3">
            <ShieldAlert className="w-4 h-4 text-rose-400" />
            <span>Risk & Streaks Dynamics</span>
          </h3>

          <div className="space-y-3 font-mono text-xs">
            <div className="flex justify-between items-center py-1 border-b border-zinc-800/80">
              <span className="text-zinc-400">Trade Expectancy</span>
              <span className="text-zinc-100 font-bold">
                {completedTrades.length > 0
                  ? `${formatSignedMoney(expectancyStats.expectancy, currentCurrency)} / trade`
                  : '—'}
              </span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-zinc-800/80">
              <span className="text-zinc-400">Average Win</span>
              <span className="text-emerald-400 font-bold">
                {completedTrades.length > 0
                  ? `+${formatMoney(expectancyStats.averageWin, currentCurrency)}`
                  : '—'}
              </span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-zinc-800/80">
              <span className="text-zinc-400">Average Loss</span>
              <span className="text-rose-400 font-bold">
                {completedTrades.length > 0
                  ? `-${formatMoney(expectancyStats.averageLoss, currentCurrency)}`
                  : '—'}
              </span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-zinc-800/80">
              <span className="text-zinc-400">Largest Realized Loss</span>
              <span className="text-rose-400 font-bold">
                {largestLoss > 0 ? `-${formatMoney(largestLoss, currentCurrency)}` : '—'}
              </span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-zinc-800/80">
              <span className="text-zinc-400">Max Consecutive Wins / Losses</span>
              <span className="text-zinc-200 font-bold">
                {completedTrades.length > 0
                  ? `${maxConsecutiveWins} Wins · ${maxConsecutiveLosses} Losses`
                  : '—'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Exit Types Breakdown */}
      <div className="bg-zinc-900/70 border border-zinc-800 rounded-xl p-4 sm:p-5">
        <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2 mb-3">
          <LogOut className="w-4 h-4 text-zinc-400" />
          <span>Exit Types Breakdown</span>
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 font-mono text-xs">
          <div className="p-2.5 bg-zinc-950 rounded-lg border border-zinc-800">
            <span className="text-[10px] text-zinc-500 block">Full TP</span>
            <span className="text-emerald-400 font-bold text-sm">{exitStats.FULL_TP}</span>
          </div>
          <div className="p-2.5 bg-zinc-950 rounded-lg border border-zinc-800">
            <span className="text-[10px] text-zinc-500 block">Cut Profit</span>
            <span className="text-teal-400 font-bold text-sm">{exitStats.CUT_PROFIT}</span>
          </div>
          <div className="p-2.5 bg-zinc-950 rounded-lg border border-zinc-800">
            <span className="text-[10px] text-zinc-500 block">Full SL</span>
            <span className="text-rose-400 font-bold text-sm">{exitStats.FULL_SL}</span>
          </div>
          <div className="p-2.5 bg-zinc-950 rounded-lg border border-zinc-800">
            <span className="text-[10px] text-zinc-500 block">Cut Loss</span>
            <span className="text-amber-400 font-bold text-sm">{exitStats.CUT_LOSS}</span>
          </div>
          <div className="p-2.5 bg-zinc-950 rounded-lg border border-zinc-800">
            <span className="text-[10px] text-zinc-500 block">Partial</span>
            <span className="text-sky-400 font-bold text-sm">{exitStats.PARTIAL}</span>
          </div>
          <div className="p-2.5 bg-zinc-950 rounded-lg border border-zinc-800">
            <span className="text-[10px] text-zinc-500 block">Other</span>
            <span className="text-zinc-400 font-bold text-sm">{exitStats.OTHER}</span>
          </div>
        </div>
      </div>

      {/* Setup Performance Table (Strictly Non-Advisory per Section 24) */}
      <div className="bg-zinc-900/70 border border-zinc-800 rounded-xl p-4 sm:p-5 overflow-hidden">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-zinc-100">Setup Performance Distribution</h3>
            <p className="text-[11px] text-zinc-400">
              Objective statistical distribution per strategy setup in {currentCurrency}
            </p>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
            {currentCurrency} Metrics
          </span>
        </div>

        {setupPerformance.length === 0 ? (
          <p className="text-xs text-zinc-500 italic py-4">No setups registered yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-400 uppercase text-[10px]">
                  <th className="pb-2 font-semibold">Setup</th>
                  <th className="pb-2 font-semibold">Category</th>
                  <th className="pb-2 font-semibold text-right">Plans</th>
                  <th className="pb-2 font-semibold text-right">Triggered</th>
                  <th className="pb-2 font-semibold text-right">Settled</th>
                  <th className="pb-2 font-semibold text-right">Win Rate</th>
                  <th className="pb-2 font-semibold text-right">Net P&L ({currentCurrency})</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {setupPerformance.map((s) => (
                  <tr key={s.setupId} className="hover:bg-zinc-800/30">
                    <td className="py-2.5 font-bold text-zinc-200">{s.setupName}</td>
                    <td className="py-2.5 text-zinc-400">{s.category || '—'}</td>
                    <td className="py-2.5 text-right text-zinc-300">{s.plansCount}</td>
                    <td className="py-2.5 text-right text-zinc-300">{s.triggeredCount}</td>
                    <td className="py-2.5 text-right text-zinc-300">{s.tradesCount}</td>
                    <td className="py-2.5 text-right font-semibold text-zinc-200">
                      {s.tradesCount > 0 ? `${s.winRate}%` : '—'}
                    </td>
                    <td
                      className={`py-2.5 text-right font-bold ${
                        s.netPnL > 0
                          ? 'text-emerald-400'
                          : s.netPnL < 0
                          ? 'text-rose-400'
                          : 'text-zinc-400'
                      }`}
                    >
                      {s.tradesCount > 0
                        ? formatSignedMoney(s.netPnL, currentCurrency)
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
