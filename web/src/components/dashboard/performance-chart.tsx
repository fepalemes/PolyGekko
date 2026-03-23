'use client';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { cn } from '@/lib/utils';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { format } from 'date-fns';
import { useLang } from '@/lib/i18n';
import type { PerformanceSample } from '@/lib/types';

const strategyColors: Record<string, string> = {
  COPY_TRADE:   '#60a5fa',
  MARKET_MAKER: '#a78bfa',
  SNIPER:       '#fb923c',
};

interface PerformanceChartProps {
  samples: PerformanceSample[];
}

export function PerformanceChart({ samples }: PerformanceChartProps) {
  const { t } = useLang();
  const pc = t.performanceChart;
  const [hidden, setHidden] = useState<string[]>([]);

  const strategyLabels: Record<string, string> = {
    COPY_TRADE:   t.strategies.copyTrade.label,
    MARKET_MAKER: t.strategies.marketMaker.label,
    SNIPER:       t.strategies.sniper.label,
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
          <p className="py-14 text-center text-sm text-muted-foreground">{pc.noData}</p>
        </CardContent>
      </Card>
    );
  }

  const strategyTypes = Array.from(new Set(samples.map(s => s.strategyType)));

  const chartData = samples.map(s => ({
    time: format(new Date(s.createdAt), 'MM/dd HH:mm'),
    strategy: s.strategyType,
    cumPnl: parseFloat(s.cumulativePnl),
    market: s.market.length > 30 ? s.market.slice(0, 30) + '…' : s.market,
  }));

  const byStrategy: Record<string, typeof chartData> = {};
  for (const st of strategyTypes) {
    byStrategy[st] = chartData.filter(d => d.strategy === st);
  }

  const allTimes = Array.from(new Set(samples.map(s => format(new Date(s.createdAt), 'MM/dd HH:mm'))));
  const mergedData = allTimes.map(time => {
    const row: Record<string, any> = { time };
    for (const st of strategyTypes) {
      const match = byStrategy[st].find(d => d.time === time);
      if (match) row[st] = match.cumPnl;
    }
    return row;
  });

  const toggleSeries = (key: string) => {
    setHidden(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="rounded-lg border border-border bg-card p-3 text-xs shadow-xl">
        <p className="mb-1.5 font-medium text-muted-foreground">{label}</p>
        {payload.map((p: any) => (
          <div key={p.dataKey} className="flex items-center gap-2">
            <span className="h-1.5 w-3 rounded-full" style={{ backgroundColor: p.color }} />
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
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            {pc.title} <HelpTooltip text={pc.help} />
          </CardTitle>
          <div className="flex items-center gap-1.5">
            {strategyTypes.map(st => (
              <button
                key={st}
                onClick={() => toggleSeries(st)}
                className={cn(
                  'flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs transition-all duration-150 cursor-pointer',
                  hidden.includes(st)
                    ? 'border-border/40 text-muted-foreground/40'
                    : 'border-border text-muted-foreground hover:text-foreground',
                )}
              >
                <span className="h-1.5 w-2.5 rounded-full" style={{ backgroundColor: hidden.includes(st) ? '#475569' : strategyColors[st] }} />
                {strategyLabels[st]}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={mergedData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <defs>
              {strategyTypes.map(st => (
                <linearGradient key={st} id={`grad-${st}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={strategyColors[st]} stopOpacity={0.18} />
                  <stop offset="95%" stopColor={strategyColors[st]} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis
              dataKey="time"
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
              tickFormatter={v => `$${v}`}
              tickLine={false}
              axisLine={false}
              width={52}
            />
            <ReferenceLine y={0} stroke="hsl(var(--border))" strokeDasharray="4 4" />
            <Tooltip content={<CustomTooltip />} />
            {strategyTypes.map(st => (
              !hidden.includes(st) && (
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
              )
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
