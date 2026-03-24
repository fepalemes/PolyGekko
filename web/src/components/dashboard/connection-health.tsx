'use client';
import { useQuery } from '@tanstack/react-query';
import { getHealth } from '@/lib/api';
import { useLang } from '@/lib/i18n';

function Dot({ ok }: { ok: boolean | undefined }) {
  if (ok === undefined) return <span className="h-2 w-2 rounded-full bg-slate-400 inline-block" />;
  return <span className={`h-2 w-2 rounded-full inline-block ${ok ? 'bg-green-400' : 'bg-red-400'}`} />;
}

export function ConnectionHealth() {
  const { t } = useLang();
  const { data } = useQuery({
    queryKey: ['health'],
    queryFn: getHealth,
    refetchInterval: 60000,
    retry: false,
  });

  const items = [
    { label: 'CLOB API', ok: data?.clob?.api },
    { label: 'CLOB Auth', ok: data?.clob?.clientInitialized },
    { label: 'Gamma API', ok: data?.gamma?.api },
  ];

  return (
    <div className="flex items-center gap-4 rounded-lg border border-border bg-card px-4 py-2 text-xs text-muted-foreground">
      <span className="font-medium text-foreground">{t.common.connections}</span>
      {items.map(({ label, ok }) => (
        <span key={label} className="flex items-center gap-1.5">
          <Dot ok={ok} />
          <span>{label}</span>
        </span>
      ))}
      {data?.checkedAt && (
        <span className="ml-auto opacity-50">
          {t.common.checked} {new Date(data.checkedAt).toLocaleTimeString()}
        </span>
      )}
    </div>
  );
}
