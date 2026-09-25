import { useMemo } from 'react';
import {
  calculateCurrentBalance,
  calculateWinRate,
  calculateProfitFactor,
  calculateExpectancyAndR,
  calculateDrawdown,
  evaluateRuleStatus,
  groupAccountsByCurrency,
  formatMoney,
  formatSignedMoney,
} from '../../calculations';
import { ResultBadge, DirectionBadge, PlanStatusBadge } from '../common/Badge';
import type { Account, Plan, Trade, Exit, PropFirmRule, Transaction } from '../../types';
import {
  parseAccountScope,
  getScopedAccounts,
  getScopedAccountIds,
  getScopeLabel,
} from '../../utils/accountScope';
import { ActiveScopeBanner } from '../common/AccountScopeSelector';
import { AccountTypeSummaryCard } from './AccountTypeSummaryCard';
import { AccountProgressCard } from './AccountProgressCard';
import {
  Wallet,
  TrendingUp,
  Target,
  Clock,
  ArrowRight,
  Plus,
  ShieldCheck,
  CheckCircle2,
  Coins,
  Percent,
} from 'lucide-react';

interface DashboardViewProps {
  accounts: Account[];
  plans: Plan[];
  trades: Trade[];
  exits: Exit[];
  rules: PropFirmRule[];
  transactions: Transaction[];
  selectedScope: string;
  onSelectScope: (scope: string) => void;
  onNavigate: (tab: 'DASHBOARD' | 'PLANS' | 'TRADES' | 'ANALYTICS' | 'CALENDAR' | 'ACCOUNTS' | 'SETTINGS') => void;
  onOpenNewPlan: () => void;
  onTriggerPlan: (plan: Plan) => void;
  onAddExit: (trade: Trade) => void;
}

