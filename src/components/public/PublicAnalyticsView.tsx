import { useMemo } from 'react';
import {
  BarChart3,
  TrendingUp,
  Percent,
  Award,
  DollarSign,
  ShieldAlert,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import type { PublishedJournal } from '../../types/public';
import { formatMoney } from '../../calculations';

interface PublicAnalyticsViewProps {
  journal: PublishedJournal;
  selectedAccountId: string;
}

export function PublicAnalyticsView({ journal, selectedAccountId }: PublicAnalyticsViewProps) {
  const { analytics, trades, accounts } = journal;

  const currency = accounts[0]?.currency || 'USD';

  // Filter trades by account
  const filteredTrades = useMemo(() => {
    return trades
      .filter((t) => {
        if (selectedAccountId !== 'ALL' && t.accountId !== selectedAccountId) return false;
        return t.status === 'COMPLETED';
      })
      .sort((a, b) => new Date(a.actualEntryTime).getTime() - new Date(b.actualEntryTime).getTime());
  }, [trades, selectedAccountId]);

  // Generate cumulative equity curve
  const equityCurveData = useMemo(() => {
    let runningPnL = 0;
    const points: Array<{ index: number; date: string; pnl: number; net: number }> = [
      { index: 0, date: 'Start', pnl: 0, net: 0 },
    ];

    filteredTrades.forEach((t, i) => {
      runningPnL += t.realizedPnL || 0;
      points.push({
        index: i + 1,
        date: new Date(t.actualEntryTime).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' }),
        pnl: t.realizedPnL || 0,
        net: runningPnL,
      });
    });

    return points;
  }, [filteredTrades]);

  // Setup performance aggregation
  const setupPerformance = useMemo(() => {
    const map = new Map<string, { count: number; wins: number; pnl: number }>();

    for (const trade of filteredTrades) {
      const name = trade.setupName || 'Standard Setup';
      const existing = map.get(name) || { count: 0, wins: 0, pnl: 0 };
      existing.count += 1;
      if ((trade.realizedPnL || 0) > 0) existing.wins += 1;
      existing.pnl += trade.realizedPnL || 0;
      map.set(name, existing);
    }

    return Array.from(map.entries()).map(([name, data]) => ({
      name,
      count: data.count,
      winRate: (data.wins / data.count) * 100,
      pnl: data.pnl,
    }));
  }, [filteredTrades]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800">
        <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-zinc-400" />
          <span>Performance Analytics</span>
        </h2>
        <p className="text-xs text-zinc-400 mt-0.5">
          Mathematical equity growth, risk ratios, and setup efficiency.
        </p>
      </div>

      {/* Equity Curve Chart */}
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4 sm:p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              Cumulative Realized P&L Growth
            </h3>
            <span
              className={`text-lg font-bold font-mono ${
                analytics.netPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {analytics.netPnL >= 0 ? '+' : ''}
              {formatMoney(analytics.netPnL, currency)}
            </span>
          </div>
        </div>

        <div className="h-64 sm:h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={equityCurveData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="pnlGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis
                dataKey="date"
                stroke="#71717a"
                tick={{ fontSize: 10 }}
                tickLine={false}
              />
              <YAxis
                stroke="#71717a"
                tick={{ fontSize: 10 }}
                tickLine={false}
                tickFormatter={(val) => `$${val}`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#18181b',
                  borderColor: '#27272a',
                  borderRadius: '0.75rem',
                  fontSize: '12px',
                }}
                formatter={(val) => [
                  typeof val === 'number' ? formatMoney(val, currency) : String(val ?? ''),
                  'Cumulative P&L',
                ]}
              />
              <Area
                type="monotone"
                dataKey="net"
                stroke="#10b981"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#pnlGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Analytics Statistics Bento Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800">
          <span className="text-[10px] text-zinc-500 uppercase font-mono block">Win Rate</span>
          <div className="text-base font-bold font-mono text-zinc-100 mt-1">
            {analytics.winRate.toFixed(1)}%
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800">
          <span className="text-[10px] text-zinc-500 uppercase font-mono block">Profit Factor</span>
          <div className="text-base font-bold font-mono text-zinc-100 mt-1">
            {analytics.profitFactor ? analytics.profitFactor.toFixed(2) : '-'}
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800">
          <span className="text-[10px] text-zinc-500 uppercase font-mono block">Average Win</span>
          <div className="text-base font-bold font-mono text-emerald-400 mt-1">
            +{formatMoney(analytics.averageWin || 0, currency)}
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800">
          <span className="text-[10px] text-zinc-500 uppercase font-mono block">Average Loss</span>
          <div className="text-base font-bold font-mono text-rose-400 mt-1">
            -{formatMoney(Math.abs(analytics.averageLoss || 0), currency)}
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800">
          <span className="text-[10px] text-zinc-500 uppercase font-mono block">Expectancy</span>
          <div className="text-base font-bold font-mono text-zinc-100 mt-1">
            {analytics.expectancy >= 0 ? '+' : ''}
            {formatMoney(analytics.expectancy, currency)}
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800">
          <span className="text-[10px] text-zinc-500 uppercase font-mono block">Max Drawdown</span>
          <div className="text-base font-bold font-mono text-rose-400 mt-1">
            {analytics.maxDrawdown ? analytics.maxDrawdown.toFixed(1) : 0}%
          </div>
        </div>
      </div>

      {/* Setup Breakdown Table */}
      {setupPerformance.length > 0 && (
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4 sm:p-5 shadow-xs">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3">
            Strategy & Setup Performance
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-500 font-mono text-[10px] uppercase">
                  <th className="pb-2.5 font-medium">Setup Name</th>
                  <th className="pb-2.5 font-medium text-center">Trades</th>
                  <th className="pb-2.5 font-medium text-center">Win Rate</th>
                  <th className="pb-2.5 font-medium text-right">Net P&L</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 font-mono">
                {setupPerformance.map((s) => (
                  <tr key={s.name} className="hover:bg-zinc-850/50">
                    <td className="py-2.5 font-sans font-medium text-zinc-200">{s.name}</td>
                    <td className="py-2.5 text-center text-zinc-400">{s.count}</td>
                    <td className="py-2.5 text-center text-zinc-300">{s.winRate.toFixed(1)}%</td>
                    <td
                      className={`py-2.5 text-right font-bold ${
                        s.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {s.pnl >= 0 ? '+' : ''}
                      {formatMoney(s.pnl, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
