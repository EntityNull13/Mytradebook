import { useRef, useEffect } from 'react';
import { Calendar, Globe, Moon, Sun } from 'lucide-react';
import type { PublishedAccount } from '../../types/public';
import { useTheme } from '../../utils/theme';

interface PublicHeaderProps {
  accounts: PublishedAccount[];
  selectedAccountId: string;
  onSelectAccount: (id: string) => void;
  publishedAt?: string;
  journalName?: string;
  onNavigateAdmin?: () => void;
}

const CLICK_RESET_TIMEOUT_MS = 1800; // Reset sequence if pause between clicks > 1.8s
const REQUIRED_CLICKS = 10;

export function PublicHeader({
  accounts,
  selectedAccountId,
  onSelectAccount,
  publishedAt,
  journalName = 'Tradebook Public Journal',
  onNavigateAdmin,
}: PublicHeaderProps) {
  const { isDark, toggleTheme } = useTheme();
  const clickCountRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  // Global listener: reset click counter if user clicks/taps any area outside the trigger
  useEffect(() => {
    const handleOutsideInteraction = (e: MouseEvent | TouchEvent) => {
      if (triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
        if (clickCountRef.current > 0) {
          clickCountRef.current = 0;
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
          }
        }
      }
    };

    window.addEventListener('click', handleOutsideInteraction);
    window.addEventListener('touchstart', handleOutsideInteraction, { passive: true });

    return () => {
      window.removeEventListener('click', handleOutsideInteraction);
      window.removeEventListener('touchstart', handleOutsideInteraction);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []);

  const handleClickReadOnly = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    clickCountRef.current += 1;

    if (clickCountRef.current >= REQUIRED_CLICKS) {
      clickCountRef.current = 0;
      onNavigateAdmin?.();
      return;
    }

    timeoutRef.current = setTimeout(() => {
      clickCountRef.current = 0;
      timeoutRef.current = null;
    }, CLICK_RESET_TIMEOUT_MS);
  };

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

        {/* Controls - Read-Only Account Filter & Hidden Admin Trigger */}
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

          {/* Night / Day Mode Toggle */}
          <button
            onClick={toggleTheme}
            className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-zinc-700"
            title={isDark ? 'Switch to Day Mode' : 'Switch to Night Mode'}
            aria-label={isDark ? 'Switch to Day Mode' : 'Switch to Night Mode'}
          >
            {isDark ? (
              <Sun className="w-3.5 h-3.5 text-amber-400" />
            ) : (
              <Moon className="w-3.5 h-3.5 text-zinc-400" />
            )}
          </button>

          {/* 100% Read-Only badge serving as hidden 10-click admin trigger */}
          <div
            ref={triggerRef}
            onClick={handleClickReadOnly}
            className="text-[11px] font-mono px-2.5 py-1 rounded-md bg-zinc-800/80 text-zinc-400 border border-zinc-700 select-none cursor-default active:bg-zinc-800"
            style={{ touchAction: 'manipulation' }}
          >
            100% Read-Only
          </div>
        </div>
      </div>
    </header>
  );
}
