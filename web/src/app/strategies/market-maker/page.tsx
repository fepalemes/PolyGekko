'use client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/main-layout';
import { StrategyCard } from '@/components/strategies/strategy-card';
import { MarketMakerForm } from '@/components/strategies/market-maker-form';
import { getStrategiesStatus, getSettingsByCategory } from '@/lib/api';
import { useLang } from '@/lib/i18n';

export default function MarketMakerPage() {
  const qc = useQueryClient();
  const { t } = useLang();
  const { data: statuses = [] } = useQuery({
    queryKey: ['strategies'],
    queryFn: getStrategiesStatus,
    refetchInterval: 5000,
  });
  const { data: settings = [], refetch } = useQuery({
    queryKey: ['settings', 'market_maker'],
    queryFn: () => getSettingsByCategory('market_maker'),
  });

  const status = statuses.find(s => s.type === 'MARKET_MAKER') || { type: 'MARKET_MAKER' as const, running: false, isDryRun: true };

  return (
    <MainLayout title={t.strategies.marketMaker.label}>
      <div className="mx-auto max-w-3xl space-y-5">
        <StrategyCard
          status={status}
          label={t.strategies.marketMaker.label}
          description={t.strategies.marketMaker.howItWorks}
          queryKey={['strategies']}
        />
        <MarketMakerForm settings={settings} onSaved={() => { refetch(); qc.invalidateQueries({ queryKey: ['strategies'] }); }} />
      </div>
    </MainLayout>
  );
}
