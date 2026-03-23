'use client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { format } from 'date-fns';
import { useLang } from '@/lib/i18n';
import type { PerformanceSample } from '@/lib/types';

const strategyColors: Record<string, string> = {
  COPY_TRADE: '#60a5fa',
  MARKET_MAKER: '#a78bfa',
  SNIPER: '#fb923c',
};

interface PerformanceChartProps {
  samples: PerformanceSample[];
}

export function PerformanceChart({ samples }: PerformanceChartProps) {
  const { t } = useLang();
  const pc = t.performanceChart;

  const strategyLabels: Record<string, string> = {
    COPY_TRADE: t.strategies.copyTrade.label,
    MARKET_MAKER: t.strategies.marketMaker.label,
    SNIPER: t.strategies.sniper.label,
  };

  if (samples.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {pc.title} <HelpTooltip text={pc.help} />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="py-12 text-center text-sm text-muted-foreground">{pc.noData}</p>
        </CardContent>
      </Card>
    );
  }

  const strategyTypes = [...new Set(samples.map(s => s.strategyType))];

  const chartData = samples.map(s => ({
    time: format(new Date(s.createdAt), 'MM/dd HH:mm'),
    strategy: s.strategyType,
    cumPnl: parseFloat(s.cumulativePnl),
    delta: parseFloat(s.pnlDelta),
    outcome: s.outcome,
    market: s.market.length > 30 ? s.market.slice(0, 30) + '…' : s.market,
  }));

  const byStrategy: Record<string, typeof chartData> = {};
  for (const st of strategyTypes) {
    byStrategy[st] = chartData.filter(d => d.strategy === st);
  }

  const allTimes = [...new Set(samples.map(s => format(new Date(s.createdAt), 'MM/dd HH:mm')))];
  const mergedData = allTimes.map(time => {
    const row: Record<string, any> = { time };
    for (const st of strategyTypes) {
      const match = byStrategy[st].find(d => d.time === time);
      if (match) row[st] = match.cumPnl;
    }
    return row;
  });

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="rounded-lg border border-border bg-card p-3 text-xs shadow-xl">
        <p className="mb-1 font-medium text-muted-foreground">{label}</p>
        {payload.map((p: any) => (
          <div key={p.dataKey} className="flex items-center gap-2">
            <span style={{ color: p.color }}>■</span>
            <span className="text-muted-foreground">{strategyLabels[p.dataKey] || p.dataKey}:</span>
            <span className={`font-mono font-semibold ${p.value >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {p.value >= 0 ? '+' : ''}${p.value.toFixed(2)}
            </span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {pc.title} <HelpTooltip text={pc.help} />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={mergedData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <defs>
              {strategyTypes.map(st => (
                <linearGradient key={st} id={`grad-${st}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={strategyColors[st]} stopOpacity={0.15} />
                  <stop offset="95%" stopColor={strategyColors[st]} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="time"
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
              tickFormatter={v => `$${v}`}
              tickLine={false}
            />
            <ReferenceLine y={0} stroke="hsl(var(--border))" strokeDasharray="4 4" />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              formatter={(value) => (
                <span style={{ color: strategyColors[value], fontSize: 12 }}>
                  {strategyLabels[value] || value}
                </span>
              )}
            />
            {strategyTypes.map(st => (
              <Area
                key={st}
                type="monotone"
                dataKey={st}
                name={st}
                stroke={strategyColors[st]}
                fill={`url(#grad-${st})`}
                strokeWidth={2}
                dot={false}
                connectNulls
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
