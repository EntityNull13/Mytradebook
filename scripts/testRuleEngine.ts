import { evaluateRuleStatus, resolveRuleType, type RuleEvaluationResult } from '../src/calculations';
import type { PropFirmRule, Trade } from '../src/types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ ${message}`);
}

console.log('--- STARTING PROP FIRM RULE ENGINE HARDENING VALIDATION ---\n');

// 1. Changing rule name does NOT change evaluation
{
  const baseRule: PropFirmRule = {
    id: 'r1',
    accountId: 'acc1',
    ruleType: 'DAILY_LOSS_LIMIT',
    category: 'DRAWDOWN',
    ruleName: 'Daily Loss Limit',
    limitValue: 500,
    enabled: true,
  };

  const renamedRule: PropFirmRule = {
    ...baseRule,
    ruleName: 'My Custom Arbitrary Name With No Loss Keywords',
  };

  const todayIso = new Date().toISOString();
  const mockTrades: Trade[] = [
    {
      id: 't1',
      accountId: 'acc1',
      planId: 'p1',
      actualEntry: 1.05,
      actualEntryTime: todayIso,
      actualPositionSize: 1,
      status: 'COMPLETED',
      completedAt: todayIso,
      realizedPnL: -600,
      result: 'LOSS',
      createdAt: todayIso,
      updatedAt: todayIso,
    },
  ];

  const res1 = evaluateRuleStatus(baseRule, mockTrades, 9400, 10000, 'USD');
  const res2 = evaluateRuleStatus(renamedRule, mockTrades, 9400, 10000, 'USD');

  assert(res1.status === 'BREACHED', 'Base rule DAILY_LOSS_LIMIT breached');
  assert(res2.status === 'BREACHED', 'Renamed rule DAILY_LOSS_LIMIT still breached with arbitrary name');
  assert(res1.currentValue === res2.currentValue, 'Current values identical regardless of ruleName');
}

// 2. Rule evaluation uses ruleType
{
  const ruleWithType: PropFirmRule = {
    id: 'r2',
    accountId: 'acc1',
    ruleType: 'MAX_OVERALL_LOSS',
    category: 'DRAWDOWN',
    ruleName: 'Super Random Label',
    limitValue: 1000,
    enabled: true,
  };

  assert(resolveRuleType(ruleWithType) === 'MAX_OVERALL_LOSS', 'resolveRuleType strictly returns ruleType');
}

// 3. DAILY_LOSS_LIMIT evaluates correctly
{
  const rule: PropFirmRule = {
    id: 'r3',
    accountId: 'acc1',
    ruleType: 'DAILY_LOSS_LIMIT',
    category: 'DRAWDOWN',
    ruleName: 'Daily Loss',
    limitValue: 500,
    enabled: true,
  };

  const todayIso = new Date().toISOString();
  const safeTrades: Trade[] = [
    {
      id: 't1',
      accountId: 'acc1',
      planId: 'p1',
      actualEntry: 1.25,
      actualEntryTime: todayIso,
      actualPositionSize: 1,
      status: 'COMPLETED',
      completedAt: todayIso,
      realizedPnL: -200,
      result: 'LOSS',
      createdAt: todayIso,
      updatedAt: todayIso,
    },
  ];

  const safeRes = evaluateRuleStatus(rule, safeTrades, 9800, 10000, 'USD');
  assert(safeRes.status === 'SAFE', 'DAILY_LOSS_LIMIT: -200 loss < 500 limit is SAFE');

  const warningTrades: Trade[] = [
    {
      ...safeTrades[0],
      realizedPnL: -400,
    },
  ];
  const warnRes = evaluateRuleStatus(rule, warningTrades, 9600, 10000, 'USD');
  assert(warnRes.status === 'WARNING', 'DAILY_LOSS_LIMIT: -400 loss >= 375 (75%) is WARNING');

  const breachTrades: Trade[] = [
    {
      ...safeTrades[0],
      realizedPnL: -550,
    },
  ];
  const breachRes = evaluateRuleStatus(rule, breachTrades, 9450, 10000, 'USD');
  assert(breachRes.status === 'BREACHED', 'DAILY_LOSS_LIMIT: -550 loss >= 500 is BREACHED');
}

