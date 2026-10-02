import React from 'react';
import type { PlanStatus, TradeResult, ExitType, TradeDirection } from '../../types';
import { formatMoney } from '../../utils/currency';

interface BadgeProps {
  children?: React.ReactNode;
  variant?: 'default' | 'success' | 'danger' | 'warning' | 'neutral' | 'info';
  className?: string;
}

export function Badge({ children, variant = 'default', className = '' }: BadgeProps) {
  const variantClasses = {
    default: 'bg-zinc-100 text-zinc-700 border-zinc-200',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    danger: 'bg-rose-50 text-rose-700 border-rose-200',
    warning: 'bg-amber-50 text-amber-800 border-amber-200',
    neutral: 'bg-zinc-100 text-zinc-600 border-zinc-200',
    info: 'bg-sky-50 text-sky-700 border-sky-200',
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border tracking-wide uppercase font-mono ${variantClasses[variant]} ${className}`}
    >
      {children}
    </span>
  );
}

export function PlanStatusBadge({ status }: { status: PlanStatus }) {
  switch (status) {
    case 'PLANNED':
      return <Badge variant="info">Planned</Badge>;
    case 'TRIGGERED':
      return <Badge variant="success">Triggered</Badge>;
    case 'NOT_TRIGGERED':
      return <Badge variant="neutral">Not Triggered</Badge>;
    case 'INVALID':
      return <Badge variant="warning">Invalid</Badge>;
    default:
      return <Badge>{status}</Badge>;
  }
}

export function DirectionBadge({ direction }: { direction: TradeDirection }) {
  if (direction === 'BUY') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-bold font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
        ▲ BUY
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-bold font-mono px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
      ▼ SELL
    </span>
  );
}

export function ResultBadge({ result, pnl, currency }: { result?: TradeResult; pnl?: number; currency?: string }) {
  if (result === 'PROFIT' || (pnl !== undefined && pnl > 0)) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-mono font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
        + PROFIT {pnl !== undefined ? `(${currency ? formatMoney(pnl, currency) : `$${pnl.toLocaleString()}`})` : ''}
      </span>
    );
  }
  if (result === 'LOSS' || (pnl !== undefined && pnl < 0)) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-mono font-semibold px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
        - LOSS {pnl !== undefined ? `(${currency ? formatMoney(Math.abs(pnl), currency) : `$${Math.abs(pnl).toLocaleString()}`})` : ''}
      </span>
    );
  }
  if (result === 'BEP' || (pnl !== undefined && pnl === 0)) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-mono font-semibold px-2 py-0.5 rounded bg-zinc-100 text-zinc-700 border border-zinc-200">
        0 BEP
      </span>
    );
  }
  return (
    <span className="inline-flex items-center text-xs font-mono text-zinc-400">
      —
    </span>
  );
}

export function ExitTypeBadge({ exitType }: { exitType: ExitType }) {
  const styles: Record<ExitType, { label: string; cls: string }> = {
    FULL_TP: { label: 'Full TP', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    CUT_PROFIT: { label: 'Cut Profit', cls: 'bg-teal-50 text-teal-700 border-teal-200' },
    FULL_SL: { label: 'Full SL', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
    CUT_LOSS: { label: 'Cut Loss', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
    PARTIAL: { label: 'Partial', cls: 'bg-sky-50 text-sky-700 border-sky-200' },
    OTHER: { label: 'Other Exit', cls: 'bg-zinc-100 text-zinc-600 border-zinc-200' },
  };

  const item = styles[exitType] || styles.OTHER;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono border ${item.cls}`}>
      {item.label}
    </span>
  );
}