export function DashboardView({
  accounts,
  plans,
  trades,
  rules,
  transactions,
  selectedScope,
  onSelectScope,
  onNavigate,
  onOpenNewPlan,
  onTriggerPlan,
  onAddExit,
}: DashboardViewProps) {
  // 1. Centralized Account Scope Filtering (Section 2 & 6)
  const scopedAccounts = useMemo(
    () => getScopedAccounts(accounts, selectedScope),
    [accounts, selectedScope]
  );

  const scopedAccountIds = useMemo(
    () => getScopedAccountIds(accounts, selectedScope),
    [accounts, selectedScope]
  );

  const filteredPlans = useMemo(
    () => plans.filter((p) => scopedAccountIds.has(p.accountId)),
    [plans, scopedAccountIds]
  );

  const filteredTrades = useMemo(
    () => trades.filter((t) => scopedAccountIds.has(t.accountId)),
    [trades, scopedAccountIds]
  );

  const relevantTransactions = useMemo(
    () => transactions.filter((t) => scopedAccountIds.has(t.accountId)),
    [transactions, scopedAccountIds]
  );

  // Active trades, pending plans, and completed trades
  const activeTrades = filteredTrades.filter((t) => t.status === 'ACTIVE');
  const pendingPlans = filteredPlans.filter((p) => p.status === 'PLANNED');
  const completedTrades = filteredTrades.filter(
    (t) => t.status === 'COMPLETED' && t.realizedPnL !== null
  );

  // 2. Currency breakdown (Section 10: Multi-currency isolation, never add USD+IDR)
  const currencyBreakdowns = useMemo(
    () => groupAccountsByCurrency(scopedAccounts, filteredTrades, relevantTransactions),
    [scopedAccounts, filteredTrades, relevantTransactions]
  );
  const primaryCurrency = scopedAccounts.length > 0 ? scopedAccounts[0].currency || 'USD' : 'USD';
  const isMultiCurrency = currencyBreakdowns.length > 1;

  // 3. Compute aggregate balance and return
  let totalStarting = 0;
  scopedAccounts.forEach((a) => {
    totalStarting += a.startingBalance;
  });

  const totalBalanceState = calculateCurrentBalance(
    totalStarting,
    filteredTrades,
    relevantTransactions
  );

  const totalPnL = totalBalanceState.totalRealizedPnL;
  const returnPercentage =
    totalStarting > 0 ? Number(((totalPnL / totalStarting) * 100).toFixed(2)) : null;

  const winRateStats = calculateWinRate(filteredTrades);
  const profitFactor = calculateProfitFactor(filteredTrades);
  const expectancyStats = calculateExpectancyAndR(filteredTrades, filteredPlans);

  // Max drawdown for equity curve in scope
  const { maxDrawdownVal } = useMemo(() => {
    if (completedTrades.length === 0) return { maxDrawdownVal: 0 };
    const sorted = [...completedTrades].sort((a, b) =>
      (a.completedAt || a.actualEntryTime || '').localeCompare(
        b.completedAt || b.actualEntryTime || ''
      )
    );
    let running = 0;
    const curve = [0];
    for (const t of sorted) {
      running += t.realizedPnL ?? 0;
      curve.push(running);
    }
    const dd = calculateDrawdown(curve);
    return { maxDrawdownVal: dd.maxDrawdown };
  }, [completedTrades]);

  // 4. Check prop firm warnings strictly for accounts in scope
  const activeRules = rules.filter((r) => r.enabled && scopedAccountIds.has(r.accountId));
  const evaluatedRules = activeRules.map((rule) => {
    const acc = accounts.find((a) => a.id === rule.accountId);
    const accTrades = trades.filter((t) => t.accountId === rule.accountId);
    const startingBal = acc?.startingBalance ?? 0;
    const bal = calculateCurrentBalance(
      startingBal,
      accTrades,
      transactions.filter((tx) => tx.accountId === rule.accountId)
    );
    const accCurrency = acc?.currency || 'USD';
    return {
      rule,
      evaluation: evaluateRuleStatus(
        rule,
        accTrades,
        bal.currentBalance,
        startingBal,
        accCurrency
      ),
    };
  });

  const warningRules = evaluatedRules.filter(
    (r) => r.evaluation.status === 'WARNING' || r.evaluation.status === 'BREACHED'
  );

  const planMap = useMemo(() => new Map(plans.map((p) => [p.id, p])), [plans]);
  const parsedScope = parseAccountScope(selectedScope);
  const scopeLabelInfo = getScopeLabel(selectedScope, accounts);

  return (
    <div className="space-y-6">
      {/* Top Banner: Quick Summary & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-zinc-100 tracking-tight">
            Dashboard Jurnal Trading
          </h2>
          <p className="text-xs text-zinc-400">
            Saldo modal, disiplin eksekusi, dan posisi pasar aktif
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenNewPlan}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-zinc-100 text-zinc-950 hover:bg-zinc-200 transition-colors font-mono cursor-pointer shadow-xs"
          >
            <Plus className="w-3.5 h-3.5 stroke-[3]" />
            <span>Buat Rencana</span>
          </button>
        </div>
      </div>

      {/* Account Scope Active Banner & Switcher (Section 4 & 5) */}
      <ActiveScopeBanner
        accounts={accounts}
        selectedScope={selectedScope}
        onSelectScope={onSelectScope}
      />

      {/* Onboarding Banner when no accounts exist */}
      {accounts.length === 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
              <Wallet className="w-4 h-4 text-zinc-400" />
              <span>Belum Ada Akun Trading Terdaftar</span>
            </h3>
            <p className="text-xs text-zinc-400 max-w-xl">
              Mulai dengan menambahkan akun trading Anda (Personal, Prop Firm Evaluation/Funded, atau Demo). Semua data disimpan 100% aman di perangkat Anda secara lokal.
            </p>
          </div>
          <button
            onClick={() => onNavigate('ACCOUNTS')}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-zinc-100 text-zinc-950 hover:bg-zinc-200 transition-colors font-mono cursor-pointer shadow-xs shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah Akun Baru</span>
          </button>
        </div>
      )}

      {/* Empty State when scope has no accounts */}
      {accounts.length > 0 && scopedAccounts.length === 0 && (
        <div className="p-6 bg-zinc-900/60 border border-zinc-800 rounded-xl text-center space-y-2">
          <p className="text-sm font-semibold text-zinc-300">
            Tidak ada akun yang sesuai dengan filter scope ini ({scopeLabelInfo.title}).
          </p>
          <p className="text-xs text-zinc-500">
            Pilih scope lain atau tambahkan akun dengan tipe ini di menu Akun.
          </p>
          <button
            onClick={() => onSelectScope('ALL')}
            className="mt-2 px-3 py-1.5 text-xs font-mono rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors"
          >
            Kembali ke ALL ACCOUNTS
          </button>
        </div>
      )}

      {/* Section 11: Individual Account Progress Card */}
      {parsedScope.type === 'INDIVIDUAL' && scopeLabelInfo.individualAccount && (
        <AccountProgressCard
          account={scopeLabelInfo.individualAccount}
          trades={trades}
          rules={rules}
          transactions={transactions}
        />
      )}

      {/* Section 9: Account Type Summary when Scope = ALL */}
      {parsedScope.type === 'ALL' && accounts.length > 0 && (
        <AccountTypeSummaryCard accounts={accounts} trades={trades} />
      )}

      {/* Multi-Currency Notice & Breakdown (Section 10) */}
      {isMultiCurrency && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider font-mono text-zinc-300 flex items-center gap-2">
              <Coins className="w-4 h-4 text-amber-500" />
              <span>Ringkasan Berdasarkan Mata Uang (Multi-Currency)</span>
            </span>
            <span className="text-[11px] text-zinc-500 font-mono">
              {currencyBreakdowns.length} mata uang terpisah
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {currencyBreakdowns.map((cb) => (
              <div
                key={cb.currency}
                className="bg-zinc-950/70 border border-zinc-800 p-3 rounded-lg flex items-center justify-between text-xs font-mono"
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-zinc-100">{cb.currency}</span>
                    <span className="text-[10px] text-zinc-500">({cb.accountsCount} akun)</span>
                  </div>
                  <span className="text-[10px] text-zinc-500 block mt-0.5">
                    Awal: {formatMoney(cb.startingBalance, cb.currency)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-bold text-zinc-100 block">
                    {formatMoney(cb.balance, cb.currency)}
                  </span>
                  <span
                    className={`text-[10px] font-semibold ${
                      cb.netPnL > 0
                        ? 'text-emerald-500'
                        : cb.netPnL < 0
                        ? 'text-rose-500'
                        : 'text-zinc-400'
                    }`}
                  >
                    {formatSignedMoney(cb.netPnL, cb.currency)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Prop Firm Warnings if any within scope */}
      {warningRules.length > 0 && (
        <div className="bg-amber-950/30 border border-amber-800/80 rounded-xl p-3.5 space-y-2">
          <div className="flex items-center gap-2 text-amber-300 text-xs font-semibold uppercase tracking-wider font-mono">
            <ShieldCheck className="w-4 h-4 text-amber-400" />
            <span>Objective / Drawdown Threshold Alert</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
            {warningRules.map((wr) => (
              <div
                key={wr.rule.id}
                className="bg-zinc-950 p-2.5 rounded-lg border border-amber-800/60 flex items-center justify-between shadow-xs"
              >
                <span className="text-zinc-200">{wr.rule.ruleName}:</span>
                <span className="font-bold text-amber-400">{wr.evaluation.displayText}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Primary KPI Cards Grid (Section 6) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Balance */}
        <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800 shadow-xs">
          <span className="text-[11px] font-mono text-zinc-400 uppercase flex items-center gap-1.5">
            <Wallet className="w-3.5 h-3.5 text-zinc-500" />
            <span>Total Modal</span>
          </span>
          <span className="text-lg sm:text-xl font-bold font-mono text-zinc-100 block mt-1">
            {scopedAccounts.length === 0
              ? '—'
              : isMultiCurrency
              ? `${currencyBreakdowns.length} Valuta`
              : formatMoney(totalBalanceState.currentBalance, primaryCurrency)}
          </span>
          <span className="text-[10px] text-zinc-500 font-mono mt-0.5 block truncate">
            {isMultiCurrency
              ? 'Lihat panel multi-currency'
              : `Awal: ${formatMoney(totalStarting, primaryCurrency)}`}
          </span>
        </div>

        {/* Realized P&L */}
        <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800 shadow-xs">
          <span className="text-[11px] font-mono text-zinc-400 uppercase flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-zinc-500" />
            <span>Net Realized P&L</span>
          </span>
          <span
            className={`text-lg sm:text-xl font-bold font-mono block mt-1 ${
              totalPnL > 0
                ? 'text-emerald-400'
                : totalPnL < 0
                ? 'text-rose-400'
                : 'text-zinc-300'
            }`}
          >
            {completedTrades.length > 0
              ? isMultiCurrency
                ? `${totalPnL >= 0 ? '+' : ''}${totalPnL.toLocaleString()}`
                : formatSignedMoney(totalPnL, primaryCurrency)
              : '—'}
          </span>
          <span className="text-[10px] text-zinc-500 font-mono mt-0.5 block">
            {completedTrades.length} trade selesai
          </span>
        </div>

        {/* Return % */}
        <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800 shadow-xs">
          <span className="text-[11px] font-mono text-zinc-400 uppercase flex items-center gap-1.5">
            <Percent className="w-3.5 h-3.5 text-zinc-500" />
            <span>Return %</span>
          </span>
          <span
            className={`text-lg sm:text-xl font-bold font-mono block mt-1 ${
              returnPercentage !== null && returnPercentage > 0
                ? 'text-emerald-400'
                : returnPercentage !== null && returnPercentage < 0
                ? 'text-rose-400'
                : 'text-zinc-300'
            }`}
          >
            {completedTrades.length > 0 && returnPercentage !== null
              ? `${returnPercentage > 0 ? '+' : ''}${returnPercentage}%`
              : '—'}
          </span>
          <span className="text-[10px] text-zinc-500 font-mono mt-0.5 block">
            Terhadap modal awal
          </span>
        </div>

        {/* Win Rate */}
        <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800 shadow-xs">
          <span className="text-[11px] font-mono text-zinc-400 uppercase flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-zinc-500" />
            <span>Win Rate</span>
          </span>
          <span className="text-lg sm:text-xl font-bold font-mono text-zinc-100 block mt-1">
            {completedTrades.length > 0 ? `${winRateStats.winRate}%` : '—'}
          </span>
          <span className="text-[10px] text-zinc-500 font-mono mt-0.5 block truncate">
            {completedTrades.length > 0
              ? `${winRateStats.wins}W · ${winRateStats.losses}L · ${winRateStats.beps}B`
              : 'Belum ada trade'}
          </span>
        </div>

        {/* Profit Factor */}
        <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800 shadow-xs">
          <span className="text-[11px] font-mono text-zinc-400 uppercase flex items-center gap-1.5">
            <Target className="w-3.5 h-3.5 text-zinc-500" />
            <span>Profit Factor</span>
          </span>
          <span className="text-lg sm:text-xl font-bold font-mono text-zinc-100 block mt-1">
            {completedTrades.length > 0 ? profitFactor : '—'}
          </span>
          <span className="text-[10px] text-zinc-500 font-mono mt-0.5 block">
            Avg R: {completedTrades.length > 0 ? `${expectancyStats.averageR}R` : '—'}
          </span>
        </div>

        {/* Max Drawdown */}
        <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800 shadow-xs">
          <span className="text-[11px] font-mono text-zinc-400 uppercase flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-rose-500" />
            <span>Max Drawdown</span>
          </span>
          <span className="text-lg sm:text-xl font-bold font-mono text-rose-400 block mt-1">
            {completedTrades.length > 0
              ? isMultiCurrency
                ? `-${maxDrawdownVal.toLocaleString()}`
                : `-${formatMoney(maxDrawdownVal, primaryCurrency)}`
              : '—'}
          </span>
          <span className="text-[10px] text-zinc-500 font-mono mt-0.5 block">
            Penurunan dari puncak
          </span>
        </div>
      </div>

      {/* Dual Section: Active Trades & Pending Plans */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Active Positions */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 sm:p-5 flex flex-col justify-between shadow-xs">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Posisi Aktif ({activeTrades.length})</span>
              </h3>
              <button
                onClick={() => onNavigate('TRADES')}
                className="text-xs font-mono text-zinc-400 hover:text-zinc-100 flex items-center gap-1 cursor-pointer"
              >
                <span>Lihat semua</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {activeTrades.length === 0 ? (
              <div className="py-8 text-center text-xs text-zinc-500 font-mono border border-dashed border-zinc-800 rounded-lg">
                Tidak ada posisi aktif pada scope ini.
              </div>
            ) : (
              <div className="space-y-2.5">
                {activeTrades.slice(0, 4).map((trade) => {
                  const plan = planMap.get(trade.planId);
                  const acc = accounts.find((a) => a.id === trade.accountId);
                  return (
                    <div
                      key={trade.id}
                      className="bg-zinc-950/70 border border-zinc-800 p-3 rounded-lg flex items-center justify-between text-xs font-mono"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-zinc-100">{plan?.symbol || 'Trade'}</span>
                          {plan && <DirectionBadge direction={plan.direction} />}
                          {acc && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400">
                              {acc.name}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-zinc-500 mt-0.5 block">
                          Fill: {trade.actualEntry} · Lot/Size: {trade.actualPositionSize}
                        </span>
                      </div>

                      <button
                        onClick={() => onAddExit(trade)}
                        className="px-2.5 py-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-950 rounded font-semibold text-[11px] transition-colors cursor-pointer shadow-xs"
                      >
                        Exit
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="pt-3 mt-3 border-t border-zinc-800 text-[11px] font-mono text-zinc-500 flex justify-between">
            <span>Posisi aktif berjalan:</span>
            <span className="font-bold text-zinc-200">
              {activeTrades.length} trade di pasar
            </span>
          </div>
        </div>

        {/* Pending Trading Plans */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 sm:p-5 flex flex-col justify-between shadow-xs">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                <Clock className="w-4 h-4 text-sky-500" />
                <span>Rencana Siap Eksekusi ({pendingPlans.length})</span>
              </h3>
              <button
                onClick={() => onNavigate('PLANS')}
                className="text-xs font-mono text-zinc-400 hover:text-zinc-100 flex items-center gap-1 cursor-pointer"
              >
                <span>Lihat semua</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {pendingPlans.length === 0 ? (
              <div className="py-8 text-center text-xs text-zinc-500 font-mono border border-dashed border-zinc-800 rounded-lg">
                Belum ada rencana yang menunggu trigger pada scope ini.
              </div>
            ) : (
              <div className="space-y-2.5">
                {pendingPlans.slice(0, 4).map((plan) => {
                  const acc = accounts.find((a) => a.id === plan.accountId);
                  return (
                    <div
                      key={plan.id}
                      className="bg-zinc-950/70 border border-zinc-800 p-3 rounded-lg flex items-center justify-between text-xs font-mono"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-zinc-100">{plan.symbol}</span>
                          <DirectionBadge direction={plan.direction} />
                          <PlanStatusBadge status={plan.status} />
                          {acc && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400">
                              {acc.name}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-zinc-500 mt-0.5 block">
                          Entry: {plan.plannedEntry} · SL: {plan.sl} · TP: {plan.tp}
                        </span>
                      </div>

                      <button
                        onClick={() => onTriggerPlan(plan)}
                        className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded font-semibold text-[11px] transition-colors cursor-pointer"
                      >
                        Trigger
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="pt-3 mt-3 border-t border-zinc-800 text-[11px] font-mono text-zinc-500 flex justify-between">
            <span>Aturan disiplin:</span>
            <span className="text-zinc-300">Selalu pasang SL sebelum trigger</span>
          </div>
        </div>
      </div>

      {/* Recent Activity Mini List */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 sm:p-5 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-zinc-100">Trade Terakhir Selesai</h3>
          <button
            onClick={() => onNavigate('CALENDAR')}
            className="text-xs font-mono text-zinc-400 hover:text-zinc-100 flex items-center gap-1 cursor-pointer"
          >
            <span>Buka Kalender</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {completedTrades.length === 0 ? (
          <p className="text-xs text-zinc-500 italic py-2">
            Belum ada trade yang diselesaikan pada scope ini.
          </p>
        ) : (
          <div className="space-y-1.5 font-mono text-xs">
            {completedTrades.slice(-5).reverse().map((t) => {
              const plan = planMap.get(t.planId);
              const acc = accounts.find((a) => a.id === t.accountId);
              return (
                <div
                  key={t.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-zinc-950/70 border border-zinc-800"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-zinc-200">{plan?.symbol || 'Trade'}</span>
                    {acc && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-850 text-zinc-400">
                        {acc.name}
                      </span>
                    )}
                    <span className="text-zinc-500 text-[11px]">
                      {new Date(t.completedAt || t.actualEntryTime).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <ResultBadge result={t.result} pnl={t.realizedPnL ?? undefined} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
