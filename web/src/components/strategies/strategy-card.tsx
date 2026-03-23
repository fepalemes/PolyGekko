'use client';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Play, Square, Loader2 } from 'lucide-react';
import { startStrategy, stopStrategy } from '@/lib/api';
import { toast } from '@/components/ui/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useLang } from '@/lib/i18n';
import type { StrategyStatus } from '@/lib/types';

interface StrategyCardProps {
  status: StrategyStatus;
  label: string;
  description: string;
  queryKey: string[];
  isDryRun: boolean;
}

export function StrategyCard({ status, label, description, queryKey, isDryRun: globalIsDryRun }: StrategyCardProps) {
  const [loading, setLoading] = useState(false);
  const qc = useQueryClient();
  const { t } = useLang();

  const toggle = async () => {
    setLoading(true);
    try {
      if (status.running) {
        await stopStrategy(status.type);
        toast({ title: `${label} ${t.common.stopped.toLowerCase()}` });
      } else {
        await startStrategy(status.type);
        toast({ title: `${label} ${t.common.running.toLowerCase()}`, variant: 'success' as any });
      }
      qc.invalidateQueries({ queryKey });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base font-semibold text-foreground">
          {label}
          <div className="flex items-center gap-2">
            {(status.running ? status.isDryRun : globalIsDryRun) && <Badge variant="warning">{t.common.dryRun}</Badge>}
            <Badge variant={status.running ? 'success' : 'secondary'}>
              {status.running ? t.common.running : t.common.stopped}
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-sm text-muted-foreground">{description}</p>
        <div className="flex items-center justify-between">
          {status.startedAt ? (
            <p className="text-xs text-muted-foreground">
              {new Date(status.startedAt).toLocaleTimeString()}
            </p>
          ) : (
            <span />
          )}
          <Button
            size="sm"
            variant={status.running ? 'destructive' : 'default'}
            onClick={toggle}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : status.running ? (
              <><Square className="mr-1.5 h-3.5 w-3.5" />{t.common.stop}</>
            ) : (
              <><Play className="mr-1.5 h-3.5 w-3.5" />{t.common.start}</>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
