'use client';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { RotateCcw, Loader2, TrendingUp, TrendingDown } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { resetSimStats } from '@/lib/api';
import { toast } from '@/components/ui/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useLang } from '@/lib/i18n';
import { formatUSD } from '@/lib/utils';
import type { SimStats } from '@/lib/types';

const strategyColors: Record<string, string> = {
  COPY_TRADE:   'text-blue-400',
  MARKET_MAKER: 'text-purple-400',
  SNIPER:       'text-orange-400',
};

const strategyBg: Record<string, string> = {
  COPY_TRADE:   'bg-blue-400/5 border-blue-400/15',
  MARKET_MAKER: 'bg-purple-400/5 border-purple-400/15',
  SNIPER:       'bg-orange-400/5 border-orange-400/15',
};

function WinRateDonut({ wins, losses }: { wins: number; losses: number }) {
  const total = wins + losses;
  if (total === 0) {
    return <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-border text-xs text-muted-foreground">–</div>;
  }
  const data = [
    { value: wins, fill: '#4ade80' },
    { value: losses, fill: '#f87171' },
  ];
  const pct = Math.round((wins / total) * 100);
  return (
    <div className="relative h-14 w-14">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={18} outerRadius={26} dataKey="value" strokeWidth={0} startAngle={90} endAngle={-270}>
            {data.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <span className="absolute inset-0 flex items-center justify-center font-mono text-[10px] font-bold text-foreground">
        {pct}%
      </span>
    </div>
  );
}

function StatRow({ label, help, value }: { label: string; help?: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        {label}
        {help && <HelpTooltip text={help} />}
      </span>
      <span className="text-xs font-medium">{value}</span>
    </div>
  );
}

function StrategyStatsCard({ stats }: { stats: SimStats }) {
  const [resetting, setResetting] = useState(false);
  const qc = useQueryClient();
  const { t } = useLang();
  const s = t.simStats;

  const strategyLabels: Record<string, string> = {
    COPY_TRADE:   t.strategies.copyTrade.label,
    MARKET_MAKER: t.strategies.marketMaker.label,
    SNIPER:       t.strategies.sniper.label,
  };

  const pnl = parseFloat(stats.pnl);
  const total = stats.wins + stats.losses;
  const winRate = total > 0 ? (stats.wins / total) * 100 : 0;
  const avgPnl = total > 0 ? pnl / total : 0;
  const pnlPositive = pnl >= 0;

  const handleReset = async () => {
    setResetting(true);
    try {
      await resetSimStats(stats.strategyType);
      qc.invalidateQueries({ queryKey: ['sim-stats'] });
      qc.invalidateQueries({ queryKey: ['performance'] });
      toast({ title: `${strategyLabels[stats.strategyType]} ${t.common.reset.toLowerCase()}` });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className={`rounded-lg border p-4 ${strategyBg[stats.strategyType] || 'border-border'}`}>
      <div className="mb-3 flex items-start justify-between">
        <div>
          <span className={`text-sm font-semibold ${strategyColors[stats.strategyType]}`}>
            {strategyLabels[stats.strategyType] || stats.strategyType}
          </span>
          <div className="mt-1.5 flex items-center gap-1.5">
            {pnlPositive
              ? <TrendingUp className="h-4 w-4 text-green-400" />
              : <TrendingDown className="h-4 w-4 text-red-400" />}
            <span className={`font-mono text-xl font-bold ${pnlPositive ? 'text-green-400' : 'text-red-400'}`}>
              {pnl >= 0 ? '+' : ''}{formatUSD(pnl)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <WinRateDonut wins={stats.wins} losses={stats.losses} />
          <Button variant="ghost" size="icon" onClick={handleReset} disabled={resetting} className="h-6 w-6 cursor-pointer" title={t.common.reset}>
            {resetting ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
          </Button>
        </div>
      </div>

      <div className="space-y-0.5 divide-y divide-border/40">
        <StatRow label={s.totalBuys} help={s.totalBuysHelp} value={stats.totalBuys} />
        <StatRow
          label={s.winLoss}
          help={s.winLossHelp}
          value={
            <span>
              <span className="text-green-400">{stats.wins}W</span>
              {' / '}
              <span className="text-red-400">{stats.losses}L</span>
            </span>
          }
        />
        <StatRow
          label={s.winRate}
          help={s.winRateHelp}
          value={
            <Badge variant={winRate >= 50 ? 'success' : 'destructive'} className="text-[10px]">
              {winRate.toFixed(1)}%
            </Badge>
          }
        />
        <StatRow
          label={s.avgPnl}
          help={s.avgPnlHelp}
          value={
            <span className={`font-mono ${avgPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {avgPnl >= 0 ? '+' : ''}{formatUSD(avgPnl)}
            </span>
          }
        />
        <StatRow
          label={s.pending}
          help={s.pendingHelp}
          value={stats.totalBuys - stats.wins - stats.losses}
        />
      </div>
    </div>
  );
}

export function SimStatsPanel({ simStats }: { simStats: SimStats[] }) {
  const { t } = useLang();
  const s = t.simStats;

  if (simStats.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {s.title}
          <HelpTooltip text={s.help} />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-3">
          {simStats.map(stat => (
            <StrategyStatsCard key={stat.strategyType} stats={stat} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
