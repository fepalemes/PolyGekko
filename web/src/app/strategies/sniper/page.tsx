'use client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/main-layout';
import { StrategyCard } from '@/components/strategies/strategy-card';
import { SniperForm } from '@/components/strategies/sniper-form';
import { getStrategiesStatus, getSettingsByCategory } from '@/lib/api';
import { useLang } from '@/lib/i18n';

export default function SniperPage() {
  const qc = useQueryClient();
  const { t } = useLang();
  const { data: statuses = [] } = useQuery({
    queryKey: ['strategies'],
    queryFn: getStrategiesStatus,
    refetchInterval: 5000,
  });
  const { data: settings = [], refetch } = useQuery({
    queryKey: ['settings', 'sniper'],
    queryFn: () => getSettingsByCategory('sniper'),
  });

  const status = statuses.find(s => s.type === 'SNIPER') || { type: 'SNIPER' as const, running: false, isDryRun: true };

  return (
    <MainLayout title={t.strategies.sniper.label}>
      <div className="mx-auto max-w-3xl space-y-5">
        <StrategyCard
          status={status}
          label={t.strategies.sniper.label}
          description={t.strategies.sniper.howItWorks}
          queryKey={['strategies']}
        />
        <SniperForm settings={settings} onSaved={() => { refetch(); qc.invalidateQueries({ queryKey: ['strategies'] }); }} />
      </div>
    </MainLayout>
  );
}
