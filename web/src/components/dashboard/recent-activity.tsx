'use client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { formatUSD, truncate, strategyLabel } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { useLang } from '@/lib/i18n';
import type { Trade } from '@/lib/types';

const sideColors = { BUY: 'success', SELL: 'destructive' } as const;

export function RecentActivity({ trades }: { trades: Trade[] }) {
  const { t } = useLang();
  const ra = t.recentActivity;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {ra.title} <HelpTooltip text={ra.help} />
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {trades.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">{ra.noActivity}</p>
        ) : (
          <div className="divide-y divide-border">
            {trades.slice(0, 10).map(trade => (
              <div key={trade.id} className="flex items-center justify-between px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-foreground">{truncate(trade.market, 45)}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(trade.createdAt), { addSuffix: true })}
                    {' · '}
                    {strategyLabel(trade.strategyType)}
                    {trade.isDryRun && ` · ${t.common.simulated}`}
                  </p>
                </div>
                <div className="ml-4 flex items-center gap-2 text-right">
                  <Badge variant={sideColors[trade.side] || 'secondary'} className="shrink-0">
                    {trade.side}
                  </Badge>
                  <div>
                    <p className="font-mono text-sm font-medium">{formatUSD(trade.cost)}</p>
                    <p className="font-mono text-xs text-muted-foreground">@ ${parseFloat(trade.price).toFixed(4)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
