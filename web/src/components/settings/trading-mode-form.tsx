'use client';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getTradingMode, setTradingMode, type TradingMode } from '@/lib/api';
import { toast } from '@/components/ui/use-toast';
import { useLang } from '@/lib/i18n';
import { Loader2, Zap, TrendingUp, Shield, Settings2 } from 'lucide-react';

interface ModeConfig {
  key: TradingMode;
  icon: React.ReactNode;
  color: string;
  border: string;
  bg: string;
  badge: string;
  stats: { ct: string; mm: string; filter: string; maxEntries: string; margin: string };
}

const MODE_CONFIGS: ModeConfig[] = [
  {
    key: 'high',
    icon: <Zap className="h-5 w-5" />,
    color: 'text-red-400',
    border: 'border-red-500/50',
    bg: 'bg-red-500/5 hover:bg-red-500/10',
    badge: 'bg-red-500/20 text-red-300 border-red-500/30',
    stats: { ct: '$50 fixed', mm: '$50 / trade', filter: 'YES+NO ≤ 0.99', maxEntries: '10/min', margin: '$10' },
  },
  {
    key: 'intermediate',
    icon: <TrendingUp className="h-5 w-5" />,
    color: 'text-yellow-400',
    border: 'border-yellow-500/50',
    bg: 'bg-yellow-500/5 hover:bg-yellow-500/10',
    badge: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
    stats: { ct: '$20 fixed', mm: '$20 / trade', filter: 'YES+NO ≤ 0.97', maxEntries: '5/min', margin: '$20' },
  },
  {
    key: 'low',
    icon: <Shield className="h-5 w-5" />,
    color: 'text-green-400',
    border: 'border-green-500/50',
    bg: 'bg-green-500/5 hover:bg-green-500/10',
    badge: 'bg-green-500/20 text-green-300 border-green-500/30',
    stats: { ct: '$5 fixed', mm: '$5 / trade', filter: 'YES+NO ≤ 0.95', maxEntries: '2/min', margin: '$50' },
  },
  {
    key: 'custom',
    icon: <Settings2 className="h-5 w-5" />,
    color: 'text-blue-400',
    border: 'border-blue-500/50',
    bg: 'bg-blue-500/5 hover:bg-blue-500/10',
    badge: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    stats: { ct: '—', mm: '—', filter: '—', maxEntries: '—', margin: '—' },
  },
];

export function TradingModeForm() {
  const { t } = useLang();
  const tm = t.tradingMode;
  const qc = useQueryClient();
  const [applying, setApplying] = useState<TradingMode | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['trading-mode'],
    queryFn: getTradingMode,
  });
  const activeMode = data?.mode ?? 'custom';

  const apply = async (mode: TradingMode) => {
    setApplying(mode);
    try {
      await setTradingMode(mode);
      await qc.invalidateQueries({ queryKey: ['trading-mode'] });
      // Invalidate all strategy settings so the form shows updated values
      await qc.invalidateQueries({ queryKey: ['settings'] });
      toast({ title: tm.applied, variant: 'success' as any });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setApplying(null);
    }
  };

  const modeLabels: Record<TradingMode, string> = {
    high: tm.high,
    intermediate: tm.intermediate,
    low: tm.low,
    custom: tm.custom,
  };
  const modeDescs: Record<TradingMode, string> = {
    high: tm.highDesc,
    intermediate: tm.intermediateDesc,
    low: tm.lowDesc,
    custom: tm.customDesc,
  };

  if (isLoading) return <p className="text-sm text-muted-foreground">{t.common.loading}</p>;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{tm.description}</p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {MODE_CONFIGS.map((cfg) => {
          const isActive = activeMode === cfg.key;
          const isApplying = applying === cfg.key;

          return (
            <div
              key={cfg.key}
              className={cn(
                'relative flex flex-col gap-3 rounded-xl border p-4 transition-colors cursor-pointer',
                cfg.bg, cfg.border,
                isActive && 'ring-2 ring-offset-2 ring-offset-background',
                isActive && cfg.border.replace('border-', 'ring-'),
              )}
              onClick={() => !isApplying && apply(cfg.key)}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className={cfg.color}>{cfg.icon}</span>
                  <span className="font-semibold text-sm">{modeLabels[cfg.key]}</span>
                </div>
                <div className="flex items-center gap-2">
                  {isActive && (
                    <Badge className={cn('text-xs border', cfg.badge)}>
                      {tm.active}
                    </Badge>
                  )}
                  {isApplying && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                </div>
              </div>

              {/* Description */}
              <p className="text-xs text-muted-foreground leading-relaxed">
                {modeDescs[cfg.key]}
              </p>

              {/* Stats grid — only for preset modes */}
              {cfg.key !== 'custom' && (
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 pt-1 border-t border-white/5">
                  <Stat label={`CT ${tm.positionSize}`} value={cfg.stats.ct} />
                  <Stat label={`MM ${tm.positionSize}`} value={cfg.stats.mm} />
                  <Stat label={tm.entryFilter} value={cfg.stats.filter} />
                  <Stat label={tm.maxEntries} value={cfg.stats.maxEntries} />
                  <Stat label={tm.walletMargin} value={cfg.stats.margin} />
                </div>
              )}

              {/* Apply button */}
              {!isActive && (
                <Button
                  size="sm"
                  variant="outline"
                  className={cn('mt-auto w-full text-xs', cfg.color, cfg.border)}
                  disabled={!!applying}
                  onClick={(e) => { e.stopPropagation(); apply(cfg.key); }}
                >
                  {isApplying ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : null}
                  {tm.apply}
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] text-muted-foreground/70 uppercase tracking-wide">{label}</span>
      <span className="text-xs font-mono font-medium">{value}</span>
    </div>
  );
}
