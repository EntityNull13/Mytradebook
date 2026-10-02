import { db, getSettings } from '../db/database';
import type { BackupContainer, BackupManifest } from '../types';

/**
 * ArrayBuffer <-> Base64 helpers
 */
function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Derives AES-GCM Key using PBKDF2 with SHA-256
 */
async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as unknown as ArrayBuffer,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt string payload using AES-GCM
 */
export async function encryptPayload(jsonText: string, password: string): Promise<{
  isEncrypted: true;
  salt: string;
  iv: string;
  ciphertext: string;
}> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);

  const enc = new TextEncoder();
  const encodedData = enc.encode(jsonText);

  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encodedData
  );

  return {
    isEncrypted: true,
    salt: bufferToBase64(salt.buffer),
    iv: bufferToBase64(iv.buffer),
    ciphertext: bufferToBase64(encryptedBuffer),
  };
}

/**
 * Decrypt payload using AES-GCM
 */
export async function decryptPayload(
  payload: { isEncrypted: true; salt: string; iv: string; ciphertext: string },
  password: string
): Promise<string> {
  const salt = new Uint8Array(base64ToBuffer(payload.salt));
  const iv = new Uint8Array(base64ToBuffer(payload.iv));
  const ciphertext = base64ToBuffer(payload.ciphertext);

  const key = await deriveKey(password, salt);

  try {
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    );
    const dec = new TextDecoder();
    return dec.decode(decryptedBuffer);
  } catch {
    throw new Error('Incorrect password or corrupted backup file');
  }
}

/**
 * Collect all data from IndexedDB
 */
export async function collectBackupData(mode: 'QUICK' | 'FULL' = 'FULL'): Promise<BackupContainer> {
  const [
    accounts,
    accountPhases,
    propFirmRules,
    plans,
    planGroups,
    trades,
    exits,
    reviews,
    setups,
    transactions,
    evidence,
    settings,
  ] = await Promise.all([
    db.accounts.toArray(),
    db.accountPhases.toArray(),
    db.propFirmRules.toArray(),
    db.plans.toArray(),
    db.planGroups.toArray(),
    db.trades.toArray(),
    db.exits.toArray(),
    db.reviews.toArray(),
    db.setups.toArray(),
    db.transactions.toArray(),
    mode === 'FULL' ? db.evidence.toArray() : Promise.resolve([]),
    getSettings(),
  ]);

  const manifest: BackupManifest = {
    schemaVersion: 1,
    appVersion: '1.0.0',
    backupVersion: 1,
    createdAt: new Date().toISOString(),
    isEncrypted: false,
    counts: {
      accounts: accounts.length,
      accountPhases: accountPhases.length,
      propFirmRules: propFirmRules.length,
      plans: plans.length,
      planGroups: planGroups.length,
      trades: trades.length,
      exits: exits.length,
      reviews: reviews.length,
      setups: setups.length,
      transactions: transactions.length,
      evidence: evidence.length,
    },
  };

  return {
    manifest,
    database: {
      accounts,
      accountPhases,
      propFirmRules,
      plans,
      planGroups,
      trades,
      exits,
      reviews,
      setups,
      transactions,
    },
    settings,
    evidence: mode === 'FULL' ? evidence : undefined,
  };
}

/**
 * Creates and downloads a .tjbackup file
 * All .tjbackup files are strictly encrypted with AES-256-GCM.
 */
export async function createAndDownloadBackup(options: {
  mode: 'QUICK' | 'FULL';
  password: string;
}): Promise<{ filename: string; size: number }> {
  if (!options?.password || typeof options.password !== 'string' || options.password.trim().length === 0) {
    throw new Error('A non-empty password is required to generate an encrypted .tjbackup file. Use exportRawJson() for unencrypted export.');
  }

  const container = await collectBackupData(options.mode);

  container.manifest.isEncrypted = true;
  const rawJson = JSON.stringify(container);
  const encrypted = await encryptPayload(rawJson, options.password.trim());
  const fileContent = JSON.stringify(encrypted, null, 2);

  // Generate filename: Tradebook-Backup-YYYY-MM-DD-HHmm.tjbackup
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  const datePart = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
  const filename = `Tradebook-Backup-${datePart}.tjbackup`;

  const blob = new Blob([fileContent], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  // Update last backup timestamp
  await db.settings.update('app_settings', {
    lastBackupAt: new Date().toISOString(),
    lastBackupType: 'LOCAL',
  });

  return {
    filename,
    size: blob.size,
  };
}

export async function generateBackup(options: {
  password: string;
  includeEvidence?: boolean;
}): Promise<{ filename: string; size: number }> {
  if (!options?.password || typeof options.password !== 'string' || options.password.trim().length === 0) {
    throw new Error('A non-empty password is required to generate an encrypted .tjbackup file. Use exportRawJson() for unencrypted export.');
  }

  return createAndDownloadBackup({
    mode: options.includeEvidence === false ? 'QUICK' : 'FULL',
    password: options.password.trim(),
  });
}

/**
 * Raw JSON export for debugging/advanced users
 * Generates: Tradebook-Raw-YYYY-MM-DD.json
 */
export async function exportRawJson(): Promise<void> {
  const container = await collectBackupData('FULL');
  const jsonStr = JSON.stringify(container, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  const datePart = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  a.download = `Tradebook-Raw-${datePart}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
