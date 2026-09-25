import { db, getMigrationVersion, setMigrationVersion } from './database';
import type { Setup } from '../types';
import { seedAccountScopeTestData, purgeAccountScopeTestData } from './dummyScopeData';

/**
 * Version marker for one-time legacy demo data cleanup migration.
 */
export const DEMO_CLEANUP_VERSION = 2;

/**
 * Explicit list of known legacy demo record IDs from the original demo dataset.
 * ONLY these exact IDs may be removed during the one-time migration.
 * No generic property matching (such as symbol, P&L, balance, or ID prefix) is ever permitted.
 */
export const LEGACY_DEMO_TRADE_IDS = [
  'trade-1',
  'trade-2',
  'trade-3',
  'trade-4',
  'trade-5',
  'trade-6',
  'trade-7',
  'trade-8',
  'trade-active-1',
];

export const LEGACY_DEMO_PLAN_IDS = [
  'plan-1',
  'plan-2',
  'plan-3',
  'plan-4',
  'plan-5',
  'plan-6',
  'plan-7',
  'plan-8',
  'plan-active-1',
  'plan-pending-1',
  'plan-pending-2',
];

export const LEGACY_DEMO_EXIT_IDS = [
  'exit-1',
  'exit-2',
  'exit-3',
  'exit-4',
  'exit-5',
  'exit-6',
  'exit-7',
  'exit-8',
];

export const LEGACY_DEMO_REVIEW_IDS = [
  'rev-1',
  'rev-2',
  'rev-3',
  'rev-4',
  'rev-8',
];

export const LEGACY_DEMO_ACCOUNT_IDS = [
  'acc-main-funded',
];

/**
 * One-time migration to purge legacy demo records from IndexedDB.
 * 
 * Safety guarantees:
 * 1. Authoritative migration marker is stored inside Dexie/IndexedDB ('migration_metadata').
 * 2. On subsequent app loads, exits immediately without touching any tables.
 * 3. If browser localStorage is cleared, IndexedDB migration state is preserved and NO deletion occurs.
 * 4. NEVER executes full table clear (db.*.clear()) operations.
 * 5. ONLY deletes exact known legacy IDs using bulkDelete.
 * 6. Preserves all user-created trades, plans, accounts, setups, and transactions.
 */
export async function cleanupDummyTrades(force = false): Promise<void> {
  try {
    // 1. Check if the one-time migration has already completed inside IndexedDB
    const currentVersion = await getMigrationVersion();

    if (!force && currentVersion >= DEMO_CLEANUP_VERSION) {
      // Migration already completed. Never repeat cleanup on future application loads.
      return;
    }

    // 2. Surgically remove ONLY the known legacy demo record IDs.
    // NEVER clear entire tables or delete by symbol/PnL/balance.
    await Promise.all([
      db.trades.bulkDelete(LEGACY_DEMO_TRADE_IDS),
      db.plans.bulkDelete(LEGACY_DEMO_PLAN_IDS),
      db.exits.bulkDelete(LEGACY_DEMO_EXIT_IDS),
      db.reviews.bulkDelete(LEGACY_DEMO_REVIEW_IDS),
      db.accounts.bulkDelete(LEGACY_DEMO_ACCOUNT_IDS),
    ]);

    // If explicitly forced by user action, also purge test scope data (dummy-*)
    if (force) {
      await purgeAccountScopeTestData();
    }

    // 3. Mark migration as permanently completed in IndexedDB
    await setMigrationVersion(DEMO_CLEANUP_VERSION);
  } catch (err) {
    console.warn('Error during demo data cleanup migration:', err);
  }
}

/**
 * Database initialization.
 * Runs one-time migration to ensure clean state and legacy demo records are removed.
 * If database is completely empty (0 accounts), seeds the deterministic Account Scope test dataset.
 */
export async function seedInitialData(): Promise<void> {
  await cleanupDummyTrades();

  const accountsCount = await db.accounts.count();
  if (accountsCount === 0) {
    await seedAccountScopeTestData();
  }
}

/**
 * Explicit strategy tags loader (only adds tags if setups table is empty).
 */
export async function loadSampleData(): Promise<void> {
  const existingSetupsCount = await db.setups.count();
  if (existingSetupsCount === 0) {
    const now = new Date().toISOString();
    const defaultSetups: Setup[] = [
      { id: 'setup-breakout', name: 'Range Breakout & Retest', category: 'TREND', active: true, createdAt: now, updatedAt: now },
      { id: 'setup-liquidity', name: 'Liquidity Sweep (SMC/ICT)', category: 'REVERSAL', active: true, createdAt: now, updatedAt: now },
      { id: 'setup-pullback', name: 'Trend Continuation Pullback', category: 'TREND', active: true, createdAt: now, updatedAt: now },
    ];
    await db.setups.bulkPut(defaultSetups);
  }
}



