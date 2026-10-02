import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { db } from '../../db/database';
import type { Account, Transaction, TransactionType } from '../../types';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: Account[];
  defaultAccountId?: string;
  onSaved: () => void;
}

export function TransactionModal({
  isOpen,
  onClose,
  accounts,
  defaultAccountId,
  onSaved,
}: TransactionModalProps) {
  const [accountId, setAccountId] = useState(defaultAccountId || accounts[0]?.id || '');
  const [type, setType] = useState<TransactionType>('DEPOSIT');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
      setErrorMsg('Please enter a valid positive amount');
      return;
    }

    try {
      const newTx: Transaction = {
        id: `tx-${Date.now()}`,
        accountId,
        type,
        amount: amt,
        date,
        notes: notes.trim() || undefined,
        createdAt: new Date().toISOString(),
      };

      await db.transactions.put(newTx);
      onSaved();
      onClose();
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to record balance transaction');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Record Balance Transaction"
      subtitle="Manual deposits, payouts, withdrawals, or platform fees"
      maxWidth="sm"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMsg && (
          <div className="p-3 text-xs bg-rose-950/50 border border-rose-800 text-rose-300 rounded-lg">
            {errorMsg}
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-1">Account *</label>
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="w-full bg-zinc-950 text-zinc-200 text-xs px-3 py-2 rounded-lg border border-zinc-800 focus:border-zinc-500 focus:outline-none"
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.currency})
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Type *</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as TransactionType)}
              className="w-full bg-zinc-950 text-zinc-200 text-xs px-3 py-2 rounded-lg border border-zinc-800 focus:border-zinc-500 focus:outline-none"
            >
              <option value="DEPOSIT">Deposit</option>
              <option value="WITHDRAWAL">Withdrawal</option>
              <option value="PAYOUT">Prop Payout</option>
              <option value="FEE">Fee / Comm</option>
              <option value="ACTIVATION_FEE">Activation Fee</option>
              <option value="ADJUSTMENT">Adjustment</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">
              Amount ({accounts.find((a) => a.id === accountId)?.currency || 'USD'}) *
            </label>
            <input
              type="number"
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              required
              className="w-full bg-zinc-950 text-zinc-200 text-xs font-mono px-3 py-2 rounded-lg border border-zinc-800 focus:border-zinc-500 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-1">Date *</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            className="w-full bg-zinc-950 text-zinc-200 text-xs font-mono px-3 py-2 rounded-lg border border-zinc-800 focus:border-zinc-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-1">Notes</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Initial capital deposit"
            className="w-full bg-zinc-950 text-zinc-200 text-xs px-3 py-2 rounded-lg border border-zinc-800 focus:border-zinc-500 focus:outline-none"
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
            className="px-5 py-2 text-xs font-semibold text-zinc-950 bg-zinc-100 hover:bg-white rounded-lg transition-colors font-mono"
          >
            Save Transaction
          </button>
        </div>
      </form>
    </Modal>
  );
}
