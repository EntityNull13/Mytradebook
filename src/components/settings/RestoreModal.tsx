import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { parseBackupFile, executeRestore, type RestorePreview } from '../../services/restore';
import {
  Upload,
  KeyRound,
  ShieldCheck,
  AlertTriangle,
  Lock,
} from 'lucide-react';

interface RestoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRestored: () => void;
}

export function RestoreModal({ isOpen, onClose, onRestored }: RestoreModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [needsPassword, setNeedsPassword] = useState(false);
  const [preview, setPreview] = useState<RestorePreview | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Pre-restore safety backup state
  const [createSafetyBackup, setCreateSafetyBackup] = useState(true);
  const [safetyPassword, setSafetyPassword] = useState('');

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setErrorMsg('');
    setNeedsPassword(false);
    setPreview(null);
    setIsLoading(true);

    try {
      const res = await parseBackupFile(file);
      if (res.needsPassword) {
        setNeedsPassword(true);
      } else if (res.error) {
        setErrorMsg(res.error);
      } else if (res.preview) {
        setPreview(res.preview);
      }
    } catch {
      setErrorMsg('Unable to read backup file.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDecrypt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !password.trim()) return;

    setIsLoading(true);
    setErrorMsg('');

    try {
      const res = await parseBackupFile(selectedFile, password.trim());
      if (res.error) {
        setErrorMsg(res.error);
      } else if (res.preview) {
        setPreview(res.preview);
        setNeedsPassword(false);
      }
    } catch {
      setErrorMsg('Decryption failed. Please verify password.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmRestore = async () => {
    if (!preview) return;
    setErrorMsg('');

    if (createSafetyBackup && !safetyPassword.trim()) {
      setErrorMsg('Please enter an encryption password for the automated safety backup.');
      return;
    }

    setIsLoading(true);

    try {
      await executeRestore(preview.parsedContainer, createSafetyBackup, safetyPassword.trim());
      onRestored();
      onClose();
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : 'The restore operation could not be completed.';
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Restore Tradebook Backup"
      subtitle="Import a .tjbackup container into this device's local database"
      maxWidth="md"
    >
      <div className="space-y-4">
        {errorMsg && (
          <div className="p-3 text-xs bg-rose-950/50 border border-rose-800 text-rose-300 rounded-lg flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Step 1: File selection */}
        {!selectedFile && (
          <label className="flex flex-col items-center justify-center border-2 border-dashed border-zinc-700 hover:border-zinc-500 rounded-xl p-8 cursor-pointer bg-zinc-950/40 transition-colors">
            <Upload className="w-8 h-8 text-zinc-400 mb-2" />
            <span className="text-xs font-semibold text-zinc-200">
              Select .tjbackup container file
            </span>
            <span className="text-[11px] text-zinc-500 mt-1">
              Supports encrypted (.tjbackup) and standard archives
            </span>
            <input
              type="file"
              accept=".tjbackup,.json"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>
        )}

        {/* Step 2: Password prompt if encrypted */}
        {selectedFile && needsPassword && (
          <form onSubmit={handleDecrypt} className="space-y-3 bg-zinc-950 p-4 rounded-xl border border-zinc-800">
            <div className="flex items-center gap-2 text-amber-400">
              <KeyRound className="w-4 h-4" />
              <span className="text-xs font-semibold uppercase tracking-wider font-mono">
                Encrypted Backup Container
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              This backup is protected with AES-256 encryption. Enter the password used when creating it:
            </p>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter backup encryption password"
              required
              className="w-full bg-zinc-900 text-zinc-200 text-xs px-3 py-2 rounded-lg border border-zinc-700 focus:border-zinc-500 focus:outline-none"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedFile(null)}
                className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200"
              >
                Change File
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-zinc-100 text-zinc-950 hover:bg-white font-mono cursor-pointer"
              >
                {isLoading ? 'Decrypting...' : 'Decrypt & Inspect'}
              </button>
            </div>
          </form>
        )}

        {/* Step 3: Preview Manifest Counts */}
        {preview && (
          <div className="space-y-4">
            <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5 font-mono">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Backup Verified</span>
                </span>
                <span className="text-[10px] text-zinc-500 font-mono">
                  Created {new Date(preview.manifest.createdAt).toLocaleDateString()}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                <div className="bg-zinc-900/80 p-2 rounded border border-zinc-800">
                  <span className="text-[10px] text-zinc-500 block">Accounts</span>
                  <span className="text-zinc-200 font-bold">{preview.manifest.counts.accounts}</span>
                </div>
                <div className="bg-zinc-900/80 p-2 rounded border border-zinc-800">
                  <span className="text-[10px] text-zinc-500 block">Plans</span>
                  <span className="text-zinc-200 font-bold">{preview.manifest.counts.plans}</span>
                </div>
                <div className="bg-zinc-900/80 p-2 rounded border border-zinc-800">
                  <span className="text-[10px] text-zinc-500 block">Trades</span>
                  <span className="text-zinc-200 font-bold">{preview.manifest.counts.trades}</span>
                </div>
                <div className="bg-zinc-900/80 p-2 rounded border border-zinc-800">
                  <span className="text-[10px] text-zinc-500 block">Exits</span>
                  <span className="text-zinc-200 font-bold">{preview.manifest.counts.exits}</span>
                </div>
                <div className="bg-zinc-900/80 p-2 rounded border border-zinc-800">
                  <span className="text-[10px] text-zinc-500 block">Reviews</span>
                  <span className="text-zinc-200 font-bold">{preview.manifest.counts.reviews}</span>
                </div>
                <div className="bg-zinc-900/80 p-2 rounded border border-zinc-800">
                  <span className="text-[10px] text-zinc-500 block">Rules</span>
                  <span className="text-zinc-200 font-bold">{preview.manifest.counts.propFirmRules}</span>
                </div>
                <div className="bg-zinc-900/80 p-2 rounded border border-zinc-800">
                  <span className="text-[10px] text-zinc-500 block">Transactions</span>
                  <span className="text-zinc-200 font-bold">{preview.manifest.counts.transactions}</span>
                </div>
                <div className="bg-zinc-900/80 p-2 rounded border border-zinc-800">
                  <span className="text-[10px] text-zinc-500 block">Evidence</span>
                  <span className="text-zinc-200 font-bold">{preview.manifest.counts.evidence}</span>
                </div>
              </div>
            </div>

            {/* Mandatory Encrypted Safety Backup Option */}
            <div className="p-3.5 bg-zinc-950/60 rounded-xl border border-zinc-800 space-y-2.5">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="safetyCheck"
                  checked={createSafetyBackup}
                  onChange={(e) => setCreateSafetyBackup(e.target.checked)}
                  className="rounded border-zinc-700 bg-zinc-900 text-emerald-500 focus:ring-0 cursor-pointer"
                />
                <label htmlFor="safetyCheck" className="text-xs text-zinc-300 cursor-pointer">
                  <strong>Create automatic AES-256 encrypted safety backup of current data first</strong> (Recommended)
                </label>
              </div>

              {createSafetyBackup && (
                <div className="pt-2 pl-7 space-y-1.5 border-t border-zinc-800/60">
                  <label className="block text-[11px] font-medium text-zinc-300 flex items-center gap-1.5">
                    <Lock className="w-3 h-3 text-emerald-400" />
                    <span>Safety Backup Encryption Password *</span>
                  </label>
                  <input
                    type="password"
                    value={safetyPassword}
                    onChange={(e) => setSafetyPassword(e.target.value)}
                    placeholder="Enter password to encrypt current data"
                    className="w-full bg-zinc-900 text-zinc-200 text-xs px-3 py-1.5 rounded-lg border border-zinc-700 focus:border-emerald-500 focus:outline-none"
                  />
                  <span className="text-[10px] text-zinc-500 block">
                    Your current local database will be downloaded as an encrypted .tjbackup file prior to restore.
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => {
                  setSelectedFile(null);
                  setPreview(null);
                  setSafetyPassword('');
                }}
                className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200"
              >
                Choose Different File
              </button>

              <button
                type="button"
                onClick={handleConfirmRestore}
                disabled={isLoading}
                className="px-5 py-2 text-xs font-semibold rounded-lg bg-emerald-400 hover:bg-emerald-300 text-zinc-950 font-mono transition-colors cursor-pointer"
              >
                {isLoading ? 'Restoring...' : 'Restore This Backup'}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
