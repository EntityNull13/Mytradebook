import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { db } from '../../db/database';
import type { Account, AccountPhase, PropFirmRule, AccountType } from '../../types';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialAccount?: Account | null;
  onSaved: () => void;
}

type AnswerState = 'YES' | 'NO' | 'UNKNOWN';

export function AccountModal({
  isOpen,
  onClose,
  initialAccount,
  onSaved,
}: AccountModalProps) {
  const [name, setName] = useState(initialAccount?.name || '');
  const [type, setType] = useState<AccountType>(initialAccount?.type || 'PERSONAL');
  const [currency, setCurrency] = useState(initialAccount?.currency || 'USD');
  const [startingBalance, setStartingBalance] = useState(
    initialAccount?.startingBalance?.toString() || ''
  );
  const [notes, setNotes] = useState(initialAccount?.notes || '');

  // Prop Firm interactive questions (Default to UNKNOWN, no assumed thresholds)
  const [dailyLossAnswer, setDailyLossAnswer] = useState<AnswerState>('UNKNOWN');
  const [dailyLossValue, setDailyLossValue] = useState('');

  const [maxLossAnswer, setMaxLossAnswer] = useState<AnswerState>('UNKNOWN');
  const [maxLossValue, setMaxLossValue] = useState('');

  const [profitTargetAnswer, setProfitTargetAnswer] = useState<AnswerState>('UNKNOWN');
  const [profitTargetValue, setProfitTargetValue] = useState('');

  const [minDaysAnswer, setMinDaysAnswer] = useState<AnswerState>('UNKNOWN');
  const [minDaysValue, setMinDaysValue] = useState('');

  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!name.trim()) {
      setErrorMsg('Please enter an account name');
      return;
    }

    const startBal = parseFloat(startingBalance);
    if (isNaN(startBal) || startBal < 0) {
      setErrorMsg('Please enter a valid starting balance');
      return;
    }

    try {
      const now = new Date().toISOString();
      const accId = initialAccount?.id || `acc-${Date.now()}`;

      const accountData: Account = {
        id: accId,
        name: name.trim(),
        type,
        currency: currency.toUpperCase().trim(),
        startingBalance: startBal,
        status: initialAccount?.status || 'ACTIVE',
        notes: notes.trim() || undefined,
        createdAt: initialAccount?.createdAt || now,
        updatedAt: now,
      };

      await db.transaction('rw', [db.accounts, db.accountPhases, db.propFirmRules], async () => {
        await db.accounts.put(accountData);

        // If newly creating a PROP_FIRM account, setup initial phase and rules
        if (!initialAccount && type === 'PROP_FIRM') {
          const phaseId = `phase-${Date.now()}`;
          const initialPhase: AccountPhase = {
            id: phaseId,
            accountId: accId,
            name: 'Phase 1 - Evaluation',
            type: 'CHALLENGE',
            status: 'ACTIVE',
            startingBalance: startBal,
            startedAt: now,
          };
          await db.accountPhases.put(initialPhase);

          const rulesToAdd: PropFirmRule[] = [];

          if (dailyLossAnswer === 'YES' && parseFloat(dailyLossValue) > 0) {
            rulesToAdd.push({
              id: `rule-${Date.now()}-1`,
              accountId: accId,
              phaseId,
              category: 'DRAWDOWN',
              ruleType: 'DAILY_LOSS_LIMIT',
              ruleName: 'Daily Loss Limit',
              limitValue: parseFloat(dailyLossValue),
              unit: 'CURRENCY',
              enabled: true,
            });
          }

          if (maxLossAnswer === 'YES' && parseFloat(maxLossValue) > 0) {
            rulesToAdd.push({
              id: `rule-${Date.now()}-2`,
              accountId: accId,
              phaseId,
              category: 'DRAWDOWN',
              ruleType: 'MAX_OVERALL_LOSS',
              ruleName: 'Maximum Overall Loss',
              limitValue: parseFloat(maxLossValue),
              unit: 'CURRENCY',
              enabled: true,
            });
          }

          if (profitTargetAnswer === 'YES' && parseFloat(profitTargetValue) > 0) {
            rulesToAdd.push({
              id: `rule-${Date.now()}-3`,
              accountId: accId,
              phaseId,
              category: 'ACCOUNT_OBJECTIVE',
              ruleType: 'PROFIT_TARGET',
              ruleName: 'Profit Target',
              limitValue: parseFloat(profitTargetValue),
              unit: 'CURRENCY',
              enabled: true,
            });
          }

          if (minDaysAnswer === 'YES' && parseFloat(minDaysValue) > 0) {
            rulesToAdd.push({
              id: `rule-${Date.now()}-4`,
              accountId: accId,
              phaseId,
              category: 'ACCOUNT_OBJECTIVE',
              ruleType: 'MIN_TRADING_DAYS',
              ruleName: 'Minimum Trading Days',
              limitValue: parseFloat(minDaysValue),
              unit: 'DAYS',
              enabled: true,
            });
          }

          if (rulesToAdd.length > 0) {
            await db.propFirmRules.bulkAdd(rulesToAdd);
          }
        }
      });

      onSaved();
      onClose();
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to save account.');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialAccount ? 'Edit Trading Account' : 'Create Trading Account'}
      subtitle="Configure account parameters, currency, and objective constraints"
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {errorMsg && (
          <div className="p-3 text-xs bg-rose-950/50 border border-rose-800 text-rose-300 rounded-lg">
            {errorMsg}
          </div>
        )}

        {/* Basic info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Account Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. FTMO 100k, Personal Main"
              required
              className="w-full bg-zinc-950 text-zinc-200 text-xs px-3 py-2 rounded-lg border border-zinc-800 focus:border-zinc-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Account Type *</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as AccountType)}
              className="w-full bg-zinc-950 text-zinc-200 text-xs px-3 py-2 rounded-lg border border-zinc-800 focus:border-zinc-500 focus:outline-none"
            >
              <option value="PERSONAL">Personal / Self-Funded</option>
              <option value="PROP_FIRM">Prop Firm Challenge</option>
              <option value="DEMO">Demo / Paper Account</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Starting Balance *</label>
            <input
              type="number"
              step="any"
              value={startingBalance}
              onChange={(e) => setStartingBalance(e.target.value)}
              required
              className="w-full bg-zinc-950 text-zinc-200 text-xs font-mono px-3 py-2 rounded-lg border border-zinc-800 focus:border-zinc-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Base Currency *</label>
            <input
              type="text"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              placeholder="USD, EUR, IDR, GBP"
              required
              className="w-full bg-zinc-950 text-zinc-200 text-xs font-mono px-3 py-2 rounded-lg border border-zinc-800 focus:border-zinc-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Prop Firm Rule Configuration (PRD Section 25) */}
        {!initialAccount && type === 'PROP_FIRM' && (
          <div className="bg-zinc-950/70 p-4 rounded-xl border border-zinc-800/90 space-y-3.5">
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-amber-400/90 font-mono">
                Prop Firm Evaluation Constraints
              </h4>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Answer each question accurately. Rules without limits will be skipped.
              </p>
            </div>

            {/* Q1: Daily Loss */}
            <div className="space-y-1.5 pt-2 border-t border-zinc-800">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-300">Do you have a Daily Loss Limit?</span>
                <div className="flex gap-1">
                  {(['YES', 'NO', 'UNKNOWN'] as const).map((ans) => (
                    <button
                      key={ans}
                      type="button"
                      onClick={() => setDailyLossAnswer(ans)}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium ${
                        dailyLossAnswer === ans
                          ? 'bg-zinc-100 text-zinc-950'
                          : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {ans}
                    </button>
                  ))}
                </div>
              </div>
              {dailyLossAnswer === 'YES' && (
                <input
                  type="number"
                  step="any"
                  value={dailyLossValue}
                  onChange={(e) => setDailyLossValue(e.target.value)}
                  placeholder={`Daily loss limit (${currency})`}
                  className="w-full bg-zinc-900 text-zinc-200 text-xs font-mono px-2.5 py-1.5 rounded border border-zinc-800"
                />
              )}
            </div>

            {/* Q2: Max Overall Loss */}
            <div className="space-y-1.5 pt-2 border-t border-zinc-800">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-300">Do you have a Maximum Overall Loss?</span>
                <div className="flex gap-1">
                  {(['YES', 'NO', 'UNKNOWN'] as const).map((ans) => (
                    <button
                      key={ans}
                      type="button"
                      onClick={() => setMaxLossAnswer(ans)}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium ${
                        maxLossAnswer === ans
                          ? 'bg-zinc-100 text-zinc-950'
                          : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {ans}
                    </button>
                  ))}
                </div>
              </div>
              {maxLossAnswer === 'YES' && (
                <input
                  type="number"
                  step="any"
                  value={maxLossValue}
                  onChange={(e) => setMaxLossValue(e.target.value)}
                  placeholder={`Max overall loss limit (${currency})`}
                  className="w-full bg-zinc-900 text-zinc-200 text-xs font-mono px-2.5 py-1.5 rounded border border-zinc-800"
                />
              )}
            </div>

            {/* Q3: Profit Target */}
            <div className="space-y-1.5 pt-2 border-t border-zinc-800">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-300">Do you have a Profit Target?</span>
                <div className="flex gap-1">
                  {(['YES', 'NO', 'UNKNOWN'] as const).map((ans) => (
                    <button
                      key={ans}
                      type="button"
                      onClick={() => setProfitTargetAnswer(ans)}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium ${
                        profitTargetAnswer === ans
                          ? 'bg-zinc-100 text-zinc-950'
                          : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {ans}
                    </button>
                  ))}
                </div>
              </div>
              {profitTargetAnswer === 'YES' && (
                <input
                  type="number"
                  step="any"
                  value={profitTargetValue}
                  onChange={(e) => setProfitTargetValue(e.target.value)}
                  placeholder={`Profit target (${currency})`}
                  className="w-full bg-zinc-900 text-zinc-200 text-xs font-mono px-2.5 py-1.5 rounded border border-zinc-800"
                />
              )}
            </div>

            {/* Q4: Min Days */}
            <div className="space-y-1.5 pt-2 border-t border-zinc-800">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-300">Minimum Trading Days required?</span>
                <div className="flex gap-1">
                  {(['YES', 'NO', 'UNKNOWN'] as const).map((ans) => (
                    <button
                      key={ans}
                      type="button"
                      onClick={() => setMinDaysAnswer(ans)}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium ${
                        minDaysAnswer === ans
                          ? 'bg-zinc-100 text-zinc-950'
                          : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {ans}
                    </button>
                  ))}
                </div>
              </div>
              {minDaysAnswer === 'YES' && (
                <input
                  type="number"
                  step="any"
                  value={minDaysValue}
                  onChange={(e) => setMinDaysValue(e.target.value)}
                  placeholder="Minimum trading days (e.g. 4)"
                  className="w-full bg-zinc-900 text-zinc-200 text-xs font-mono px-2.5 py-1.5 rounded border border-zinc-800"
                />
              )}
            </div>
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-1">Notes</label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Account details, broker reference, or notes"
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
            className="px-5 py-2 text-xs font-semibold text-zinc-950 bg-zinc-100 hover:bg-white rounded-lg transition-colors font-mono"
          >
            {initialAccount ? 'Save Changes' : 'Create Account'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
