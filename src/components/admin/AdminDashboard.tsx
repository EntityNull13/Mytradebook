import { useState, useEffect, useCallback } from 'react';
import { db, getSettings } from '../../db/database';
import { seedInitialData } from '../../db/seed';
import { Header } from '../layout/Header';
import { Navigation, type NavTab } from '../layout/Navigation';
import { BackupBanner } from '../layout/BackupBanner';

import { DashboardView } from '../dashboard/DashboardView';
import { PlansView } from '../plans/PlansView';
import { TradesView } from '../trades/TradesView';
import { AnalyticsView } from '../analytics/AnalyticsView';
import { CalendarView } from '../calendar/CalendarView';
import { AccountsView } from '../accounts/AccountsView';
import { SettingsView } from '../settings/SettingsView';

import { PlanFormModal } from '../plans/PlanFormModal';
import { TriggerModal } from '../plans/TriggerModal';
import { AddExitModal } from '../trades/AddExitModal';
import { PublishModal } from './PublishModal';
import { getScopedAccountIds } from '../../utils/accountScope';

import type {
  Account,
  AccountPhase,
  PropFirmRule,
  Plan,
  Trade,
  Exit,
  TradeReview,
  Evidence,
  Setup,
  Transaction,
  AppSettings,
} from '../../types';

interface AdminDashboardProps {
  onLogout: () => void;
  onNavigatePublic: () => void;
}

