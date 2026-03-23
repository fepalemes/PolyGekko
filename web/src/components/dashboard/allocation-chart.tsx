'use client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { useLang } from '@/lib/i18n';
import { formatUSD } from '@/lib/utils';
import type { Position } from '@/lib/types';

interface AllocationChartProps {
  positions: Position[];
}

const STRATEGY_COLORS: Record<string, string> = {
  COPY_TRADE:   '#60a5fa',
  MARKET_MAKER: '#a78bfa',
  SNIPER:       '#fb923c',
};

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="rounded-lg border border-border bg-card p-3 text-xs shadow-xl">
      <p className="mb-1 font-medium" style={{ color: d.payload.fill }}>{d.name}</p>
      <p className="text-muted-foreground">Capital: <span className="font-mono text-foreground">{formatUSD(d.value)}</span></p>
      <p className="text-muted-foreground">Share: <span className="font-mono text-foreground">{d.payload.pct}%</span></p>
    </div>
  );
};

const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
  if (percent < 0.08) return null;
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.55;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

export function AllocationChart({ positions }: AllocationChartProps) {
  const { t } = useLang();

  const strategyLabels: Record<string, string> = {
    COPY_TRADE:   t.strategies.copyTrade.label,
    MARKET_MAKER: t.strategies.marketMaker.label,
    SNIPER:       t.strategies.sniper.label,
  };

  const openPositions = positions.filter(p => p.status === 'OPEN' || p.status === 'SELLING');

  const grouped: Record<string, number> = {};
  for (const pos of openPositions) {
    const cost = parseFloat(pos.totalCost || '0');
    grouped[pos.strategyType] = (grouped[pos.strategyType] || 0) + cost;
  }

  const total = Object.values(grouped).reduce((a, b) => a + b, 0);

  if (total === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Capital Allocation <HelpTooltip text="Distribution of open position capital across strategies." />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="py-8 text-center text-sm text-muted-foreground">No open positions</p>
        </CardContent>
      </Card>
    );
  }

  const data = Object.entries(grouped).map(([key, value]) => ({
    name: strategyLabels[key] || key,
    value: parseFloat(value.toFixed(2)),
    fill: STRATEGY_COLORS[key] || '#94a3b8',
    pct: ((value / total) * 100).toFixed(1),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Capital Allocation <HelpTooltip text="Distribution of open position capital across strategies." />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={52}
              outerRadius={80}
              paddingAngle={3}
              dataKey="value"
              labelLine={false}
              label={renderCustomLabel}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} stroke="transparent" />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend
              formatter={(value) => (
                <span style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
