'use client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { formatUSD, truncate, strategyLabel } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { useLang } from '@/lib/i18n';
import type { Trade } from '@/lib/types';
import type { PolyActivity } from '@/lib/api';

const sideColors = { BUY: 'success', SELL: 'destructive' } as const;

interface RecentActivityProps {
  trades: Trade[];
  polyActivity?: PolyActivity[];
  isDryRun?: boolean;
}

export function RecentActivity({ trades, polyActivity = [], isDryRun = true }: RecentActivityProps) {
  const { t } = useLang();
  const ra = t.recentActivity;

  // In live mode, show real Polymarket activity; in sim mode, show local trade records
  if (!isDryRun && polyActivity.length > 0) {
    return (
      <Card className="flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {ra.title} <HelpTooltip text={ra.help} />
            <span className="ml-auto text-xs font-normal text-muted-foreground">Polymarket</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 p-0">
          <div className="divide-y divide-border">
            {polyActivity.slice(0, 10).map((a, i) => {
              const side = a.side as 'BUY' | 'SELL' | '';
              const isRedeem = a.type === 'REDEEM';
              const pnlColor = side === 'SELL' || isRedeem ? 'text-green-400' : 'text-foreground';
              return (
                <div key={`${a.transactionHash ?? i}`} className="flex items-center justify-between px-4 py-2.5 hover:bg-secondary/15">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-foreground">{truncate(a.title, 40)}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(a.timestamp * 1000), { addSuffix: true })}
                      {a.outcome ? ` · ${a.outcome}` : ''}
                    </p>
                  </div>
                  <div className="ml-4 flex items-center gap-2 text-right">
                    {isRedeem ? (
                      <Badge variant="outline" className="shrink-0">REDEEM</Badge>
                    ) : (
                      <Badge variant={sideColors[side as keyof typeof sideColors] ?? 'secondary'} className="shrink-0">
                        {side}
                      </Badge>
                    )}
                    <div>
                      <p className={`font-mono text-sm font-semibold ${pnlColor}`}>{formatUSD(a.usdcSize)}</p>
                      {a.price > 0 && (
                        <p className="font-mono text-xs text-muted-foreground">@ ${a.price.toFixed(2)}</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {ra.title} <HelpTooltip text={ra.help} />
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 p-0">
        {trades.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-muted-foreground">{ra.noActivity}</p>
        ) : (
          <div className="divide-y divide-border">
            {trades.slice(0, 10).map(trade => (
              <div key={trade.id} className="flex items-center justify-between px-4 py-2.5 transition-colors hover:bg-secondary/15">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-foreground">{truncate(trade.market, 40)}</p>
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
                    <p className="font-mono text-sm font-semibold text-foreground">{formatUSD(trade.cost)}</p>
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