export function AdminDashboard({ onLogout, onNavigatePublic }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [selectedScope, setSelectedScope] = useState<string>('ALL');

  // Database records
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountPhases, setAccountPhases] = useState<AccountPhase[]>([]);
  const [propFirmRules, setPropFirmRules] = useState<PropFirmRule[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [exits, setExits] = useState<Exit[]>([]);
  const [reviews, setReviews] = useState<TradeReview[]>([]);
  const [evidenceList, setEvidenceList] = useState<Evidence[]>([]);
  const [setups, setSetups] = useState<Setup[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);

  // Modals
  const [isNewPlanOpen, setIsNewPlanOpen] = useState(false);
  const [planToTrigger, setPlanToTrigger] = useState<Plan | null>(null);
  const [tradeForExit, setTradeForExit] = useState<Trade | null>(null);
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);

  // Load all local IndexedDB data
  const loadData = useCallback(async () => {
    try {
      await seedInitialData();
      const [
        accs,
        phases,
        rules,
        plns,
        trds,
        exts,
        rvws,
        evs,
        stps,
        txs,
        sttngs,
      ] = await Promise.all([
        db.accounts.toArray(),
        db.accountPhases.toArray(),
        db.propFirmRules.toArray(),
        db.plans.toArray(),
        db.trades.toArray(),
        db.exits.toArray(),
        db.reviews.toArray(),
        db.evidence.toArray(),
        db.setups.toArray(),
        db.transactions.toArray(),
        getSettings(),
      ]);

      setAccounts(accs);
      setAccountPhases(phases);
      setPropFirmRules(rules);
      setPlans(plns.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      setTrades(trds.sort((a, b) => b.actualEntryTime.localeCompare(a.actualEntryTime)));
      setExits(exts);
      setReviews(rvws);
      setEvidenceList(evs);
      setSetups(stps);
      setTransactions(txs);
      setSettings(sttngs);
    } catch (err) {
      console.error('Failed to load local database:', err);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (!settings) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-500 font-mono text-xs">
        Memuat jurnal trading...
      </div>
    );
  }

  // Active trades and plans counts
  const scopedAccountIds = getScopedAccountIds(accounts, selectedScope);

  const activeTradesCount = trades.filter(
    (t) => t.status === 'ACTIVE' && scopedAccountIds.has(t.accountId)
  ).length;

  const plannedPlansCount = plans.filter(
    (p) => p.status === 'PLANNED' && scopedAccountIds.has(p.accountId)
  ).length;

  const targetPlanForExitTrade = tradeForExit
    ? plans.find((p) => p.id === tradeForExit.planId) || null
    : null;

  const tradeForExitExits = tradeForExit
    ? exits.filter((e) => e.tradeId === tradeForExit.id)
    : [];
  const tradeForExitClosedSum = tradeForExitExits.reduce((acc, e) => acc + e.closedSize, 0);
  const tradeForExitRemainingSize = tradeForExit
    ? Math.max(0, Number((tradeForExit.actualPositionSize - tradeForExitClosedSum).toFixed(6)))
    : 0;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans pb-16 md:pb-6">
      {/* 1. Header with Account Scope Filter, Admin controls & Quick Actions */}
      <Header
        accounts={accounts}
        selectedScope={selectedScope}
        onSelectScope={setSelectedScope}
        onOpenNewPlan={() => setIsNewPlanOpen(true)}
        onOpenSettings={() => setActiveTab('settings')}
        settings={settings}
        isAdmin={true}
        onOpenPublishModal={() => setIsPublishModalOpen(true)}
        onLogout={onLogout}
        onViewPublicSite={onNavigatePublic}
      />

      {/* 2. Top Navigation Tabs */}
      <Navigation
        currentTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenNewPlan={() => setIsNewPlanOpen(true)}
        plansCount={plannedPlansCount}
        activeTradesCount={activeTradesCount}
      />

      {/* 3. Safety Backup Reminder Banner (PRD Section 17) */}
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 pt-3">
        <BackupBanner
          lastBackupAt={settings.lastBackupAt}
          onOpenSettingsBackup={() => setActiveTab('settings')}
        />
      </div>

      {/* 4. Main View Canvas */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-4 sm:py-6">
        {activeTab === 'dashboard' && (
          <DashboardView
            accounts={accounts}
            plans={plans}
            trades={trades}
            exits={exits}
            rules={propFirmRules}
            transactions={transactions}
            selectedScope={selectedScope}
            onSelectScope={setSelectedScope}
            onNavigate={(tab) => setActiveTab(tab.toLowerCase() as NavTab)}
            onOpenNewPlan={() => setIsNewPlanOpen(true)}
            onTriggerPlan={(plan: Plan) => setPlanToTrigger(plan)}
            onAddExit={(trade: Trade) => setTradeForExit(trade)}
          />
        )}

        {activeTab === 'plans' && (
          <PlansView
            plans={plans}
            trades={trades}
            accounts={accounts}
            setups={setups}
            evidenceList={evidenceList}
            onRefresh={loadData}
            onOpenNewPlan={() => setIsNewPlanOpen(true)}
            selectedScope={selectedScope}
          />
        )}

        {activeTab === 'trades' && (
          <TradesView
            trades={trades}
            plans={plans}
            exits={exits}
            reviews={reviews}
            accounts={accounts}
            evidenceList={evidenceList}
            onRefresh={loadData}
            selectedScope={selectedScope}
          />
        )}

        {activeTab === 'analytics' && (
          <AnalyticsView
            trades={trades}
            plans={plans}
            exits={exits}
            setups={setups}
            accounts={accounts}
            transactions={transactions}
            selectedScope={selectedScope}
            onSelectScope={setSelectedScope}
          />
        )}

        {activeTab === 'calendar' && (
          <CalendarView
            trades={trades}
            plans={plans}
            accounts={accounts}
            selectedScope={selectedScope}
            onSelectScope={setSelectedScope}
          />
        )}

        {activeTab === 'accounts' && (
          <AccountsView
            accounts={accounts}
            accountPhases={accountPhases}
            propFirmRules={propFirmRules}
            plans={plans}
            trades={trades}
            exits={exits}
            reviews={reviews}
            evidenceList={evidenceList}
            transactions={transactions}
            onRefresh={loadData}
            selectedScope={selectedScope}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            settings={settings}
            accounts={accounts}
            plans={plans}
            trades={trades}
            exits={exits}
            evidenceList={evidenceList}
            onRefresh={loadData}
          />
        )}
      </main>

      {/* Global Modals */}
      {isNewPlanOpen && (
        <PlanFormModal
          isOpen={isNewPlanOpen}
          onClose={() => setIsNewPlanOpen(false)}
          accounts={accounts}
          setups={setups}
          onSaved={loadData}
        />
      )}

      {planToTrigger && (
        <TriggerModal
          isOpen={!!planToTrigger}
          onClose={() => setPlanToTrigger(null)}
          plan={planToTrigger}
          onTriggered={() => {
            loadData();
            setActiveTab('trades');
          }}
        />
      )}

      {tradeForExit && (
        <AddExitModal
          isOpen={!!tradeForExit}
          onClose={() => setTradeForExit(null)}
          trade={tradeForExit}
          plan={targetPlanForExitTrade}
          remainingSize={tradeForExitRemainingSize}
          currency={accounts.find((a) => a.id === tradeForExit.accountId)?.currency || 'USD'}
          onSaved={loadData}
        />
      )}

      {/* Admin Publish Modal */}
      {isPublishModalOpen && (
        <PublishModal
          isOpen={isPublishModalOpen}
          onClose={() => setIsPublishModalOpen(false)}
          accounts={accounts}
          plans={plans}
          trades={trades}
          exits={exits}
          reviews={reviews}
          setups={setups}
        />
      )}
    </div>
  );
}
