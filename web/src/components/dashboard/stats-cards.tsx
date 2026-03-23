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
  isDryRun?: boolean;
}

export function StatsCards({ simStats, positions, tradesCount, isDryRun = true }: StatsCardsProps) {
  const { t } = useLang();
  const totalPnl = simStats.reduce((sum, s) => sum + parseFloat(s.pnl || '0'), 0);
  const totalWins = simStats.reduce((sum, s) => sum + s.wins, 0);
  const totalLosses = simStats.reduce((sum, s) => sum + s.losses, 0);
  const winRate = totalWins + totalLosses > 0 ? (totalWins / (totalWins + totalLosses)) * 100 : 0;
  const openPositions = positions.filter(p => p.status === 'OPEN').length;
  const pnlPositive = totalPnl >= 0;
  const d = t.dashboard;

  const cards = [
    {
      title: d.totalPnl,
      help: d.totalPnlHelp,
      icon: pnlPositive ? TrendingUp : TrendingDown,
      iconColor: pnlPositive ? 'text-green-400' : 'text-red-400',
      iconBg: pnlPositive ? 'bg-green-400/10' : 'bg-red-400/10',
      value: (
        <span className={`stat-value ${pnlPositive ? 'text-green-400' : 'text-red-400'}`}>
          {totalPnl >= 0 ? '+' : ''}{formatUSD(totalPnl)}
        </span>
      ),
      sub: isDryRun ? d.simulatedPnl : '',
      accent: pnlPositive ? 'border-l-green-500/40' : 'border-l-red-500/40',
    },
    {
      title: d.openPositions,
      help: d.openPositionsHelp,
      icon: Briefcase,
      iconColor: 'text-blue-400',
      iconBg: 'bg-blue-400/10',
      value: <span className="stat-value text-foreground">{openPositions}</span>,
      sub: `${positions.length} ${d.totalPositions}`,
      accent: 'border-l-blue-500/40',
    },
    {
      title: d.totalTrades,
      help: d.totalTradesHelp,
      icon: ArrowLeftRight,
      iconColor: 'text-purple-400',
      iconBg: 'bg-purple-400/10',
      value: <span className="stat-value text-foreground">{tradesCount}</span>,
      sub: `${totalWins}W / ${totalLosses}L`,
      accent: 'border-l-purple-500/40',
    },
    {
      title: d.winRate,
      help: d.winRateHelp,
      icon: Target,
      iconColor: winRate >= 50 ? 'text-green-400' : 'text-orange-400',
      iconBg: winRate >= 50 ? 'bg-green-400/10' : 'bg-orange-400/10',
      value: (
        <span className={`stat-value ${winRate >= 50 ? 'text-green-400' : 'text-orange-400'}`}>
          {winRate.toFixed(1)}%
        </span>
      ),
      sub: `${totalWins + totalLosses} ${d.resolvedMarkets}`,
      accent: winRate >= 50 ? 'border-l-green-500/40' : 'border-l-orange-500/40',
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.title} className={`border-l-2 ${card.accent} card-hover`}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  {card.title}
                  <HelpTooltip text={card.help} />
                </span>
                <div className={`rounded-md p-1.5 ${card.iconBg}`}>
                  <Icon className={`h-3.5 w-3.5 ${card.iconColor}`} />
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {card.value}
              <p className="mt-1.5 text-xs text-muted-foreground">{card.sub}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
