import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { DirectionBadge } from '../common/Badge';
import { db } from '../../db/database';
import type { Plan, Trade } from '../../types';
import { Zap, Clock } from 'lucide-react';

interface TriggerModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan: Plan | null;
  onTriggered: () => void;
}

interface TriggerFormProps {
  plan: Plan;
  onClose: () => void;
  onTriggered: () => void;
}

function TriggerForm({ plan, onClose, onTriggered }: TriggerFormProps) {
  const [actualEntry, setActualEntry] = useState(plan.plannedEntry ? plan.plannedEntry.toString() : '');
  const [actualSize, setActualSize] = useState(plan.positionSize ? plan.positionSize.toString() : '');
  const [actualTime, setActualTime] = useState(() => new Date().toISOString().slice(0, 16));
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const entryNum = parseFloat(actualEntry);
    const sizeNum = parseFloat(actualSize);

    if (isNaN(entryNum) || entryNum <= 0) {
      setErrorMsg('Please enter a valid actual fill entry price');
      return;
    }
    if (isNaN(sizeNum) || sizeNum <= 0) {
      setErrorMsg('Please enter a valid actual position size');
      return;
    }

    try {
      const now = new Date().toISOString();
      const tradeId = `trade-${Date.now()}`;

      // 1. Create ACTIVE Trade (realizedPnL must be null per Section 4)
      const newTrade: Trade = {
        id: tradeId,
        planId: plan.id,
        accountId: plan.accountId,
        phaseId: plan.phaseId,
        actualEntry: entryNum,
        actualEntryTime: actualTime ? new Date(actualTime).toISOString() : now,
        actualPositionSize: sizeNum,
        status: 'ACTIVE',
        realizedPnL: null, // Strictly null for active trades
        notes: notes.trim() || undefined,
        createdAt: now,
        updatedAt: now,
      };

      // 2. Mark Plan as TRIGGERED
      await db.transaction('rw', [db.plans, db.trades], async () => {
        await db.plans.update(plan.id, {
          status: 'TRIGGERED',
          updatedAt: now,
        });
        await db.trades.put(newTrade);
      });

      onTriggered();
      onClose();
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to trigger trade. Your existing data has not been deleted.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {errorMsg && (
        <div className="p-3 text-xs bg-rose-950/50 border border-rose-800 text-rose-300 rounded-lg">
          {errorMsg}
        </div>
      )}

      {/* Section: Planned Reference (Read-Only) */}
      <div className="bg-zinc-950/80 p-3.5 rounded-lg border border-zinc-800/80">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            Planned Intent
          </span>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-zinc-100">{plan.symbol}</span>
            <DirectionBadge direction={plan.direction} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs font-mono">
          <div>
            <span className="text-[10px] text-zinc-500 block">Planned Entry</span>
            <span className="text-zinc-200 font-semibold">{plan.plannedEntry}</span>
          </div>
          <div>
            <span className="text-[10px] text-zinc-500 block">Stop Loss (SL)</span>
            <span className="text-zinc-400">{plan.sl ?? '—'}</span>
          </div>
          <div>
            <span className="text-[10px] text-zinc-500 block">Take Profit (TP)</span>
            <span className="text-zinc-400">{plan.tp ?? '—'}</span>
          </div>
        </div>
      </div>

      {/* Section: Actual Execution Values */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          <span>Actual Execution Fill</span>
        </h4>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">
              Actual Fill Price *
            </label>
            <input
              type="number"
              step="any"
              value={actualEntry}
              onChange={(e) => setActualEntry(e.target.value)}
              required
              className="w-full bg-zinc-950 text-zinc-200 text-xs font-mono px-3 py-2 rounded-lg border border-zinc-800 focus:border-zinc-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">
              Actual Position Size *
            </label>
            <input
              type="number"
              step="any"
              value={actualSize}
              onChange={(e) => setActualSize(e.target.value)}
              required
              placeholder="e.g. 1.0"
              className="w-full bg-zinc-950 text-zinc-200 text-xs font-mono px-3 py-2 rounded-lg border border-zinc-800 focus:border-zinc-500 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-1 flex items-center gap-1">
            <Clock className="w-3 h-3 text-zinc-400" />
            <span>Fill Timestamp</span>
          </label>
          <input
            type="datetime-local"
            value={actualTime}
            onChange={(e) => setActualTime(e.target.value)}
            className="w-full bg-zinc-950 text-zinc-200 text-xs font-mono px-3 py-2 rounded-lg border border-zinc-800 focus:border-zinc-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-1">
            Execution Slippage / Notes
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. 0.4 pip slippage on market fill"
            className="w-full bg-zinc-950 text-zinc-200 text-xs px-3 py-2 rounded-lg border border-zinc-800 focus:border-zinc-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-xs font-medium text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg border border-zinc-700 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-5 py-2 text-xs font-semibold text-zinc-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors font-mono"
        >
          Confirm & Activate Trade
        </button>
      </div>
    </form>
  );
}

export function TriggerModal({
  isOpen,
  onClose,
  plan,
  onTriggered,
}: TriggerModalProps) {
  if (!isOpen || !plan) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Trigger Execution -> Active Trade"
      subtitle="Convert planned intent into an active execution"
      maxWidth="md"
    >
      <TriggerForm plan={plan} onClose={onClose} onTriggered={onTriggered} />
    </Modal>
  );
}
