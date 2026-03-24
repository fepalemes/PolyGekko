'use client';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { Copy, BarChart2, Crosshair, Play, Square, Loader2, Pause, RotateCcw } from 'lucide-react';
import { startStrategy, stopStrategy, pauseStrategy, resumeStrategy } from '@/lib/api';
import { toast } from '@/components/ui/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useLang } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { StrategyStatus } from '@/lib/types';

export function StrategyStatusCards({ statuses, isDryRun: globalIsDryRun }: { statuses: StrategyStatus[], isDryRun: boolean }) {
  const [loading, setLoading] = useState<string | null>(null);
  const qc = useQueryClient();
  const { t } = useLang();

  const strategyMeta = {
    COPY_TRADE: {
      label: t.strategies.copyTrade.label,
      description: t.strategies.copyTrade.description,
      howItWorks: t.strategies.copyTrade.howItWorks,
      icon: Copy,
      color: 'text-blue-400',
      bg: 'bg-blue-400/10',
      ring: 'ring-blue-500/20',
    },
    MARKET_MAKER: {
      label: t.strategies.marketMaker.label,
      description: t.strategies.marketMaker.description,
      howItWorks: t.strategies.marketMaker.howItWorks,
      icon: BarChart2,
      color: 'text-purple-400',
      bg: 'bg-purple-400/10',
      ring: 'ring-purple-500/20',
    },
    SNIPER: {
      label: t.strategies.sniper.label,
      description: t.strategies.sniper.description,
      howItWorks: t.strategies.sniper.howItWorks,
      icon: Crosshair,
      color: 'text-orange-400',
      bg: 'bg-orange-400/10',
      ring: 'ring-orange-500/20',
    },
  };

  const toggle = async (status: StrategyStatus) => {
    setLoading(status.type);
    try {
      if (status.running) {
        await stopStrategy(status.type);
        toast({ title: `${strategyMeta[status.type as keyof typeof strategyMeta]?.label} ${t.common.stopped.toLowerCase()}` });
      } else {
        await startStrategy(status.type);
        toast({ title: `${strategyMeta[status.type as keyof typeof strategyMeta]?.label} ${t.common.running.toLowerCase()}`, variant: 'success' as any });
      }
      qc.invalidateQueries({ queryKey: ['strategies'] });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(null);
    }
  };

  const togglePause = async (status: StrategyStatus) => {
    setLoading(`pause-${status.type}`);
    try {
      if (status.paused) {
        await resumeStrategy(status.type);
        toast({ title: `${strategyMeta[status.type as keyof typeof strategyMeta]?.label} resumed`, variant: 'success' as any });
      } else {
        await pauseStrategy(status.type);
        toast({ title: `${strategyMeta[status.type as keyof typeof strategyMeta]?.label} paused` });
      }
      qc.invalidateQueries({ queryKey: ['strategies'] });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <h2 className="section-label">{t.strategies.title}</h2>
        <HelpTooltip text={t.strategies.modeHelp} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {statuses.map(status => {
          const meta = strategyMeta[status.type as keyof typeof strategyMeta];
          if (!meta) return null;
          const Icon = meta.icon;
          const isLoading = loading === status.type;
          const isPauseLoading = loading === `pause-${status.type}`;
          const isSimulated = status.running ? status.isDryRun : globalIsDryRun;

          return (
            <Card
              key={status.type}
              className={cn(
                'transition-all duration-200',
                status.running && status.paused
                  ? 'border-yellow-500/25 bg-yellow-500/[0.03]'
                  : status.running
                  ? 'border-green-500/25 bg-green-500/[0.03]'
                  : 'card-hover',
              )}
            >
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2">
                  <div className={cn('rounded-md p-1.5 ring-1', meta.bg, meta.ring)}>
                    <Icon className={cn('h-3.5 w-3.5', meta.color)} />
                  </div>
                  <span>{meta.label}</span>
                  <HelpTooltip text={meta.howItWorks} />
                  {status.running && !status.paused && (
                    <span className="ml-auto h-2 w-2 rounded-full bg-green-400 pulse-ring" />
                  )}
                  {status.paused && (
                    <span className="ml-auto h-2 w-2 rounded-full bg-yellow-400" />
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs leading-relaxed text-muted-foreground">{meta.description}</p>
                <div className="flex items-center justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <Badge variant={status.running && !status.paused ? 'success' : status.paused ? 'warning' : 'secondary'}>
                        {status.paused ? t.common.paused : status.running ? t.common.running : t.common.stopped}
                      </Badge>
                      {isSimulated && (
                        <Badge variant="warning">{t.common.dryRun}</Badge>
                      )}
                    </div>
                    {status.startedAt && (
                      <p className="text-xs text-muted-foreground">
                        {new Date(status.startedAt).toLocaleTimeString()}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {status.running && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => togglePause(status)}
                        disabled={isPauseLoading || isLoading}
                        className={cn(
                          'cursor-pointer h-8 px-2',
                          status.paused
                            ? 'border-yellow-500/50 text-yellow-500 hover:bg-yellow-500/10'
                            : 'text-muted-foreground hover:text-foreground',
                        )}
                        title={status.paused ? t.common.resume : t.common.pause}
                      >
                        {isPauseLoading ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : status.paused ? (
                          <RotateCcw className="h-3.5 w-3.5" />
                        ) : (
                          <Pause className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant={status.running ? 'destructive' : 'default'}
                      onClick={() => toggle(status)}
                      disabled={isLoading || isPauseLoading}
                      className="cursor-pointer"
                    >
                      {isLoading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : status.running ? (
                        <><Square className="mr-1 h-3.5 w-3.5" />{t.common.stop}</>
                      ) : (
                        <><Play className="mr-1 h-3.5 w-3.5" />{t.common.start}</>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
