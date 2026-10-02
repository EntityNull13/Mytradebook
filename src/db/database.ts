import Dexie, { type Table } from 'dexie';
import type {
  Account,
  AccountPhase,
  PropFirmRule,
  Plan,
  PlanGroup,
  Trade,
  Exit,
  TradeReview,
  Setup,
  Transaction,
  Evidence,
  AppSettings,
  MigrationRecord,
} from '../types';

export class TradingJournalDB extends Dexie {
  accounts!: Table<Account, string>;
  accountPhases!: Table<AccountPhase, string>;
  propFirmRules!: Table<PropFirmRule, string>;
  plans!: Table<Plan, string>;
  planGroups!: Table<PlanGroup, string>;
  trades!: Table<Trade, string>;
  exits!: Table<Exit, string>;
  reviews!: Table<TradeReview, string>;
  setups!: Table<Setup, string>;
  transactions!: Table<Transaction, string>;
  evidence!: Table<Evidence, string>;
  settings!: Table<AppSettings, string>;

  constructor() {
    super('UniversalTradingJournalDB');
    this.version(1).stores({
      accounts: 'id, type, status, createdAt',
      accountPhases: 'id, accountId, status',
      propFirmRules: 'id, accountId, phaseId, category',
      plans: 'id, accountId, planGroupId, status, symbol, createdAt',
      planGroups: 'id, symbol, createdAt',
      trades: 'id, planId, accountId, status, createdAt, result',
      exits: 'id, tradeId, executedAt',
      reviews: 'id, tradeId, createdAt',
      setups: 'id, active, name',
      transactions: 'id, accountId, type, date',
      evidence: 'id, type, createdAt',
      settings: 'id',
    });

    this.version(2).stores({
      accounts: 'id, type, status, createdAt',
      accountPhases: 'id, accountId, status',
      propFirmRules: 'id, accountId, phaseId, category',
      plans: 'id, accountId, phaseId, planGroupId, status, symbol, createdAt',
      planGroups: 'id, accountId, symbol, createdAt',
      trades: 'id, planId, accountId, phaseId, status, createdAt, result',
      exits: 'id, tradeId, executedAt',
      reviews: 'id, tradeId, createdAt',
      setups: 'id, active, name',
      transactions: 'id, accountId, type, date',
      evidence: 'id, type, createdAt',
      settings: 'id',
    }).upgrade(async (tx) => {
      // Data integrity migration per Sections 4, 5, 16:
      // 1. Ensure ACTIVE trades have null realizedPnL
      await tx.table('trades').toCollection().modify((trade: Trade) => {
        if (trade.status === 'ACTIVE') {
          trade.realizedPnL = null;
        }
      });
      // 2. Map legacy BEP exitType to OTHER while preserving outcome
      await tx.table('exits').toCollection().modify((exit: Exit) => {
        if ((exit.exitType as string) === 'BEP') {
          exit.exitType = 'OTHER';
        }
      });
    });

    this.version(3).stores({
      accounts: 'id, type, status, createdAt',
      accountPhases: 'id, accountId, status',
      propFirmRules: 'id, accountId, phaseId, ruleType, category',
      plans: 'id, accountId, phaseId, planGroupId, status, symbol, createdAt',
      planGroups: 'id, accountId, symbol, createdAt',
      trades: 'id, planId, accountId, phaseId, status, createdAt, result',
      exits: 'id, tradeId, executedAt',
      reviews: 'id, tradeId, createdAt',
      setups: 'id, active, name',
      transactions: 'id, accountId, type, date',
      evidence: 'id, type, createdAt',
      settings: 'id',
    }).upgrade(async (tx) => {
      // Rule Engine hardening migration:
      // Ensure all existing rules have a valid structured ruleType, defaulting safely to CUSTOM
      await tx.table('propFirmRules').toCollection().modify((rule: PropFirmRule) => {
        if (!rule.ruleType) {
          rule.ruleType = 'CUSTOM';
        }
      });
    });
  }
}

export const db = new TradingJournalDB();

export const DEFAULT_SETTINGS: AppSettings = {
  id: 'app_settings',
  theme: 'light',
  timezone: 'Asia/Jakarta',
  dateFormat: 'YYYY-MM-DD',
  currencyDisplay: 'USD',
  autoBackup: false,
  cloudBackupConnected: false,
  lastBackupAt: undefined,
  lastBackupType: undefined,
};

export async function getSettings(): Promise<AppSettings> {
  const current = await db.settings.get('app_settings');
  if (!current || current.id !== 'app_settings') {
    await db.settings.put(DEFAULT_SETTINGS);
    return DEFAULT_SETTINGS;
  }
  return current as AppSettings;
}

export async function updateSettings(partial: Partial<AppSettings>): Promise<AppSettings> {
  const current = await getSettings();
  const updated = { ...current, ...partial };
  await db.settings.put(updated);
  return updated;
}

export async function getMigrationVersion(): Promise<number> {
  try {
    const record = await (db.settings as any).get('migration_metadata');
    if (record && record.id === 'migration_metadata' && typeof record.demoCleanup === 'number') {
      return record.demoCleanup;
    }
    // Check app_settings as fallback if present
    const appSettings = await db.settings.get('app_settings');
    if (appSettings && typeof appSettings.demoCleanup === 'number') {
      return appSettings.demoCleanup;
    }
    return 0;
  } catch {
    return 0;
  }
}

export async function setMigrationVersion(version: number): Promise<void> {
  const record: MigrationRecord = {
    id: 'migration_metadata',
    demoCleanup: version,
    migratedAt: new Date().toISOString(),
  };
  await (db.settings as any).put(record);
  // Also redundantly save on app_settings
  const appSettings = await db.settings.get('app_settings');
  if (appSettings) {
    appSettings.demoCleanup = version;
    await db.settings.put(appSettings);
  }
}
