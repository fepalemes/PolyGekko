'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { getPositions, getUnrealizedPnl } from '@/lib/api';
import { formatUSD, formatNumber, truncate, strategyLabel } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { useLang } from '@/lib/i18n';
import { useSimMode } from '@/hooks/use-sim-mode';
import type { PositionStatus } from '@/lib/types';

const statusColors = {
  OPEN:     'success',
  SELLING:  'warning',
  SOLD:     'secondary',
  REDEEMED: 'info',
} as const;

const statusDots: Record<string, string> = {
  OPEN:     'bg-green-400',
  SELLING:  'bg-yellow-400',
  SOLD:     'bg-slate-400',
  REDEEMED: 'bg-blue-400',
};

export default function PositionsPage() {
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterStrategy, setFilterStrategy] = useState('ALL');
  const { t } = useLang();
  const p = t.positions;
  const isDryRun = useSimMode();
  const dryRunStr = String(isDryRun);

  const { data: positions = [], isLoading } = useQuery({
    queryKey: ['positions', filterStatus, filterStrategy, dryRunStr],
    queryFn: () => getPositions({
      ...(filterStatus !== 'ALL' && { status: filterStatus }),
      ...(filterStrategy !== 'ALL' && { strategyType: filterStrategy }),
      isDryRun: dryRunStr,
    }),
    refetchInterval: 10000,
  });

  const { data: unrealizedPnlMap = {} } = useQuery({
    queryKey: ['unrealized-pnl', dryRunStr],
    queryFn: async () => {
      const data = await getUnrealizedPnl(dryRunStr);
      return Object.fromEntries(data.map(d => [d.positionId, d]));
    },
    refetchInterval: 30000,
    enabled: filterStatus === 'ALL' || filterStatus === 'OPEN',
  });

  const openCount    = positions.filter(pos => pos.status === 'OPEN').length;
  const sellingCount = positions.filter(pos => pos.status === 'SELLING').length;
  const soldCount    = positions.filter(pos => pos.status === 'SOLD').length;
  const totalCost    = positions.reduce((sum, pos) => sum + parseFloat(pos.totalCost || '0'), 0);

  return (
    <MainLayout title={p.title}>
      <div className="space-y-4">
        {/* Filter bar + summary */}
        <div className="flex flex-wrap items-center gap-2">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t.common.allStatuses}</SelectItem>
              <SelectItem value="OPEN">Open</SelectItem>
              <SelectItem value="SELLING">Selling</SelectItem>
              <SelectItem value="SOLD">Sold</SelectItem>
              <SelectItem value="REDEEMED">Redeemed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterStrategy} onValueChange={setFilterStrategy}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t.common.allStrategies}</SelectItem>
              <SelectItem value="COPY_TRADE">{t.strategies.copyTrade.label}</SelectItem>
              <SelectItem value="MARKET_MAKER">{t.strategies.marketMaker.label}</SelectItem>
              <SelectItem value="SNIPER">{t.strategies.sniper.label}</SelectItem>
            </SelectContent>
          </Select>

          <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
            {openCount > 0 && (
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
                {openCount} open
              </span>
            )}
            {sellingCount > 0 && (
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-yellow-400" />
                {sellingCount} selling
              </span>
            )}
            {soldCount > 0 && (
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                {soldCount} sold
              </span>
            )}
            {totalCost > 0 && (
              <span className="font-mono text-foreground">{formatUSD(totalCost)} total</span>
            )}
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="space-y-0 divide-y divide-border">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 px-4 py-3">
                    <div className="h-3 w-2/5 animate-pulse rounded bg-secondary" />
                    <div className="h-3 w-1/5 animate-pulse rounded bg-secondary" />
                    <div className="ml-auto h-3 w-1/6 animate-pulse rounded bg-secondary" />
                  </div>
                ))}
              </div>
            ) : positions.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">{p.noPositions}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10 bg-card">
                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                      <th className="px-4 py-3 font-medium">{p.market}</th>
                      <th className="px-4 py-3 font-medium">{p.outcome}</th>
                      <th className="px-4 py-3 font-medium text-right">{p.shares}</th>
                      <th className="px-4 py-3 font-medium text-right">{p.avgPrice}</th>
                      <th className="px-4 py-3 font-medium text-right">{p.totalCost}</th>
                      <th className="px-4 py-3 font-medium">
                        <span className="flex items-center gap-1">{p.status} <HelpTooltip text={p.statusHelp} /></span>
                      </th>
                      <th className="px-4 py-3 font-medium text-right">
                        <span className="flex items-center justify-end gap-1">{p.pnl} <HelpTooltip text={p.pnlHelp} /></span>
                      </th>
                      <th className="px-4 py-3 font-medium">{p.strategy}</th>
                      <th className="px-4 py-3 font-medium">{p.age}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {positions.map(pos => (
                      <tr key={pos.id} className="transition-colors hover:bg-secondary/20">
                        <td className="px-4 py-2.5">
                          <span className="text-foreground">{truncate(pos.market, 42)}</span>
                          {pos.isDryRun && <Badge variant="warning" className="ml-2 text-[10px]">{t.common.simulated}</Badge>}
                        </td>
                        <td className="px-4 py-2.5">
                          <Badge variant={pos.outcome === 'YES' ? 'success' : 'destructive'}>{pos.outcome}</Badge>
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono">{formatNumber(pos.shares)}</td>
                        <td className="px-4 py-2.5 text-right font-mono">${formatNumber(pos.avgBuyPrice, 4)}</td>
                        <td className="px-4 py-2.5 text-right font-mono">{formatUSD(pos.totalCost)}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <span className={`h-1.5 w-1.5 rounded-full ${statusDots[pos.status] || 'bg-slate-400'}`} />
                            <Badge variant={statusColors[pos.status as PositionStatus] || 'secondary'}>{pos.status}</Badge>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-xs">
                          {pos.resolvedPnl != null ? (
                            <span className={parseFloat(pos.resolvedPnl) >= 0 ? 'text-green-400' : 'text-red-400'}>
                              {parseFloat(pos.resolvedPnl) >= 0 ? '+' : ''}{formatUSD(pos.resolvedPnl)}
                            </span>
                          ) : pos.status === 'OPEN' && unrealizedPnlMap[pos.id] ? (
                            <span className={`${(unrealizedPnlMap[pos.id].unrealizedPnl ?? 0) >= 0 ? 'text-green-400/70' : 'text-red-400/70'} italic`}
                              title={`Live price: $${(unrealizedPnlMap[pos.id].currentPrice ?? 0).toFixed(4)} · Value: $${(unrealizedPnlMap[pos.id].currentValue ?? 0).toFixed(2)}`}>
                              {(unrealizedPnlMap[pos.id].unrealizedPnl ?? 0) >= 0 ? '+' : ''}
                              {formatUSD(unrealizedPnlMap[pos.id].unrealizedPnl ?? 0)}
                              <span className="ml-1 text-[10px] opacity-60">~</span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground">–</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">{strategyLabel(pos.strategyType)}</td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(pos.createdAt), { addSuffix: true })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
