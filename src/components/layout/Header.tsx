import { ShieldCheck, Plus, CircleAlert, Globe, LogOut, ExternalLink } from 'lucide-react';
import type { Account, AppSettings } from '../../types';
import { PWAInstallButton } from '../common/PWAInstallButton';
import { AccountScopeSelector } from '../common/AccountScopeSelector';

interface HeaderProps {
  accounts: Account[];
  selectedScope: string;
  onSelectScope: (scope: string) => void;
  onOpenNewPlan: () => void;
  onOpenSettings: () => void;
  settings?: AppSettings;
  isAdmin?: boolean;
  onOpenPublishModal?: () => void;
  onLogout?: () => void;
  onViewPublicSite?: () => void;
}

export function Header({
  accounts,
  selectedScope,
  onSelectScope,
  onOpenNewPlan,
  onOpenSettings,
  settings,
  isAdmin,
  onOpenPublishModal,
  onLogout,
  onViewPublicSite,
}: HeaderProps) {
  // Compute backup status: "Backed Up Locally" or "Never Backed Up"
  const getBackupStatusBadge = () => {
    if (!settings?.lastBackupAt) {
      return (
        <button
          onClick={onOpenSettings}
          className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-medium rounded-md bg-amber-950/50 text-amber-300 border border-amber-800/80 hover:bg-amber-900/50 transition-colors cursor-pointer"
          title="This device has never been backed up"
        >
          <CircleAlert className="w-3.5 h-3.5 text-amber-400" />
          <span>Never Backed Up</span>
        </button>
      );
    }

    return (
      <button
        onClick={onOpenSettings}
        className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-medium rounded-md bg-emerald-950/50 text-emerald-300 border border-emerald-800/80 hover:bg-emerald-900/50 transition-colors cursor-pointer"
        title={`Last backed up locally: ${new Date(settings.lastBackupAt).toLocaleString()}`}
      >
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
        <span>Backed Up Locally</span>
      </button>
    );
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
              {isAdmin ? (
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800/80 font-semibold">
                  Admin
                </span>
              ) : (
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                  Offline-First
                </span>
              )}
            </h1>
            <p className="text-[11px] text-zinc-400 hidden sm:block">Plan · Trigger · Execute · Review</p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Account Filter using centralized AccountScope */}
          <AccountScopeSelector
            accounts={accounts}
            selectedScope={selectedScope}
            onSelectScope={onSelectScope}
            compact={true}
          />

          {/* Admin Publish Journal CTA */}
          {isAdmin && onOpenPublishModal && (
            <button
              onClick={onOpenPublishModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-300 bg-emerald-950/60 border border-emerald-800/80 hover:bg-emerald-900/60 rounded-lg shadow-xs transition-all cursor-pointer"
              title="Publish snapshots of your trading records to the public view"
            >
              <Globe className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden md:inline">Publish</span>
            </button>
          )}

          {/* Admin Link to Public View */}
          {isAdmin && onViewPublicSite && (
            <button
              onClick={onViewPublicSite}
              className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
              title="Open Public View in current tab"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Public View</span>
            </button>
          )}

          {/* Backup Status */}
          {getBackupStatusBadge()}

          {/* PWA Install Button */}
          <PWAInstallButton />

          {/* Primary CTA: + New Plan */}
          <button
            onClick={onOpenNewPlan}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-zinc-950 bg-zinc-100 hover:bg-zinc-200 rounded-lg shadow-xs hover:shadow transition-all font-mono active:scale-95 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-zinc-950 stroke-[3]" />
            <span>New Plan</span>
          </button>

          {/* Admin Logout */}
          {isAdmin && onLogout && (
            <button
              onClick={onLogout}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-zinc-700"
              title="Log out of Admin Dashboard"
            >
              <LogOut className="w-3.5 h-3.5 text-zinc-400" />
              <span>Logout</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

