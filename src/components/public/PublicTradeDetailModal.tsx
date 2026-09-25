import { X, ArrowUpRight, ArrowDownRight, Award } from 'lucide-react';
import type { PublishedTrade } from '../../types/public';
import { formatMoney } from '../../calculations';

interface PublicTradeDetailModalProps {
  trade: PublishedTrade | null;
  onClose: () => void;
  currency?: string;
}

export function PublicTradeDetailModal({
  trade,
  onClose,
  currency = 'USD',
}: PublicTradeDetailModalProps) {
  if (!trade) return null;

  const isProfit = (trade.realizedPnL || 0) > 0;
  const isLoss = (trade.realizedPnL || 0) < 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-zinc-800 flex items-center justify-between sticky top-0 bg-zinc-900/95 backdrop-blur-md z-10">
          <div className="flex items-center gap-3">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center font-mono font-bold text-sm ${
                trade.direction === 'BUY'
                  ? 'bg-emerald-950/70 border border-emerald-800/80 text-emerald-400'
                  : 'bg-rose-950/70 border border-rose-800/80 text-rose-400'
              }`}
            >
              {trade.direction === 'BUY' ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-zinc-100 font-mono">{trade.symbol}</h2>
                <span
                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                    trade.direction === 'BUY'
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                      : 'bg-rose-950 text-rose-300 border border-rose-800'
                  }`}
                >
                  {trade.direction}
                </span>
                <span
                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                    trade.result === 'PROFIT'
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                      : trade.result === 'LOSS'
                      ? 'bg-rose-950 text-rose-300 border border-rose-800'
                      : 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                  }`}
                >
                  {trade.result || 'BEP'}
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Entry: {new Date(trade.actualEntryTime).toLocaleString()}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5 flex-1">
          {/* Main Outcome Card */}
          <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-zinc-400 uppercase tracking-wider block">Realized Return</span>
              <div
                className={`text-2xl font-bold font-mono mt-0.5 ${
                  isProfit ? 'text-emerald-400' : isLoss ? 'text-rose-400' : 'text-zinc-300'
                }`}
              >
                {trade.realizedPnL >= 0 ? '+' : ''}
                {formatMoney(trade.realizedPnL, currency)}
              </div>
            </div>
            <div className="text-right">
              <span className="text-[11px] text-zinc-400 uppercase tracking-wider block">Realized R</span>
              <div
                className={`text-xl font-bold font-mono mt-0.5 ${
                  (trade.realizedRMultiple || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {trade.realizedRMultiple !== undefined
                  ? `${trade.realizedRMultiple >= 0 ? '+' : ''}${trade.realizedRMultiple.toFixed(2)}R`
                  : '-'}
              </div>
            </div>
          </div>

          {/* Trade Execution Metrics */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2.5">
              Execution Details
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              <div className="p-2.5 rounded-lg bg-zinc-950/60 border border-zinc-800">
                <span className="text-[10px] text-zinc-500 uppercase block">Entry Price</span>
                <span className="text-xs font-mono font-semibold text-zinc-200">
                  {trade.actualEntry}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-zinc-950/60 border border-zinc-800">
                <span className="text-[10px] text-zinc-500 uppercase block">Stop Loss</span>
                <span className="text-xs font-mono font-semibold text-rose-400">
                  {trade.initialStopLoss ?? 'None'}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-zinc-950/60 border border-zinc-800">
                <span className="text-[10px] text-zinc-500 uppercase block">Take Profit</span>
                <span className="text-xs font-mono font-semibold text-emerald-400">
                  {trade.takeProfit ?? 'Open / Dynamic'}
                </span>
              </div>
              {trade.actualPositionSize !== undefined && (
                <div className="p-2.5 rounded-lg bg-zinc-950/60 border border-zinc-800">
                  <span className="text-[10px] text-zinc-500 uppercase block">Position Size</span>
                  <span className="text-xs font-mono font-semibold text-zinc-200">
                    {trade.actualPositionSize}
                  </span>
                </div>
              )}
              {trade.setupName && (
                <div className="p-2.5 rounded-lg bg-zinc-950/60 border border-zinc-800">
                  <span className="text-[10px] text-zinc-500 uppercase block">Setup</span>
                  <span className="text-xs font-semibold text-zinc-200">{trade.setupName}</span>
                </div>
              )}
              <div className="p-2.5 rounded-lg bg-zinc-950/60 border border-zinc-800">
                <span className="text-[10px] text-zinc-500 uppercase block">Planned R:R</span>
                <span className="text-xs font-mono font-semibold text-zinc-200">
                  1:{trade.plannedRiskReward ? trade.plannedRiskReward.toFixed(1) : '-'}
                </span>
              </div>
            </div>
          </div>

          {/* Exits Breakdown */}
          {trade.exits && trade.exits.length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2.5">
                Exits ({trade.exits.length})
              </h3>
              <div className="space-y-2">
                {trade.exits.map((exit, idx) => (
                  <div
                    key={exit.id || idx}
                    className="p-3 rounded-lg bg-zinc-950/70 border border-zinc-800 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-zinc-200 font-mono">{exit.exitType}</span>
                        <span className="text-zinc-500 text-[11px]">@ {exit.price}</span>
                      </div>
                      {exit.notes && (
                        <p className="text-zinc-400 text-[11px] mt-0.5">{exit.notes}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <span
                        className={`font-mono font-bold ${
                          exit.realizedPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {exit.realizedPnL >= 0 ? '+' : ''}
                        {formatMoney(exit.realizedPnL, currency)}
                      </span>
                      <span className="block text-[10px] text-zinc-500 font-mono">
                        {new Date(exit.executedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Published Review */}
          {trade.review && (
            <div className="p-4 rounded-xl bg-zinc-950/90 border border-zinc-800 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                <Award className="w-3.5 h-3.5 text-amber-400" />
                <span>Trade Review & Lessons</span>
              </h3>

              {trade.review.followedPlan && (
                <div className="text-xs flex items-center gap-2">
                  <span className="text-zinc-500 text-[11px]">Followed Plan:</span>
                  <span
                    className={`font-mono font-semibold px-2 py-0.5 rounded text-[10px] ${
                      trade.review.followedPlan === 'YES'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : trade.review.followedPlan === 'PARTIALLY'
                        ? 'bg-amber-950 text-amber-300 border border-amber-800'
                        : 'bg-rose-950 text-rose-300 border border-rose-800'
                    }`}
                  >
                    {trade.review.followedPlan}
                  </span>
                </div>
              )}

              {trade.review.whatHappened && (
                <div className="text-xs">
                  <span className="text-zinc-500 text-[11px] block">What happened:</span>
                  <p className="text-zinc-300 mt-0.5 text-[11px] leading-relaxed">
                    {trade.review.whatHappened}
                  </p>
                </div>
              )}

              {trade.review.whatWentWell && (
                <div className="text-xs">
                  <span className="text-zinc-500 text-[11px] block">What went well:</span>
                  <p className="text-zinc-300 mt-0.5 text-[11px] leading-relaxed">
                    {trade.review.whatWentWell}
                  </p>
                </div>
              )}

              {trade.review.whatCouldImprove && (
                <div className="text-xs">
                  <span className="text-zinc-500 text-[11px] block">What could improve:</span>
                  <p className="text-zinc-300 mt-0.5 text-[11px] leading-relaxed">
                    {trade.review.whatCouldImprove}
                  </p>
                </div>
              )}

              {trade.review.lessonLearned && (
                <div className="text-xs">
                  <span className="text-zinc-500 text-[11px] block">Lesson learned:</span>
                  <p className="text-zinc-300 mt-0.5 text-[11px] leading-relaxed font-medium">
                    {trade.review.lessonLearned}
                  </p>
                </div>
              )}

              {trade.review.notes && (
                <div className="text-xs">
                  <span className="text-zinc-500 text-[11px] block">Additional Notes:</span>
                  <p className="text-zinc-300 mt-0.5 text-[11px] leading-relaxed">
                    {trade.review.notes}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-900 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
