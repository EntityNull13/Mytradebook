import { Modal } from '../common/Modal';
import { ResultBadge, DirectionBadge } from '../common/Badge';
import { formatSignedMoney } from '../../calculations';
import type { Plan, Trade } from '../../types';

interface DayDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  dateStr: string; // 'YYYY-MM-DD'
  dayStats?: {
    pnl: number;
    tradesCount: number;
    wins: number;
    losses: number;
    beps: number;
    plansCount: number;
  };
  dayPlans: Plan[];
  dayTrades: Trade[];
  currency?: string;
}

export function DayDetailModal({
  isOpen,
  onClose,
  dateStr,
  dayStats,
  dayPlans,
  dayTrades,
  currency = 'USD',
}: DayDetailModalProps) {
  const formattedDate = new Date(dateStr + 'T00:00:00').toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const pnl = dayStats?.pnl ?? 0;
  const hasActivity = (dayStats?.tradesCount ?? 0) > 0 || (dayStats?.plansCount ?? 0) > 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={formattedDate}
      subtitle="Complete intraday breakdown of plans and execution results"
      maxWidth="lg"
    >
      <div className="space-y-5">
        {/* Daily KPI Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800">
            <span className="text-[10px] uppercase font-mono text-zinc-500 block">Daily P&L</span>
            <span
              className={`text-base font-bold font-mono ${
                pnl > 0 ? 'text-emerald-400' : pnl < 0 ? 'text-rose-400' : 'text-zinc-400'
              }`}
            >
              {hasActivity
                ? formatSignedMoney(pnl, currency)
                : '—'}
            </span>
          </div>

          <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800">
            <span className="text-[10px] uppercase font-mono text-zinc-500 block">Completed Trades</span>
            <span className="text-base font-bold font-mono text-zinc-200">
              {dayStats?.tradesCount ?? 0}
            </span>
          </div>

          <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800">
            <span className="text-[10px] uppercase font-mono text-zinc-500 block">Win / Loss / BEP</span>
            <span className="text-sm font-bold font-mono text-zinc-300">
              <span className="text-emerald-400">{dayStats?.wins ?? 0}W</span> ·{' '}
              <span className="text-rose-400">{dayStats?.losses ?? 0}L</span> ·{' '}
              <span className="text-zinc-400">{dayStats?.beps ?? 0}B</span>
            </span>
          </div>

          <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800">
            <span className="text-[10px] uppercase font-mono text-zinc-500 block">Plans Created</span>
            <span className="text-base font-bold font-mono text-zinc-200">
              {dayStats?.plansCount ?? 0}
            </span>
          </div>
        </div>

        {/* Executed Trades on this day */}
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
            Executed Trades ({dayTrades.length})
          </h4>
          {dayTrades.length === 0 ? (
            <p className="text-xs text-zinc-500 italic py-2">No executed trades completed on this date.</p>
          ) : (
            <div className="space-y-2">
              {dayTrades.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between p-2.5 bg-zinc-950 rounded-lg border border-zinc-800 text-xs font-mono"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-200 font-bold">Trade fill: {t.actualEntry}</span>
                    <span className="text-zinc-400">({t.actualPositionSize} size)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ResultBadge result={t.result} pnl={t.realizedPnL ?? undefined} currency={currency} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Plans Created on this day */}
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
            Plans Created ({dayPlans.length})
          </h4>
          {dayPlans.length === 0 ? (
            <p className="text-xs text-zinc-500 italic py-2">No plans recorded on this date.</p>
          ) : (
            <div className="space-y-2">
              {dayPlans.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between p-2.5 bg-zinc-950 rounded-lg border border-zinc-800 text-xs font-mono"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-zinc-100">{p.symbol}</span>
                    <DirectionBadge direction={p.direction} />
                    <span className="text-zinc-400">Entry: {p.plannedEntry}</span>
                  </div>
                  <span className="text-[11px] uppercase text-zinc-400">{p.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end pt-3 border-t border-zinc-800">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-zinc-300 hover:text-zinc-100 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors font-mono"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}
