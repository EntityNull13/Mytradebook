import { useState } from 'react';
import { PlanStatusBadge, DirectionBadge } from '../common/Badge';
import { PlanFormModal } from './PlanFormModal';
import { TriggerModal } from './TriggerModal';
import { LayerPlanModal } from './LayerPlanModal';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { Modal } from '../common/Modal';
import { db } from '../../db/database';
import { formatMoney } from '../../calculations';
import type { Plan, Account, Setup, PlanStatus, Evidence, Trade } from '../../types';
import { getScopedAccountIds } from '../../utils/accountScope';
import {
  Plus,
  Layers,
  Copy,
  Zap,
  Ban,
  CircleOff,
  Edit2,
  Trash2,
  Image as ImageIcon,
  Search,
  Archive,
  AlertTriangle,
} from 'lucide-react';

interface PlansViewProps {
  plans: Plan[];
  trades?: Trade[];
  accounts: Account[];
  setups: Setup[];
  evidenceList: Evidence[];
  onRefresh: () => void;
  onOpenNewPlan: () => void;
  selectedAccountId?: string;
  selectedScope?: string;
}

export function PlansView({
  plans,
  trades = [],
  accounts,
  setups,
  evidenceList,
  onRefresh,
  onOpenNewPlan,
  selectedAccountId,
  selectedScope,
}: PlansViewProps) {
  const [filterStatus, setFilterStatus] = useState<PlanStatus | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modals state
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [triggeringPlan, setTriggeringPlan] = useState<Plan | null>(null);
  const [isLayerModalOpen, setIsLayerModalOpen] = useState(false);
  const [planToDelete, setPlanToDelete] = useState<Plan | null>(null);

  // Invalidate / Not Triggered Reason Prompt Modal
  const [statusActionPlan, setStatusActionPlan] = useState<{
    plan: Plan;
    targetStatus: 'NOT_TRIGGERED' | 'INVALID';
  } | null>(null);
  const [statusReason, setStatusReason] = useState('');

  // Evidence view modal
  const [viewingEvidence, setViewingEvidence] = useState<Evidence | null>(null);

  // Filter plans by scoped account IDs
  const activeScopeStr = selectedScope || selectedAccountId || 'ALL';
  const scopedAccountIds = getScopedAccountIds(accounts, activeScopeStr);

  const filteredPlans = plans.filter((p) => {
    if (!scopedAccountIds.has(p.accountId)) return false;
    if (filterStatus !== 'ALL' && p.status !== filterStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchesSymbol = p.symbol.toLowerCase().includes(q);
      const matchesReason = p.entryReason?.toLowerCase().includes(q);
      const matchesNotes = p.notes?.toLowerCase().includes(q);
      if (!matchesSymbol && !matchesReason && !matchesNotes) return false;
    }
    return true;
  });

  // Duplicate Plan (per PRD Section 32)
  const handleDuplicatePlan = async (sourcePlan: Plan) => {
    try {
      const now = new Date().toISOString();
      const duplicated: Plan = {
        id: `plan-${Date.now()}`,
        accountId: sourcePlan.accountId,
        symbol: sourcePlan.symbol,
        direction: sourcePlan.direction,
        plannedEntry: sourcePlan.plannedEntry,
        sl: sourcePlan.sl,
        tp: sourcePlan.tp,
        positionSize: sourcePlan.positionSize,
        risk: sourcePlan.risk,
        setupId: sourcePlan.setupId,
        timeframe: sourcePlan.timeframe,
        marketBias: sourcePlan.marketBias,
        entryReason: sourcePlan.entryReason,
        confidence: sourcePlan.confidence,
        notes: sourcePlan.notes,
        screenshotId: sourcePlan.screenshotId,
        status: 'PLANNED', // strictly PLANNED
        duplicatedFromPlanId: sourcePlan.id,
        createdAt: now,
        updatedAt: now,
      };

      await db.plans.put(duplicated);
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  // Confirm Status change (NOT_TRIGGERED or INVALID)
  const handleConfirmStatusChange = async () => {
    if (!statusActionPlan) return;
    try {
      const now = new Date().toISOString();
      if (statusActionPlan.targetStatus === 'NOT_TRIGGERED') {
        await db.plans.update(statusActionPlan.plan.id, {
          status: 'NOT_TRIGGERED',
          notTriggeredReason: statusReason.trim() || 'Price did not reach planned entry level',
          updatedAt: now,
        });
      } else {
        await db.plans.update(statusActionPlan.plan.id, {
          status: 'INVALID',
          invalidReason: statusReason.trim() || 'Setup invalidated prior to trigger',
          updatedAt: now,
        });
      }
      setStatusActionPlan(null);
      setStatusReason('');
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeletePlan = async () => {
    if (!planToDelete) return;
    try {
      await db.plans.delete(planToDelete.id);
      setPlanToDelete(null);
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  const handleArchivePlan = async () => {
    if (!planToDelete) return;
    try {
      await db.plans.update(planToDelete.id, {
        status: 'ARCHIVED',
        updatedAt: new Date().toISOString(),
      });
      setPlanToDelete(null);
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  const linkedTrade = planToDelete ? trades.find((t) => t.planId === planToDelete.id) : undefined;

  const accountMap = new Map(accounts.map((a) => [a.id, a]));
  const setupMap = new Map(setups.map((s) => [s.id, s.name]));
  const evidenceMap = new Map(evidenceList.map((e) => [e.id, e]));

  return (
    <div className="space-y-6">
      {/* Top action toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-zinc-100 tracking-tight flex items-center gap-2">
            <span>Trading Plans</span>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
              {filteredPlans.length}
            </span>
          </h2>
          <p className="text-xs text-zinc-400">
            Formulate and document execution conditions before market entry
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsLayerModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-300 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg transition-colors"
          >
            <Layers className="w-3.5 h-3.5 text-zinc-400" />
            <span>Layering Grid</span>
          </button>
          <button
            onClick={onOpenNewPlan}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-zinc-950 bg-zinc-100 hover:bg-white rounded-lg transition-colors font-mono font-semibold"
          >
            <Plus className="w-3.5 h-3.5 text-zinc-950 stroke-[3]" />
            <span>New Plan</span>
          </button>
        </div>
      </div>

      {/* Filter toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-900/40 p-2.5 rounded-xl border border-zinc-800/80">
        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search symbol, notes..."
            className="w-full bg-zinc-950 text-zinc-200 text-xs pl-8 pr-3 py-1.5 rounded-lg border border-zinc-800 focus:border-zinc-500 focus:outline-none"
          />
        </div>

        {/* Status pills */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
          {(['ALL', 'PLANNED', 'TRIGGERED', 'NOT_TRIGGERED', 'INVALID', 'ARCHIVED'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono font-medium transition-colors uppercase whitespace-nowrap ${
                filterStatus === st
                  ? 'bg-zinc-100 text-zinc-950 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
              }`}
            >
              {st === 'ALL' ? 'All Status' : st.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Plans List */}
      {filteredPlans.length === 0 ? (
        <div className="text-center py-16 px-4 border border-dashed border-zinc-800 rounded-xl bg-zinc-950/40">
          <p className="text-sm font-medium text-zinc-400">No trading plans found</p>
          <p className="text-xs text-zinc-500 mt-1">
            {plans.length === 0
              ? 'Start by creating your first trading plan with parameters and entry reason.'
              : 'Try changing your status filter or search criteria.'}
          </p>
          {plans.length === 0 && (
            <button
              onClick={onOpenNewPlan}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-zinc-950 bg-zinc-100 hover:bg-white rounded-lg transition-colors font-mono"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create First Plan</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPlans.map((plan) => {
            const account = accountMap.get(plan.accountId);
            const accountName = account?.name || 'Account';
            const currency = account?.currency || 'USD';
            const setupName = plan.setupId ? setupMap.get(plan.setupId) : undefined;
            const evidence = plan.screenshotId ? evidenceMap.get(plan.screenshotId) : undefined;

            return (
              <div
                key={plan.id}
                className="bg-zinc-900/70 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between hover:border-zinc-700 transition-all shadow-sm"
              >
                <div>
                  {/* Header Row */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-base font-bold font-mono text-zinc-100 tracking-tight">
                          {plan.symbol}
                        </span>
                        <DirectionBadge direction={plan.direction} />
                      </div>
                      <span className="text-[11px] text-zinc-500 block truncate max-w-[180px]">
                        {accountName}
                      </span>
                    </div>
                    <PlanStatusBadge status={plan.status} />
                  </div>

                  {/* Planned Metrics Grid */}
                  <div className="grid grid-cols-3 gap-2 bg-zinc-950/80 p-2.5 rounded-lg border border-zinc-800/80 mb-3 text-xs font-mono">
                    <div>
                      <span className="text-[10px] text-zinc-500 block">Plan Entry</span>
                      <span className="text-zinc-200 font-semibold">{plan.plannedEntry}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-500 block">SL</span>
                      <span className="text-zinc-400">{plan.sl ?? '—'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-500 block">TP</span>
                      <span className="text-zinc-400">{plan.tp ?? '—'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-500 block">Plan Size</span>
                      <span className="text-zinc-300">{plan.positionSize ?? '—'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-500 block">Risk ({currency})</span>
                      <span className="text-zinc-300">
                        {plan.risk ? formatMoney(plan.risk, currency) : '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-500 block">Timeframe</span>
                      <span className="text-zinc-300">{plan.timeframe ?? '—'}</span>
                    </div>
                  </div>

                  {/* Setup & Reason */}
                  {(setupName || plan.entryReason) && (
                    <div className="mb-3 text-xs space-y-1">
                      {setupName && (
                        <div className="inline-block text-[11px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700/60">
                          {setupName}
                        </div>
                      )}
                      {plan.entryReason && (
                        <p className="text-zinc-400 line-clamp-2 text-[11px] leading-relaxed">
                          {plan.entryReason}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Reason for Invalidation / Not Triggered */}
                  {plan.status === 'NOT_TRIGGERED' && plan.notTriggeredReason && (
                    <div className="p-2 mb-3 rounded bg-zinc-950 border border-zinc-800 text-[11px] text-zinc-400">
                      <strong className="text-zinc-300 font-mono">Not Triggered:</strong> {plan.notTriggeredReason}
                    </div>
                  )}
                  {plan.status === 'INVALID' && plan.invalidReason && (
                    <div className="p-2 mb-3 rounded bg-amber-950/30 border border-amber-900/40 text-[11px] text-amber-300/90">
                      <strong className="text-amber-200 font-mono">Invalidated:</strong> {plan.invalidReason}
                    </div>
                  )}

                  {/* Screenshot Thumbnail */}
                  {evidence && (
                    <button
                      onClick={() => setViewingEvidence(evidence)}
                      className="mb-3 flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 font-mono transition-colors"
                    >
                      <ImageIcon className="w-3.5 h-3.5" />
                      <span>View Chart Screenshot</span>
                    </button>
                  )}
                </div>

                {/* Card Actions */}
                <div className="pt-3 border-t border-zinc-800/80 flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1">
                    {/* Trigger Button (if PLANNED) */}
                    {plan.status === 'PLANNED' && (
                      <button
                        onClick={() => setTriggeringPlan(plan)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-mono font-semibold rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30 transition-colors"
                        title="Trigger trade execution"
                      >
                        <Zap className="w-3 h-3" />
                        <span>Trigger</span>
                      </button>
                    )}

                    {/* Duplicate Plan */}
                    <button
                      onClick={() => handleDuplicatePlan(plan)}
                      className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded transition-colors"
                      title="Duplicate Plan (Creates new planned entry)"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>

                    {/* Edit */}
                    <button
                      onClick={() => setEditingPlan(plan)}
                      className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded transition-colors"
                      title="Edit Plan"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    {/* Delete */}
                    <button
                      onClick={() => setPlanToDelete(plan)}
                      className="p-1.5 text-zinc-400 hover:text-rose-400 hover:bg-zinc-800 rounded transition-colors"
                      title="Delete Plan"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Mark Not Triggered or Invalid buttons if PLANNED */}
                  {plan.status === 'PLANNED' && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setStatusActionPlan({ plan, targetStatus: 'NOT_TRIGGERED' });
                          setStatusReason('Price never reached planned entry level before setup expired');
                        }}
                        className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded transition-colors"
                        title="Mark Not Triggered"
                      >
                        <CircleOff className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          setStatusActionPlan({ plan, targetStatus: 'INVALID' });
                          setStatusReason('Market structure shift invalidated setup');
                        }}
                        className="p-1.5 text-zinc-500 hover:text-amber-400 hover:bg-zinc-800 rounded transition-colors"
                        title="Mark Invalid"
                      >
                        <Ban className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Trigger Modal */}
      {triggeringPlan && (
        <TriggerModal
          isOpen={!!triggeringPlan}
          onClose={() => setTriggeringPlan(null)}
          plan={triggeringPlan}
          onTriggered={onRefresh}
        />
      )}

      {/* Edit Plan Modal */}
      {editingPlan && (
        <PlanFormModal
          isOpen={!!editingPlan}
          onClose={() => setEditingPlan(null)}
          accounts={accounts}
          setups={setups}
          initialPlan={editingPlan}
          onSaved={onRefresh}
        />
      )}

      {/* Layer Modal */}
      <LayerPlanModal
        isOpen={isLayerModalOpen}
        onClose={() => setIsLayerModalOpen(false)}
        accounts={accounts}
        onSaved={onRefresh}
      />

      {/* Invalidate / Not Triggered Reason Modal */}
      {statusActionPlan && (
        <Modal
          isOpen={!!statusActionPlan}
          onClose={() => setStatusActionPlan(null)}
          title={
            statusActionPlan.targetStatus === 'NOT_TRIGGERED'
              ? 'Mark Plan as Not Triggered'
              : 'Mark Plan as Invalid'
          }
          subtitle="Document the market reason clearly for descriptive review"
          maxWidth="sm"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Reason / Invalidation Cause
              </label>
              <textarea
                rows={3}
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
                placeholder="Why was this plan not triggered or invalidated?"
                className="w-full bg-zinc-950 text-zinc-200 text-xs px-3 py-2 rounded-lg border border-zinc-800 focus:border-zinc-500 focus:outline-none resize-none"
              />
            </div>
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
              <button
                onClick={() => setStatusActionPlan(null)}
                className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmStatusChange}
                className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-zinc-100 text-zinc-950 hover:bg-zinc-200 font-mono transition-colors"
              >
                Save Status
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete / Archive Confirmation Dialog */}
      {planToDelete && linkedTrade ? (
        <Modal
          isOpen={true}
          onClose={() => setPlanToDelete(null)}
          title="Plan Linked to Historical Trade"
          subtitle="Data safety protection active"
          maxWidth="md"
        >
          <div className="space-y-4">
            <div className="p-3 bg-amber-950/40 border border-amber-800/60 rounded-lg flex items-start gap-2.5 text-amber-200 text-xs">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-amber-100">Historical Trade Relationship Exists</p>
                <p className="text-amber-300/90 leading-relaxed">
                  The plan for <span className="font-mono font-bold text-amber-200">{planToDelete.symbol}</span> has an associated executed trade (ID: {linkedTrade.id}).
                  Hard deleting this plan would break the historical <strong>Plan → Trade → Exit → Review</strong> audit trail.
                </p>
                <p className="text-amber-300/90">
                  Please <strong>Archive</strong> this plan instead to preserve historical analytics and prevent orphan records.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setPlanToDelete(null)}
                className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded border border-zinc-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleArchivePlan}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded bg-amber-500 hover:bg-amber-400 text-zinc-950 font-mono transition-colors"
              >
                <Archive className="w-3.5 h-3.5 text-zinc-950" />
                <span>Archive Plan (Safe)</span>
              </button>
            </div>
          </div>
        </Modal>
      ) : (
        <ConfirmDialog
          isOpen={!!planToDelete && !linkedTrade}
          onClose={() => setPlanToDelete(null)}
          onConfirm={handleDeletePlan}
          title="Delete Trading Plan"
          message={`Are you sure you want to delete the plan for ${planToDelete?.symbol}? This action cannot be undone.`}
          isDestructive
          confirmLabel="Delete Plan"
        />
      )}

      {/* Screenshot Evidence Modal */}
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
