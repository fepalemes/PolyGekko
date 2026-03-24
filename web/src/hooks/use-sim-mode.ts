'use client';
import { useQuery } from '@tanstack/react-query';
import { getSettingsByCategory } from '@/lib/api';

/**
 * Returns the current global simulation mode (isDryRun).
 * Reads from the shared ['settings', 'system'] React Query cache —
 * no extra network request if the header has already fetched it.
 */
export function useSimMode(): boolean {
  const { data: settings = [] } = useQuery({
    queryKey: ['settings', 'system'],
    queryFn: () => getSettingsByCategory('system'),
  });
  const setting = settings.find(s => s.key === 'GLOBAL_SIMULATION_MODE');
  return setting ? setting.value === 'true' : true;
}
