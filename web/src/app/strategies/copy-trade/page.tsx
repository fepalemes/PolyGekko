'use client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/main-layout';
import { StrategyCard } from '@/components/strategies/strategy-card';
import { CopyTradeForm } from '@/components/strategies/copy-trade-form';
import { getStrategiesStatus, getSettingsByCategory } from '@/lib/api';
import { useLang } from '@/lib/i18n';

export default function CopyTradePage() {
  const qc = useQueryClient();
  const { t } = useLang();
  const { data: statuses = [] } = useQuery({
    queryKey: ['strategies'],
    queryFn: getStrategiesStatus,
    refetchInterval: 5000,
  });
  const { data: settings = [], refetch } = useQuery({
    queryKey: ['settings', 'copy_trade'],
    queryFn: () => getSettingsByCategory('copy_trade'),
  });
  const { data: systemSettings = [] } = useQuery({
    queryKey: ['settings', 'system'],
    queryFn: () => getSettingsByCategory('system'),
  });

  const simModeSetting = systemSettings.find(s => s.key === 'GLOBAL_SIMULATION_MODE');
  const isDryRun = simModeSetting ? simModeSetting.value === 'true' : true;
  const status = statuses.find(s => s.type === 'COPY_TRADE') || { type: 'COPY_TRADE' as const, running: false, isDryRun: true };

  return (
    <MainLayout title={t.strategies.copyTrade.label}>
      <div className="mx-auto max-w-3xl space-y-5">
        <StrategyCard
          status={status}
          label={t.strategies.copyTrade.label}
          description={t.strategies.copyTrade.howItWorks}
          queryKey={['strategies']}
          isDryRun={isDryRun}
        />
        <CopyTradeForm settings={settings} onSaved={() => { refetch(); qc.invalidateQueries({ queryKey: ['strategies'] }); }} />
      </div>
    </MainLayout>
  );
}
