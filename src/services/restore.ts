import { db } from '../db/database';
import { decryptPayload, createAndDownloadBackup } from './backup';
import type { BackupContainer, BackupManifest } from '../types';

export interface RestorePreview {
  isEncrypted: boolean;
  manifest: BackupManifest;
  parsedContainer: BackupContainer;
}

/**
 * Inspects a backup file and returns either decryption requirement or the manifest preview
 */
export async function parseBackupFile(file: File, password?: string): Promise<{
  needsPassword: boolean;
  preview?: RestorePreview;
  error?: string;
}> {
  try {
    const text = await file.text();
    const rawObj = JSON.parse(text);

    // Check if it's an encrypted container
    if (rawObj.isEncrypted && rawObj.ciphertext && rawObj.salt && rawObj.iv) {
      if (!password) {
        return { needsPassword: true };
      }
      try {
        const decryptedText = await decryptPayload(rawObj, password);
        const container: BackupContainer = JSON.parse(decryptedText);
        validateBackupSchema(container);
        return {
          needsPassword: false,
          preview: {
            isEncrypted: true,
            manifest: container.manifest,
            parsedContainer: container,
          },
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to decrypt backup file';
        return { needsPassword: true, error: message };
      }
    }

    // Unencrypted container
    const container: BackupContainer = rawObj;
    validateBackupSchema(container);

    return {
      needsPassword: false,
      preview: {
        isEncrypted: false,
        manifest: container.manifest,
        parsedContainer: container,
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Invalid .tjbackup format';
    return { needsPassword: false, error: message };
  }
}

/**
 * Validates schema version and critical structures
 */
export function validateBackupSchema(container: BackupContainer) {
  if (!container.manifest) {
    throw new Error('Missing backup manifest');
  }
  if (!container.database) {
    throw new Error('Missing database tables in backup');
  }
  if (container.manifest.schemaVersion > 1) {
    throw new Error(`Unsupported schema version: ${container.manifest.schemaVersion}`);
  }
}

/**
 * Performs encrypted safety backup before restore, then restores all data
 */
export async function executeRestore(
  container: BackupContainer,
  createSafetyBackup = true,
  safetyBackupPassword?: string
): Promise<{ success: boolean; safetyBackupCreated: boolean }> {
  let safetyBackupCreated = false;

  if (createSafetyBackup) {
    if (!safetyBackupPassword || !safetyBackupPassword.trim()) {
      throw new Error('AES-256-GCM encryption password is required for safety backup');
    }
    await createAndDownloadBackup({ mode: 'FULL', password: safetyBackupPassword.trim() });
    safetyBackupCreated = true;
  }

  // Atomically wipe and restore
  await db.transaction('rw', [
    db.accounts,
    db.accountPhases,
    db.propFirmRules,
    db.plans,
    db.planGroups,
    db.trades,
    db.exits,
    db.reviews,
    db.setups,
    db.transactions,
    db.evidence,
    db.settings,
  ], async () => {
    await db.accounts.clear();
    await db.accountPhases.clear();
    await db.propFirmRules.clear();
    await db.plans.clear();
    await db.planGroups.clear();
    await db.trades.clear();
    await db.exits.clear();
    await db.reviews.clear();
    await db.setups.clear();
    await db.transactions.clear();
    await db.evidence.clear();

    const d = container.database;
    if (d.accounts?.length) await db.accounts.bulkAdd(d.accounts);
    if (d.accountPhases?.length) await db.accountPhases.bulkAdd(d.accountPhases);
    if (d.propFirmRules?.length) await db.propFirmRules.bulkAdd(d.propFirmRules);
    if (d.plans?.length) await db.plans.bulkAdd(d.plans);
    if (d.planGroups?.length) await db.planGroups.bulkAdd(d.planGroups);
    if (d.trades?.length) await db.trades.bulkAdd(d.trades);
    if (d.exits?.length) await db.exits.bulkAdd(d.exits);
    if (d.reviews?.length) await db.reviews.bulkAdd(d.reviews);
    if (d.setups?.length) await db.setups.bulkAdd(d.setups);
    if (d.transactions?.length) await db.transactions.bulkAdd(d.transactions);
    if (container.evidence?.length) await db.evidence.bulkAdd(container.evidence);

    if (container.settings) {
      await db.settings.put(container.settings);
    }
  });

  return { success: true, safetyBackupCreated };
}
