import React, { useState, useEffect } from 'react';
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

interface TriStateButtonsProps {
  value: AnswerState;
  onChange: (val: AnswerState) => void;
}

function TriStateButtons({ value, onChange }: TriStateButtonsProps) {
  return (
    <div className="inline-flex rounded-lg bg-zinc-900 p-0.5 border border-zinc-800 shrink-0">
      <button
        type="button"
        onClick={() => onChange('YES')}
        className={`px-2.5 py-1 text-[11px] font-mono font-bold rounded-md transition-colors cursor-pointer ${
          value === 'YES'
            ? 'bg-emerald-600 text-white shadow-sm'
            : 'text-zinc-400 hover:text-zinc-200'
        }`}
      >
        YES
      </button>
      <button
        type="button"
        onClick={() => onChange('NO')}
        className={`px-2.5 py-1 text-[11px] font-mono font-bold rounded-md transition-colors cursor-pointer ${
          value === 'NO'
            ? 'bg-rose-600 text-white shadow-sm'
            : 'text-zinc-400 hover:text-zinc-200'
        }`}
      >
        NO
      </button>
      <button
        type="button"
        onClick={() => onChange('UNKNOWN')}
        className={`px-2.5 py-1 text-[11px] font-mono font-bold rounded-md transition-colors cursor-pointer ${
          value === 'UNKNOWN'
            ? 'bg-zinc-700 text-zinc-100 shadow-sm'
            : 'text-zinc-400 hover:text-zinc-200'
        }`}
      >
        UNKNOWN
      </button>
    </div>
  );
}

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

  // 1. Daily Loss Limit
  const [dailyLossAnswer, setDailyLossAnswer] = useState<AnswerState>('UNKNOWN');
  const [dailyLossValue, setDailyLossValue] = useState('');

  // 2. Maximum Overall Loss
  const [maxLossAnswer, setMaxLossAnswer] = useState<AnswerState>('UNKNOWN');
  const [maxLossValue, setMaxLossValue] = useState('');

  // 3. Trailing Drawdown
  const [trailingDDAnswer, setTrailingDDAnswer] = useState<AnswerState>('UNKNOWN');
  const [trailingDDUnit, setTrailingDDUnit] = useState<'CURRENCY' | 'PERCENT'>('CURRENCY');
  const [trailingDDValue, setTrailingDDValue] = useState('');

  // 4. Profit Target
  const [profitTargetAnswer, setProfitTargetAnswer] = useState<AnswerState>('UNKNOWN');
  const [profitTargetValue, setProfitTargetValue] = useState('');

  // 5. Minimum Trading Days
  const [minDaysAnswer, setMinDaysAnswer] = useState<AnswerState>('UNKNOWN');
  const [minDaysValue, setMinDaysValue] = useState('');

  // 6. Minimum Profitable Days
  const [minProfitableDaysAnswer, setMinProfitableDaysAnswer] = useState<AnswerState>('UNKNOWN');
  const [minProfitableDaysValue, setMinProfitableDaysValue] = useState('');

  // 7. Maximum Risk per Symbol
  const [maxRiskSymbolAnswer, setMaxRiskSymbolAnswer] = useState<AnswerState>('UNKNOWN');
  const [maxRiskSymbolUnit, setMaxRiskSymbolUnit] = useState<'PERCENT' | 'CURRENCY'>('PERCENT');
  const [maxRiskSymbolValue, setMaxRiskSymbolValue] = useState('');

  // 8. Consistency Rule
  const [consistencyAnswer, setConsistencyAnswer] = useState<AnswerState>('UNKNOWN');
  const [consistencyType, setConsistencyType] = useState('Best Day');
  const [consistencyMaxPct, setConsistencyMaxPct] = useState('40');

  // 9. News Trading Restrictions
  const [newsRestrictionAnswer, setNewsRestrictionAnswer] = useState<AnswerState>('UNKNOWN');
  const [newsRestrictionType, setNewsRestrictionType] = useState('No Trading Around News');
  const [newsBeforeMin, setNewsBeforeMin] = useState('5');
  const [newsAfterMin, setNewsAfterMin] = useState('5');

  // 10. Weekend Holding Allowed
  const [weekendHoldingAnswer, setWeekendHoldingAnswer] = useState<AnswerState>('UNKNOWN');
  const [weekendCutoff, setWeekendCutoff] = useState('21:00');

  // 11. Overnight Holding Allowed
  const [overnightHoldingAnswer, setOvernightHoldingAnswer] = useState<AnswerState>('UNKNOWN');

  // 12. Are EAs / Bots Allowed?
  const [eaBotsAnswer, setEaBotsAnswer] = useState<AnswerState>('UNKNOWN');

  // 13. Is Copy Trading Allowed?
  const [copyTradingAnswer, setCopyTradingAnswer] = useState<AnswerState>('UNKNOWN');

  // 14. Is Hedging Allowed?
  const [hedgingAnswer, setHedgingAnswer] = useState<AnswerState>('UNKNOWN');

  // 15. Maximum Position Size
  const [maxPositionSizeAnswer, setMaxPositionSizeAnswer] = useState<AnswerState>('UNKNOWN');
  const [maxPositionSizeValue, setMaxPositionSizeValue] = useState('');

  // 16. Other Restrictions
  const [otherRestrictionsAnswer, setOtherRestrictionsAnswer] = useState<AnswerState>('UNKNOWN');
  const [otherRestrictionsValue, setOtherRestrictionsValue] = useState('');

  const [errorMsg, setErrorMsg] = useState('');

  // If initialAccount provided, load existing values and rules
  useEffect(() => {
    if (initialAccount) {
      setName(initialAccount.name);
      setType(initialAccount.type);
      setCurrency(initialAccount.currency);
      setStartingBalance(initialAccount.startingBalance?.toString() || '');
      setNotes(initialAccount.notes || '');

      if (initialAccount.type === 'PROP_FIRM') {
        db.propFirmRules.where({ accountId: initialAccount.id }).toArray().then((existingRules) => {
          for (const r of existingRules) {
            if (r.ruleType === 'DAILY_LOSS_LIMIT') {
              setDailyLossAnswer(r.answer || (r.enabled ? 'YES' : 'NO'));
              setDailyLossValue(r.limitValue?.toString() || '');
            } else if (r.ruleType === 'MAX_OVERALL_LOSS') {
              setMaxLossAnswer(r.answer || (r.enabled ? 'YES' : 'NO'));
              setMaxLossValue(r.limitValue?.toString() || '');
            } else if (r.ruleType === 'TRAILING_DRAWDOWN') {
              setTrailingDDAnswer(r.answer || (r.enabled ? 'YES' : 'NO'));
              setTrailingDDValue(r.limitValue?.toString() || '');
              if (r.unit === 'PERCENT') setTrailingDDUnit('PERCENT');
              else setTrailingDDUnit('CURRENCY');
            } else if (r.ruleType === 'PROFIT_TARGET') {
              setProfitTargetAnswer(r.answer || (r.enabled ? 'YES' : 'NO'));
              setProfitTargetValue(r.limitValue?.toString() || '');
            } else if (r.ruleType === 'MIN_TRADING_DAYS') {
              setMinDaysAnswer(r.answer || (r.enabled ? 'YES' : 'NO'));
              setMinDaysValue(r.limitValue?.toString() || '');
            } else if (r.ruleType === 'MIN_PROFITABLE_DAYS') {
              setMinProfitableDaysAnswer(r.answer || (r.enabled ? 'YES' : 'NO'));
              setMinProfitableDaysValue(r.limitValue?.toString() || '');
            } else if (r.ruleType === 'MAX_RISK_PER_SYMBOL') {
              setMaxRiskSymbolAnswer(r.answer || (r.enabled ? 'YES' : 'NO'));
              setMaxRiskSymbolValue(r.limitValue?.toString() || '');
              if (r.unit === 'CURRENCY') setMaxRiskSymbolUnit('CURRENCY');
              else setMaxRiskSymbolUnit('PERCENT');
            } else if (r.ruleType === 'CONSISTENCY_RULE') {
              setConsistencyAnswer(r.answer || (r.enabled ? 'YES' : 'NO'));
              setConsistencyMaxPct(r.limitValue?.toString() || '40');
            } else if (r.ruleType === 'NEWS_RESTRICTION') {
              setNewsRestrictionAnswer(r.answer || (r.enabled ? 'YES' : 'NO'));
            } else if (r.ruleType === 'WEEKEND_HOLDING') {
              setWeekendHoldingAnswer(r.answer || (r.enabled ? 'YES' : 'NO'));
            } else if (r.ruleType === 'OVERNIGHT_HOLDING') {
              setOvernightHoldingAnswer(r.answer || (r.enabled ? 'YES' : 'NO'));
            } else if (r.ruleType === 'EA_BOTS_ALLOWED') {
              setEaBotsAnswer(r.answer || (r.enabled ? 'YES' : 'NO'));
            } else if (r.ruleType === 'COPY_TRADING_ALLOWED') {
              setCopyTradingAnswer(r.answer || (r.enabled ? 'YES' : 'NO'));
            } else if (r.ruleType === 'HEDGING_ALLOWED') {
              setHedgingAnswer(r.answer || (r.enabled ? 'YES' : 'NO'));
            } else if (r.ruleType === 'MAX_POSITION_SIZE') {
              setMaxPositionSizeAnswer(r.answer || (r.enabled ? 'YES' : 'NO'));
              setMaxPositionSizeValue(r.limitValue?.toString() || '');
            } else if (r.ruleType === 'CUSTOM') {
              setOtherRestrictionsAnswer(r.answer || (r.enabled ? 'YES' : 'NO'));
              setOtherRestrictionsValue(r.description || '');
            }
          }
        });
      }
    }
  }, [initialAccount]);

  const currencySymbol = currency.trim().toUpperCase() === 'USD' ? '$' : currency.trim() || '$';

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

        // If PROP_FIRM account, setup/update evaluation phase and rules
        if (type === 'PROP_FIRM') {
          let phaseId = `phase-${Date.now()}`;
          if (initialAccount) {
            const existingPhases = await db.accountPhases.where({ accountId: accId }).toArray();
            if (existingPhases.length > 0) {
              phaseId = existingPhases[0].id;
            } else {
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
            }
            // Remove previous rules so we can apply fresh ones cleanly
            await db.propFirmRules.where({ accountId: accId }).delete();
          } else {
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
          }

          const rulesToAdd: PropFirmRule[] = [];
          const baseTimestamp = Date.now();

          // 1. Daily Loss Limit
          if (dailyLossAnswer === 'YES' && parseFloat(dailyLossValue) > 0) {
            rulesToAdd.push({
              id: `rule-${baseTimestamp}-1`,
              accountId: accId,
              phaseId,
              category: 'DRAWDOWN',
              ruleType: 'DAILY_LOSS_LIMIT',
              ruleName: 'Daily Loss Limit',
              limitValue: parseFloat(dailyLossValue),
              value: parseFloat(dailyLossValue),
              unit: 'CURRENCY',
              answer: 'YES',
              enabled: true,
              createdAt: now,
              updatedAt: now,
            });
          }

          // 2. Maximum Overall Loss
          if (maxLossAnswer === 'YES' && parseFloat(maxLossValue) > 0) {
            rulesToAdd.push({
              id: `rule-${baseTimestamp}-2`,
              accountId: accId,
              phaseId,
              category: 'DRAWDOWN',
              ruleType: 'MAX_OVERALL_LOSS',
              ruleName: 'Maximum Overall Loss',
              limitValue: parseFloat(maxLossValue),
              value: parseFloat(maxLossValue),
              unit: 'CURRENCY',
              answer: 'YES',
              enabled: true,
              createdAt: now,
              updatedAt: now,
            });
          }

          // 3. Trailing Drawdown
          if (trailingDDAnswer === 'YES' && parseFloat(trailingDDValue) > 0) {
            rulesToAdd.push({
              id: `rule-${baseTimestamp}-3`,
              accountId: accId,
              phaseId,
              category: 'DRAWDOWN',
              ruleType: 'TRAILING_DRAWDOWN',
              ruleName: 'Trailing Drawdown',
              limitValue: parseFloat(trailingDDValue),
              value: parseFloat(trailingDDValue),
              unit: trailingDDUnit,
              answer: 'YES',
              enabled: true,
              createdAt: now,
              updatedAt: now,
            });
          }

          // 4. Profit Target
          if (profitTargetAnswer === 'YES' && parseFloat(profitTargetValue) > 0) {
            rulesToAdd.push({
              id: `rule-${baseTimestamp}-4`,
              accountId: accId,
              phaseId,
              category: 'ACCOUNT_OBJECTIVE',
              ruleType: 'PROFIT_TARGET',
              ruleName: 'Profit Target',
              limitValue: parseFloat(profitTargetValue),
              value: parseFloat(profitTargetValue),
              unit: 'CURRENCY',
              answer: 'YES',
              enabled: true,
              createdAt: now,
              updatedAt: now,
            });
          }

          // 5. Minimum Trading Days
          if (minDaysAnswer === 'YES' && parseFloat(minDaysValue) > 0) {
            rulesToAdd.push({
              id: `rule-${baseTimestamp}-5`,
              accountId: accId,
              phaseId,
              category: 'ACCOUNT_OBJECTIVE',
              ruleType: 'MIN_TRADING_DAYS',
              ruleName: 'Minimum Trading Days',
              limitValue: parseFloat(minDaysValue),
              value: parseFloat(minDaysValue),
              unit: 'DAYS',
              answer: 'YES',
              enabled: true,
              createdAt: now,
              updatedAt: now,
            });
          }

          // 6. Minimum Profitable Days
          if (minProfitableDaysAnswer === 'YES' && parseFloat(minProfitableDaysValue) > 0) {
            rulesToAdd.push({
              id: `rule-${baseTimestamp}-6`,
              accountId: accId,
              phaseId,
              category: 'ACCOUNT_OBJECTIVE',
              ruleType: 'MIN_PROFITABLE_DAYS',
              ruleName: 'Minimum Profitable Days',
              limitValue: parseFloat(minProfitableDaysValue),
              value: parseFloat(minProfitableDaysValue),
              unit: 'DAYS',
              answer: 'YES',
              enabled: true,
              createdAt: now,
              updatedAt: now,
            });
          }

          // 7. Maximum Risk per Symbol
          if (maxRiskSymbolAnswer === 'YES' && parseFloat(maxRiskSymbolValue) > 0) {
            rulesToAdd.push({
              id: `rule-${baseTimestamp}-7`,
              accountId: accId,
              phaseId,
              category: 'RISK',
              ruleType: 'MAX_RISK_PER_SYMBOL',
              ruleName: 'Max Risk Per Symbol',
              limitValue: parseFloat(maxRiskSymbolValue),
              value: parseFloat(maxRiskSymbolValue),
              unit: maxRiskSymbolUnit,
              answer: 'YES',
              enabled: true,
              createdAt: now,
              updatedAt: now,
            });
          }

          // 8. Consistency Rule
          if (consistencyAnswer === 'YES' && parseFloat(consistencyMaxPct) > 0) {
            rulesToAdd.push({
              id: `rule-${baseTimestamp}-8`,
              accountId: accId,
              phaseId,
              category: 'TRADING_BEHAVIOR',
              ruleType: 'CONSISTENCY_RULE',
              ruleName: `Consistency Rule (${consistencyType})`,
              limitValue: parseFloat(consistencyMaxPct),
              value: parseFloat(consistencyMaxPct),
              unit: 'PERCENT',
              description: `Maximum ${consistencyMaxPct}% profit on ${consistencyType}`,
              answer: 'YES',
              enabled: true,
              createdAt: now,
              updatedAt: now,
            });
          }

          // 9. News Trading Restrictions
          if (newsRestrictionAnswer === 'YES') {
            rulesToAdd.push({
              id: `rule-${baseTimestamp}-9`,
              accountId: accId,
              phaseId,
              category: 'NEWS',
              ruleType: 'NEWS_RESTRICTION',
              ruleName: 'News Trading Restriction',
              unit: 'TEXT',
              description: `${newsRestrictionType} (${newsBeforeMin || '5'}m before / ${newsAfterMin || '5'}m after)`,
              answer: 'YES',
              enabled: true,
              createdAt: now,
              updatedAt: now,
            });
          }

          // 10. Weekend Holding Allowed
          if (weekendHoldingAnswer !== 'UNKNOWN') {
            rulesToAdd.push({
              id: `rule-${baseTimestamp}-10`,
              accountId: accId,
              phaseId,
              category: 'HOLDING',
              ruleType: 'WEEKEND_HOLDING',
              ruleName: 'Weekend Holding',
              unit: 'TEXT',
              description:
                weekendHoldingAnswer === 'YES'
                  ? `Weekend holding allowed${weekendCutoff ? ` (Cutoff: Friday ${weekendCutoff})` : ''}`
                  : 'Weekend holding prohibited',
              answer: weekendHoldingAnswer,
              enabled: weekendHoldingAnswer === 'YES',
              createdAt: now,
              updatedAt: now,
            });
          }

          // 11. Overnight Holding Allowed
          if (overnightHoldingAnswer !== 'UNKNOWN') {
            rulesToAdd.push({
              id: `rule-${baseTimestamp}-11`,
              accountId: accId,
              phaseId,
              category: 'HOLDING',
              ruleType: 'OVERNIGHT_HOLDING',
              ruleName: 'Overnight Holding',
              unit: 'TEXT',
              description:
                overnightHoldingAnswer === 'YES'
                  ? 'Overnight holding allowed'
                  : 'Overnight holding prohibited',
              answer: overnightHoldingAnswer,
              enabled: overnightHoldingAnswer === 'YES',
              createdAt: now,
              updatedAt: now,
            });
          }

          // 12. Are EAs / Bots Allowed?
          if (eaBotsAnswer !== 'UNKNOWN') {
            rulesToAdd.push({
              id: `rule-${baseTimestamp}-12`,
              accountId: accId,
              phaseId,
              category: 'AUTOMATION',
              ruleType: 'EA_BOTS_ALLOWED',
              ruleName: 'EAs / Bots Policy',
              unit: 'TEXT',
              description:
                eaBotsAnswer === 'YES'
                  ? 'EAs / Algorithmic bots allowed'
                  : 'EAs / Automated trading prohibited',
              answer: eaBotsAnswer,
              enabled: eaBotsAnswer === 'YES',
              createdAt: now,
              updatedAt: now,
            });
          }

          // 13. Is Copy Trading Allowed?
          if (copyTradingAnswer !== 'UNKNOWN') {
            rulesToAdd.push({
              id: `rule-${baseTimestamp}-13`,
              accountId: accId,
              phaseId,
              category: 'AUTOMATION',
              ruleType: 'COPY_TRADING_ALLOWED',
              ruleName: 'Copy Trading Policy',
              unit: 'TEXT',
              description:
                copyTradingAnswer === 'YES'
                  ? 'Copy trading allowed'
                  : 'Copy trading prohibited',
              answer: copyTradingAnswer,
              enabled: copyTradingAnswer === 'YES',
              createdAt: now,
              updatedAt: now,
            });
          }

          // 14. Is Hedging Allowed?
          if (hedgingAnswer !== 'UNKNOWN') {
            rulesToAdd.push({
              id: `rule-${baseTimestamp}-14`,
              accountId: accId,
              phaseId,
              category: 'TRADING_BEHAVIOR',
              ruleType: 'HEDGING_ALLOWED',
              ruleName: 'Hedging Policy',
              unit: 'TEXT',
              description:
                hedgingAnswer === 'YES'
                  ? 'Simultaneous hedging allowed'
                  : 'Hedging prohibited',
              answer: hedgingAnswer,
              enabled: hedgingAnswer === 'YES',
              createdAt: now,
              updatedAt: now,
            });
          }

          // 15. Maximum Position Size
          if (maxPositionSizeAnswer === 'YES' && parseFloat(maxPositionSizeValue) > 0) {
            rulesToAdd.push({
              id: `rule-${baseTimestamp}-15`,
              accountId: accId,
              phaseId,
              category: 'RISK',
              ruleType: 'MAX_POSITION_SIZE',
              ruleName: 'Maximum Position Size',
              limitValue: parseFloat(maxPositionSizeValue),
              value: parseFloat(maxPositionSizeValue),
              unit: 'LOTS',
              description: `Maximum ${maxPositionSizeValue} lots / contracts`,
              answer: 'YES',
              enabled: true,
              createdAt: now,
              updatedAt: now,
            });
          }

          // 16. Other Restrictions
          if (otherRestrictionsAnswer === 'YES' && otherRestrictionsValue.trim()) {
            rulesToAdd.push({
              id: `rule-${baseTimestamp}-16`,
              accountId: accId,
              phaseId,
              category: 'TRADING_BEHAVIOR',
              ruleType: 'CUSTOM',
              ruleName: 'Other Restrictions',
              description: otherRestrictionsValue.trim(),
              answer: 'YES',
              enabled: true,
              createdAt: now,
              updatedAt: now,
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
      maxWidth="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5 max-h-[80vh] overflow-y-auto pr-1">
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

        {/* Prop Firm Rule Configuration */}
        {type === 'PROP_FIRM' && (
          <div className="bg-zinc-950/80 p-4 sm:p-5 rounded-xl border border-zinc-800/90 space-y-4">
            <div className="border-b border-zinc-800 pb-2.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 font-mono flex items-center justify-between">
                <span>PROP FIRM EVALUATION CONSTRAINTS</span>
                <span className="text-[10px] text-zinc-400 font-normal normal-case">16 Objective Rules</span>
              </h4>
              <p className="text-[11px] text-zinc-400 mt-1">
                Answer each question accurately. Rules without limits will be skipped.
              </p>
            </div>

            <div className="space-y-3.5 divide-y divide-zinc-800/60">
              {/* 1. Daily Loss Limit */}
              <div className="pt-3 first:pt-0">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-xs font-medium text-zinc-200">
                    Do you have a Daily Loss Limit?
                  </span>
                  <TriStateButtons value={dailyLossAnswer} onChange={setDailyLossAnswer} />
                </div>
                {dailyLossAnswer === 'YES' && (
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs font-mono text-zinc-400 font-bold">{currencySymbol}</span>
                    <input
                      type="number"
                      step="any"
                      value={dailyLossValue}
                      onChange={(e) => setDailyLossValue(e.target.value)}
                      placeholder="1000"
                      className="w-36 bg-zinc-900 text-zinc-100 text-xs font-mono px-2.5 py-1.5 rounded-lg border border-zinc-700 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                )}
              </div>

              {/* 2. Maximum Overall Loss */}
              <div className="pt-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-xs font-medium text-zinc-200">
                    Do you have a Maximum Overall Loss?
                  </span>
                  <TriStateButtons value={maxLossAnswer} onChange={setMaxLossAnswer} />
                </div>
                {maxLossAnswer === 'YES' && (
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs font-mono text-zinc-400 font-bold">{currencySymbol}</span>
                    <input
                      type="number"
                      step="any"
                      value={maxLossValue}
                      onChange={(e) => setMaxLossValue(e.target.value)}
                      placeholder="2000"
                      className="w-36 bg-zinc-900 text-zinc-100 text-xs font-mono px-2.5 py-1.5 rounded-lg border border-zinc-700 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                )}
              </div>

              {/* 3. Trailing Drawdown */}
              <div className="pt-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-xs font-medium text-zinc-200">
                    Do you have a Trailing Drawdown?
                  </span>
                  <TriStateButtons value={trailingDDAnswer} onChange={setTrailingDDAnswer} />
                </div>
                {trailingDDAnswer === 'YES' && (
                  <div className="flex items-center gap-2 mt-2">
                    <div className="inline-flex rounded-lg bg-zinc-900 border border-zinc-800 p-0.5 text-xs font-mono">
                      <button
                        type="button"
                        onClick={() => setTrailingDDUnit('CURRENCY')}
                        className={`px-2 py-0.5 rounded text-[11px] font-bold transition-colors cursor-pointer ${
                          trailingDDUnit === 'CURRENCY'
                            ? 'bg-zinc-700 text-white'
                            : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        $
                      </button>
                      <button
                        type="button"
                        onClick={() => setTrailingDDUnit('PERCENT')}
                        className={`px-2 py-0.5 rounded text-[11px] font-bold transition-colors cursor-pointer ${
                          trailingDDUnit === 'PERCENT'
                            ? 'bg-zinc-700 text-white'
                            : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        %
                      </button>
                    </div>
                    <input
                      type="number"
                      step="any"
                      value={trailingDDValue}
                      onChange={(e) => setTrailingDDValue(e.target.value)}
                      placeholder={trailingDDUnit === 'CURRENCY' ? '1500' : '5'}
                      className="w-36 bg-zinc-900 text-zinc-100 text-xs font-mono px-2.5 py-1.5 rounded-lg border border-zinc-700 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                )}
              </div>

              {/* 4. Profit Target */}
              <div className="pt-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-xs font-medium text-zinc-200">
                    Do you have a Profit Target?
                  </span>
                  <TriStateButtons value={profitTargetAnswer} onChange={setProfitTargetAnswer} />
                </div>
                {profitTargetAnswer === 'YES' && (
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs font-mono text-zinc-400 font-bold">{currencySymbol}</span>
                    <input
                      type="number"
                      step="any"
                      value={profitTargetValue}
                      onChange={(e) => setProfitTargetValue(e.target.value)}
                      placeholder="1250"
                      className="w-36 bg-zinc-900 text-zinc-100 text-xs font-mono px-2.5 py-1.5 rounded-lg border border-zinc-700 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                )}
              </div>

              {/* 5. Minimum Trading Days required? */}
              <div className="pt-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-xs font-medium text-zinc-200">
                    Minimum Trading Days required?
                  </span>
                  <TriStateButtons value={minDaysAnswer} onChange={setMinDaysAnswer} />
                </div>
                {minDaysAnswer === 'YES' && (
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="number"
                      step="1"
                      value={minDaysValue}
                      onChange={(e) => setMinDaysValue(e.target.value)}
                      placeholder="5"
                      className="w-24 bg-zinc-900 text-zinc-100 text-xs font-mono px-2.5 py-1.5 rounded-lg border border-zinc-700 focus:border-emerald-500 focus:outline-none"
                    />
                    <span className="text-xs text-zinc-400 font-mono">days</span>
                  </div>
                )}
              </div>

              {/* 6. Minimum Profitable Days required? */}
              <div className="pt-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-xs font-medium text-zinc-200">
                    Minimum Profitable Days required?
                  </span>
                  <TriStateButtons value={minProfitableDaysAnswer} onChange={setMinProfitableDaysAnswer} />
                </div>
                {minProfitableDaysAnswer === 'YES' && (
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="number"
                      step="1"
                      value={minProfitableDaysValue}
                      onChange={(e) => setMinProfitableDaysValue(e.target.value)}
                      placeholder="3"
                      className="w-24 bg-zinc-900 text-zinc-100 text-xs font-mono px-2.5 py-1.5 rounded-lg border border-zinc-700 focus:border-emerald-500 focus:outline-none"
                    />
                    <span className="text-xs text-zinc-400 font-mono">days</span>
                  </div>
                )}
              </div>

              {/* 7. Maximum Risk per Symbol? */}
              <div className="pt-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-xs font-medium text-zinc-200">
                    Do you have a Maximum Risk per Symbol?
                  </span>
                  <TriStateButtons value={maxRiskSymbolAnswer} onChange={setMaxRiskSymbolAnswer} />
                </div>
                {maxRiskSymbolAnswer === 'YES' && (
                  <div className="flex items-center gap-2 mt-2">
                    <div className="inline-flex rounded-lg bg-zinc-900 border border-zinc-800 p-0.5 text-xs font-mono">
                      <button
                        type="button"
                        onClick={() => setMaxRiskSymbolUnit('PERCENT')}
                        className={`px-2 py-0.5 rounded text-[11px] font-bold transition-colors cursor-pointer ${
                          maxRiskSymbolUnit === 'PERCENT'
                            ? 'bg-zinc-700 text-white'
                            : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        %
                      </button>
                      <button
                        type="button"
                        onClick={() => setMaxRiskSymbolUnit('CURRENCY')}
                        className={`px-2 py-0.5 rounded text-[11px] font-bold transition-colors cursor-pointer ${
                          maxRiskSymbolUnit === 'CURRENCY'
                            ? 'bg-zinc-700 text-white'
                            : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        $
                      </button>
                    </div>
                    <input
                      type="number"
                      step="any"
                      value={maxRiskSymbolValue}
                      onChange={(e) => setMaxRiskSymbolValue(e.target.value)}
                      placeholder="2"
                      className="w-24 bg-zinc-900 text-zinc-100 text-xs font-mono px-2.5 py-1.5 rounded-lg border border-zinc-700 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                )}
              </div>

              {/* 8. Consistency Rule? */}
              <div className="pt-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-xs font-medium text-zinc-200">
                    Do you have a Consistency Rule?
                  </span>
                  <TriStateButtons value={consistencyAnswer} onChange={setConsistencyAnswer} />
                </div>
                {consistencyAnswer === 'YES' && (
                  <div className="flex flex-wrap items-center gap-3 mt-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-zinc-400 font-mono">Rule Type:</span>
                      <select
                        value={consistencyType}
                        onChange={(e) => setConsistencyType(e.target.value)}
                        className="bg-zinc-900 text-zinc-200 text-xs font-mono px-2.5 py-1.5 rounded-lg border border-zinc-700 focus:border-emerald-500 focus:outline-none"
                      >
                        <option value="Best Day">Best Day</option>
                        <option value="Lot Size Consistency">Lot Size Consistency</option>
                        <option value="Profit Distribution">Profit Distribution</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-zinc-400 font-mono">Maximum:</span>
                      <input
                        type="number"
                        step="any"
                        value={consistencyMaxPct}
                        onChange={(e) => setConsistencyMaxPct(e.target.value)}
                        placeholder="40"
                        className="w-20 bg-zinc-900 text-zinc-100 text-xs font-mono px-2 py-1.5 rounded-lg border border-zinc-700 focus:border-emerald-500 focus:outline-none"
                      />
                      <span className="text-xs text-zinc-400 font-mono">%</span>
                    </div>
                  </div>
                )}
              </div>

              {/* 9. News Trading Restrictions? */}
              <div className="pt-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-xs font-medium text-zinc-200">
                    Are there News Trading Restrictions?
                  </span>
                  <TriStateButtons value={newsRestrictionAnswer} onChange={setNewsRestrictionAnswer} />
                </div>
                {newsRestrictionAnswer === 'YES' && (
                  <div className="space-y-2 mt-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-zinc-400 font-mono">Restriction:</span>
                      <select
                        value={newsRestrictionType}
                        onChange={(e) => setNewsRestrictionType(e.target.value)}
                        className="bg-zinc-900 text-zinc-200 text-xs font-mono px-2.5 py-1.5 rounded-lg border border-zinc-700 focus:border-emerald-500 focus:outline-none"
                      >
                        <option value="No Trading Around News">No Trading Around News</option>
                        <option value="No Holding During High Impact News">No Holding During High Impact News</option>
                        <option value="Prohibited Major Red Folder">Prohibited Major Red Folder</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
                      <span>Window:</span>
                      <input
                        type="number"
                        value={newsBeforeMin}
                        onChange={(e) => setNewsBeforeMin(e.target.value)}
                        placeholder="5"
                        className="w-16 bg-zinc-900 text-zinc-100 text-xs font-mono px-2 py-1 rounded-lg border border-zinc-700 focus:border-emerald-500 focus:outline-none"
                      />
                      <span>minutes before /</span>
                      <input
                        type="number"
                        value={newsAfterMin}
                        onChange={(e) => setNewsAfterMin(e.target.value)}
                        placeholder="5"
                        className="w-16 bg-zinc-900 text-zinc-100 text-xs font-mono px-2 py-1 rounded-lg border border-zinc-700 focus:border-emerald-500 focus:outline-none"
                      />
                      <span>minutes after</span>
                    </div>
                  </div>
                )}
              </div>

              {/* 10. Weekend Holding Allowed? */}
              <div className="pt-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-xs font-medium text-zinc-200">
                    Is Weekend Holding Allowed?
                  </span>
                  <TriStateButtons value={weekendHoldingAnswer} onChange={setWeekendHoldingAnswer} />
                </div>
                {weekendHoldingAnswer !== 'UNKNOWN' && (
                  <div className="flex items-center gap-2 mt-2 text-xs font-mono text-zinc-400">
                    <span>Optional cutoff: Friday</span>
                    <input
                      type="text"
                      value={weekendCutoff}
                      onChange={(e) => setWeekendCutoff(e.target.value)}
                      placeholder="21:00"
                      className="w-24 bg-zinc-900 text-zinc-100 text-xs font-mono px-2 py-1 rounded-lg border border-zinc-700 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                )}
              </div>

              {/* 11. Overnight Holding Allowed? */}
              <div className="pt-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-xs font-medium text-zinc-200">
                    Is Overnight Holding Allowed?
                  </span>
                  <TriStateButtons value={overnightHoldingAnswer} onChange={setOvernightHoldingAnswer} />
                </div>
              </div>

              {/* 12. Are EAs / Bots Allowed? */}
              <div className="pt-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-xs font-medium text-zinc-200">
                    Are EAs / Bots Allowed?
                  </span>
                  <TriStateButtons value={eaBotsAnswer} onChange={setEaBotsAnswer} />
                </div>
              </div>

              {/* 13. Is Copy Trading Allowed? */}
              <div className="pt-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-xs font-medium text-zinc-200">
                    Is Copy Trading Allowed?
                  </span>
                  <TriStateButtons value={copyTradingAnswer} onChange={setCopyTradingAnswer} />
                </div>
              </div>

              {/* 14. Is Hedging Allowed? */}
              <div className="pt-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-xs font-medium text-zinc-200">
                    Is Hedging Allowed?
                  </span>
                  <TriStateButtons value={hedgingAnswer} onChange={setHedgingAnswer} />
                </div>
              </div>

              {/* 15. Maximum Position Size? */}
              <div className="pt-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-xs font-medium text-zinc-200">
                    Maximum Position Size?
                  </span>
                  <TriStateButtons value={maxPositionSizeAnswer} onChange={setMaxPositionSizeAnswer} />
                </div>
                {maxPositionSizeAnswer === 'YES' && (
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="number"
                      step="any"
                      value={maxPositionSizeValue}
                      onChange={(e) => setMaxPositionSizeValue(e.target.value)}
                      placeholder="10"
                      className="w-24 bg-zinc-900 text-zinc-100 text-xs font-mono px-2.5 py-1.5 rounded-lg border border-zinc-700 focus:border-emerald-500 focus:outline-none"
                    />
                    <span className="text-xs text-zinc-400 font-mono">lots / contracts</span>
                  </div>
                )}
              </div>

              {/* 16. Other Restrictions? */}
              <div className="pt-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-xs font-medium text-zinc-200">
                    Other Restrictions?
                  </span>
                  <TriStateButtons value={otherRestrictionsAnswer} onChange={setOtherRestrictionsAnswer} />
                </div>
                {otherRestrictionsAnswer === 'YES' && (
                  <div className="mt-2">
                    <input
                      type="text"
                      value={otherRestrictionsValue}
                      onChange={(e) => setOtherRestrictionsValue(e.target.value)}
                      placeholder="Custom rule description..."
                      className="w-full bg-zinc-900 text-zinc-100 text-xs font-mono px-3 py-2 rounded-lg border border-zinc-700 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                )}
              </div>
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
            className="px-4 py-2 text-xs font-medium text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg border border-zinc-700 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-5 py-2 text-xs font-semibold text-zinc-950 bg-zinc-100 hover:bg-white rounded-lg transition-colors font-mono cursor-pointer"
          >
            {initialAccount ? 'Save Changes' : 'Create Account'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
