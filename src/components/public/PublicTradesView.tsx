import { useState } from 'react';
import { Flame, ArrowUpRight, ArrowDownRight, ArrowRight } from 'lucide-react';
import type { PublishedTrade } from '../../types/public';
import { formatMoney } from '../../calculations';

interface PublicTradesViewProps {
  trades: PublishedTrade[];
  selectedAccountId: string;
  onSelectTrade: (trade: PublishedTrade) => void;
  currency?: string;
}

export function PublicTradesView({
  trades,
  selectedAccountId,
  onSelectTrade,
  currency = 'USD',
}: PublicTradesViewProps) {
  const [resultFilter, setResultFilter] = useState<'ALL' | 'PROFIT' | 'LOSS' | 'BEP'>('ALL');
  const [directionFilter, setDirectionFilter] = useState<'ALL' | 'BUY' | 'SELL'>('ALL');

  const filtered = trades.filter((t) => {
    if (selectedAccountId !== 'ALL' && t.accountId !== selectedAccountId) return false;
    if (resultFilter !== 'ALL' && t.result !== resultFilter) return false;
    if (directionFilter !== 'ALL' && t.direction !== directionFilter) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Header & Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-900 p-4 rounded-xl border border-zinc-800">
        <div>
          <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
            <Flame className="w-4 h-4 text-zinc-400" />
            <span>Trading Journal</span>
            <span className="text-xs font-mono text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded-full">
              {filtered.length}
            </span>
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Verified execution logs and trade outcomes. Click any trade for full execution breakdown.
          </p>
        </div>

        {/* Filter controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg bg-zinc-950 p-0.5 border border-zinc-800">
            {(['ALL', 'PROFIT', 'LOSS', 'BEP'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setResultFilter(r)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  resultFilter === r ? 'bg-zinc-800 text-zinc-100 font-semibold' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          <div className="flex rounded-lg bg-zinc-950 p-0.5 border border-zinc-800">
            {(['ALL', 'BUY', 'SELL'] as const).map((d) => (
              <button
                key={d}
                onClick={() => setDirectionFilter(d)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  directionFilter === d ? 'bg-zinc-800 text-zinc-100 font-semibold' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Trades List */}
      {filtered.length === 0 ? (
        <div className="p-12 rounded-xl bg-zinc-900/40 border border-zinc-800 text-center">
          <p className="text-xs text-zinc-400">No trades match the selected filters.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((trade) => {
            const isProfit = (trade.realizedPnL || 0) > 0;
            const isLoss = (trade.realizedPnL || 0) < 0;

            return (
              <div
                key={trade.id}
                onClick={() => onSelectTrade(trade)}
                className="p-3.5 sm:p-4 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-all cursor-pointer flex items-center justify-between group shadow-xs"
              >
                <div className="flex items-center gap-3 sm:gap-4">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center font-mono text-sm shrink-0 ${
                      trade.direction === 'BUY'
                        ? 'bg-emerald-950/70 text-emerald-400 border border-emerald-800/80'
                        : 'bg-rose-950/70 text-rose-400 border border-rose-800/80'
                    }`}
                  >
                    {trade.direction === 'BUY' ? (
                      <ArrowUpRight className="w-5 h-5" />
                    ) : (
                      <ArrowDownRight className="w-5 h-5" />
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm sm:text-base font-bold font-mono text-zinc-100">
                        {trade.symbol}
                      </span>
                      <span
                        className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded ${
                          trade.direction === 'BUY'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : 'bg-rose-950 text-rose-300 border border-rose-800'
                        }`}
                      >
                        {trade.direction}
                      </span>
                      <span
                        className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded ${
                          trade.result === 'PROFIT'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : trade.result === 'LOSS'
                            ? 'bg-rose-950 text-rose-300 border border-rose-800'
                            : 'bg-zinc-800 text-zinc-400'
                        }`}
                      >
                        {trade.result}
                      </span>
                      {trade.setupName && (
                        <span className="text-[11px] text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded hidden sm:inline-block">
                          {trade.setupName}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-zinc-500 font-mono mt-1">
                      <span>Entry: {trade.actualEntry}</span>
                      <span>·</span>
                      <span>SL: {trade.initialStopLoss ?? '-'}</span>
                      <span>·</span>
                      <span>{new Date(trade.actualEntryTime).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-right shrink-0">
                  <div>
                    <div
                      className={`text-sm sm:text-base font-bold font-mono ${
                        isProfit ? 'text-emerald-400' : isLoss ? 'text-rose-400' : 'text-zinc-400'
                      }`}
                    >
                      {trade.realizedPnL >= 0 ? '+' : ''}
                      {formatMoney(trade.realizedPnL, currency)}
                    </div>
                    <div className="text-[11px] font-mono text-zinc-400">
                      {(trade.realizedRMultiple || 0) >= 0 ? '+' : ''}
                      {(trade.realizedRMultiple || 0).toFixed(2)}R
                    </div>
                  </div>

                  <ArrowRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-300 transition-colors hidden sm:block" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
