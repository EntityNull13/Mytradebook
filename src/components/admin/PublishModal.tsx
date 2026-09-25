import { useState, useEffect } from 'react';
import {
  X,
  Globe,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ExternalLink,
  Shield,
  Eye,
  EyeOff,
} from 'lucide-react';
import type { Account, Plan, Trade, Exit, TradeReview, Setup } from '../../types';
import { publishJournalSnapshot, unpublishJournalSnapshot, fetchPublicJournal } from '../../services/publish';
import { formatMoney } from '../../calculations';

interface PublishModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: Account[];
  plans: Plan[];
  trades: Trade[];
  exits: Exit[];
  reviews: TradeReview[];
  setups: Setup[];
}

export function PublishModal({
  isOpen,
  onClose,
  accounts,
  plans,
  trades,
  exits,
  reviews,
  setups,
}: PublishModalProps) {
  // Publication options
  const [showBalances, setShowBalances] = useState(false);
  const [showPositionSizes, setShowPositionSizes] = useState(false);
  const [includeReviews, setIncludeReviews] = useState(true);
  const [includeActiveTrades, setIncludeActiveTrades] = useState(false);
  const [includePlannedPlans, setIncludePlannedPlans] = useState(true);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>(['ALL']);

  // Status
  const [isCurrentlyPublished, setIsCurrentlyPublished] = useState<boolean>(false);
  const [lastPublishedAt, setLastPublishedAt] = useState<string | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState<boolean>(true);
  const [isPublishing, setIsPublishing] = useState<boolean>(false);
  const [isUnpublishing, setIsUnpublishing] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Load current published status
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;

    const loadStatus = async () => {
      setIsLoadingStatus(true);
      try {
        const res = await fetchPublicJournal();
        if (!isMounted) return;
        if (res.isPublished && res.journal) {
          setIsCurrentlyPublished(true);
          setLastPublishedAt(res.journal.publishedAt);
          setShowBalances(res.journal.showBalances);
          setShowPositionSizes(res.journal.showPositionSizes);
          setIncludeReviews(res.journal.includeReviews);
        } else {
          setIsCurrentlyPublished(false);
          setLastPublishedAt(null);
        }
      } catch (err) {
        if (isMounted) {
          console.warn('Unable to load publish status:', err);
        }
      } finally {
        if (isMounted) {
          setIsLoadingStatus(false);
        }
      }
    };

    loadStatus();

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // Calculate live preview metrics
  const targetAccounts = selectedAccountIds.includes('ALL')
    ? accounts
    : accounts.filter((a) => selectedAccountIds.includes(a.id));
  const targetAccountIds = new Set(targetAccounts.map((a) => a.id));

  const previewTrades = trades.filter((t) => {
    if (!targetAccountIds.has(t.accountId)) return false;
    if (!includeActiveTrades && t.status === 'ACTIVE') return false;
    return true;
  });

  const previewPlans = plans.filter((p) => {
    if (!targetAccountIds.has(p.accountId)) return false;
    if (!includePlannedPlans && p.status === 'PLANNED') return false;
    return true;
  });

  const completedTrades = previewTrades.filter((t) => t.status === 'COMPLETED' && t.realizedPnL !== null);
  const netPnL = completedTrades.reduce((acc, t) => acc + (t.realizedPnL || 0), 0);
  const wins = completedTrades.filter((t) => (t.realizedPnL || 0) > 0).length;
  const winRate = completedTrades.length > 0 ? (wins / completedTrades.length) * 100 : 0;

  const handlePublish = async () => {
    setIsPublishing(true);
    setFeedback(null);

    const res = await publishJournalSnapshot(
      { accounts, plans, trades, exits, reviews, setups },
      {
        showBalances,
        showPositionSizes,
        includeReviews,
        includeActiveTrades,
        includePlannedPlans,
        accountIds: selectedAccountIds,
      }
    );

    setIsPublishing(false);

    if (res.success) {
      setIsCurrentlyPublished(true);
      setLastPublishedAt(res.publishedAt || new Date().toISOString());
      setFeedback({
        type: 'success',
        message: 'Trading journal successfully published to public view!',
      });
    } else {
      setFeedback({
        type: 'error',
        message: res.error || 'Failed to publish changes.',
      });
    }
  };

  const handleUnpublish = async () => {
    if (!window.confirm('Are you sure you want to unpublish your journal? Public visitors will no longer see any trading records.')) {
      return;
    }

    setIsUnpublishing(true);
    setFeedback(null);

    const res = await unpublishJournalSnapshot();
    setIsUnpublishing(false);

    if (res.success) {
      setIsCurrentlyPublished(false);
      setLastPublishedAt(null);
      setFeedback({
        type: 'success',
        message: 'Journal has been unpublished. Public view is now hidden.',
      });
    } else {
      setFeedback({
        type: 'error',
        message: res.error || 'Failed to unpublish journal.',
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-zinc-800 flex items-center justify-between sticky top-0 bg-zinc-900/95 backdrop-blur-md z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-950/70 border border-emerald-800/80 text-emerald-400 flex items-center justify-center">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <span>Publish to Public View</span>
                {isLoadingStatus ? (
                  <span className="text-[10px] text-zinc-500 font-mono">Checking status...</span>
                ) : isCurrentlyPublished ? (
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Published
                  </span>
                ) : (
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                    Not Published
                  </span>
                )}
              </h2>
              <p className="text-xs text-zinc-400">
                Control which trading records and metrics are visible to the public at{' '}
                <code className="text-zinc-300 font-mono text-[11px] bg-zinc-800 px-1 py-0.5 rounded">/</code>
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
          {/* Status summary banner */}
          <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-xs text-zinc-400 block font-medium">Public Publication Status</span>
              <div className="text-sm font-semibold text-zinc-200 mt-0.5">
                {isCurrentlyPublished ? (
                  <span className="text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Live & Visible to Public</span>
                  </span>
                ) : (
                  <span className="text-zinc-400 flex items-center gap-1.5">
                    <Shield className="w-4 h-4 text-zinc-500" />
                    <span>Private (Public view displays "No public journal published yet")</span>
                  </span>
                )}
              </div>
              {lastPublishedAt && (
                <span className="text-[11px] text-zinc-500 font-mono mt-0.5 block">
                  Last updated: {new Date(lastPublishedAt).toLocaleString()}
                </span>
              )}
            </div>

            {isCurrentlyPublished && (
              <a
                href="/"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-200 transition-colors w-fit"
              >
                <span>Preview Public View</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>

          {/* Privacy & Granular Controls */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              Publication Controls & Privacy Filters
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Balances Toggle */}
              <label className="flex items-start gap-3 p-3 rounded-xl bg-zinc-950/60 border border-zinc-800 hover:border-zinc-700 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={showBalances}
                  onChange={(e) => setShowBalances(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-emerald-500 focus:ring-0 cursor-pointer"
                />
                <div className="text-xs">
                  <span className="font-semibold text-zinc-200 block flex items-center gap-1.5">
                    {showBalances ? <Eye className="w-3.5 h-3.5 text-emerald-400" /> : <EyeOff className="w-3.5 h-3.5 text-zinc-500" />}
                    <span>Show Account Balances</span>
                  </span>
                  <span className="text-zinc-400 text-[11px]">
                    Display account starting and current balances in public summary cards.
                  </span>
                </div>
              </label>

              {/* Position Sizes Toggle */}
              <label className="flex items-start gap-3 p-3 rounded-xl bg-zinc-950/60 border border-zinc-800 hover:border-zinc-700 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={showPositionSizes}
                  onChange={(e) => setShowPositionSizes(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-emerald-500 focus:ring-0 cursor-pointer"
                />
                <div className="text-xs">
                  <span className="font-semibold text-zinc-200 block flex items-center gap-1.5">
                    {showPositionSizes ? <Eye className="w-3.5 h-3.5 text-emerald-400" /> : <EyeOff className="w-3.5 h-3.5 text-zinc-500" />}
                    <span>Show Lot / Position Sizes</span>
                  </span>
                  <span className="text-zinc-400 text-[11px]">
                    Display exact lots / contracts in trade details.
                  </span>
                </div>
              </label>

              {/* Reviews Toggle */}
              <label className="flex items-start gap-3 p-3 rounded-xl bg-zinc-950/60 border border-zinc-800 hover:border-zinc-700 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={includeReviews}
                  onChange={(e) => setIncludeReviews(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-emerald-500 focus:ring-0 cursor-pointer"
                />
                <div className="text-xs">
                  <span className="font-semibold text-zinc-200 block">
                    Include Trade Reviews
                  </span>
                  <span className="text-zinc-400 text-[11px]">
                    Publish lessons learned, discipline scores, and setup ratings.
                  </span>
                </div>
              </label>

              {/* Active Trades Toggle */}
              <label className="flex items-start gap-3 p-3 rounded-xl bg-zinc-950/60 border border-zinc-800 hover:border-zinc-700 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={includeActiveTrades}
                  onChange={(e) => setIncludeActiveTrades(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-emerald-500 focus:ring-0 cursor-pointer"
                />
                <div className="text-xs">
                  <span className="font-semibold text-zinc-200 block">
                    Include Active Open Trades
                  </span>
                  <span className="text-zinc-400 text-[11px]">
                    Show currently open trades in addition to completed closed trades.
                  </span>
                </div>
              </label>

              {/* Planned Plans Toggle */}
              <label className="flex items-start gap-3 p-3 rounded-xl bg-zinc-950/60 border border-zinc-800 hover:border-zinc-700 cursor-pointer transition-colors sm:col-span-2">
                <input
                  type="checkbox"
                  checked={includePlannedPlans}
                  onChange={(e) => setIncludePlannedPlans(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-emerald-500 focus:ring-0 cursor-pointer"
                />
                <div className="text-xs">
                  <span className="font-semibold text-zinc-200 block">
                    Include Planned Trading Plans
                  </span>
                  <span className="text-zinc-400 text-[11px]">
                    Make your watchlists and pre-market trading plans visible to visitors.
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* Account selector */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400">
              Target Accounts to Publish
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSelectedAccountIds(['ALL'])}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  selectedAccountIds.includes('ALL')
                    ? 'bg-zinc-100 text-zinc-950 font-bold'
                    : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                }`}
              >
                All Accounts ({accounts.length})
              </button>
              {accounts.map((acc) => {
                const isSelected = selectedAccountIds.includes(acc.id) && !selectedAccountIds.includes('ALL');
                return (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => {
                      if (selectedAccountIds.includes('ALL')) {
                        setSelectedAccountIds([acc.id]);
                      } else if (isSelected) {
                        const next = selectedAccountIds.filter((id) => id !== acc.id);
                        setSelectedAccountIds(next.length === 0 ? ['ALL'] : next);
                      } else {
                        setSelectedAccountIds([...selectedAccountIds, acc.id]);
                      }
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-500 text-zinc-950 font-bold'
                        : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                    }`}
                  >
                    {acc.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Live Snapshot Preview */}
          <div className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800 space-y-3">
            <span className="text-xs font-bold text-zinc-300 block">
              Snapshot Preview (What Visitors Will See)
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800">
                <span className="text-[10px] text-zinc-400 block uppercase">Accounts</span>
                <span className="text-base font-bold text-zinc-100 font-mono">{targetAccounts.length}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800">
                <span className="text-[10px] text-zinc-400 block uppercase">Plans</span>
                <span className="text-base font-bold text-zinc-100 font-mono">{previewPlans.length}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800">
                <span className="text-[10px] text-zinc-400 block uppercase">Trades</span>
                <span className="text-base font-bold text-zinc-100 font-mono">{previewTrades.length}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800">
                <span className="text-[10px] text-zinc-400 block uppercase">Win Rate</span>
                <span className="text-base font-bold text-emerald-400 font-mono">
                  {winRate.toFixed(1)}%
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs pt-1 px-1 text-zinc-400">
              <span>Published Realized P&L:</span>
              <span className={`font-mono font-bold ${netPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {formatMoney(netPnL, 'USD')}
              </span>
            </div>
          </div>

          {/* Feedback messages */}
          {feedback && (
            <div
              className={`p-3 rounded-xl text-xs flex items-start gap-2.5 ${
                feedback.type === 'success'
                  ? 'bg-emerald-950/70 border border-emerald-800 text-emerald-200'
                  : 'bg-rose-950/70 border border-rose-800 text-rose-200'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              )}
              <span>{feedback.message}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-900 flex items-center justify-between gap-3">
          {isCurrentlyPublished ? (
            <button
              type="button"
              onClick={handleUnpublish}
              disabled={isUnpublishing || isPublishing}
              className="px-3.5 py-2 rounded-xl bg-rose-950/50 hover:bg-rose-900/60 border border-rose-800 text-rose-300 text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isUnpublishing ? 'Unpublishing...' : 'Unpublish (Make Private)'}
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors cursor-pointer"
            >
              Close
            </button>

            <button
              type="button"
              onClick={handlePublish}
              disabled={isPublishing || isUnpublishing}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-950 text-xs font-bold transition-all shadow-xs hover:shadow disabled:opacity-50 cursor-pointer active:scale-95"
            >
              {isPublishing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-zinc-950" />
                  <span>Publishing Changes...</span>
                </>
              ) : (
                <>
                  <Globe className="w-4 h-4 text-zinc-950" />
                  <span>{isCurrentlyPublished ? 'Publish Changes' : 'Publish to Public'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
