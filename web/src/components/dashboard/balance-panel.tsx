'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { getBalance, updateSimBalance, clearSimData } from '@/lib/api';
import { useLang } from '@/lib/i18n';
import { formatUSD } from '@/lib/utils';

export function BalancePanel({ isDryRun = true }: { isDryRun?: boolean }) {
  const qc = useQueryClient();
  const { t } = useLang();
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState('');
  const [clearing, setClearing] = useState(false);

  const { data, refetch } = useQuery({
    queryKey: ['balance', isDryRun],
    queryFn: () => getBalance(isDryRun),
    refetchInterval: 10000,
  });

  const updateMutation = useMutation({
    mutationFn: (val: string) => updateSimBalance(val),
    onSuccess: () => { setEditing(false); refetch(); },
  });

  const handleClearSimData = async () => {
    if (!confirm(t.common.clearSimDataConfirm)) return;
    setClearing(true);
    try {
      await clearSimData();
      qc.invalidateQueries();
    } finally {
      setClearing(false);
    }
  };

  const balance = data?.balance ?? 0;
  const ctBalance = (data as any)?.ctBalance ?? 0;
  const mmBalance = (data as any)?.mmBalance ?? 0;
  const b = t.balance;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
            {b.title}
            <HelpTooltip text={isDryRun ? b.simHelp : b.help} />
          </CardTitle>
          <Badge variant={isDryRun ? 'warning' : 'success'} className="text-[10px]">
            {isDryRun ? t.common.simulated : t.common.live}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {editing ? (
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={inputVal}
              onChange={e => setInputVal(e.target.value)}
              className="h-8 w-32 rounded border border-border bg-background px-2 text-sm font-mono"
              placeholder="1000"
              autoFocus
            />
            <Button size="sm" onClick={() => updateMutation.mutate(inputVal)} disabled={updateMutation.isPending}>
              {t.common.save}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>{t.common.cancel}</Button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <span className="text-2xl font-bold font-mono">{formatUSD(balance)}</span>
            {isDryRun && (
              <Button size="sm" variant="outline" onClick={() => { setInputVal(String(ctBalance)); setEditing(true); }}>
                {t.common.edit}
              </Button>
            )}
          </div>
        )}

        {isDryRun && !editing && (
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span>Copy Trade: <span className="font-mono text-foreground">{formatUSD(ctBalance)}</span></span>
            <span>Market Maker: <span className="font-mono text-foreground">{formatUSD(mmBalance)}</span></span>
          </div>
        )}

        {isDryRun && (
          <Button
            size="sm"
            variant="destructive"
            className="w-full"
            onClick={handleClearSimData}
            disabled={clearing}
          >
            {clearing ? t.common.clearing : t.common.clearSimData}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
