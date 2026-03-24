'use client';
import { useQuery } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/main-layout';
import { StatsCards } from '@/components/dashboard/stats-cards';
import { StrategyStatusCards } from '@/components/dashboard/strategy-status';
import { PerformanceChart } from '@/components/dashboard/performance-chart';
import { RecentActivity } from '@/components/dashboard/recent-activity';
import { SimStatsPanel } from '@/components/dashboard/sim-stats-panel';
import { BalancePanel } from '@/components/dashboard/balance-panel';
import { WinLossChart } from '@/components/dashboard/win-loss-chart';
import { AllocationChart } from '@/components/dashboard/allocation-chart';
import { getStrategiesStatus, getSimStats, getPositions, getTrades, getPerformance } from '@/lib/api';
import { useSocketEvents } from '@/hooks/use-socket-events';
import { useSimMode } from '@/hooks/use-sim-mode';

export default function DashboardPage() {
  useSocketEvents();
  const isDryRun = useSimMode();
  const dryRunStr = String(isDryRun);

  const { data: statuses = [] } = useQuery({
    queryKey: ['strategies'],
    queryFn: getStrategiesStatus,
    refetchInterval: 5000,
  });
  const { data: simStats = [] } = useQuery({
    queryKey: ['sim-stats'],
    queryFn: getSimStats,
    refetchInterval: 15000,
  });
  const { data: performance = [] } = useQuery({
    queryKey: ['performance'],
    queryFn: () => getPerformance(undefined, 200),
    refetchInterval: 30000,
  });
  const { data: positions = [] } = useQuery({
    queryKey: ['positions', dryRunStr],
    queryFn: () => getPositions({ isDryRun: dryRunStr }),
    refetchInterval: 10000,
  });
  const { data: trades = [] } = useQuery({
    queryKey: ['trades', dryRunStr],
    queryFn: () => getTrades({ limit: '50', isDryRun: dryRunStr }),
    refetchInterval: 15000,
  });

  return (
    <MainLayout title="Dashboard">
      <div className="space-y-5">
        {/* Row 1: Stats + Balance */}
        <div className="grid gap-5 lg:grid-cols-4">
          <div className="lg:col-span-3">
            <StatsCards simStats={simStats} positions={positions} tradesCount={trades.length} isDryRun={isDryRun} />
          </div>
          <BalancePanel isDryRun={isDryRun} />
        </div>

        {/* Row 2: Strategy status */}
        <StrategyStatusCards statuses={statuses} isDryRun={isDryRun} />

        {/* Row 3: Performance + Recent Activity */}
        <div className="grid gap-5 lg:grid-cols-2">
          <PerformanceChart samples={performance} />
          <RecentActivity trades={trades} />
        </div>

        {/* Conditionally render Simulation parts */}
        {isDryRun && (
          <>
            {/* Row 4: Win/Loss breakdown + Capital Allocation */}
            <div className="grid gap-5 lg:grid-cols-2">
              <WinLossChart simStats={simStats} />
              <AllocationChart positions={positions} />
            </div>

            {/* Row 5: Sim stats per strategy */}
            <SimStatsPanel simStats={simStats} />
          </>
        )}
      </div>
    </MainLayout>
  );
}
