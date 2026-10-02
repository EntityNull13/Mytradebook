import { useState, useEffect } from 'react';
import { calculateCurrentBalance, evaluateRuleStatus, formatMoney, formatSignedMoney } from '../../calculations';
import { AccountModal } from './AccountModal';
import { PhaseModal } from './PhaseModal';
import { PropFirmRuleModal } from './PropFirmRuleModal';
import { TransactionModal } from './TransactionModal';
import { Modal } from '../common/Modal';
import { db } from '../../db/database';
import { getScopedAccountIds } from '../../utils/accountScope';
import type {
  Account,
  AccountPhase,
  PropFirmRule,
  Plan,
  PlanGroup,
  Trade,
  Exit,
  TradeReview,
  Evidence,
  Transaction,
  PhaseStatus,
} from '../../types';
import {
  Plus,
  Wallet,
  ShieldCheck,
  ArrowDownRight,
  ArrowUpRight,
  Sliders,
  Edit2,
  Trash2,
  Archive,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Clock,
  Layers,
} from 'lucide-react';

interface AccountsViewProps {
  accounts: Account[];
  accountPhases: AccountPhase[];
  propFirmRules: PropFirmRule[];
  plans?: Plan[];
  trades: Trade[];
  exits?: Exit[];
  reviews?: TradeReview[];
  evidenceList?: Evidence[];
  transactions: Transaction[];
  onRefresh: () => void;
  selectedAccountId?: string;
  selectedScope?: string;
}

