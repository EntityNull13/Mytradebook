import type { Account, AccountType } from '../types';

export type AccountScopeType = 'ALL' | 'PERSONAL' | 'PROP_FIRM' | 'DEMO' | 'OTHER' | 'INDIVIDUAL';

export interface ParsedAccountScope {
  raw: string;
  type: AccountScopeType;
  accountType?: AccountType;
  accountId?: string;
}

/**
 * Parses any scope string into a structured ParsedAccountScope object.
 * Supports:
 * - 'ALL'
 * - 'TYPE:PERSONAL' | 'TYPE:PROP_FIRM' | 'TYPE:DEMO' | 'TYPE:OTHER'
 * - 'PERSONAL' | 'PROP_FIRM' | 'DEMO' | 'OTHER' (graceful shorthand)
 * - 'ACCOUNT:<accountId>'
 * - '<accountId>' (fallback individual account ID)
 */
export function parseAccountScope(scope: string): ParsedAccountScope {
  if (!scope || scope === 'ALL') {
    return { raw: 'ALL', type: 'ALL' };
  }

  if (scope.startsWith('TYPE:')) {
    const accType = scope.slice(5).toUpperCase() as AccountType;
    return {
      raw: `TYPE:${accType}`,
      type: accType as AccountScopeType,
      accountType: accType,
    };
  }

  if (scope === 'PERSONAL' || scope === 'PROP_FIRM' || scope === 'DEMO' || scope === 'OTHER') {
    return {
      raw: `TYPE:${scope}`,
      type: scope as AccountScopeType,
      accountType: scope as AccountType,
    };
  }

  if (scope.startsWith('ACCOUNT:')) {
    const id = scope.slice(8);
    return {
      raw: scope,
      type: 'INDIVIDUAL',
      accountId: id,
    };
  }

  // Raw account ID
  return {
    raw: `ACCOUNT:${scope}`,
    type: 'INDIVIDUAL',
    accountId: scope,
  };
}

/**
 * Returns accounts that fall strictly within the specified scope.
 */
export function getScopedAccounts(accounts: Account[], scope: string): Account[] {
  const parsed = parseAccountScope(scope);

  if (parsed.type === 'ALL') {
    return accounts;
  }

  if (parsed.type === 'INDIVIDUAL' && parsed.accountId) {
    return accounts.filter((a) => a.id === parsed.accountId);
  }

  if (parsed.accountType) {
    return accounts.filter((a) => a.type === parsed.accountType);
  }

  return accounts;
}

/**
 * Returns a Set of account IDs matching the scope for O(1) membership checks.
 */
export function getScopedAccountIds(accounts: Account[], scope: string): Set<string> {
  const scoped = getScopedAccounts(accounts, scope);
  return new Set(scoped.map((a) => a.id));
}

/**
 * Human-readable format for AccountType
 */
export function formatAccountType(type: AccountType): string {
  switch (type) {
    case 'PERSONAL':
      return 'Personal';
    case 'PROP_FIRM':
      return 'Prop Firm';
    case 'DEMO':
      return 'Demo';
    case 'OTHER':
      return 'Other';
    default:
      return type;
  }
}

export interface ScopeLabelInfo {
  title: string;
  subtitle: string;
  accountCount: number;
  isIndividual: boolean;
  individualAccount?: Account;
}

/**
 * Returns display labels and count metadata for UI badges & headers.
 */
export function getScopeLabel(scope: string, accounts: Account[]): ScopeLabelInfo {
  const parsed = parseAccountScope(scope);
  const scopedAccounts = getScopedAccounts(accounts, scope);
  const count = scopedAccounts.length;

  if (parsed.type === 'ALL') {
    return {
      title: 'All Accounts',
      subtitle: `${count} ${count === 1 ? 'account' : 'accounts'}`,
      accountCount: count,
      isIndividual: false,
    };
  }

  if (parsed.type === 'INDIVIDUAL' && parsed.accountId) {
    const acc = accounts.find((a) => a.id === parsed.accountId);
    const title = acc ? acc.name : 'Unknown Account';
    const typeLabel = acc ? formatAccountType(acc.type) : 'Account';
    const curr = acc?.currency || 'USD';
    return {
      title,
      subtitle: `1 account · ${typeLabel} (${curr})`,
      accountCount: 1,
      isIndividual: true,
      individualAccount: acc,
    };
  }

  const typeName = parsed.accountType ? formatAccountType(parsed.accountType) : 'Accounts';
  return {
    title: typeName,
    subtitle: `${count} ${count === 1 ? 'account' : 'accounts'}`,
    accountCount: count,
    isIndividual: false,
  };
}
