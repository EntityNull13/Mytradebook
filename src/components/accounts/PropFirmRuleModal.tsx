import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { db } from '../../db/database';
import type { PropFirmRule, RuleCategory, PropFirmRuleType, RuleAnswer, AccountPhase } from '../../types';

interface PropFirmRuleModalProps {
  isOpen: boolean;
  onClose: () => void;
  accountId: string;
  phaseId?: string;
  phases?: AccountPhase[];
  onSaved: () => void;
}

const RULE_TYPE_DEFAULTS: Record<
  PropFirmRuleType,
  { label: string; name: string; category: RuleCategory; defaultLimit: string; defaultUnit: 'CURRENCY' | 'PERCENT' | 'DAYS' | 'TRADES' | 'TEXT' }
> = {
  DAILY_LOSS_LIMIT: {
    label: 'Daily Loss Limit',
    name: 'Daily Loss Limit',
    category: 'DRAWDOWN',
    defaultLimit: '500',
    defaultUnit: 'CURRENCY',
  },
  MAX_OVERALL_LOSS: {
    label: 'Max Overall Loss',
    name: 'Maximum Overall Drawdown',
    category: 'DRAWDOWN',
    defaultLimit: '1000',
    defaultUnit: 'CURRENCY',
  },
  TRAILING_DRAWDOWN: {
    label: 'Trailing Drawdown',
    name: 'Trailing Drawdown from Peak',
    category: 'DRAWDOWN',
    defaultLimit: '800',
    defaultUnit: 'CURRENCY',
  },
  PROFIT_TARGET: {
    label: 'Profit Target',
    name: 'Phase Profit Target',
    category: 'ACCOUNT_OBJECTIVE',
    defaultLimit: '1000',
    defaultUnit: 'CURRENCY',
  },
  MIN_TRADING_DAYS: {
    label: 'Min Trading Days',
    name: 'Minimum Trading Days',
    category: 'ACCOUNT_OBJECTIVE',
    defaultLimit: '5',
    defaultUnit: 'DAYS',
  },
  MIN_PROFITABLE_DAYS: {
    label: 'Min Profitable Days',
    name: 'Minimum Profitable Days',
    category: 'ACCOUNT_OBJECTIVE',
    defaultLimit: '3',
    defaultUnit: 'DAYS',
  },
  MAX_RISK_PER_SYMBOL: {
    label: 'Max Risk Per Symbol',
    name: 'Max Risk Exposure Per Symbol',
    category: 'RISK',
    defaultLimit: '2',
    defaultUnit: 'PERCENT',
  },
  NEWS_RESTRICTION: {
    label: 'News Restriction',
    name: 'Red Folder News Restriction',
    category: 'NEWS',
    defaultLimit: '5',
    defaultUnit: 'TEXT',
  },
  HOLDING_RESTRICTION: {
    label: 'Holding Restriction',
    name: 'Overnight / Weekend Holding',
    category: 'HOLDING',
    defaultLimit: '0',
    defaultUnit: 'TEXT',
  },
  AUTOMATION_RESTRICTION: {
    label: 'Automation Restriction',
    name: 'Expert Advisor / Bot Policy',
    category: 'AUTOMATION',
    defaultLimit: '0',
    defaultUnit: 'TEXT',
  },
  ACCOUNT_LIFECYCLE: {
    label: 'Account Lifecycle Policy',
    name: 'Inactivity & Account Expiration',
    category: 'LIFECYCLE',
    defaultLimit: '30',
    defaultUnit: 'DAYS',
  },
  PAYOUT_RESTRICTION: {
    label: 'Payout Restriction',
    name: 'First Payout & Buffer Policy',
    category: 'PAYOUT',
    defaultLimit: '14',
    defaultUnit: 'DAYS',
  },
  CUSTOM: {
    label: 'Custom Rule',
    name: 'Custom Account Condition',
    category: 'TRADING_BEHAVIOR',
    defaultLimit: '',
    defaultUnit: 'CURRENCY',
  },
};