export function AccountsView({
  accounts,
  accountPhases,
  propFirmRules,
  plans = [],
  trades,
  exits = [],
  reviews = [],
  evidenceList = [],
  transactions,
  onRefresh,
  selectedAccountId,
  selectedScope,
}: AccountsViewProps) {
  // Modals state
  const [isAddAccountOpen, setIsAddAccountOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [phaseForAccount, setPhaseForAccount] = useState<{ account: Account; phase?: AccountPhase } | null>(null);
  const [accountForRule, setAccountForRule] = useState<{ account: Account; phaseId?: string } | null>(null);
  const [accountForTx, setAccountForTx] = useState<Account | null>(null);
  const [accountToArchive, setAccountToArchive] = useState<Account | null>(null);
  const [accountToDelete, setAccountToDelete] = useState<Account | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Local PlanGroups state for cascade evaluation
  const [planGroups, setPlanGroups] = useState<PlanGroup[]>([]);
  useEffect(() => {
    db.planGroups.toArray().then(setPlanGroups);
  }, []);

  // Tab filter: Active vs Archived
  const [statusFilter, setStatusFilter] = useState<'ACTIVE' | 'ARCHIVED'>('ACTIVE');

  const activeScopeStr = selectedScope || selectedAccountId || 'ALL';
  const scopedAccountIds = getScopedAccountIds(accounts, activeScopeStr);

  const visibleAccounts = accounts
    .filter((a) => scopedAccountIds.has(a.id))
    .filter((a) => (statusFilter === 'ACTIVE' ? a.status !== 'ARCHIVED' : a.status === 'ARCHIVED'));

  // Calculate Impact Summary for account deletion (including PlanGroups cascade)
  const getImpactSummary = (account: Account) => {
    const accPhases = accountPhases.filter((p) => p.accountId === account.id);
    const accRules = propFirmRules.filter((r) => r.accountId === account.id);
    const accPlans = plans.filter((p) => p.accountId === account.id);
    const accTrades = trades.filter((t) => t.accountId === account.id);
    const tradeIdSet = new Set(accTrades.map((t) => t.id));
    const planIdSet = new Set(accPlans.map((p) => p.id));

    // Linked plan groups by accountId or referenced by account's plans
    const planGroupIdsFromPlans = new Set(accPlans.map((p) => p.planGroupId).filter(Boolean));
    const accPlanGroups = planGroups.filter(
      (pg) => pg.accountId === account.id || planGroupIdsFromPlans.has(pg.id)
    );

    const accExits = exits.filter((e) => tradeIdSet.has(e.tradeId));
    const accReviews = reviews.filter((r) => tradeIdSet.has(r.tradeId));
    const accEvidence = evidenceList.filter(
      (ev) => (ev.tradeId && tradeIdSet.has(ev.tradeId)) || (ev.planId && planIdSet.has(ev.planId))
    );
    const accTxs = transactions.filter((t) => t.accountId === account.id);

    return {
      phases: accPhases.length,
      rules: accRules.length,
      planGroups: accPlanGroups.length,
      plans: accPlans.length,
      trades: accTrades.length,
      exits: accExits.length,
      reviews: accReviews.length,
      evidence: accEvidence.length,
      transactions: accTxs.length,
      hasHistoricalData: accTrades.length > 0 || accPlans.length > 0 || accTxs.length > 0,
      phaseIds: accPhases.map((p) => p.id),
      ruleIds: accRules.map((r) => r.id),
      planGroupIds: accPlanGroups.map((pg) => pg.id),
      planIds: accPlans.map((p) => p.id),
      tradeIds: accTrades.map((t) => t.id),
      exitIds: accExits.map((e) => e.id),
      reviewIds: accReviews.map((r) => r.id),
      evidenceIds: accEvidence.map((ev) => ev.id),
      txIds: accTxs.map((t) => t.id),
    };
  };

  // Safe Archive Account
  const handleArchiveAccount = async (account: Account) => {
    try {
      await db.accounts.update(account.id, {
        status: 'ARCHIVED',
        updatedAt: new Date().toISOString(),
      });
      setAccountToArchive(null);
      onRefresh();
    } catch (err) {
      console.error('Failed to archive account:', err);
    }
  };

  // Unarchive Account
  const handleUnarchiveAccount = async (account: Account) => {
    try {
      await db.accounts.update(account.id, {
        status: 'ACTIVE',
        updatedAt: new Date().toISOString(),
      });
      onRefresh();
    } catch (err) {
      console.error('Failed to unarchive account:', err);
    }
  };

  // Permanent Delete Account without mandatory password or forced backup
  const handleDeleteAccount = async () => {
    if (!accountToDelete) return;

    try {
      setIsDeleting(true);
      const impact = getImpactSummary(accountToDelete);

      // Cascade delete all linked records transactionally:
      // Account -> AccountPhase, PropFirmRule, PlanGroup, Plan, Trade (Exit, Review), Evidence, Transaction
      await db.transaction(
        'rw',
        [
          db.accounts,
          db.accountPhases,
          db.propFirmRules,
          db.planGroups,
          db.plans,
          db.trades,
          db.exits,
          db.reviews,
          db.evidence,
          db.transactions,
        ],
        async () => {
          await db.accounts.delete(accountToDelete.id);
          for (const id of impact.phaseIds) await db.accountPhases.delete(id);
          for (const id of impact.ruleIds) await db.propFirmRules.delete(id);
          for (const id of impact.planGroupIds) await db.planGroups.delete(id);
          for (const id of impact.planIds) await db.plans.delete(id);
          for (const id of impact.tradeIds) await db.trades.delete(id);
          for (const id of impact.exitIds) await db.exits.delete(id);
          for (const id of impact.reviewIds) await db.reviews.delete(id);
          for (const id of impact.evidenceIds) await db.evidence.delete(id);
          for (const id of impact.txIds) await db.transactions.delete(id);
        }
      );

      setAccountToDelete(null);
      db.planGroups.toArray().then(setPlanGroups);
      onRefresh();
    } catch (err) {
      console.error('Cascade account delete failed:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  // Update Phase Status directly
  const handleUpdatePhaseStatus = async (phaseId: string, newStatus: PhaseStatus) => {
    try {
      await db.accountPhases.update(phaseId, { status: newStatus });
      onRefresh();
    } catch (err) {
      console.error('Failed to update phase status:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-zinc-100 tracking-tight flex items-center gap-2">
            <Wallet className="w-5 h-5 text-zinc-400" />
            <span>Accounts, Phases & Rule Tracker</span>
          </h2>
          <p className="text-xs text-zinc-400">
            Account hierarchy, evaluation phases, generic drawdown rules, and capital balance records
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Active vs Archived filter toggle */}
          <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-lg p-0.5">
            <button
              onClick={() => setStatusFilter('ACTIVE')}
              className={`px-3 py-1 text-xs font-mono rounded-md transition-colors ${
                statusFilter === 'ACTIVE'
                  ? 'bg-zinc-800 text-zinc-100 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Active ({accounts.filter((a) => a.status !== 'ARCHIVED').length})
            </button>
            <button
              onClick={() => setStatusFilter('ARCHIVED')}
              className={`px-3 py-1 text-xs font-mono rounded-md transition-colors ${
                statusFilter === 'ARCHIVED'
                  ? 'bg-zinc-800 text-zinc-100 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Archived ({accounts.filter((a) => a.status === 'ARCHIVED').length})
            </button>
          </div>

          <button
            onClick={() => setIsAddAccountOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-zinc-950 bg-zinc-100 hover:bg-white rounded-lg transition-colors font-mono font-semibold"
          >
            <Plus className="w-3.5 h-3.5 text-zinc-950 stroke-[3]" />
            <span>New Account</span>
          </button>
        </div>
      </div>

      {visibleAccounts.length === 0 ? (
        <div className="text-center py-16 px-4 border border-dashed border-zinc-800 rounded-xl bg-zinc-950/40">
          <p className="text-sm font-medium text-zinc-400">
            {statusFilter === 'ACTIVE' ? 'No active accounts found' : 'No archived accounts'}
          </p>
          <p className="text-xs text-zinc-500 mt-1">
            {statusFilter === 'ACTIVE'
              ? 'Create an account (Personal, Prop Firm, or Demo) to begin tracking your performance.'
              : 'Accounts you archive instead of deleting will be stored safely here.'}
          </p>
          {statusFilter === 'ACTIVE' && (
            <button
              onClick={() => setIsAddAccountOpen(true)}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-zinc-950 bg-zinc-100 hover:bg-white rounded-lg transition-colors font-mono"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create First Account</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {visibleAccounts.map((account) => {
            const accTrades = trades.filter((t) => t.accountId === account.id);
            const accTxs = transactions.filter((tx) => tx.accountId === account.id);
            const accPhases = accountPhases.filter((p) => p.accountId === account.id);
            const accRules = propFirmRules.filter((r) => r.accountId === account.id && r.enabled);
            const bal = calculateCurrentBalance(account.startingBalance, accTrades, accTxs);

            // Account-level rules (not assigned to a specific phase)
            const accountLevelRules = accRules.filter((r) => !r.phaseId);

            return (
              <div
                key={account.id}
                className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-4 sm:p-6 shadow-sm space-y-5"
              >
                {/* Account Title & Top Toolbar */}
                <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-zinc-800">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-zinc-100 tracking-tight">
                        {account.name}
                      </h3>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 uppercase border border-zinc-700">
                        {account.type.replace('_', ' ')}
                      </span>
                      <span className="text-[10px] font-mono text-zinc-400 font-semibold px-1.5 py-0.5 rounded bg-zinc-950 border border-zinc-800">
                        {account.currency}
                      </span>
                      {account.status === 'ARCHIVED' && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950/60 text-amber-400 border border-amber-800 uppercase">
                          Archived
                        </span>
                      )}
                    </div>
                    {account.notes && (
                      <p className="text-xs text-zinc-400 mt-0.5">{account.notes}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {account.status === 'ARCHIVED' ? (
                      <button
                        onClick={() => handleUnarchiveAccount(account)}
                        className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-mono rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-colors"
                        title="Restore Account to Active"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Unarchive</span>
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => setPhaseForAccount({ account })}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-mono rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-colors"
                          title="Add Phase to Account"
                        >
                          <Layers className="w-3 h-3 text-zinc-400" />
                          <span>+ Phase</span>
                        </button>

                        <button
                          onClick={() => setAccountForTx(account)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-mono rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Balance Tx</span>
                        </button>

                        <button
                          onClick={() => setAccountForRule({ account })}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-mono rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-colors"
                        >
                          <Sliders className="w-3 h-3" />
                          <span>Add Rule</span>
                        </button>

                        <button
                          onClick={() => setEditingAccount(account)}
                          className="p-1.5 text-zinc-400 hover:text-zinc-100 rounded hover:bg-zinc-800 transition-colors cursor-pointer"
                          title="Edit Account"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => setAccountToArchive(account)}
                          className="p-1.5 text-zinc-400 hover:text-amber-400 rounded hover:bg-zinc-800 transition-colors cursor-pointer"
                          title="Archive Account"
                        >
                          <Archive className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}

                    <button
                      onClick={() => setAccountToDelete(account)}
                      className="p-1.5 text-zinc-500 hover:text-rose-400 rounded hover:bg-zinc-800 transition-colors cursor-pointer"
                      title="Delete Account"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Account Balances Breakdown */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800 font-mono">
                    <span className="text-[10px] uppercase text-zinc-500 block">Current Balance</span>
                    <span className="text-lg font-bold text-zinc-100">
                      {formatMoney(bal.currentBalance, account.currency)}
                    </span>
                    <span className="text-[10px] text-zinc-500 block mt-0.5">
                      Starting: {formatMoney(account.startingBalance, account.currency)}
                    </span>
                  </div>

                  <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800 font-mono">
                    <span className="text-[10px] uppercase text-zinc-500 block">Realized Trading P&L</span>
                    <span
                      className={`text-lg font-bold ${
                        bal.totalRealizedPnL > 0
                          ? 'text-emerald-400'
                          : bal.totalRealizedPnL < 0
                          ? 'text-rose-400'
                          : 'text-zinc-400'
                      }`}
                    >
                      {formatSignedMoney(bal.totalRealizedPnL, account.currency)}
                    </span>
                    <span className="text-[10px] text-zinc-500 block mt-0.5">
                      {accTrades.length} trades settled
                    </span>
                  </div>

                  <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800 font-mono">
                    <span className="text-[10px] uppercase text-zinc-500 block">Deposits</span>
                    <span className="text-sm font-bold text-emerald-400/90 flex items-center gap-1 mt-0.5">
                      <ArrowDownRight className="w-3.5 h-3.5" />
                      +{formatMoney(bal.totalDeposits, account.currency)}
                    </span>
                    <span className="text-[10px] text-zinc-500 block mt-0.5">Capital in</span>
                  </div>

                  <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800 font-mono">
                    <span className="text-[10px] uppercase text-zinc-500 block">Withdrawals / Fees</span>
                    <span className="text-sm font-bold text-rose-400/90 flex items-center gap-1 mt-0.5">
                      <ArrowUpRight className="w-3.5 h-3.5" />
                      -{formatMoney(bal.totalWithdrawals + bal.totalFees, account.currency)}
                    </span>
                    <span className="text-[10px] text-zinc-500 block mt-0.5">Capital out</span>
                  </div>
                </div>

                {/* HIERARCHICAL STRUCTURE: Account └── Phase └── Rules */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-zinc-400" />
                      <h4 className="text-xs font-mono font-semibold uppercase tracking-wider text-zinc-300">
                        Phases & Associated Evaluation Rules ({accPhases.length})
                      </h4>
                    </div>

                    <button
                      onClick={() => setPhaseForAccount({ account })}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-mono rounded bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 border border-zinc-700/80 transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add Phase</span>
                    </button>
                  </div>

                  {accPhases.length === 0 ? (
                    <div className="bg-zinc-950/40 border border-dashed border-zinc-800 rounded-lg p-3.5 text-center">
                      <p className="text-xs text-zinc-400">No evaluation phases defined for this account.</p>
                      <p className="text-[11px] text-zinc-500 mt-0.5">
                        Add a phase (e.g. Challenge, Verification, Funded) to structure targets and drawdown rules.
                      </p>
                      <button
                        onClick={() => setPhaseForAccount({ account })}
                        className="mt-2.5 inline-flex items-center gap-1 px-3 py-1 text-xs font-mono rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Add First Phase</span>
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {accPhases.map((phase) => {
                        const phaseRules = accRules.filter((r) => r.phaseId === phase.id);
                        const phaseTrades = accTrades.filter((t) => t.phaseId === phase.id);
                        const phasePnL = phaseTrades.reduce(
                          (sum, t) => sum + (t.realizedPnL || 0),
                          0
                        );

                        return (
                          <div
                            key={phase.id}
                            className="bg-zinc-950/70 border border-zinc-800/90 rounded-lg p-3.5 space-y-3"
                          >
                            {/* Phase Header */}
                            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-zinc-850">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-zinc-200 font-mono">
                                  {phase.name}
                                </span>
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-750 uppercase">
                                  {phase.type}
                                </span>
                                {/* Phase status badge */}
                                <div className="flex items-center gap-1">
                                  {phase.status === 'ACTIVE' && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-800/80">
                                      <Clock className="w-2.5 h-2.5" />
                                      ACTIVE
                                    </span>
                                  )}
                                  {phase.status === 'PASSED' && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-950/60 text-blue-300 border border-blue-800/80">
                                      <CheckCircle2 className="w-2.5 h-2.5 text-blue-400" />
                                      PASSED
                                    </span>
                                  )}
                                  {phase.status === 'FAILED' && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-950/60 text-rose-300 border border-rose-800/80">
                                      <XCircle className="w-2.5 h-2.5 text-rose-400" />
                                      FAILED
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <span className="text-[11px] font-mono text-zinc-400">
                                  Initial: {formatMoney(phase.startingBalance, account.currency)}
                                </span>
                                {phaseTrades.length > 0 && (
                                  <span
                                    className={`text-[11px] font-mono font-bold ${
                                      phasePnL >= 0 ? 'text-emerald-400' : 'text-rose-400'
                                    }`}
                                  >
                                    ({phaseTrades.length} trades, {formatSignedMoney(phasePnL, account.currency)})
                                  </span>
                                )}

                                {/* Status Toggle Dropdown */}
                                <select
                                  value={phase.status}
                                  onChange={(e) =>
                                    handleUpdatePhaseStatus(phase.id, e.target.value as PhaseStatus)
                                  }
                                  className="bg-zinc-900 text-zinc-300 text-[10px] font-mono px-1.5 py-0.5 rounded border border-zinc-700 focus:outline-none"
                                >
                                  <option value="ACTIVE">Mark Active</option>
                                  <option value="PASSED">Mark Passed</option>
                                  <option value="FAILED">Mark Failed</option>
                                  <option value="ARCHIVED">Mark Archived</option>
                                </select>

                                <button
                                  onClick={() => setPhaseForAccount({ account, phase })}
                                  className="p-1 text-zinc-400 hover:text-zinc-200"
                                  title="Edit Phase"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>

                                <button
                                  onClick={() => setAccountForRule({ account, phaseId: phase.id })}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 transition-colors"
                                >
                                  <Plus className="w-2.5 h-2.5" />
                                  <span>Add Rule</span>
                                </button>
                              </div>
                            </div>

                            {/* Phase Rules List */}
                            {phaseRules.length === 0 ? (
                              <div className="text-[11px] text-zinc-500 font-mono italic">
                                No rules linked to this phase yet.{' '}
                                <button
                                  onClick={() => setAccountForRule({ account, phaseId: phase.id })}
                                  className="text-zinc-400 underline hover:text-zinc-200 not-italic"
                                >
                                  Add Phase Rule
                                </button>
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 font-mono text-xs">
                                {phaseRules.map((rule) => {
                                  const evaluated = evaluateRuleStatus(
                                    rule,
                                    accTrades,
                                    bal.currentBalance,
                                    phase.startingBalance,
                                    account.currency
                                  );

                                  return (
                                    <div
                                      key={rule.id}
                                      className={`p-2.5 rounded border flex flex-col justify-between ${
                                        evaluated.status === 'BREACHED'
                                          ? 'bg-rose-950/30 border-rose-800/60 text-rose-300'
                                          : evaluated.status === 'WARNING'
                                          ? 'bg-amber-950/30 border-amber-800/60 text-amber-300'
                                          : evaluated.status === 'SAFE' && evaluated.achieved
                                          ? 'bg-emerald-950/30 border-emerald-800/60 text-emerald-300'
                                          : evaluated.status === 'NOT_EVALUABLE'
                                          ? 'bg-zinc-950/70 border-zinc-800/80 text-zinc-400'
                                          : evaluated.status === 'NOT_CONFIGURED' || evaluated.status === 'UNKNOWN'
                                          ? 'bg-zinc-950/40 border-zinc-800/50 text-zinc-500'
                                          : 'bg-zinc-900 border-zinc-800 text-zinc-300'
                                      }`}
                                    >
                                      <div className="flex items-center justify-between gap-1">
                                        <span className="text-[11px] text-zinc-400 block truncate">
                                          {rule.ruleName}
                                        </span>
                                        <div className="flex items-center gap-1 shrink-0">
                                          <span className="text-[9px] uppercase px-1 py-0.2 rounded bg-zinc-800/60 text-zinc-400 font-mono">
                                            {rule.ruleType || rule.category.replace('_', ' ')}
                                          </span>
                                          <span
                                            className={`text-[9px] font-bold px-1 py-0.2 rounded font-mono ${
                                              evaluated.status === 'BREACHED'
                                                ? 'bg-rose-900/60 text-rose-200'
                                                : evaluated.status === 'WARNING'
                                                ? 'bg-amber-900/60 text-amber-200'
                                                : evaluated.status === 'SAFE' && evaluated.achieved
                                                ? 'bg-emerald-900/60 text-emerald-200'
                                                : evaluated.status === 'NOT_EVALUABLE'
                                                ? 'bg-zinc-800 text-zinc-400'
                                                : 'bg-zinc-800 text-zinc-400'
                                            }`}
                                          >
                                            {evaluated.achieved ? 'ACHIEVED' : evaluated.status}
                                          </span>
                                        </div>
                                      </div>
                                      <span className="text-xs font-bold mt-1 block">
                                        {evaluated.displayText}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Account-wide rules (not tied to any single phase) */}
                  {accountLevelRules.length > 0 && (
                    <div className="bg-zinc-950/40 border border-zinc-800/70 rounded-lg p-3 space-y-2">
                      <span className="text-[11px] font-mono font-semibold uppercase text-zinc-400 block">
                        Account-Wide General Rules
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 font-mono text-xs">
                        {accountLevelRules.map((rule) => {
                          const evaluated = evaluateRuleStatus(
                            rule,
                            accTrades,
                            bal.currentBalance,
                            account.startingBalance,
                            account.currency
                          );

                          return (
                            <div
                              key={rule.id}
                              className={`p-2.5 rounded border flex flex-col justify-between ${
                                evaluated.status === 'BREACHED'
                                  ? 'bg-rose-950/30 border-rose-800/60 text-rose-300'
                                  : evaluated.status === 'WARNING'
                                  ? 'bg-amber-950/30 border-amber-800/60 text-amber-300'
                                  : evaluated.status === 'SAFE' && evaluated.achieved
                                  ? 'bg-emerald-950/30 border-emerald-800/60 text-emerald-300'
                                  : evaluated.status === 'NOT_EVALUABLE'
                                  ? 'bg-zinc-950/70 border-zinc-800/80 text-zinc-400'
                                  : evaluated.status === 'NOT_CONFIGURED' || evaluated.status === 'UNKNOWN'
                                  ? 'bg-zinc-950/40 border-zinc-800/50 text-zinc-500'
                                  : 'bg-zinc-900 border-zinc-800 text-zinc-300'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-[11px] text-zinc-400 block truncate">
                                  {rule.ruleName}
                                </span>
                                <span
                                  className={`text-[9px] font-bold px-1 py-0.2 rounded font-mono ${
                                    evaluated.status === 'BREACHED'
                                      ? 'bg-rose-900/60 text-rose-200'
                                      : evaluated.status === 'WARNING'
                                      ? 'bg-amber-900/60 text-amber-200'
                                      : evaluated.status === 'SAFE' && evaluated.achieved
                                      ? 'bg-emerald-900/60 text-emerald-200'
                                      : 'bg-zinc-800 text-zinc-400'
                                  }`}
                                >
                                  {evaluated.achieved ? 'ACHIEVED' : evaluated.status}
                                </span>
                              </div>
                              <span className="text-xs font-bold mt-1 block">
                                {evaluated.displayText}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Recent Balance Transactions */}
                {accTxs.length > 0 && (
                  <div className="text-xs font-mono pt-1">
                    <span className="text-[11px] uppercase text-zinc-500 font-semibold block mb-1.5">
                      Recent Account Balance Transactions
                    </span>
                    <div className="space-y-1">
                      {accTxs.slice(-3).map((tx) => (
                        <div
                          key={tx.id}
                          className="flex items-center justify-between py-1 px-2 rounded bg-zinc-950/40 border border-zinc-800/40"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-zinc-500">{tx.date}</span>
                            <span className="font-semibold text-zinc-300">{tx.type}</span>
                            {tx.notes && <span className="text-zinc-500 italic">({tx.notes})</span>}
                          </div>
                          <span
                            className={`font-bold ${
                              tx.type === 'DEPOSIT'
                                ? 'text-emerald-400'
                                : tx.type === 'WITHDRAWAL' || tx.type === 'PAYOUT'
                                ? 'text-rose-400'
                                : 'text-zinc-300'
                            }`}
                          >
                            {tx.type === 'DEPOSIT' ? '+' : '-'}{formatMoney(tx.amount, account.currency)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Account Modal */}
      {isAddAccountOpen && (
        <AccountModal
          isOpen={isAddAccountOpen}
          onClose={() => setIsAddAccountOpen(false)}
          onSaved={onRefresh}
        />
      )}

      {editingAccount && (
        <AccountModal
          isOpen={!!editingAccount}
          onClose={() => setEditingAccount(null)}
          initialAccount={editingAccount}
          onSaved={onRefresh}
        />
      )}

      {/* Phase Modal */}
      {phaseForAccount && (
        <PhaseModal
          isOpen={!!phaseForAccount}
          onClose={() => setPhaseForAccount(null)}
          accountId={phaseForAccount.account.id}
          defaultStartingBalance={phaseForAccount.account.startingBalance}
          initialPhase={phaseForAccount.phase}
          onSaved={onRefresh}
        />
      )}

      {/* Prop Firm Rule Modal */}
      {accountForRule && (
        <PropFirmRuleModal
          isOpen={!!accountForRule}
          onClose={() => setAccountForRule(null)}
          accountId={accountForRule.account.id}
          phaseId={accountForRule.phaseId}
          phases={accountPhases.filter((p) => p.accountId === accountForRule.account.id)}
          onSaved={onRefresh}
        />
      )}

      {/* Transaction Modal */}
      {accountForTx && (
        <TransactionModal
          isOpen={!!accountForTx}
          onClose={() => setAccountForTx(null)}
          accounts={accounts}
          defaultAccountId={accountForTx.id}
          onSaved={onRefresh}
        />
      )}

      {/* Archive Account Confirmation Modal */}
      {accountToArchive && (
        <Modal
          isOpen={!!accountToArchive}
          onClose={() => setAccountToArchive(null)}
          title="Archive Account?"
          maxWidth="sm"
        >
          <div className="space-y-4">
            <div className="p-3 bg-amber-950/40 border border-amber-800/60 rounded-lg flex items-start gap-2.5 text-amber-200 text-xs">
              <Archive className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-amber-100">
                  Are you sure you want to archive this account?
                </p>
                <p className="text-amber-300/90 leading-relaxed">
                  Archived accounts will no longer appear in active account selectors, but historical trading records will be preserved.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setAccountToArchive(null)}
                className="px-4 py-2 text-xs font-medium text-zinc-400 hover:text-zinc-200 rounded-lg border border-zinc-700 hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleArchiveAccount(accountToArchive)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-mono transition-colors cursor-pointer"
              >
                <Archive className="w-3.5 h-3.5 text-zinc-950" />
                <span>Archive Account</span>
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Account Confirmation Modal */}
      {accountToDelete && (
        <Modal
          isOpen={!!accountToDelete}
          onClose={() => setAccountToDelete(null)}
          title="Delete Account?"
          maxWidth="sm"
        >
          <div className="space-y-4">
            <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-lg flex items-start gap-2.5 text-rose-200 text-xs">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-rose-100">
                  Are you sure you want to permanently delete this account and its linked records?
                </p>
                <p className="text-rose-300/90 leading-relaxed">
                  This action cannot be undone. All linked trading records will be permanently erased.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setAccountToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-medium text-zinc-400 hover:text-zinc-200 rounded-lg border border-zinc-700 hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={isDeleting}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-mono transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeleting ? 'Deleting...' : 'Delete Account'}</span>
              </button>
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
}
