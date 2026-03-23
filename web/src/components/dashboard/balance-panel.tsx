'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { Pencil, Trash2, Loader2 } from 'lucide-react';
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

  const balance   = data?.balance ?? 0;
  const ctBalance = (data as any)?.ctBalance ?? 0;
  const mmBalance = (data as any)?.mmBalance ?? 0;
  const b = t.balance;

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-1.5">
            {b.title}
            <HelpTooltip text={isDryRun ? b.simHelp : b.help} />
          </CardTitle>
          <Badge variant={isDryRun ? 'warning' : 'success'} className="text-[10px]">
            {isDryRun ? t.common.simulated : t.common.live}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-3">
        {/* Main balance */}
        {editing ? (
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={inputVal}
              onChange={e => setInputVal(e.target.value)}
              className="h-9 w-28 rounded-md border border-border bg-background px-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="1000"
              autoFocus
            />
            <Button size="sm" onClick={() => updateMutation.mutate(inputVal)} disabled={updateMutation.isPending} className="cursor-pointer">
              {updateMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t.common.save}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)} className="cursor-pointer">{t.common.cancel}</Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="font-mono text-2xl font-bold text-foreground">{formatUSD(balance)}</span>
            {isDryRun && (
              <button
                onClick={() => { setInputVal(String(ctBalance)); setEditing(true); }}
                className="rounded p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground cursor-pointer"
                title={t.common.edit}
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Per-strategy breakdown */}
        {isDryRun && !editing && (
          <div className="rounded-md bg-secondary/40 px-3 py-2 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Copy Trade</span>
              <span className="font-mono text-foreground">{formatUSD(ctBalance)}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Market Maker</span>
              <span className="font-mono text-foreground">{formatUSD(mmBalance)}</span>
            </div>
          </div>
        )}

        {/* Clear sim data */}
        {isDryRun && (
          <Button
            size="sm"
            variant="destructive"
            className="mt-auto w-full cursor-pointer"
            onClick={handleClearSimData}
            disabled={clearing}
          >
            {clearing ? (
              <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />{t.common.clearing}</>
            ) : (
              <><Trash2 className="mr-1.5 h-3.5 w-3.5" />{t.common.clearSimData}</>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
