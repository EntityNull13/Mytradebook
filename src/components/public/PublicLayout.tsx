import { useState, useEffect } from 'react';
import { Loader2, Globe } from 'lucide-react';
import { fetchPublicJournal } from '../../services/publish';
import type { PublishedJournal, PublishedTrade } from '../../types/public';
import { PublicHeader } from './PublicHeader';
import { PublicNavigation, type PublicNavTab } from './PublicNavigation';
import { PublicDashboardView } from './PublicDashboardView';
import { PublicPlansView } from './PublicPlansView';
import { PublicTradesView } from './PublicTradesView';
import { PublicCalendarView } from './PublicCalendarView';
import { PublicAnalyticsView } from './PublicAnalyticsView';
import { PublicTradeDetailModal } from './PublicTradeDetailModal';

const emptyJournal: PublishedJournal = {
  id: 'empty_published_journal',
  isPublished: false,
  publishedAt: '',
  updatedAt: '',
  journalName: 'Tradebook Public Journal',
  bio: '',
  showBalances: true,
  showPositionSizes: true,
  includeReviews: true,
  accounts: [],
  plans: [],
  trades: [],
  analytics: {
    totalTrades: 0,
    winningTrades: 0,
    losingTrades: 0,
    bepTrades: 0,
    winRate: 0,
    netPnL: 0,
    profitFactor: 0,
    averageWin: 0,
    averageLoss: 0,
    expectancy: 0,
    averageR: 0,
    maxDrawdown: 0,
  },
};

interface PublicLayoutProps {
  onNavigateAdmin?: () => void;
}

export function PublicLayout({ onNavigateAdmin }: PublicLayoutProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [journal, setJournal] = useState<PublishedJournal | null>(null);
  const [currentTab, setCurrentTab] = useState<PublicNavTab>('dashboard');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('ALL');
  const [selectedTradeForDetail, setSelectedTradeForDetail] = useState<PublishedTrade | null>(null);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      setIsLoading(true);
      try {
        const res = await fetchPublicJournal();
        if (!isMounted) return;
        if (res.isPublished && res.journal) {
          setJournal(res.journal);
        } else {
          setJournal(null);
        }
      } catch (err) {
        if (isMounted) {
          console.warn('Unable to load public journal snapshot:', err);
          setJournal(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    load();

    return () => {
      isMounted = false;
    };
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-zinc-100 text-zinc-950 font-mono font-bold flex items-center justify-center text-sm shadow-md">
            TB
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-400 font-mono">
            <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
            <span>Loading public trading journal...</span>
          </div>
        </div>
      </div>
    );
  }

  const activeJournal = journal && journal.isPublished ? journal : emptyJournal;
  const isUnpublished = !journal || !journal.isPublished;
  const defaultCurrency = activeJournal.accounts[0]?.currency || 'USD';

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      {/* Public Read-Only Header */}
      <PublicHeader
        accounts={activeJournal.accounts}
        selectedAccountId={selectedAccountId}
        onSelectAccount={setSelectedAccountId}
        publishedAt={activeJournal.publishedAt}
        journalName={activeJournal.journalName}
        onNavigateAdmin={onNavigateAdmin}
      />

      {/* Public Read-Only Navigation */}
      <PublicNavigation
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        plansCount={activeJournal.plans.length}
        tradesCount={activeJournal.trades.length}
      />

      {/* Main View Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 pb-20 md:pb-8 space-y-6">
        {/* Informational Banner if no journal has been published yet */}
        {isUnpublished && (
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 sm:p-5 flex items-start gap-3 shadow-xs">
            <div className="p-2 rounded-lg bg-zinc-800 text-zinc-400 shrink-0 mt-0.5">
              <Globe className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">Public Trading Journal</h2>
              <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">
                No trading records have been published yet. Once the trader publishes records from their private workspace, verified execution logs, performance statistics, and trading plans will appear here in read-only mode.
              </p>
            </div>
          </div>
        )}

        {currentTab === 'dashboard' && (
          <PublicDashboardView
            journal={activeJournal}
            selectedAccountId={selectedAccountId}
            onTradeClick={(t) => setSelectedTradeForDetail(t)}
            onViewAllTrades={() => setCurrentTab('trades')}
            onViewAllPlans={() => setCurrentTab('plans')}
          />
        )}

        {currentTab === 'plans' && (
          <PublicPlansView
            plans={activeJournal.plans}
            selectedAccountId={selectedAccountId}
          />
        )}

        {currentTab === 'trades' && (
          <PublicTradesView
            trades={activeJournal.trades}
            selectedAccountId={selectedAccountId}
            onSelectTrade={(t) => setSelectedTradeForDetail(t)}
            currency={defaultCurrency}
          />
        )}

        {currentTab === 'calendar' && (
          <PublicCalendarView
            trades={activeJournal.trades}
            selectedAccountId={selectedAccountId}
            onSelectTrade={(t) => setSelectedTradeForDetail(t)}
            currency={defaultCurrency}
          />
        )}

        {currentTab === 'analytics' && (
          <PublicAnalyticsView
            journal={activeJournal}
            selectedAccountId={selectedAccountId}
          />
        )}
      </main>

      {/* Public Read-Only Trade Detail Modal */}
      {selectedTradeForDetail && (
        <PublicTradeDetailModal
          trade={selectedTradeForDetail}
          onClose={() => setSelectedTradeForDetail(null)}
          currency={defaultCurrency}
        />
      )}

      {/* Public Footer */}
      <footer className="border-t border-zinc-800/80 bg-zinc-900/60 py-4 px-6 text-center text-[11px] text-zinc-500 hidden md:block">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>Tradebook · Verified Public Trading Journal</span>
            <span>·</span>
            <span className="font-mono text-zinc-400">Read-Only Mode</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