export function PropFirmRuleModal({
  isOpen,
  onClose,
  accountId,
  phaseId,
  phases = [],
  onSaved,
}: PropFirmRuleModalProps) {
  const [selectedPhaseId, setSelectedPhaseId] = useState<string>(
    phaseId || (phases.length > 0 ? phases[0].id : '')
  );
  const [ruleType, setRuleType] = useState<PropFirmRuleType>('DAILY_LOSS_LIMIT');
  const [category, setCategory] = useState<RuleCategory>('DRAWDOWN');
  const [ruleName, setRuleName] = useState('Daily Loss Limit');
  const [answer, setAnswer] = useState<RuleAnswer>('YES');
  const [limitValue, setLimitValue] = useState('500');
  const [unit, setUnit] = useState<'CURRENCY' | 'PERCENT' | 'DAYS' | 'TRADES' | 'TEXT'>('CURRENCY');
  const [description, setDescription] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleRuleTypeChange = (newType: PropFirmRuleType) => {
    setRuleType(newType);
    const def = RULE_TYPE_DEFAULTS[newType];
    if (def) {
      setRuleName(def.name);
      setCategory(def.category);
      setLimitValue(def.defaultLimit);
      setUnit(def.defaultUnit);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleName.trim()) {
      setErrorMsg('Please specify rule display name');
      return;
    }

    try {
      const parsedLimit = answer === 'YES' && limitValue ? parseFloat(limitValue) : undefined;
      const newRule: PropFirmRule = {
        id: `rule-${Date.now()}`,
        accountId,
        phaseId: selectedPhaseId ? selectedPhaseId : undefined,
        ruleType,
        category,
        ruleName: ruleName.trim(),
        answer,
        limitValue: parsedLimit,
        value: parsedLimit,
        unit,
        description: description.trim() || undefined,
        enabled: answer === 'YES',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await db.propFirmRules.put(newRule);
      onSaved();
      onClose();
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to save rule');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Account Rule / Constraint"
      subtitle="Evaluated non-advisingly against current balance and intraday trades"
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMsg && (
          <div className="p-3 text-xs bg-rose-950/50 border border-rose-800 text-rose-300 rounded-lg">
            {errorMsg}
          </div>
        )}

        {phases.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">
              Associated Evaluation Phase *
            </label>
            <select
              value={selectedPhaseId}
              onChange={(e) => setSelectedPhaseId(e.target.value)}
              className="w-full bg-zinc-950 text-zinc-200 text-xs px-3 py-2 rounded-lg border border-zinc-800 focus:border-zinc-500 focus:outline-none font-mono"
            >
              {phases.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.type} • {p.status})
                </option>
              ))}
              <option value="">Account-Wide (All Phases)</option>
            </select>
            <span className="text-[10px] text-zinc-500 block mt-1">
              Links rule directly to a designated phase for evaluation.
            </span>
          </div>
        )}

        {/* Structured Rule Type Selection */}
        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-1">
            Structured Rule Engine Type *
          </label>
          <select
            value={ruleType}
            onChange={(e) => handleRuleTypeChange(e.target.value as PropFirmRuleType)}
            className="w-full bg-zinc-950 text-zinc-200 text-xs px-3 py-2 rounded-lg border border-zinc-800 focus:border-emerald-500 focus:outline-none font-mono"
          >
            <option value="DAILY_LOSS_LIMIT">DAILY_LOSS_LIMIT — Intraday loss threshold</option>
            <option value="MAX_OVERALL_LOSS">MAX_OVERALL_LOSS — Total account loss limit</option>
            <option value="TRAILING_DRAWDOWN">TRAILING_DRAWDOWN — Trailing drawdown from high water mark</option>
            <option value="PROFIT_TARGET">PROFIT_TARGET — Objective target balance</option>
            <option value="MIN_TRADING_DAYS">MIN_TRADING_DAYS — Minimum trading days required</option>
            <option value="MIN_PROFITABLE_DAYS">MIN_PROFITABLE_DAYS — Minimum profitable trading days</option>
            <option value="MAX_RISK_PER_SYMBOL">MAX_RISK_PER_SYMBOL — Position size limit per instrument</option>
            <option value="NEWS_RESTRICTION">NEWS_RESTRICTION — Red-folder event trading restriction</option>
            <option value="HOLDING_RESTRICTION">HOLDING_RESTRICTION — Overnight / weekend holding rules</option>
            <option value="AUTOMATION_RESTRICTION">AUTOMATION_RESTRICTION — EA and algorithmic trading policy</option>
            <option value="ACCOUNT_LIFECYCLE">ACCOUNT_LIFECYCLE — Inactivity and expiration policy</option>
            <option value="PAYOUT_RESTRICTION">PAYOUT_RESTRICTION — Payout waiting period and profit split</option>
            <option value="CUSTOM">CUSTOM — Custom condition or behavior rule</option>
          </select>
          <span className="text-[10px] text-zinc-500 block mt-1">
            Determines generic calculation logic without relying on fragile string matching.
          </span>
        </div>

        {/* Rule Answer / Applicability UX */}
        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-1">
            Does this rule apply to this account/phase?
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setAnswer('YES')}
              className={`py-1.5 px-3 text-xs font-medium rounded-lg border text-center transition-colors cursor-pointer ${
                answer === 'YES'
                  ? 'bg-emerald-950/60 border-emerald-700 text-emerald-300'
                  : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              YES (Active)
            </button>
            <button
              type="button"
              onClick={() => setAnswer('NO')}
              className={`py-1.5 px-3 text-xs font-medium rounded-lg border text-center transition-colors cursor-pointer ${
                answer === 'NO'
                  ? 'bg-zinc-800 border-zinc-600 text-zinc-200'
                  : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              NO (Not applied)
            </button>
            <button
              type="button"
              onClick={() => setAnswer('UNKNOWN')}
              className={`py-1.5 px-3 text-xs font-medium rounded-lg border text-center transition-colors cursor-pointer ${
                answer === 'UNKNOWN'
                  ? 'bg-amber-950/50 border-amber-700 text-amber-300'
                  : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              I DON'T KNOW
            </button>
          </div>
          <span className="text-[10px] text-zinc-500 block mt-1">
            {answer === 'YES'
              ? 'Active constraint with configured evaluation thresholds.'
              : answer === 'NO'
              ? 'Rule is disabled and does not enforce any threshold.'
              : 'Rule remains unconfigured and will not produce pass/fail.'}
          </span>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-1">Rule Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as RuleCategory)}
            className="w-full bg-zinc-950 text-zinc-200 text-xs px-3 py-2 rounded-lg border border-zinc-800 focus:border-zinc-500 focus:outline-none"
          >
            <option value="DRAWDOWN">Drawdown (Daily Loss / Max Loss / Trailing)</option>
            <option value="ACCOUNT_OBJECTIVE">Account Objective (Profit Target / Min Days)</option>
            <option value="RISK">Risk (Risk per trade / Exposure)</option>
            <option value="NEWS">News Trading Restrictions</option>
            <option value="HOLDING">Holding (Overnight / Weekend)</option>
            <option value="PAYOUT">Payout Requirements</option>
            <option value="LIFECYCLE">Account Lifecycle & Inactivity</option>
            <option value="TRADING_BEHAVIOR">Trading Behavior</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-1">
            Display Label (User-Editable) *
          </label>
          <input
            type="text"
            value={ruleName}
            onChange={(e) => setRuleName(e.target.value)}
            placeholder="e.g. Intraday Max Loss, Milestone 1 Target"
            required
            className="w-full bg-zinc-950 text-zinc-200 text-xs px-3 py-2 rounded-lg border border-zinc-800 focus:border-zinc-500 focus:outline-none"
          />
          <span className="text-[10px] text-zinc-500 block mt-0.5">
            Display name only. Changing this label will never break calculation logic.
          </span>
        </div>

        {answer === 'YES' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Limit Threshold</label>
              <input
                type="number"
                step="any"
                value={limitValue}
                onChange={(e) => setLimitValue(e.target.value)}
                placeholder="e.g. 500"
                className="w-full bg-zinc-950 text-zinc-200 text-xs font-mono px-3 py-2 rounded-lg border border-zinc-800 focus:border-zinc-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Unit</label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value as 'CURRENCY' | 'PERCENT' | 'DAYS' | 'TRADES' | 'TEXT')}
                className="w-full bg-zinc-950 text-zinc-200 text-xs px-3 py-2 rounded-lg border border-zinc-800 focus:border-zinc-500 focus:outline-none"
              >
                <option value="CURRENCY">Currency ($)</option>
                <option value="PERCENT">Percent (%)</option>
                <option value="DAYS">Days</option>
                <option value="TRADES">Trades</option>
                <option value="TEXT">Text constraint</option>
              </select>
            </div>
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-1">Notes / Description</label>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional rule criteria details"
            className="w-full bg-zinc-950 text-zinc-200 text-xs px-3 py-2 rounded-lg border border-zinc-800 focus:border-zinc-500 focus:outline-none resize-none"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg border border-zinc-700 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-5 py-2 text-xs font-semibold text-zinc-950 bg-zinc-100 hover:bg-white rounded-lg transition-colors font-mono cursor-pointer"
          >
            Add Rule
          </button>
        </div>
      </form>
    </Modal>
  );
}
