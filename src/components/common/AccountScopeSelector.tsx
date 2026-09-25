import React from 'react';
import type { Account } from '../../types';
import {
  parseAccountScope,
  formatAccountType,
  getScopeLabel,
} from '../../utils/accountScope';
import { Layers, ChevronDown } from 'lucide-react';

interface AccountScopeSelectorProps {
  accounts: Account[];
  selectedScope: string;
  onSelectScope: (scope: string) => void;
  className?: string;
  compact?: boolean;
}

export function AccountScopeSelector({
  accounts,
  selectedScope,
  onSelectScope,
  className = '',
  compact = false,
}: AccountScopeSelectorProps) {
  // Counts per account type
  const personalAccounts = accounts.filter((a) => a.type === 'PERSONAL');
  const propFirmAccounts = accounts.filter((a) => a.type === 'PROP_FIRM');
  const demoAccounts = accounts.filter((a) => a.type === 'DEMO');
  const otherAccounts = accounts.filter((a) => a.type === 'OTHER');

  const scopeLabelInfo = getScopeLabel(selectedScope, accounts);
  const parsed = parseAccountScope(selectedScope);

  // Normalize active value for select element
  const selectValue = parsed.raw;

  return (
    <div className={`relative inline-flex items-center ${className}`}>
      <div className="relative flex items-center">
        {!compact && (
          <div className="pointer-events-none absolute left-3 flex items-center text-zinc-400">
            <Layers className="w-3.5 h-3.5 text-zinc-400" />
          </div>
        )}

        <select
          value={selectValue}
          onChange={(e) => onSelectScope(e.target.value)}
          className={`appearance-none bg-zinc-900 hover:bg-zinc-850 text-zinc-200 text-xs font-mono font-medium rounded-lg border border-zinc-800 hover:border-zinc-700 focus:outline-none focus:border-zinc-500 cursor-pointer shadow-xs transition-colors ${
            compact ? 'pl-2.5 pr-7 py-1.5' : 'pl-8 pr-8 py-2'
          }`}
          aria-label="Account Scope Selector"
        >
          <option value="ALL">
            ALL ACCOUNTS ({accounts.length})
          </option>

          <optgroup label="ACCOUNT TYPES">
            <option value="TYPE:PERSONAL">
              PERSONAL ({personalAccounts.length})
            </option>
            <option value="TYPE:PROP_FIRM">
              PROP FIRM ({propFirmAccounts.length})
            </option>
            <option value="TYPE:DEMO">
              DEMO ({demoAccounts.length})
            </option>
            <option value="TYPE:OTHER">
              OTHER ({otherAccounts.length})
            </option>
          </optgroup>

          {accounts.length > 0 && (
            <optgroup label="INDIVIDUAL ACCOUNTS">
              {accounts.map((acc) => (
                <option key={acc.id} value={`ACCOUNT:${acc.id}`}>
                  {acc.name} ({formatAccountType(acc.type)} · {acc.currency || 'USD'})
                </option>
              ))}
            </optgroup>
          )}
        </select>

        <div className="pointer-events-none absolute right-2.5 flex items-center text-zinc-400">
          <ChevronDown className="w-3.5 h-3.5" />
        </div>
      </div>
    </div>
  );
}

/**
 * Reusable Active Scope Indicator Badge / Header
 * Shows current active scope and accounts count per Section 5 of specification.
 */
interface ActiveScopeBadgeProps {
  accounts: Account[];
  selectedScope: string;
  onSelectScope?: (scope: string) => void;
  showSelector?: boolean;
}

export function ActiveScopeBanner({
  accounts,
  selectedScope,
  onSelectScope,
  showSelector = true,
}: ActiveScopeBadgeProps) {
  const scopeInfo = getScopeLabel(selectedScope, accounts);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-zinc-900/80 border border-zinc-800 rounded-xl">
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300">
          <Layers className="w-4 h-4 text-cyan-400" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono uppercase text-zinc-400 font-semibold tracking-wider">
              Account Scope
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
              {scopeInfo.subtitle}
            </span>
          </div>
          <h4 className="text-sm font-bold text-zinc-100 font-sans tracking-tight">
            {scopeInfo.title}
          </h4>
        </div>
      </div>

      {showSelector && onSelectScope && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-400 font-mono hidden sm:inline">Switch scope:</span>
          <AccountScopeSelector
            accounts={accounts}
            selectedScope={selectedScope}
            onSelectScope={onSelectScope}
            compact={true}
          />
        </div>
      )}
    </div>
  );
}
