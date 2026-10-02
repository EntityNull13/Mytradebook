import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { calculateTradeResult, formatMoney } from '../../calculations';
import { db } from '../../db/database';
import type { Trade, Plan, Exit, ExitType } from '../../types';

interface AddExitModalProps {
  isOpen: boolean;
  onClose: () => void;
  trade: Trade | null;
  plan: Plan | null;
  remainingSize: number;
  currency?: string;
  onSaved: () => void;
}

interface ExitFormProps {
  trade: Trade;
  plan: Plan;
  remainingSize: number;
  currency: string;
  onClose: () => void;
  onSaved: () => void;
}

function ExitForm({
  trade,
  plan,
  remainingSize,
  currency,
  onClose,
  onSaved,
}: ExitFormProps) {
  const [exitPrice, setExitPrice] = useState(trade.actualEntry.toString());
  const [closedSize, setClosedSize] = useState(remainingSize.toString());
  const [exitType, setExitType] = useState<ExitType>('FULL_TP');
  const [realizedPnL, setRealizedPnL] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const priceNum = parseFloat(exitPrice);
    const sizeNum = parseFloat(closedSize);
    const pnlNum = parseFloat(realizedPnL);

    if (isNaN(priceNum) || priceNum <= 0) {
      setErrorMsg('Please enter a valid exit price');
      return;
    }
    if (isNaN(sizeNum) || sizeNum <= 0) {
      setErrorMsg('Please enter a valid closed size');
      return;
    }
    // Strict Validation: Closed size cannot exceed remaining position size (Section 18)
    if (sizeNum > remainingSize + 0.000001) {
      setErrorMsg(`Closed size (${sizeNum}) cannot exceed remaining position size (${remainingSize}).`);
      return;
    }
    if (isNaN(pnlNum)) {
      setErrorMsg('Please enter the realized P&L for this exit.');
      return;
    }

    try {
      const now = new Date().toISOString();
      const exitId = `exit-${Date.now()}`;

      const newExit: Exit = {
        id: exitId,
        tradeId: trade.id,
        executedAt: now,
        price: priceNum,
        closedSize: sizeNum,
        exitType,
        realizedPnL: pnlNum,
        reason: reason.trim() || undefined,
        notes: notes.trim() || undefined,
      };

      const newRemaining = Math.max(0, Number((remainingSize - sizeNum).toFixed(6)));
      const isNowCompleted = newRemaining <= 0.000001;

      await db.transaction('rw', [db.trades, db.exits], async () => {
        await db.exits.put(newExit);
        
        // Sum all exits for this trade
        const existingExits = await db.exits.where('tradeId').equals(trade.id).toArray();
        const totalRealized = Number(existingExits.reduce((sum, x) => sum + x.realizedPnL, 0).toFixed(2));

        await db.trades.update(trade.id, {
          // Per Section 4: If completed, set realized P&L. If still ACTIVE, remains null.
          realizedPnL: isNowCompleted ? totalRealized : null,
          status: isNowCompleted ? 'COMPLETED' : 'ACTIVE',
          result: isNowCompleted ? calculateTradeResult(totalRealized) : undefined,
          completedAt: isNowCompleted ? now : trade.completedAt,
          updatedAt: now,
        });
      });

      onSaved();
      onClose();
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to record exit. Existing data safe.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {errorMsg && (
        <div className="p-3 text-xs bg-rose-950/50 border border-rose-800 text-rose-300 rounded-lg">
          {errorMsg}
        </div>
      )}

      {/* Position Context */}
      <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800 flex items-center justify-between text-xs font-mono">
        <div>
          <span className="text-[10px] text-zinc-500 block">Total Active Size</span>
          <span className="text-zinc-200 font-semibold">{trade.actualPositionSize}</span>
        </div>
        <div>
          <span className="text-[10px] text-zinc-500 block">Remaining Position</span>
          <span className="text-amber-400 font-bold">{remainingSize}</span>
        </div>
        <div>
          <span className="text-[10px] text-zinc-500 block">Status</span>
          <span className="text-sky-400 font-semibold">{trade.status}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-1">Exit Price *</label>
          <input
            type="number"
            step="any"
            value={exitPrice}
            onChange={(e) => setExitPrice(e.target.value)}
            required
            className="w-full bg-zinc-950 text-zinc-200 text-xs font-mono px-3 py-2 rounded-lg border border-zinc-800 focus:border-zinc-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-1">
            Closed Size * (Max: {remainingSize})
          </label>
          <input
            type="number"
            step="any"
            value={closedSize}
            onChange={(e) => setClosedSize(e.target.value)}
            max={remainingSize}
            required
            className="w-full bg-zinc-950 text-zinc-200 text-xs font-mono px-3 py-2 rounded-lg border border-zinc-800 focus:border-zinc-500 focus:outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-1">Exit Type *</label>
          <select
            value={exitType}
            onChange={(e) => setExitType(e.target.value as ExitType)}
            required
            className="w-full bg-zinc-950 text-zinc-200 text-xs px-3 py-2 rounded-lg border border-zinc-800 focus:border-zinc-500 focus:outline-none"
          >
            <option value="FULL_TP">Full TP (Take Profit)</option>
            <option value="CUT_PROFIT">Cut Profit (Manual / Early)</option>
            <option value="FULL_SL">Full SL (Stop Loss)</option>
            <option value="CUT_LOSS">Cut Loss (Manual / Early)</option>
            <option value="PARTIAL">Partial Exit</option>
            <option value="OTHER">Other</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-1">
            Realized P&L ({currency}) *
          </label>
          <input
            type="number"
            step="any"
            value={realizedPnL}
            onChange={(e) => setRealizedPnL(e.target.value)}
            placeholder="e.g. +450 or -200"
            required
            className="w-full bg-zinc-950 text-zinc-200 text-xs font-mono px-3 py-2 rounded-lg border border-zinc-800 focus:border-zinc-500 focus:outline-none"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-zinc-300 mb-1">Exit Trigger Reason</label>
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Target reached, structure break, high impact news"
          className="w-full bg-zinc-950 text-zinc-200 text-xs px-3 py-2 rounded-lg border border-zinc-800 focus:border-zinc-500 focus:outline-none"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-zinc-300 mb-1">Notes</label>
        <textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional exit notes"
          className="w-full bg-zinc-950 text-zinc-200 text-xs px-3 py-2 rounded-lg border border-zinc-800 focus:border-zinc-500 focus:outline-none resize-none"
        />
      </div>

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
          className="px-5 py-2 text-xs font-semibold text-zinc-950 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors font-mono"
        >
          Confirm Exit
        </button>
      </div>
    </form>
  );
}

export function AddExitModal({
  isOpen,
  onClose,
  trade,
  plan,
  remainingSize,
  currency = 'USD',
  onSaved,
}: AddExitModalProps) {
  if (!isOpen || !trade || !plan) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Record Trade Exit"
      subtitle={`${plan.symbol} (${plan.direction}) · Entry Fill: ${trade.actualEntry}`}
      maxWidth="md"
    >
      <ExitForm
        trade={trade}
        plan={plan}
        remainingSize={remainingSize}
        currency={currency}
        onClose={onClose}
        onSaved={onSaved}
      />
    </Modal>
  );
}
