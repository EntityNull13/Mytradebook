import { useState, useMemo } from 'react';
import { calculateDailyPnL, formatSignedMoney } from '../../calculations';
import { DayDetailModal } from './DayDetailModal';
import type { Trade, Plan, Account } from '../../types';
import { getScopedAccounts, getScopedAccountIds } from '../../utils/accountScope';
import { ActiveScopeBanner } from '../common/AccountScopeSelector';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';

interface CalendarViewProps {
  trades: Trade[];
  plans: Plan[];
  accounts: Account[];
  selectedScope: string;
  onSelectScope?: (scope: string) => void;
}

export function CalendarView({
  trades,
  plans,
  accounts,
  selectedScope,
  onSelectScope,
}: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDayStr, setSelectedDayStr] = useState<string | null>(null);

  // Filter trades/plans strictly by AccountScope (Section 13)
  const scopedAccounts = useMemo(
    () => getScopedAccounts(accounts, selectedScope),
    [accounts, selectedScope]
  );

  const scopedAccountIds = useMemo(
    () => getScopedAccountIds(accounts, selectedScope),
    [accounts, selectedScope]
  );

  const filteredTrades = useMemo(
    () => trades.filter((t) => scopedAccountIds.has(t.accountId)),
    [trades, scopedAccountIds]
  );

  const filteredPlans = useMemo(
    () => plans.filter((p) => scopedAccountIds.has(p.accountId)),
    [plans, scopedAccountIds]
  );

  const currency =
    scopedAccounts.length > 0 ? scopedAccounts[0].currency || 'USD' : 'USD';

  const dailyStatsMap = useMemo(
    () => calculateDailyPnL(filteredTrades, filteredPlans),
    [filteredTrades, filteredPlans]
  );

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const todayMonth = () => setCurrentDate(new Date());

  const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  // Compute month's start and days count
  const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Aggregate monthly P&L
  let monthPnL = 0;
  let monthTrades = 0;
  let monthProfitableDays = 0;
  let monthLossDays = 0;

  for (let day = 1; day <= daysInMonth; day++) {
    const pad = (n: number) => n.toString().padStart(2, '0');
    const dayStr = `${year}-${pad(month + 1)}-${pad(day)}`;
    const stats = dailyStatsMap.get(dayStr);
    if (stats) {
      monthPnL += stats.pnl;
      monthTrades += stats.tradesCount;
      if (stats.tradesCount > 0) {
        if (stats.pnl > 0) monthProfitableDays++;
        else if (stats.pnl < 0) monthLossDays++;
      }
    }
  }

  // Days grid
  const daysArray: Array<{ dayNum: number; dateStr: string } | null> = [];
  for (let i = 0; i < firstDayIndex; i++) {
    daysArray.push(null);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const pad = (n: number) => n.toString().padStart(2, '0');
    const dateStr = `${year}-${pad(month + 1)}-${pad(day)}`;
    daysArray.push({ dayNum: day, dateStr });
  }

  const selectedDayPlans = selectedDayStr
    ? filteredPlans.filter((p) => p.createdAt.slice(0, 10) === selectedDayStr)
    : [];
  const selectedDayTrades = selectedDayStr
    ? filteredTrades.filter(
        (t) => (t.completedAt || t.actualEntryTime || '').slice(0, 10) === selectedDayStr
      )
    : [];

  return (
    <div className="space-y-6">
      {/* Header toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-zinc-100 tracking-tight flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-zinc-400" />
            <span>Trading Calendar</span>
          </h2>
          <p className="text-xs text-zinc-400">
            Intraday P&L distribution, profitable day consistency, and execution logs
          </p>
        </div>

        {/* Month Navigation & Stats */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-lg border border-zinc-800">
            <button
              onClick={prevMonth}
              className="p-1.5 text-zinc-400 hover:text-zinc-100 rounded hover:bg-zinc-800 transition-colors"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={todayMonth}
              className="px-2.5 py-1 text-xs font-mono font-semibold text-zinc-200 hover:text-white transition-colors"
            >
              {monthName}
            </button>
            <button
              onClick={nextMonth}
              className="p-1.5 text-zinc-400 hover:text-zinc-100 rounded hover:bg-zinc-800 transition-colors"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Account Scope Active Banner (Section 13) */}
      <ActiveScopeBanner
        accounts={accounts}
        selectedScope={selectedScope}
        onSelectScope={onSelectScope}
      />

      {/* Monthly Metrics Summary Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-zinc-900/60 p-3.5 rounded-xl border border-zinc-800/80">
        <div>
          <span className="text-[10px] uppercase font-mono text-zinc-500 block">Monthly Realized P&L</span>
          <span
            className={`text-base font-bold font-mono ${
              monthPnL > 0 ? 'text-emerald-400' : monthPnL < 0 ? 'text-rose-400' : 'text-zinc-300'
            }`}
          >
            {monthTrades > 0
              ? formatSignedMoney(monthPnL, currency)
              : '—'}
          </span>
        </div>

        <div>
          <span className="text-[10px] uppercase font-mono text-zinc-500 block">Trades Completed</span>
          <span className="text-base font-bold font-mono text-zinc-200">{monthTrades}</span>
        </div>

        <div>
          <span className="text-[10px] uppercase font-mono text-zinc-500 block">Profitable Days</span>
          <span className="text-base font-bold font-mono text-emerald-400">{monthProfitableDays} days</span>
        </div>

        <div>
          <span className="text-[10px] uppercase font-mono text-zinc-500 block">Loss Days</span>
          <span className="text-base font-bold font-mono text-rose-400">{monthLossDays} days</span>
        </div>
      </div>

      {/* Month Days Calendar Grid */}
      <div className="bg-zinc-900/70 border border-zinc-800 rounded-xl p-4 sm:p-5">
        {/* Day of week headers */}
        <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2 text-center font-mono text-[11px] text-zinc-400 uppercase font-semibold">
          <div>Sun</div>
          <div>Mon</div>
          <div>Tue</div>
          <div>Wed</div>
          <div>Thu</div>
          <div>Fri</div>
          <div>Sat</div>
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7 gap-1 sm:gap-2 font-mono">
          {daysArray.map((day, idx) => {
            if (!day) {
              return <div key={`empty-${idx}`} className="h-20 sm:h-24 bg-zinc-950/30 rounded-lg" />;
            }

            const stats = dailyStatsMap.get(day.dateStr);
            const hasTrades = stats && stats.tradesCount > 0;
            const hasPlans = stats && stats.plansCount > 0;
            const pnl = stats?.pnl ?? 0;

            const isPositive = pnl > 0;
            const isNegative = pnl < 0;

            let bgClass = 'bg-zinc-950/60 hover:bg-zinc-800/60 border-zinc-850';
            if (hasTrades) {
              if (isPositive) bgClass = 'bg-emerald-950/30 border-emerald-900/50 hover:bg-emerald-950/50';
              else if (isNegative) bgClass = 'bg-rose-950/30 border-rose-900/50 hover:bg-rose-950/50';
              else bgClass = 'bg-zinc-850/60 border-zinc-700/50 hover:bg-zinc-800';
            }

            const isToday =
              new Date().toISOString().slice(0, 10) === day.dateStr;

            return (
              <button
                key={day.dateStr}
                onClick={() => setSelectedDayStr(day.dateStr)}
                className={`h-20 sm:h-24 p-1.5 sm:p-2 rounded-lg border text-left flex flex-col justify-between transition-colors relative cursor-pointer ${bgClass}`}
              >
                <div className="flex items-center justify-between w-full">
                  <span
                    className={`text-xs font-bold ${
                      isToday
                        ? 'w-5 h-5 rounded-full bg-zinc-100 text-zinc-950 flex items-center justify-center font-bold text-[10px]'
                        : 'text-zinc-400'
                    }`}
                  >
                    {day.dayNum}
                  </span>

                  {hasPlans && (
                    <span
                      className="text-[9px] px-1 rounded bg-zinc-800 text-zinc-300 border border-zinc-700"
                      title={`${stats.plansCount} plans logged`}
                    >
                      {stats.plansCount}P
                    </span>
                  )}
                </div>

                {hasTrades ? (
                  <div className="space-y-0.5">
                    <span
                      className={`text-[11px] sm:text-xs font-bold block truncate ${
                        isPositive
                          ? 'text-emerald-400'
                          : isNegative
                          ? 'text-rose-400'
                          : 'text-zinc-400'
                      }`}
                    >
                      {formatSignedMoney(pnl, currency)}
                    </span>
                    <span className="text-[9px] sm:text-[10px] text-zinc-400 block truncate">
                      {stats.tradesCount}T ({stats.wins}W/{stats.losses}L)
                    </span>
                  </div>
                ) : (
                  <div className="text-[10px] text-zinc-600 italic">No activity</div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Day Detail Modal */}
      {selectedDayStr && (
        <DayDetailModal
          isOpen={!!selectedDayStr}
          onClose={() => setSelectedDayStr(null)}
          dateStr={selectedDayStr}
          dayStats={dailyStatsMap.get(selectedDayStr)}
          dayPlans={selectedDayPlans}
          dayTrades={selectedDayTrades}
          currency={currency}
        />
      )}
    </div>
  );
}
