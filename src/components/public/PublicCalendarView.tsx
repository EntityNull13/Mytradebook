import { useState, useMemo } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import type { PublishedTrade } from '../../types/public';
import { formatMoney } from '../../calculations';

interface PublicCalendarViewProps {
  trades: PublishedTrade[];
  selectedAccountId: string;
  onSelectTrade: (trade: PublishedTrade) => void;
  currency?: string;
}

export function PublicCalendarView({
  trades,
  selectedAccountId,
  onSelectTrade,
  currency = 'USD',
}: PublicCalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(() => new Date());

  const filteredTrades = useMemo(() => {
    return trades.filter((t) => {
      if (selectedAccountId !== 'ALL' && t.accountId !== selectedAccountId) return false;
      return t.status === 'COMPLETED';
    });
  }, [trades, selectedAccountId]);

  // Aggregate by Date Key (YYYY-MM-DD)
  const dailyData = useMemo(() => {
    const map = new Map<string, { pnl: number; count: number; trades: PublishedTrade[] }>();

    for (const trade of filteredTrades) {
      const dateStr = trade.completedAt || trade.actualEntryTime;
      const key = dateStr.slice(0, 10);
      const existing = map.get(key) || { pnl: 0, count: 0, trades: [] };
      existing.pnl += trade.realizedPnL || 0;
      existing.count += 1;
      existing.trades.push(trade);
      map.set(key, existing);
    }

    return map;
  }, [filteredTrades]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  // Calendar calculations
  const firstDayIndex = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  // Monthly stats
  const monthlyPnL = useMemo(() => {
    let sum = 0;
    for (let day = 1; day <= daysInMonth; day++) {
      const dayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const entry = dailyData.get(dayStr);
      if (entry) sum += entry.pnl;
    }
    return sum;
  }, [dailyData, year, month, daysInMonth]);

  const [selectedDayTrades, setSelectedDayTrades] = useState<{ day: string; trades: PublishedTrade[] } | null>(null);

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-900 p-4 rounded-xl border border-zinc-800">
        <div>
          <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-zinc-400" />
            <span>Trading Calendar</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Daily closed trading performance distribution.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <span className="text-[10px] text-zinc-400 uppercase tracking-wider block">Month P&L</span>
            <span
              className={`text-sm font-bold font-mono ${
                monthlyPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {monthlyPnL >= 0 ? '+' : ''}
              {formatMoney(monthlyPnL, currency)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={prevMonth}
              className="p-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-zinc-100 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-semibold text-zinc-200 min-w-[120px] text-center font-mono">
              {monthName}
            </span>
            <button
              onClick={nextMonth}
              className="p-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-zinc-100 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-3 sm:p-4 shadow-xs">
        {/* Days of week */}
        <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2 text-center text-[11px] font-semibold text-zinc-500 uppercase font-mono">
          <span>Sun</span>
          <span>Mon</span>
          <span>Tue</span>
          <span>Wed</span>
          <span>Thu</span>
          <span>Fri</span>
          <span>Sat</span>
        </div>

        {/* Days cells */}
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {/* Empty prefix slots */}
          {Array.from({ length: firstDayIndex }).map((_, i) => (
            <div key={`empty-${i}`} className="min-h-[64px] sm:min-h-[80px] rounded-lg bg-zinc-950/20" />
          ))}

          {/* Actual days */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dayNum = i + 1;
            const dayKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
            const entry = dailyData.get(dayKey);

            const hasTrades = entry && entry.count > 0;
            const isProfit = entry && entry.pnl > 0;
            const isLoss = entry && entry.pnl < 0;

            return (
              <div
                key={dayKey}
                onClick={() => {
                  if (hasTrades) {
                    setSelectedDayTrades({ day: dayKey, trades: entry.trades });
                  }
                }}
                className={`min-h-[64px] sm:min-h-[80px] p-2 rounded-lg border transition-all flex flex-col justify-between ${
                  hasTrades
                    ? isProfit
                      ? 'bg-emerald-950/30 border-emerald-800/60 hover:border-emerald-700 cursor-pointer'
                      : isLoss
                      ? 'bg-rose-950/30 border-rose-800/60 hover:border-rose-700 cursor-pointer'
                      : 'bg-zinc-800/50 border-zinc-700 hover:border-zinc-600 cursor-pointer'
                    : 'bg-zinc-950/60 border-zinc-800/60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-medium text-zinc-400">{dayNum}</span>
                  {hasTrades && (
                    <span className="text-[9px] font-mono px-1 rounded bg-zinc-800 text-zinc-400">
                      {entry.count}T
                    </span>
                  )}
                </div>

                {hasTrades ? (
                  <div className="text-right">
                    <span
                      className={`text-[11px] sm:text-xs font-mono font-bold block truncate ${
                        isProfit ? 'text-emerald-400' : isLoss ? 'text-rose-400' : 'text-zinc-300'
                      }`}
                    >
                      {entry.pnl >= 0 ? '+' : ''}
                      {formatMoney(entry.pnl, currency)}
                    </span>
                  </div>
                ) : (
                  <div />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Day popup list */}
      {selectedDayTrades && (
        <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300">
              Trades on {selectedDayTrades.day} ({selectedDayTrades.trades.length})
            </h3>
            <button
              onClick={() => setSelectedDayTrades(null)}
              className="text-xs text-zinc-500 hover:text-zinc-300 cursor-pointer"
            >
              Close
            </button>
          </div>

          <div className="space-y-2">
            {selectedDayTrades.trades.map((t) => (
              <div
                key={t.id}
                onClick={() => onSelectTrade(t)}
                className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 hover:border-zinc-700 cursor-pointer flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2">
                  <span className="font-bold font-mono text-zinc-200">{t.symbol}</span>
                  <span className="font-mono text-[10px] text-zinc-400">({t.direction})</span>
                  <span
                    className={`text-[9px] font-mono px-1 rounded ${
                      t.result === 'PROFIT' ? 'text-emerald-400' : t.result === 'LOSS' ? 'text-rose-400' : 'text-zinc-400'
                    }`}
                  >
                    {t.result}
                  </span>
                </div>
                <div className="text-right font-mono">
                  <span className={t.realizedPnL >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                    {t.realizedPnL >= 0 ? '+' : ''}
                    {formatMoney(t.realizedPnL, currency)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
