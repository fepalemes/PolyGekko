'use client';
import { useState } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { Badge } from '@/components/ui/badge';
import { runBacktest } from '@/lib/api';
import { formatUSD } from '@/lib/utils';
import { useLang } from '@/lib/i18n';
import { toast } from '@/components/ui/use-toast';
import { Loader2, Play, TrendingUp, TrendingDown } from 'lucide-react';

export default function BacktestPage() {
  const { t } = useLang();
  const b = t.backtest;
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [form, setForm] = useState({
    strategyType: 'ALL',
    stopLossPercent: '0',
    takeProfitPercent: '0',
    positionSizeUsdc: '0',
    isDryRun: true,
  });

  const set = (key: string, value: any) => setForm(f => ({ ...f, [key]: value }));

  const run = async () => {
    setRunning(true);
    setResult(null);
    try {
      const res = await runBacktest({
        ...(form.strategyType !== 'ALL' && { strategyType: form.strategyType }),
        stopLossPercent: parseFloat(form.stopLossPercent) || 0,
        takeProfitPercent: parseFloat(form.takeProfitPercent) || 0,
        positionSizeUsdc: parseFloat(form.positionSizeUsdc) || 0,
        isDryRun: form.isDryRun,
      });
      setResult(res);
      if (res.totalPositions === 0) {
        toast({ title: b.noData, variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setRunning(false);
    }
  };

  return (
    <MainLayout title={b.title}>
      <div className="mx-auto max-w-2xl space-y-5">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              {b.title}
              <HelpTooltip text={b.help} />
            </CardTitle>
            <p className="text-xs text-muted-foreground leading-relaxed">{b.description}</p>
          </CardHeader>
          <CardContent className="space-y-5">

            {/* Strategy + Mode */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{b.strategy}</Label>
                <Select value={form.strategyType} onValueChange={v => set('strategyType', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">{t.common.allStrategies}</SelectItem>
                    <SelectItem value="COPY_TRADE">{t.strategies.copyTrade.label}</SelectItem>
                    <SelectItem value="MARKET_MAKER">{t.strategies.marketMaker.label}</SelectItem>
                    <SelectItem value="SNIPER">{t.strategies.sniper.label}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <span className="text-sm">{b.useDryRunData}</span>
                <Switch checked={form.isDryRun} onCheckedChange={v => set('isDryRun', v)} />
              </div>
            </div>

            {/* Parameters */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="sl" className="flex items-center gap-1.5">
                  {b.stopLoss} <HelpTooltip text={b.stopLossHelp} />
                </Label>
                <Input id="sl" type="number" min="0" max="99" placeholder="0"
                  value={form.stopLossPercent}
                  onChange={e => set('stopLossPercent', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tp" className="flex items-center gap-1.5">
                  {b.takeProfit} <HelpTooltip text={b.takeProfitHelp} />
                </Label>
                <Input id="tp" type="number" min="0" placeholder="0"
                  value={form.takeProfitPercent}
                  onChange={e => set('takeProfitPercent', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="size" className="flex items-center gap-1.5">
                  {b.positionSize} <HelpTooltip text={b.positionSizeHelp} />
                </Label>
                <Input id="size" type="number" min="0" placeholder="0 = original"
                  value={form.positionSizeUsdc}
                  onChange={e => set('positionSizeUsdc', e.target.value)} />
              </div>
            </div>

            <Button onClick={run} disabled={running} className="w-full">
              {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
              {b.run}
            </Button>
          </CardContent>
        </Card>

        {/* Results */}
        {result && result.totalPositions > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                {b.results}
                <Badge variant={result.totalPnl >= 0 ? 'success' : 'destructive'} className="ml-2">
                  {result.totalPnl >= 0 ? <TrendingUp className="mr-1 h-3 w-3" /> : <TrendingDown className="mr-1 h-3 w-3" />}
                  {result.totalPnl >= 0 ? '+' : ''}{formatUSD(result.totalPnl)}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { label: b.totalTrades, value: result.totalPositions },
                  { label: b.winRate, value: `${result.winRate}%`, sub: `${result.wins}W / ${result.losses}L` },
                  { label: b.avgPnl, value: formatUSD(result.avgPnlPerTrade), color: result.avgPnlPerTrade >= 0 ? 'text-green-400' : 'text-red-400' },
                  { label: b.maxDrawdown, value: formatUSD(result.maxDrawdown), color: 'text-red-400' },
                  { label: b.sharpe, value: result.sharpeRatio.toFixed(3), sub: result.sharpeRatio >= 1 ? '✅ Good' : result.sharpeRatio >= 0 ? '⚠️ Low' : '❌ Negative' },
                  { label: b.totalPnl, value: formatUSD(result.totalPnl), color: result.totalPnl >= 0 ? 'text-green-400' : 'text-red-400' },
                ].map(({ label, value, sub, color }) => (
                  <div key={label} className="rounded-lg border border-border p-3 space-y-0.5">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className={`font-mono text-lg font-semibold ${color || 'text-foreground'}`}>{value}</p>
                    {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">{b.disclaimer}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
