import { useState } from 'react';
import { HardDrive, X, ArrowRight } from 'lucide-react';

interface BackupBannerProps {
  onOpenSettingsBackup: () => void;
  lastBackupAt?: string;
}

export function BackupBanner({ onOpenSettingsBackup, lastBackupAt }: BackupBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  // If already backed up recently or dismissed, don't show the initial warning
  if (dismissed || lastBackupAt) return null;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-xs text-amber-900 flex items-center justify-between gap-4 shadow-xs">
      <div className="flex items-center gap-2">
        <HardDrive className="w-4 h-4 text-amber-600 shrink-0" />
        <span>
          <strong className="font-semibold text-amber-950">Local-First Storage:</strong> All data is stored on this device. A portable backup is required for recovery if this device is lost or cleared.
        </span>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={onOpenSettingsBackup}
          className="inline-flex items-center gap-1 font-semibold text-amber-900 hover:text-amber-950 underline decoration-amber-400 hover:decoration-amber-600 transition-colors"
        >
          Backup Now <ArrowRight className="w-3 h-3" />
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="p-1 text-amber-700 hover:text-amber-900 rounded transition-colors"
          title="Dismiss banner"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
