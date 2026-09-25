import { useState } from 'react';
import { ClipboardList } from 'lucide-react';
import type { PublishedPlan } from '../../types/public';

interface PublicPlansViewProps {
  plans: PublishedPlan[];
  selectedAccountId: string;
}

export function PublicPlansView({ plans, selectedAccountId }: PublicPlansViewProps) {
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PLANNED' | 'TRIGGERED' | 'INVALID'>('ALL');
  const [directionFilter, setDirectionFilter] = useState<'ALL' | 'BUY' | 'SELL'>('ALL');

  const filtered = plans.filter((p) => {
    if (selectedAccountId !== 'ALL' && p.accountId !== selectedAccountId) return false;
    if (statusFilter !== 'ALL' && p.status !== statusFilter) return false;
    if (directionFilter !== 'ALL' && p.direction !== directionFilter) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Header & Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-900 p-4 rounded-xl border border-zinc-800">
        <div>
          <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-zinc-400" />
            <span>Trading Plans</span>
            <span className="text-xs font-mono text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded-full">
              {filtered.length}
            </span>
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Pre-market analyses and planned trade setups.
          </p>
        </div>

        {/* Filter controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg bg-zinc-950 p-0.5 border border-zinc-800">
            {(['ALL', 'PLANNED', 'TRIGGERED', 'INVALID'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  statusFilter === s ? 'bg-zinc-800 text-zinc-100 font-semibold' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {s}
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

      {/* Plans List */}
      {filtered.length === 0 ? (
        <div className="p-12 rounded-xl bg-zinc-900/40 border border-zinc-800 text-center">
          <p className="text-xs text-zinc-400">No trading plans match the selected filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {filtered.map((plan) => (
            <div
              key={plan.id}
              className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex flex-col justify-between space-y-3"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold font-mono text-zinc-100">{plan.symbol}</span>
                    <span
                      className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                        plan.direction === 'BUY'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : 'bg-rose-950 text-rose-300 border border-rose-800'
                      }`}
                    >
                      {plan.direction}
                    </span>
                    <span className="text-[10px] font-mono text-zinc-400 bg-zinc-800 px-1.5 py-0.5 rounded">
                      {plan.timeframe}
                    </span>
                  </div>

                  <span
                    className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded ${
                      plan.status === 'PLANNED'
                        ? 'bg-blue-950 text-blue-300 border border-blue-800'
                        : plan.status === 'TRIGGERED'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                    }`}
                  >
                    {plan.status}
                  </span>
                </div>

                {plan.setupName && (
                  <span className="text-xs font-semibold text-zinc-300 block mb-1.5">
                    Setup: {plan.setupName}
                  </span>
                )}

                <p className="text-xs text-zinc-300 leading-relaxed line-clamp-2">
                  {plan.entryReason}
                </p>

                {plan.invalidReason && (
                  <div className="mt-2 text-[11px] text-zinc-400">
                    <span className="text-rose-400 font-medium">Invalid if: </span>
                    <span>{plan.invalidReason}</span>
                  </div>
                )}
              </div>

              {/* Price Levels Grid */}
              <div className="grid grid-cols-4 gap-1.5 p-2 rounded-lg bg-zinc-950 border border-zinc-800/80 text-center font-mono">
                <div>
                  <span className="text-[9px] text-zinc-500 uppercase block">Entry</span>
                  <span className="text-xs text-zinc-200 font-semibold">{plan.plannedEntry}</span>
                </div>
                <div>
                  <span className="text-[9px] text-zinc-500 uppercase block">SL</span>
                  <span className="text-xs text-rose-400 font-semibold">{plan.sl ?? '-'}</span>
                </div>
                <div>
                  <span className="text-[9px] text-zinc-500 uppercase block">TP</span>
                  <span className="text-xs text-emerald-400 font-semibold">{plan.tp ?? '-'}</span>
                </div>
                <div>
                  <span className="text-[9px] text-zinc-500 uppercase block">R:R</span>
                  <span className="text-xs text-zinc-300 font-semibold">
                    1:{plan.plannedRiskReward ? plan.plannedRiskReward.toFixed(1) : '-'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
