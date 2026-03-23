'use client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, Cell,
} from 'recharts';
import { useLang } from '@/lib/i18n';
import type { SimStats } from '@/lib/types';

interface WinLossChartProps {
  simStats: SimStats[];
}

const strategyColors: Record<string, { win: string; loss: string; pending: string }> = {
  COPY_TRADE:    { win: '#4ade80', loss: '#f87171', pending: '#94a3b8' },
  MARKET_MAKER:  { win: '#4ade80', loss: '#f87171', pending: '#94a3b8' },
  SNIPER:        { win: '#4ade80', loss: '#f87171', pending: '#94a3b8' },
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card p-3 text-xs shadow-xl">
      <p className="mb-1.5 font-medium text-foreground">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground">{p.name}</span>
          <span className="font-mono font-semibold" style={{ color: p.color }}>{p.value}</span>
        </div>
      ))}
    </div>
  );
};

export function WinLossChart({ simStats }: WinLossChartProps) {
  const { t } = useLang();

  const strategyLabels: Record<string, string> = {
    COPY_TRADE:   t.strategies.copyTrade.label,
    MARKET_MAKER: t.strategies.marketMaker.label,
    SNIPER:       t.strategies.sniper.label,
  };

  if (simStats.length === 0) return null;

  const data = simStats.map(s => ({
    name: strategyLabels[s.strategyType] || s.strategyType,
    Wins: s.wins,
    Losses: s.losses,
    Pending: Math.max(0, s.totalBuys - s.wins - s.losses),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Wins / Losses <HelpTooltip text="Number of resolved wins, losses and pending positions per strategy." />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data} margin={{ top: 4, right: 8, left: -10, bottom: 4 }} barSize={18} barGap={3}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--secondary))', opacity: 0.5 }} />
            <Legend
              formatter={(value) => (
                <span style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>{value}</span>
              )}
            />
            <Bar dataKey="Wins" fill="#4ade80" radius={[3, 3, 0, 0]} />
            <Bar dataKey="Losses" fill="#f87171" radius={[3, 3, 0, 0]} />
            <Bar dataKey="Pending" fill="#475569" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