// 4. MAX_OVERALL_LOSS evaluates correctly
{
  const rule: PropFirmRule = {
    id: 'r4',
    accountId: 'acc1',
    ruleType: 'MAX_OVERALL_LOSS',
    category: 'DRAWDOWN',
    ruleName: 'Max Drawdown',
    limitValue: 1000,
    enabled: true,
  };

  const safeRes = evaluateRuleStatus(rule, [], 9600, 10000, 'USD');
  assert(safeRes.status === 'SAFE', 'MAX_OVERALL_LOSS: 400 loss is SAFE');

  const warnRes = evaluateRuleStatus(rule, [], 9200, 10000, 'USD');
  assert(warnRes.status === 'WARNING', 'MAX_OVERALL_LOSS: 800 loss (>=75%) is WARNING');

  const breachRes = evaluateRuleStatus(rule, [], 8900, 10000, 'USD');
  assert(breachRes.status === 'BREACHED', 'MAX_OVERALL_LOSS: 1100 loss is BREACHED');
}

// 5. TRAILING_DRAWDOWN evaluates correctly
{
  const rule: PropFirmRule = {
    id: 'r5',
    accountId: 'acc1',
    ruleType: 'TRAILING_DRAWDOWN',
    category: 'DRAWDOWN',
    ruleName: 'Trailing Drawdown',
    limitValue: 800,
    enabled: true,
  };

  // Starting 10,000. Trade 1: +1000 (peak = 11,000). Trade 2: -500. Current balance = 10,500.
  // Trailing loss from peak = 11,000 - 10,500 = 500 (< 800 * 0.75 = 600) -> SAFE
  const trades: Trade[] = [
    {
      id: 't1',
      accountId: 'acc1',
      planId: 'p1',
      actualEntry: 50000,
      actualEntryTime: '2026-01-01T10:00:00Z',
      actualPositionSize: 0.1,
      status: 'COMPLETED',
      completedAt: '2026-01-01T10:00:00Z',
      realizedPnL: 1000,
      result: 'PROFIT',
      createdAt: '2026-01-01T10:00:00Z',
      updatedAt: '2026-01-01T10:00:00Z',
    },
    {
      id: 't2',
      accountId: 'acc1',
      planId: 'p1',
      actualEntry: 51000,
      actualEntryTime: '2026-01-02T10:00:00Z',
      actualPositionSize: 0.1,
      status: 'COMPLETED',
      completedAt: '2026-01-02T10:00:00Z',
      realizedPnL: -500,
      result: 'LOSS',
      createdAt: '2026-01-02T10:00:00Z',
      updatedAt: '2026-01-02T10:00:00Z',
    },
  ];

  const safeRes = evaluateRuleStatus(rule, trades, 10500, 10000, 'USD');
  assert(safeRes.status === 'SAFE', 'TRAILING_DRAWDOWN: 500 drop from 11000 peak is SAFE');

  // Trade 3 drops balance to 10,100 (900 drop from 11,000 peak >= 800 limit) -> BREACHED
  const breachRes = evaluateRuleStatus(rule, trades, 10100, 10000, 'USD');
  assert(breachRes.status === 'BREACHED', 'TRAILING_DRAWDOWN: 900 drop from 11000 peak is BREACHED');
}

// 6. PROFIT_TARGET evaluates correctly
{
  const rule: PropFirmRule = {
    id: 'r6',
    accountId: 'acc1',
    ruleType: 'PROFIT_TARGET',
    category: 'ACCOUNT_OBJECTIVE',
    ruleName: 'Target 10%',
    limitValue: 1000,
    enabled: true,
  };

  const progressRes = evaluateRuleStatus(rule, [], 10500, 10000, 'USD');
  assert(progressRes.status === 'SAFE' && !progressRes.achieved, 'PROFIT_TARGET: 500 profit is in progress');

  const achievedRes = evaluateRuleStatus(rule, [], 11200, 10000, 'USD');
  assert(achievedRes.status === 'SAFE' && achievedRes.achieved === true, 'PROFIT_TARGET: 1200 profit is ACHIEVED');
}

