'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getTrades } from '@/lib/api';
import { formatUSD, truncate, strategyLabel } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { useLang } from '@/lib/i18n';

const sideColors = { BUY: 'success', SELL: 'destructive' } as const;
const statusColors = { FILLED: 'success', PENDING: 'warning', CANCELLED: 'secondary', FAILED: 'destructive' } as const;

export default function TradesPage() {
  const [filterStrategy, setFilterStrategy] = useState('ALL');
  const [filterSide, setFilterSide] = useState('ALL');
  const { t } = useLang();
  const tr = t.trades;

  const { data: trades = [], isLoading } = useQuery({
    queryKey: ['trades', filterStrategy, filterSide],
    queryFn: () => getTrades({
      ...(filterStrategy !== 'ALL' && { strategyType: filterStrategy }),
      ...(filterSide !== 'ALL' && { side: filterSide }),
      limit: '200',
    }),
    refetchInterval: 15000,
  });

  return (
    <MainLayout title={tr.title}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={filterStrategy} onValueChange={setFilterStrategy}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t.common.allStrategies}</SelectItem>
              <SelectItem value="COPY_TRADE">{t.strategies.copyTrade.label}</SelectItem>
              <SelectItem value="MARKET_MAKER">{t.strategies.marketMaker.label}</SelectItem>
              <SelectItem value="SNIPER">{t.strategies.sniper.label}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterSide} onValueChange={setFilterSide}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All sides</SelectItem>
              <SelectItem value="BUY">Buy</SelectItem>
              <SelectItem value="SELL">Sell</SelectItem>
            </SelectContent>
          </Select>
          <span className="ml-auto text-sm text-muted-foreground">{trades.length} {tr.title.toLowerCase()}</span>
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <p className="py-12 text-center text-sm text-muted-foreground">{t.common.loading}</p>
            ) : trades.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">{tr.noTrades}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                      <th className="px-4 py-3 font-medium">{tr.market}</th>
                      <th className="px-4 py-3 font-medium">{tr.side}</th>
                      <th className="px-4 py-3 font-medium text-right">{tr.shares}</th>
                      <th className="px-4 py-3 font-medium text-right">{tr.price}</th>
                      <th className="px-4 py-3 font-medium text-right">{tr.cost}</th>
                      <th className="px-4 py-3 font-medium">{tr.status}</th>
                      <th className="px-4 py-3 font-medium">{tr.strategy}</th>
                      <th className="px-4 py-3 font-medium">{tr.time}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {trades.map(trade => (
                      <tr key={trade.id} className="hover:bg-secondary/30 transition-colors">
                        <td className="px-4 py-2.5">
                          <span>{truncate(trade.market, 42)}</span>
                          {trade.isDryRun && <Badge variant="warning" className="ml-2 text-[10px]">{t.common.simulated}</Badge>}
                        </td>
                        <td className="px-4 py-2.5">
                          <Badge variant={sideColors[trade.side as keyof typeof sideColors] || 'secondary'}>{trade.side}</Badge>
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono">{parseFloat(trade.shares).toFixed(2)}</td>
                        <td className="px-4 py-2.5 text-right font-mono">${parseFloat(trade.price).toFixed(4)}</td>
                        <td className="px-4 py-2.5 text-right font-mono">{formatUSD(trade.cost)}</td>
                        <td className="px-4 py-2.5">
                          <Badge variant={statusColors[trade.status as keyof typeof statusColors] || 'secondary'}>{trade.status}</Badge>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">{strategyLabel(trade.strategyType)}</td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(trade.createdAt), { addSuffix: true })}
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
