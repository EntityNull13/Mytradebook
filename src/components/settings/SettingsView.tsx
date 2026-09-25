import { useState } from 'react';
import { generateBackup, exportRawJson } from '../../services/backup';
import { exportToExcel } from '../../services/exportExcel';
import { RestoreModal } from './RestoreModal';
import { Modal } from '../common/Modal';
import { db } from '../../db/database';
import { cleanupDummyTrades } from '../../db/seed';
import { seedAccountScopeTestData, purgeAccountScopeTestData } from '../../db/dummyScopeData';
import type { AppSettings, Account, Plan, Trade, Exit, Evidence } from '../../types';
import {
  Settings,
  Download,
  Upload,
  FileSpreadsheet,
  Lock,
  HardDrive,
  Trash2,
  CheckCircle2,
  AlertCircle,
  FileJson,
  ShieldCheck,
  CloudOff,
  KeyRound,
  AlertTriangle,
  Database,
  RefreshCw,
} from 'lucide-react';

interface SettingsViewProps {
  settings: AppSettings;
  accounts: Account[];
  plans: Plan[];
  trades: Trade[];
  exits: Exit[];
  evidenceList: Evidence[];
  onRefresh: () => void;
}

export function SettingsView({
  settings,
  accounts,
  plans,
  trades,
  exits,
  evidenceList,
  onRefresh,
}: SettingsViewProps) {
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(settings.theme || 'dark');
  const [timezone, setTimezone] = useState(settings.timezone || 'Asia/Jakarta');
  const [currency, setCurrency] = useState(settings.currencyDisplay || 'USD');

  // Backup state: AES-256-GCM encrypted
  const [backupPassword, setBackupPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [includeScreenshots, setIncludeScreenshots] = useState(true);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupSuccess, setBackupSuccess] = useState(false);

  // Modals
  const [isRestoreOpen, setIsRestoreOpen] = useState(false);
  const [isClearOpen, setIsClearOpen] = useState(false);
  const [clearPassword, setClearPassword] = useState('');
  const [clearConfirmPassword, setClearConfirmPassword] = useState('');
  const [clearPasswordError, setClearPasswordError] = useState('');
  const [isClearing, setIsClearing] = useState(false);
  const [isPurgingDummies, setIsPurgingDummies] = useState(false);
  const [isSeedingDummies, setIsSeedingDummies] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isExportingJson, setIsExportingJson] = useState(false);

  const handleSeedScopeTestAction = async () => {
    try {
      setIsSeedingDummies(true);
      await seedAccountScopeTestData();
      onRefresh();
    } catch (err) {
      console.warn('Failed to seed test data:', err);
    } finally {
      setIsSeedingDummies(false);
    }
  };

  const handlePurgeDummyTradesAction = async () => {
    try {
      setIsPurgingDummies(true);
      await purgeAccountScopeTestData();
      await cleanupDummyTrades(true);
      onRefresh();
    } catch (err) {
      console.warn('Failed to purge dummy trades:', err);
    } finally {
      setIsPurgingDummies(false);
    }
  };

  const handleSavePreferences = async () => {
    try {
      const updated: AppSettings = {
        ...settings,
        theme,
        timezone,
        currencyDisplay: currency,
      };
      await db.settings.put(updated);
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  const handleTriggerBackup = async () => {
    setPasswordError('');

    if (!backupPassword.trim()) {
      setPasswordError('Please enter an encryption password to secure your .tjbackup file.');
      return;
    }
    if (backupPassword !== confirmPassword) {
      setPasswordError('Passwords do not match.');
      return;
    }

    try {
      setIsBackingUp(true);
      setBackupSuccess(false);

      await generateBackup({
        password: backupPassword.trim(),
        includeEvidence: includeScreenshots,
      });

      setBackupSuccess(true);
      setTimeout(() => setBackupSuccess(false), 5000);
    } catch (err) {
      console.error('Backup failed:', err);
      setPasswordError(err instanceof Error ? err.message : 'Failed to generate backup container.');
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleExportExcel = async () => {
    try {
      setIsExportingExcel(true);
      await exportToExcel();
    } catch (err) {
      console.error(err);
    } finally {
      setIsExportingExcel(false);
    }
  };

  // Fixed P1: Calls exportRawJson() producing Tradebook-Raw-YYYY-MM-DD.json
  const handleExportJson = async () => {
    try {
      setIsExportingJson(true);
      await exportRawJson();
    } catch (err) {
      console.error('Failed to export raw JSON:', err);
    } finally {
      setIsExportingJson(false);
    }
  };

  // P0: Clear database with mandatory AES-256-GCM encrypted safety backup
  const handleClearAllData = async (e: React.FormEvent) => {
    e.preventDefault();
    setClearPasswordError('');

    if (!clearPassword.trim()) {
      setClearPasswordError('An encryption password is required to generate the safety backup.');
      return;
    }
    if (clearPassword !== clearConfirmPassword) {
      setClearPasswordError('Passwords do not match.');
      return;
    }

    try {
      setIsClearing(true);

      // 1. Generate encrypted safety backup first
      await generateBackup({
        password: clearPassword.trim(),
        includeEvidence: true,
      });

      // 2. Wipe all local tables transactionally
      await db.transaction(
        'rw',
        [
          db.accounts,
          db.accountPhases,
          db.propFirmRules,
          db.plans,
          db.planGroups,
          db.trades,
          db.exits,
          db.reviews,
          db.setups,
          db.evidence,
          db.transactions,
        ],
        async () => {
          await db.accounts.clear();
          await db.accountPhases.clear();
          await db.propFirmRules.clear();
          await db.plans.clear();
          await db.planGroups.clear();
          await db.trades.clear();
          await db.exits.clear();
          await db.reviews.clear();
          await db.setups.clear();
          await db.evidence.clear();
          await db.transactions.clear();
        }
      );

      setIsClearOpen(false);
      setClearPassword('');
      setClearConfirmPassword('');
      onRefresh();
    } catch (err) {
      console.error('Failed to clear database:', err);
      setClearPasswordError('Failed to complete database reset operation.');
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-zinc-100 tracking-tight flex items-center gap-2">
          <Settings className="w-5 h-5 text-zinc-400" />
          <span>Application Settings & Data Sovereignty</span>
        </h2>
        <p className="text-xs text-zinc-400">
          Local-first persistence controls, AES-256 encrypted backups, and audit exports
        </p>
      </div>

      {/* SECTION 1: DATA BACKUP & RESTORE */}
      <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-5 sm:p-6 shadow-sm space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-emerald-400" />
              <span>Encrypted Portable Backup (.tjbackup)</span>
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Self-contained, portable archive protected with military-grade AES-256-GCM encryption.
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-800">
              AES-256-GCM
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
              Local-First
            </span>
          </div>
        </div>

        {/* Backup creator form */}
        <div className="bg-zinc-950/80 p-4 sm:p-5 rounded-xl border border-zinc-800 space-y-4">
          {/* Mandatory Encryption Header */}
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-emerald-400" />
              <div>
                <span className="text-xs font-bold text-zinc-200 block">
                  AES-256-GCM Backup Encryption (Mandatory)
                </span>
                <span className="text-[10px] text-zinc-400">
                  Derives a 256-bit key via PBKDF2 SHA-256 (100,000 iterations). All .tjbackup files are encrypted.
                </span>
              </div>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-800 font-semibold">
              ENCRYPTED
            </span>
          </div>

          {/* Encryption Password Fields */}
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Encryption Password *</span>
                </label>
                <input
                  type="password"
                  value={backupPassword}
                  onChange={(e) => setBackupPassword(e.target.value)}
                  placeholder="Enter strong password"
                  className="w-full bg-zinc-900 text-zinc-200 text-xs px-3 py-2 rounded-lg border border-zinc-700 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Confirm Password *</span>
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className="w-full bg-zinc-900 text-zinc-200 text-xs px-3 py-2 rounded-lg border border-zinc-700 focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Password warning note */}
            <div className="p-3 bg-amber-950/40 border border-amber-800/60 rounded-lg flex items-start gap-2 text-amber-200 text-xs">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                <strong className="font-semibold text-amber-100">Keep this password safe.</strong> Without it, your backup cannot be restored. Your password is never stored or transmitted anywhere. For unencrypted data inspection, use the Export Raw JSON button below.
              </p>
            </div>
          </div>

          {passwordError && (
            <div className="p-2.5 bg-rose-950/60 border border-rose-800 text-rose-300 rounded-lg text-xs font-mono">
              {passwordError}
            </div>
          )}

          {/* Scope and action buttons */}
          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
              <input
                type="checkbox"
                checked={includeScreenshots}
                onChange={(e) => setIncludeScreenshots(e.target.checked)}
                className="rounded border-zinc-700 bg-zinc-900 text-zinc-100"
              />
              <span>Include chart evidence images ({evidenceList.length} files)</span>
            </label>

            <div className="flex items-center gap-2">
              <button
                onClick={handleTriggerBackup}
                disabled={isBackingUp}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-zinc-100 text-zinc-950 hover:bg-white transition-colors font-mono cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{isBackingUp ? 'Encrypting & Generating...' : 'Download .tjbackup'}</span>
              </button>

              <button
                onClick={() => setIsRestoreOpen(true)}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-zinc-800 text-zinc-200 hover:bg-zinc-700 border border-zinc-700 transition-colors font-mono cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Restore Backup</span>
              </button>
            </div>
          </div>

          {backupSuccess && (
            <div className="flex items-center gap-2 p-2.5 bg-emerald-950/50 border border-emerald-800 text-emerald-300 rounded-lg text-xs font-mono">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Backup downloaded successfully to your local storage!</span>
            </div>
          )}
        </div>

        {/* Multi-Format Exports */}
        <div className="pt-2 border-t border-zinc-800 flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="text-xs font-semibold text-zinc-200 block">
              Additional Export Formats
            </span>
            <span className="text-[11px] text-zinc-500">
              Structured multi-sheet spreadsheets and raw JSON records
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportExcel}
              disabled={isExportingExcel}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono rounded-lg bg-emerald-950/40 text-emerald-300 border border-emerald-800 hover:bg-emerald-950/70 transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>{isExportingExcel ? 'Exporting...' : 'Export to Excel (.xlsx)'}</span>
            </button>

            <button
              onClick={handleExportJson}
              disabled={isExportingJson}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono rounded-lg bg-zinc-800 text-zinc-300 border border-zinc-700 hover:bg-zinc-700 transition-colors cursor-pointer"
            >
              <FileJson className="w-3.5 h-3.5" />
              <span>{isExportingJson ? 'Exporting...' : 'Export Raw JSON'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 2: CLOUD & AUTO BACKUP STATUS */}
      <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
              <CloudOff className="w-4 h-4 text-zinc-400" />
              <span>Cloud Synchronization & Remote Storage</span>
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Remote cloud providers and automated scheduled synchronization status
            </p>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700 uppercase font-semibold">
            Not Connected · Coming Soon
          </span>
        </div>

        <div className="bg-zinc-950/80 p-4 rounded-xl border border-zinc-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-zinc-200 block font-mono">
              Local-First Offline Architecture
            </span>
            <p className="text-xs text-zinc-400 max-w-xl leading-relaxed">
              Tradebook operates completely offline on your local device. Direct remote cloud storage connectors (Google Drive, Dropbox, AWS S3) are scheduled for future releases. Use the portable <strong className="text-zinc-300 font-mono">.tjbackup</strong> feature above for manual secure sync across devices.
            </p>
          </div>
          <button
            disabled
            className="px-3.5 py-1.5 text-xs font-mono font-medium rounded-lg bg-zinc-900 text-zinc-500 border border-zinc-800 cursor-not-allowed shrink-0"
          >
            Connect Cloud (Coming Soon)
          </button>
        </div>
      </div>

      {/* SECTION 3: REGIONAL & PREFERENCES */}
      <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-5 sm:p-6 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-zinc-100">Display & Regional Preferences</h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Theme</label>
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value as 'light' | 'dark' | 'system')}
              className="w-full bg-zinc-950 text-zinc-200 text-xs px-3 py-2 rounded-lg border border-zinc-800 focus:border-zinc-500 focus:outline-none"
            >
              <option value="dark">Dark (Zinc Minimalist)</option>
              <option value="light">Light</option>
              <option value="system">System Preference</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Timezone</label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full bg-zinc-950 text-zinc-200 text-xs px-3 py-2 rounded-lg border border-zinc-800 focus:border-zinc-500 focus:outline-none"
            >
              <option value="Asia/Jakarta">Asia/Jakarta (WIB)</option>
              <option value="Asia/Singapore">Asia/Singapore (SGT)</option>
              <option value="America/New_York">America/New_York (EST)</option>
              <option value="Europe/London">Europe/London (GMT)</option>
              <option value="UTC">Universal UTC</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Default Base Currency</label>
            <input
              type="text"
              value={currency}
              onChange={(e) => setCurrency(e.target.value.toUpperCase())}
              className="w-full bg-zinc-950 text-zinc-200 text-xs font-mono px-3 py-2 rounded-lg border border-zinc-800 focus:border-zinc-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={handleSavePreferences}
            className="px-4 py-1.5 text-xs font-mono font-semibold rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700 transition-colors cursor-pointer"
          >
            Save Preferences
          </button>
        </div>
      </div>

      {/* SECTION 4: LOCAL STORAGE AUDIT & PURGE */}
      <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-5 sm:p-6 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
          <HardDrive className="w-4 h-4 text-zinc-400" />
          <span>Local Device Storage Metrics</span>
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
          <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800">
            <span className="text-[10px] text-zinc-500 block">Accounts</span>
            <span className="text-zinc-200 font-bold text-base">{accounts.length}</span>
          </div>
          <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800">
            <span className="text-[10px] text-zinc-500 block">Trading Plans</span>
            <span className="text-zinc-200 font-bold text-base">{plans.length}</span>
          </div>
          <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800">
            <span className="text-[10px] text-zinc-500 block">Trades & Exits</span>
            <span className="text-zinc-200 font-bold text-base">
              {trades.length} / {exits.length}
            </span>
          </div>
          <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800">
            <span className="text-[10px] text-zinc-500 block">Chart Evidence</span>
            <span className="text-zinc-200 font-bold text-base">{evidenceList.length} files</span>
          </div>
        </div>

        {/* Account Scope Test Data Management */}
        <div className="pt-3 border-t border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-xs font-semibold text-emerald-400 block flex items-center gap-1">
              <Database className="w-3.5 h-3.5" />
              <span>Data Testing Account Scope (dummy-*)</span>
            </span>
            <span className="text-[11px] text-zinc-500">
              Muat data pengujian realistis (5 akun, 51 trade, 65 plan) dengan prefix <code className="font-mono text-zinc-400">dummy-</code> untuk menguji Overall, Personal, Prop Firm, Demo, dan Individual Account.
            </span>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={handleSeedScopeTestAction}
              disabled={isSeedingDummies}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono rounded-lg bg-emerald-950/40 text-emerald-300 border border-emerald-800 hover:bg-emerald-950/80 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSeedingDummies ? 'animate-spin' : ''}`} />
              <span>{isSeedingDummies ? 'Memuat...' : 'Muat / Reset Data Test'}</span>
            </button>

            <button
              type="button"
              onClick={handlePurgeDummyTradesAction}
              disabled={isPurgingDummies}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono rounded-lg bg-amber-950/40 text-amber-300 border border-amber-800 hover:bg-amber-950/80 transition-colors cursor-pointer disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{isPurgingDummies ? 'Membersihkan...' : 'Hapus Data Dummy Saja'}</span>
            </button>
          </div>
        </div>

        <div className="pt-3 border-t border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-xs font-semibold text-rose-400 block flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Danger Zone: Clear Local Database</span>
            </span>
            <span className="text-[11px] text-zinc-500">
              Permanently purges local browser IndexedDB tables. An automatic encrypted safety backup is downloaded first.
            </span>
          </div>

          <button
            onClick={() => {
              setIsClearOpen(true);
              setClearPassword('');
              setClearConfirmPassword('');
              setClearPasswordError('');
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono rounded-lg bg-rose-950/40 text-rose-300 border border-rose-800 hover:bg-rose-950/80 transition-colors self-start sm:self-auto cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Reset Database</span>
          </button>
        </div>
      </div>

      {/* Restore Modal */}
      {isRestoreOpen && (
        <RestoreModal
          isOpen={isRestoreOpen}
          onClose={() => setIsRestoreOpen(false)}
          onRestored={onRefresh}
        />
      )}

      {/* Reset Database Confirmation Modal with Mandatory Encrypted Safety Backup */}
      {isClearOpen && (
        <Modal
          isOpen={isClearOpen}
          onClose={() => !isClearing && setIsClearOpen(false)}
          title="Reset Local Journal Database"
          subtitle="Permanently erase all local trading data from this device"
          maxWidth="md"
        >
          <form onSubmit={handleClearAllData} className="space-y-4">
            <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-lg flex items-start gap-2.5 text-rose-200 text-xs">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-rose-100">Permanent Database Erasure</p>
                <p className="text-rose-300/90 leading-relaxed">
                  This action will permanently erase all accounts, plans, trades, exits, and reviews from your local browser IndexedDB.
                  To ensure you never lose your data by accident, an AES-256-GCM encrypted safety backup will be generated and downloaded before erasing.
                </p>
              </div>
            </div>

            <div className="space-y-3 bg-zinc-950 p-3.5 rounded-lg border border-zinc-800">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-200">
                <Lock className="w-3.5 h-3.5 text-emerald-400" />
                <span>Safety Backup Encryption Password *</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-zinc-400 mb-1">Enter Password</label>
                  <input
                    type="password"
                    value={clearPassword}
                    onChange={(e) => setClearPassword(e.target.value)}
                    placeholder="Enter password"
                    required
                    className="w-full bg-zinc-900 text-zinc-200 text-xs px-3 py-1.5 rounded-lg border border-zinc-700 focus:border-rose-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-zinc-400 mb-1">Confirm Password</label>
                  <input
                    type="password"
                    value={clearConfirmPassword}
                    onChange={(e) => setClearConfirmPassword(e.target.value)}
                    placeholder="Confirm password"
                    required
                    className="w-full bg-zinc-900 text-zinc-200 text-xs px-3 py-1.5 rounded-lg border border-zinc-700 focus:border-rose-500 focus:outline-none"
                  />
                </div>
              </div>
              <span className="text-[10px] text-zinc-500 block">
                Your database will be saved to an encrypted <code className="font-mono text-zinc-400">.tjbackup</code> file using this password before tables are wiped.
              </span>
            </div>

            {clearPasswordError && (
              <div className="p-2.5 bg-rose-950/60 border border-rose-800 text-rose-300 rounded-lg text-xs font-mono">
                {clearPasswordError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setIsClearOpen(false)}
                disabled={isClearing}
                className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 rounded border border-zinc-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isClearing}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-mono transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isClearing ? 'Backing up & Resetting...' : 'Download Encrypted Backup & Reset'}</span>
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
