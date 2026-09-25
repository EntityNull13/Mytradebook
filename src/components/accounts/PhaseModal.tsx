import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { db } from '../../db/database';
import type { AccountPhase, PhaseType, PhaseStatus } from '../../types';

interface PhaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  accountId: string;
  defaultStartingBalance?: number;
  initialPhase?: AccountPhase | null;
  onSaved: () => void;
}

export function PhaseModal({
  isOpen,
  onClose,
  accountId,
  defaultStartingBalance = 10000,
  initialPhase,
  onSaved,
}: PhaseModalProps) {
  const [name, setName] = useState(initialPhase?.name || '');
  const [type, setType] = useState<PhaseType>(initialPhase?.type || 'CHALLENGE');
  const [status, setStatus] = useState<PhaseStatus>(initialPhase?.status || 'ACTIVE');
  const [startingBalance, setStartingBalance] = useState(
    initialPhase?.startingBalance?.toString() || defaultStartingBalance.toString()
  );
  const [startedAt, setStartedAt] = useState(
    initialPhase?.startedAt?.slice(0, 10) || new Date().toISOString().slice(0, 10)
  );
  const [notes, setNotes] = useState(initialPhase?.notes || '');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!name.trim()) {
      setErrorMsg('Please specify a phase name (e.g. Phase 1 - Challenge)');
      return;
    }

    const startBal = parseFloat(startingBalance);
    if (isNaN(startBal) || startBal < 0) {
      setErrorMsg('Please enter a valid starting balance');
      return;
    }

    try {
      const phaseData: AccountPhase = {
        id: initialPhase?.id || `phase-${Date.now()}`,
        accountId,
        name: name.trim(),
        type,
        status,
        startingBalance: startBal,
        startedAt: new Date(startedAt).toISOString(),
        notes: notes.trim() || undefined,
      };

      await db.accountPhases.put(phaseData);
      onSaved();
      onClose();
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to save account phase');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialPhase ? 'Edit Account Phase' : 'Add Evaluation / Account Phase'}
      subtitle="Define phase objectives, targets, and status for structured tracking"
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMsg && (
          <div className="p-3 text-xs bg-rose-950/50 border border-rose-800 text-rose-300 rounded-lg">
            {errorMsg}
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-1">Phase Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Phase 1 - Challenge, Phase 2 - Verification, Funded Stage"
            required
            className="w-full bg-zinc-950 text-zinc-200 text-xs px-3 py-2 rounded-lg border border-zinc-800 focus:border-zinc-500 focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Phase Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as PhaseType)}
              className="w-full bg-zinc-950 text-zinc-200 text-xs px-3 py-2 rounded-lg border border-zinc-800 focus:border-zinc-500 focus:outline-none"
            >
              <option value="CHALLENGE">Challenge (Phase 1)</option>
              <option value="VERIFICATION">Verification (Phase 2)</option>
              <option value="FUNDED">Funded Stage</option>
              <option value="PAYOUT">Payout Stage</option>
              <option value="SCALING">Scaling Stage</option>
              <option value="CUSTOM">Custom Phase</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as PhaseStatus)}
              className="w-full bg-zinc-950 text-zinc-200 text-xs px-3 py-2 rounded-lg border border-zinc-800 focus:border-zinc-500 focus:outline-none"
            >
              <option value="ACTIVE">ACTIVE (In Progress)</option>
              <option value="PASSED">PASSED</option>
              <option value="FAILED">FAILED</option>
              <option value="ARCHIVED">ARCHIVED</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">
              Phase Starting Balance
            </label>
            <input
              type="number"
              step="any"
              value={startingBalance}
              onChange={(e) => setStartingBalance(e.target.value)}
              placeholder="e.g. 10000"
              required
              className="w-full bg-zinc-950 text-zinc-200 text-xs font-mono px-3 py-2 rounded-lg border border-zinc-800 focus:border-zinc-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Start Date</label>
            <input
              type="date"
              value={startedAt}
              onChange={(e) => setStartedAt(e.target.value)}
              className="w-full bg-zinc-950 text-zinc-200 text-xs px-3 py-2 rounded-lg border border-zinc-800 focus:border-zinc-500 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-1">Notes</label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Target details, credentials reminder, or timeline notes"
            className="w-full bg-zinc-950 text-zinc-200 text-xs px-3 py-2 rounded-lg border border-zinc-800 focus:border-zinc-500 focus:outline-none resize-none"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 rounded border border-zinc-700 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-1.5 text-xs font-semibold rounded bg-zinc-100 hover:bg-white text-zinc-950 font-mono transition-colors"
          >
            {initialPhase ? 'Update Phase' : 'Create Phase'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