// 7. MIN_TRADING_DAYS evaluates correctly
{
  const rule: PropFirmRule = {
    id: 'r7',
    accountId: 'acc1',
    ruleType: 'MIN_TRADING_DAYS',
    category: 'ACCOUNT_OBJECTIVE',
    ruleName: 'Trade at least 3 days',
    limitValue: 3,
    enabled: true,
  };

  const trades: Trade[] = [
    {
      id: 't1',
      accountId: 'acc1',
      planId: 'p1',
      actualEntry: 1.08,
      actualEntryTime: '2026-03-01T12:00:00Z',
      actualPositionSize: 1,
      status: 'COMPLETED',
      completedAt: '2026-03-01T12:00:00Z',
      realizedPnL: 50,
      result: 'PROFIT',
      createdAt: '2026-03-01T12:00:00Z',
      updatedAt: '2026-03-01T12:00:00Z',
    },
    {
      id: 't2',
      accountId: 'acc1',
      planId: 'p1',
      actualEntry: 1.08,
      actualEntryTime: '2026-03-02T12:00:00Z',
      actualPositionSize: 1,
      status: 'COMPLETED',
      completedAt: '2026-03-02T12:00:00Z',
      realizedPnL: -20,
      result: 'LOSS',
      createdAt: '2026-03-02T12:00:00Z',
      updatedAt: '2026-03-02T12:00:00Z',
    },
  ];

  const inProgRes = evaluateRuleStatus(rule, trades, 10030, 10000, 'USD');
  assert(inProgRes.status === 'SAFE' && !inProgRes.achieved, 'MIN_TRADING_DAYS: 2 days is in progress');

  trades.push({
    id: 't3',
    accountId: 'acc1',
    planId: 'p1',
    actualEntry: 1.08,
    actualEntryTime: '2026-03-03T12:00:00Z',
    actualPositionSize: 1,
    status: 'COMPLETED',
    completedAt: '2026-03-03T12:00:00Z',
    realizedPnL: 30,
    result: 'PROFIT',
    createdAt: '2026-03-03T12:00:00Z',
    updatedAt: '2026-03-03T12:00:00Z',
  });

  const achRes = evaluateRuleStatus(rule, trades, 10060, 10000, 'USD');
  assert(achRes.status === 'SAFE' && achRes.achieved === true, 'MIN_TRADING_DAYS: 3 days is ACHIEVED');
}

// 8. Unsupported / descriptive rules return NOT_EVALUABLE instead of fake pass/fail
{
  const unsupportedTypes = [
    'NEWS_RESTRICTION',
    'HOLDING_RESTRICTION',
    'AUTOMATION_RESTRICTION',
    'ACCOUNT_LIFECYCLE',
    'PAYOUT_RESTRICTION',
    'CUSTOM',
  ] as const;

  for (const type of unsupportedTypes) {
    const rule: PropFirmRule = {
      id: `r-${type}`,
      accountId: 'acc1',
      ruleType: type,
      category: 'TRADING_BEHAVIOR',
      ruleName: `Policy for ${type}`,
      enabled: true,
    };

    const res = evaluateRuleStatus(rule, [], 10000, 10000, 'USD');
    assert(
      res.status === 'NOT_EVALUABLE',
      `Rule type ${type} truthfully returns status: NOT_EVALUABLE without fake pass/fail`
    );
  }
}

// 9. Rule answer UX behavior (YES, NO, UNKNOWN)
{
  const noRule: PropFirmRule = {
    id: 'r-no',
    accountId: 'acc1',
    ruleType: 'DAILY_LOSS_LIMIT',
    category: 'DRAWDOWN',
    ruleName: 'Daily Loss',
    answer: 'NO',
    limitValue: 500,
    enabled: false,
  };
  const noRes = evaluateRuleStatus(noRule, [], 9000, 10000, 'USD');
  assert(noRes.status === 'NOT_CONFIGURED', 'Rule answer NO returns NOT_CONFIGURED');

  const unknownRule: PropFirmRule = {
    id: 'r-unknown',
    accountId: 'acc1',
    ruleType: 'DAILY_LOSS_LIMIT',
    category: 'DRAWDOWN',
    ruleName: 'Daily Loss',
    answer: 'UNKNOWN',
    enabled: true,
  };
  const unknownRes = evaluateRuleStatus(unknownRule, [], 9000, 10000, 'USD');
  assert(unknownRes.status === 'UNKNOWN', 'Rule answer UNKNOWN returns UNKNOWN');
}

console.log('\n🌟 ALL 8 RULE ENGINE HARDENING VALIDATION CHECKS PASSED PERFECTLY!\n');
