import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Briefcase, ArrowLeftRight, Target } from 'lucide-react';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { formatUSD } from '@/lib/utils';
import { useLang } from '@/lib/i18n';
import type { SimStats, Position } from '@/lib/types';

interface StatsCardsProps {
  simStats: SimStats[];
  positions: Position[];
  tradesCount: number;
}

export function StatsCards({ simStats, positions, tradesCount }: StatsCardsProps) {
  const { t } = useLang();
  const totalPnl = simStats.reduce((sum, s) => sum + parseFloat(s.pnl || '0'), 0);
  const totalWins = simStats.reduce((sum, s) => sum + s.wins, 0);
  const totalLosses = simStats.reduce((sum, s) => sum + s.losses, 0);
  const winRate = totalWins + totalLosses > 0 ? (totalWins / (totalWins + totalLosses)) * 100 : 0;
  const openPositions = positions.filter(p => p.status === 'OPEN').length;
  const pnlPositive = totalPnl >= 0;
  const d = t.dashboard;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-sm font-medium text-muted-foreground">
            <span className="flex items-center gap-1.5">{d.totalPnl} <HelpTooltip text={d.totalPnlHelp} /></span>
            {pnlPositive ? <TrendingUp className="h-4 w-4 text-green-400" /> : <TrendingDown className="h-4 w-4 text-red-400" />}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`font-mono text-2xl font-bold ${pnlPositive ? 'text-green-400' : 'text-red-400'}`}>
            {totalPnl >= 0 ? '+' : ''}{formatUSD(totalPnl)}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{d.simulatedPnl}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-sm font-medium text-muted-foreground">
            <span className="flex items-center gap-1.5">{d.openPositions} <HelpTooltip text={d.openPositionsHelp} /></span>
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="font-mono text-2xl font-bold text-foreground">{openPositions}</div>
          <p className="mt-1 text-xs text-muted-foreground">{positions.length} {d.totalPositions}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-sm font-medium text-muted-foreground">
            <span className="flex items-center gap-1.5">{d.totalTrades} <HelpTooltip text={d.totalTradesHelp} /></span>
            <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="font-mono text-2xl font-bold text-foreground">{tradesCount}</div>
          <p className="mt-1 text-xs text-muted-foreground">{totalWins}W / {totalLosses}L</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-sm font-medium text-muted-foreground">
            <span className="flex items-center gap-1.5">{d.winRate} <HelpTooltip text={d.winRateHelp} /></span>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`font-mono text-2xl font-bold ${winRate >= 50 ? 'text-green-400' : 'text-red-400'}`}>
            {winRate.toFixed(1)}%
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{totalWins + totalLosses} {d.resolvedMarkets}</p>
        </CardContent>
      </Card>
    </div>
  );
}
