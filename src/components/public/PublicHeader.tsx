import { Calendar, Globe, Lock } from 'lucide-react';
import type { PublishedAccount } from '../../types/public';

interface PublicHeaderProps {
  accounts: PublishedAccount[];
  selectedAccountId: string;
  onSelectAccount: (id: string) => void;
  publishedAt?: string;
  journalName?: string;
  onNavigateAdmin?: () => void;
}

export function PublicHeader({
  accounts,
  selectedAccountId,
  onSelectAccount,
  publishedAt,
  journalName = 'Tradebook Public Journal',
  onNavigateAdmin,
}: PublicHeaderProps) {
  return (
    <header className="sticky top-0 z-30 bg-zinc-900/95 backdrop-blur-md border-b border-zinc-800 px-4 sm:px-6 py-3 shadow-xs">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-zinc-100 text-zinc-950 flex items-center justify-center font-mono font-bold text-sm shadow-xs">
            TB
          </div>
          <div>
            <h1 className="text-sm sm:text-base font-bold text-zinc-100 tracking-tight leading-none flex items-center gap-2">
              <span>Tradebook</span>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800/80 font-semibold flex items-center gap-1">
                <Globe className="w-2.5 h-2.5 text-emerald-400" />
                <span>Public View</span>
              </span>
            </h1>
            <p className="text-[11px] text-zinc-400 flex items-center gap-1.5 mt-0.5">
              <span>Plan · Trigger · Execute · Review</span>
              {journalName && journalName !== 'Tradebook' && (
                <>
                  <span className="text-zinc-600 hidden sm:inline">·</span>
                  <span className="text-zinc-300 font-medium hidden sm:inline">{journalName}</span>
                </>
              )}
              {publishedAt && (
                <>
                  <span className="text-zinc-600 hidden md:inline">·</span>
                  <span className="text-zinc-400 hidden md:flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-zinc-500" />
                    <span>{new Date(publishedAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}</span>
                  </span>
                </>
              )}
            </p>
          </div>
        </div>

        {/* Controls - Read-Only Account Filter */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {accounts && accounts.length > 1 && (
            <div className="relative">
              <select
                value={selectedAccountId}
                onChange={(e) => onSelectAccount(e.target.value)}
                className="appearance-none bg-zinc-900 text-zinc-200 text-xs font-medium pl-3 pr-8 py-1.5 rounded-lg border border-zinc-800 hover:border-zinc-700 focus:outline-none focus:border-zinc-500 cursor-pointer shadow-xs"
              >
                <option value="ALL">All Accounts ({accounts.length})</option>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-zinc-400">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          )}

          <div className="text-[11px] font-mono px-2.5 py-1 rounded-md bg-zinc-800/80 text-zinc-400 border border-zinc-700">
            100% Read-Only
          </div>

          {onNavigateAdmin && (
            <button
              onClick={onNavigateAdmin}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-zinc-50 border border-zinc-700 hover:border-zinc-600 text-xs font-medium transition-colors cursor-pointer shadow-xs"
              title="Admin Login"
            >
              <Lock className="w-3.5 h-3.5 text-emerald-400" />
              <span>Login</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
