import { useState } from 'react';
import { ResultBadge, DirectionBadge, ExitTypeBadge } from '../common/Badge';
import { AddExitModal } from './AddExitModal';
import { ReviewModal } from './ReviewModal';
import { Modal } from '../common/Modal';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { db } from '../../db/database';
import { formatMoney, formatSignedMoney } from '../../calculations';
import type { Trade, Plan, Exit, TradeReview, Account, Evidence } from '../../types';
import { getScopedAccountIds } from '../../utils/accountScope';
import {
  Plus,
  MessageSquareQuote,
  Clock,
  Trash2,
  Image as ImageIcon,
  CheckCircle2,
  Calendar,
} from 'lucide-react';

interface TradesViewProps {
  trades: Trade[];
  plans: Plan[];
  exits: Exit[];
  reviews: TradeReview[];
  accounts: Account[];
  evidenceList: Evidence[];
  onRefresh: () => void;
  selectedAccountId?: string;
  selectedScope?: string;
}

export function TradesView({
  trades,
  plans,
  exits,
  reviews,
  accounts,
  evidenceList,
  onRefresh,
  selectedAccountId,
  selectedScope,
}: TradesViewProps) {
  const [activeTab, setActiveTab] = useState<'ACTIVE' | 'COMPLETED' | 'ALL'>('ACTIVE');

  // Modals
  const [exitTargetTrade, setExitTargetTrade] = useState<{
    trade: Trade;
    plan: Plan;
    remainingSize: number;
    currency: string;
  } | null>(null);

  const [reviewTargetTrade, setReviewTargetTrade] = useState<{
    trade: Trade;
    plan: Plan;
    existingReview?: TradeReview | null;
  } | null>(null);

  const [tradeToDelete, setTradeToDelete] = useState<Trade | null>(null);
  const [viewingEvidence, setViewingEvidence] = useState<Evidence | null>(null);

  // Maps for efficient lookup
  const planMap = new Map(plans.map((p) => [p.id, p]));
  const accountMap = new Map(accounts.map((a) => [a.id, a]));
  const reviewMap = new Map(reviews.map((r) => [r.tradeId, r]));
  const evidenceMap = new Map(evidenceList.map((e) => [e.id, e]));

  // Calculate exits per trade
  const exitsByTrade = new Map<string, Exit[]>();
  for (const exit of exits) {
    const list = exitsByTrade.get(exit.tradeId) || [];
    list.push(exit);
    exitsByTrade.set(exit.tradeId, list);
  }

  // Filter trades by scoped accounts
  const activeScopeStr = selectedScope || selectedAccountId || 'ALL';
  const scopedAccountIds = getScopedAccountIds(accounts, activeScopeStr);

  const filteredTrades = trades.filter((t) => {
    if (!scopedAccountIds.has(t.accountId)) return false;
    if (activeTab === 'ACTIVE' && t.status !== 'ACTIVE') return false;
    if (activeTab === 'COMPLETED' && t.status !== 'COMPLETED') return false;
    return true;
  });

  const handleDeleteTrade = async () => {
    if (!tradeToDelete) return;
    try {
      await db.transaction('rw', [db.trades, db.exits, db.reviews], async () => {
        await db.trades.delete(tradeToDelete.id);
        const relatedExits = exits.filter((e) => e.tradeId === tradeToDelete.id);
        for (const e of relatedExits) {
          await db.exits.delete(e.id);
        }
        const review = reviews.find((r) => r.tradeId === tradeToDelete.id);
        if (review) {
          await db.reviews.delete(review.id);
        }
      });
      setTradeToDelete(null);
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  const activeCount = trades.filter(
    (t) => t.status === 'ACTIVE' && (selectedAccountId === 'ALL' || t.accountId === selectedAccountId)
  ).length;
  const completedCount = trades.filter(
    (t) => t.status === 'COMPLETED' && (selectedAccountId === 'ALL' || t.accountId === selectedAccountId)
  ).length;

  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-zinc-100 tracking-tight flex items-center gap-2">
            <span>Executed Trades</span>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
              {filteredTrades.length}
            </span>
          </h2>
          <p className="text-xs text-zinc-400">
            Real market fills, partial exits, realized P&L, and post-trade evaluation
          </p>
        </div>

        {/* Tab Toggle */}
        <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-xl border border-zinc-800 self-start sm:self-auto">
          <button
            onClick={() => setActiveTab('ACTIVE')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
              activeTab === 'ACTIVE'
                ? 'bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Active Trades ({activeCount})
          </button>
          <button
            onClick={() => setActiveTab('COMPLETED')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
              activeTab === 'COMPLETED'
                ? 'bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Completed ({completedCount})
          </button>
          <button
            onClick={() => setActiveTab('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
              activeTab === 'ALL'
                ? 'bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            All History
          </button>
        </div>
      </div>

      {/* Trades List */}
      {filteredTrades.length === 0 ? (
        <div className="text-center py-16 px-4 border border-dashed border-zinc-800 rounded-xl bg-zinc-950/40">
          <p className="text-sm font-medium text-zinc-400">
            No {activeTab.toLowerCase()} trades found
          </p>
          <p className="text-xs text-zinc-500 mt-1">
            {activeTab === 'ACTIVE'
              ? 'Trigger an existing Trading Plan to start an active execution.'
              : 'No completed trades match your filter criteria.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredTrades.map((trade) => {
            const plan = planMap.get(trade.planId);
            const tradeExits = exitsByTrade.get(trade.id) || [];
            const closedSizeSum = tradeExits.reduce((acc, e) => acc + e.closedSize, 0);
            const remainingSize = Math.max(
              0,
              Number((trade.actualPositionSize - closedSizeSum).toFixed(6))
            );
            const review = reviewMap.get(trade.id);
            const account = accountMap.get(trade.accountId);
            const accountName = account?.name || 'Account';
            const currency = account?.currency || 'USD';

            return (
              <div
                key={trade.id}
                className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-4 sm:p-5 shadow-sm hover:border-zinc-700/80 transition-all"
              >
                {/* Header Row */}
                <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-zinc-800/80">
                  <div className="flex items-center gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-base font-bold font-mono text-zinc-100">
                          {plan?.symbol || 'Trade'}
                        </span>
                        {plan && <DirectionBadge direction={plan.direction} />}
                        {trade.status === 'ACTIVE' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-emerald-950/60 text-emerald-400 border border-emerald-800/70">
                            ● Active Position
                          </span>
                        ) : (
                          <ResultBadge result={trade.result} pnl={trade.realizedPnL ?? undefined} currency={currency} />
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-zinc-400 mt-0.5">
                        <span>{accountName}</span>
                        <span>·</span>
                        <span className="font-mono flex items-center gap-1">
                          <Clock className="w-3 h-3 text-zinc-500" />
                          {new Date(trade.actualEntryTime).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Header */}
                  <div className="flex items-center gap-2">
                    {trade.status === 'ACTIVE' && plan && (
                      <button
                        onClick={() =>
                          setExitTargetTrade({
                            trade,
                            plan,
                            remainingSize,
                            currency,
                          })
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-semibold rounded-lg bg-zinc-100 text-zinc-950 hover:bg-zinc-200 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>Add Exit</span>
                      </button>
                    )}

                    {/* Review button (optional per PRD Section 41) */}
                    {plan && (
                      <button
                        onClick={() =>
                          setReviewTargetTrade({
                            trade,
                            plan,
                            existingReview: review,
                          })
                        }
                        className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-mono rounded-lg border transition-colors ${
                          review
                            ? 'bg-zinc-800 text-zinc-200 border-zinc-700'
                            : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200'
                        }`}
                        title="Evaluate execution and log lessons learned"
                      >
                        <MessageSquareQuote className="w-3.5 h-3.5" />
                        <span>{review ? 'Review Logged' : 'Add Review'}</span>
                      </button>
                    )}

                    <button
                      onClick={() => setTradeToDelete(trade)}
                      className="p-1.5 text-zinc-500 hover:text-rose-400 rounded transition-colors"
                      title="Delete Trade"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Planned vs Actual Dual Section (PRD Section 29 & 35) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 my-3">
                  {/* Planned Intent */}
                  <div className="bg-zinc-950/60 p-3 rounded-lg border border-zinc-800/80">
                    <span className="text-[10px] font-semibold font-mono uppercase tracking-wider text-zinc-500 block mb-2">
                      Planned Parameters
                    </span>
                    <div className="grid grid-cols-3 gap-2 text-xs font-mono">
                      <div>
                        <span className="text-[10px] text-zinc-500 block">Plan Entry</span>
                        <span className="text-zinc-300 font-medium">
                          {plan?.plannedEntry ?? '—'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-zinc-500 block">Planned SL</span>
                        <span className="text-zinc-400">{plan?.sl ?? '—'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-zinc-500 block">Planned TP</span>
                        <span className="text-zinc-400">{plan?.tp ?? '—'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actual Execution Fill */}
                  <div className="bg-zinc-950/60 p-3 rounded-lg border border-zinc-800/80">
                    <span className="text-[10px] font-semibold font-mono uppercase tracking-wider text-emerald-400/80 block mb-2">
                      Actual Execution Fill
                    </span>
                    <div className="grid grid-cols-3 gap-2 text-xs font-mono">
                      <div>
                        <span className="text-[10px] text-zinc-500 block">Actual Entry</span>
                        <span className="text-zinc-100 font-bold">{trade.actualEntry}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-zinc-500 block">Filled Size</span>
                        <span className="text-zinc-300">{trade.actualPositionSize}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-zinc-500 block">Remaining</span>
                        <span
                          className={`font-bold ${
                            remainingSize > 0 ? 'text-amber-400' : 'text-zinc-500'
                          }`}
                        >
                          {remainingSize}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Exits History List */}
                {tradeExits.length > 0 && (
                  <div className="mt-3 bg-zinc-950/40 rounded-lg border border-zinc-800/60 p-3">
                    <span className="text-[11px] font-mono uppercase text-zinc-400 font-semibold block mb-2">
                      Recorded Exits ({tradeExits.length})
                    </span>
                    <div className="space-y-1.5">
                      {tradeExits.map((exit, idx) => (
                        <div
                          key={exit.id}
                          className="flex flex-wrap items-center justify-between text-xs font-mono bg-zinc-900/60 px-2.5 py-1.5 rounded border border-zinc-800/80"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-zinc-500">#{idx + 1}</span>
                            <ExitTypeBadge exitType={exit.exitType} />
                            <span className="text-zinc-300">
                              Exit @ <strong>{exit.price}</strong>
                            </span>
                            <span className="text-zinc-500">({exit.closedSize} size)</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span
                              className={`font-semibold ${
                                exit.realizedPnL > 0
                                  ? 'text-emerald-400'
                                  : exit.realizedPnL < 0
                                  ? 'text-rose-400'
                                  : 'text-zinc-400'
                              }`}
                            >
                              {formatSignedMoney(exit.realizedPnL, currency)}
                            </span>
                            {exit.reason && (
                              <span className="text-[11px] text-zinc-400 italic truncate max-w-[200px]">
                                &quot;{exit.reason}&quot;
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Review Snippet if logged */}
                {review && (
                  <div className="mt-3 bg-zinc-950/60 p-3 rounded-lg border border-zinc-800/60 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-zinc-300 font-mono flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-zinc-400" />
                        <span>Execution Review</span>
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
                        Followed Plan: {review.followedPlan}
                      </span>
                    </div>
                    {review.whatHappened && (
                      <p className="text-zinc-400 mt-1 text-[11px] leading-relaxed">
                        <strong className="text-zinc-300">Delivery:</strong> {review.whatHappened}
                      </p>
                    )}
                    {review.lessonLearned && (
                      <p className="text-amber-300/80 mt-1 text-[11px] leading-relaxed">
                        <strong className="text-amber-200">Lesson:</strong> {review.lessonLearned}
                      </p>
                    )}
                    {review.screenshotId && evidenceMap.get(review.screenshotId) && (
                      <button
                        onClick={() => setViewingEvidence(evidenceMap.get(review.screenshotId!)!)}
                        className="mt-2 inline-flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 font-mono"
                      >
                        <ImageIcon className="w-3 h-3" />
                        <span>View After-Trade Chart</span>
                      </button>
                    )}
                  </div>
                )}

                {/* Notes and completed timestamp */}
                {trade.completedAt && (
                  <div className="mt-3 pt-2 text-[10px] font-mono text-zinc-500 flex items-center justify-between">
                    <span>
                      Completed on {new Date(trade.completedAt).toLocaleString()}
                    </span>
                    <span className="text-zinc-400 font-bold">
                      Total Realized P&L: {trade.realizedPnL !== null ? formatSignedMoney(trade.realizedPnL, currency) : '—'}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add Exit Modal */}
      {exitTargetTrade && (
        <AddExitModal
          isOpen={!!exitTargetTrade}
          onClose={() => setExitTargetTrade(null)}
          trade={exitTargetTrade.trade}
          plan={exitTargetTrade.plan}
          remainingSize={exitTargetTrade.remainingSize}
          currency={exitTargetTrade.currency}
          onSaved={onRefresh}
        />
      )}

      {/* Review Modal */}
      {reviewTargetTrade && (
        <ReviewModal
          isOpen={!!reviewTargetTrade}
          onClose={() => setReviewTargetTrade(null)}
          trade={reviewTargetTrade.trade}
          plan={reviewTargetTrade.plan}
          existingReview={reviewTargetTrade.existingReview}
          onSaved={onRefresh}
        />
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!tradeToDelete}
        onClose={() => setTradeToDelete(null)}
        onConfirm={handleDeleteTrade}
        title="Delete Executed Trade"
        message="Are you sure you want to delete this trade and its associated exits? This action cannot be undone."
        isDestructive
        confirmLabel="Delete Trade"
      />

      {/* Evidence Modal */}
      {viewingEvidence && (
        <Modal
          isOpen={!!viewingEvidence}
          onClose={() => setViewingEvidence(null)}
          title={viewingEvidence.name}
          subtitle={`Uploaded on ${new Date(viewingEvidence.createdAt).toLocaleString()}`}
          maxWidth="2xl"
        >
          <div className="flex items-center justify-center p-2 bg-black rounded-lg overflow-hidden">
            <img
              src={viewingEvidence.dataUrl}
              alt={viewingEvidence.name}
              className="max-h-[70vh] object-contain rounded"
            />
          </div>
        </Modal>
      )}
    </div>
  );
}
