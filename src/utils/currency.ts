/**
 * TRADEBOOK - Centralized Multi-Currency Utilities
 * Complies with Section 1 & Section 22:
 * - formatMoney(amount, currency)
 * - Supports USD, IDR, EUR, GBP, JPY and standard ISO currencies
 * - Never combines amounts of different currencies without FX conversion
 */

export function formatMoney(
  amount: number | null | undefined,
  currency: string = 'USD'
): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '—';
  }

  const curr = (currency || 'USD').toUpperCase().trim();

  try {
    const isIDR = curr === 'IDR';
    const isJPY = curr === 'JPY';

    const formatter = new Intl.NumberFormat(isIDR ? 'id-ID' : 'en-US', {
      style: 'currency',
      currency: curr,
      minimumFractionDigits: isIDR || isJPY ? 0 : 2,
      maximumFractionDigits: isIDR || isJPY ? 0 : 2,
    });

    return formatter.format(amount);
  } catch {
    // Graceful fallback if currency code is custom/unsupported
    const isZeroDecimal = curr === 'JPY' || curr === 'IDR';
    const formatted = amount.toLocaleString('en-US', {
      minimumFractionDigits: isZeroDecimal ? 0 : 2,
      maximumFractionDigits: isZeroDecimal ? 0 : 2,
    });
    return `${curr} ${formatted}`;
  }
}

/**
 * Returns a signed currency string (+/- prefix)
 * Example: +$1,250.00 or -$500.00
 */
export function formatSignedMoney(
  amount: number | null | undefined,
  currency: string = 'USD'
): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '—';
  }
  const prefix = amount > 0 ? '+' : '';
  return `${prefix}${formatMoney(amount, currency)}`;
}

export interface CurrencyBreakdown {
  currency: string;
  balance: number;
  netPnL: number;
  startingBalance: number;
  deposits: number;
  withdrawalsAndFees: number;
  accountsCount: number;
  tradesCount: number;
}
