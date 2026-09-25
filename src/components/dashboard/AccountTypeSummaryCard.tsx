import React from 'react';
import type { Account, Trade } from '../../types';
import { calculateAccountTypeSummary, formatSignedMoney } from '../../calculations';
import { Building2, User, PlayCircle, FolderArchive, Layers } from 'lucide-react';

interface AccountTypeSummaryCardProps {
  accounts: Account[];
  trades: Trade[];
}

export function AccountTypeSummaryCard({ accounts, trades }: AccountTypeSummaryCardProps) {
  const summaries = calculateAccountTypeSummary(accounts, trades);

  const getIcon = (type: string) => {
    switch (type) {
      case 'PERSONAL':
        return <User className="w-4 h-4 text-sky-400" />;
      case 'PROP_FIRM':
        return <Building2 className="w-4 h-4 text-indigo-400" />;
      case 'DEMO':
        return <PlayCircle className="w-4 h-4 text-emerald-400" />;
      default:
        return <FolderArchive className="w-4 h-4 text-zinc-400" />;
    }
  };

  return (
    <div className="bg-zinc-900/70 border border-zinc-800 rounded-xl p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-zinc-400" />
          <h3 className="text-sm font-bold text-zinc-100">Account Types Overview</h3>
        </div>
        <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">
          Descriptive Summary
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {summaries.map((s) => {
          const currencies = Object.keys(s.currencyPnL);
          const hasPnL = currencies.length > 0 && s.tradesCount > 0;

          return (
            <div
              key={s.type}
              className="p-3.5 bg-zinc-950/70 border border-zinc-850 rounded-xl flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800">
                    {getIcon(s.type)}
                  </div>
                  <span className="text-xs font-semibold text-zinc-200">{s.typeName}</span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-zinc-800">
                  {s.accountsCount} {s.accountsCount === 1 ? 'acc' : 'accs'}
                </span>
              </div>

              <div className="mt-2 space-y-1">
                <div className="flex items-baseline justify-between text-xs font-mono">
                  <span className="text-[10px] text-zinc-500 uppercase">Trades:</span>
                  <span className="text-zinc-300 font-semibold">{s.tradesCount}</span>
                </div>

                <div className="pt-1.5 border-t border-zinc-900">
                  <span className="text-[10px] text-zinc-500 font-mono uppercase block mb-0.5">
                    Net Realized P&L:
                  </span>
                  {!hasPnL ? (
                    <span className="text-xs font-mono text-zinc-500">—</span>
                  ) : (
                    <div className="space-y-0.5">
                      {currencies.map((curr) => {
                        const pnl = s.currencyPnL[curr];
                        return (
                          <div
                            key={curr}
                            className={`text-xs font-mono font-bold ${
                              pnl > 0
                                ? 'text-emerald-400'
                                : pnl < 0
                                ? 'text-rose-400'
                                : 'text-zinc-400'
                            }`}
                          >
                            {formatSignedMoney(pnl, curr)}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
