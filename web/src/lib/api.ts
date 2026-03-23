import type { Position, Trade, StrategyLog, SimStats, Setting, StrategyStatus, PerformanceSample } from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
  return res.json();
}

// Positions
export const getPositions = (filters?: { status?: string; strategyType?: string; isDryRun?: string }) => {
  const params = new URLSearchParams(filters as Record<string, string>);
  return apiFetch<Position[]>(`/positions?${params}`);
};
export const getPosition = (id: number) => apiFetch<Position>(`/positions/${id}`);

// Trades
export const getTrades = (filters?: { conditionId?: string; strategyType?: string; limit?: string }) => {
  const params = new URLSearchParams(filters as Record<string, string>);
  return apiFetch<Trade[]>(`/trades?${params}`);
};

// Logs
export const getLogs = (filters?: { strategy?: string; level?: string; limit?: string }) => {
  const params = new URLSearchParams(filters as Record<string, string>);
  return apiFetch<StrategyLog[]>(`/logs?${params}`);
};
export const clearLogs = (strategy?: string) => {
  const params = strategy ? `?strategy=${strategy}` : '';
  return apiFetch(`/logs${params}`, { method: 'DELETE' });
};

// Settings
export const getSettings = () => apiFetch<Setting[]>('/settings');
export const getSettingsByCategory = (category: string) => apiFetch<Setting[]>(`/settings?category=${category}`);
export const updateSetting = (key: string, value: string) =>
  apiFetch(`/settings/${key}`, { method: 'PATCH', body: JSON.stringify({ value }) });
export const bulkUpdateSettings = (settings: Array<{ key: string; value: string }>) =>
  apiFetch('/settings', { method: 'PATCH', body: JSON.stringify(settings) });

// Strategies
export const getStrategiesStatus = () => apiFetch<StrategyStatus[]>('/strategies');
export const getStrategyStatus = (type: string) => apiFetch<StrategyStatus>(`/strategies/${type.toLowerCase().replace('_', '-')}/status`);
export const startStrategy = (type: string) =>
  apiFetch(`/strategies/${type.toLowerCase().replace('_', '-')}/start`, { method: 'POST' });
export const stopStrategy = (type: string) =>
  apiFetch(`/strategies/${type.toLowerCase().replace('_', '-')}/stop`, { method: 'POST' });
export const getSimStats = () => apiFetch<SimStats[]>('/strategies/sim-stats');
export const getPerformance = (strategy?: string, limit?: number) => {
  const params = new URLSearchParams();
  if (strategy) params.set('strategy', strategy);
  if (limit) params.set('limit', String(limit));
  return apiFetch<PerformanceSample[]>(`/strategies/performance?${params}`);
};
export const resetSimStats = (type: string) =>
  apiFetch(`/strategies/sim-stats/${type}`, { method: 'DELETE' });
export const clearSimData = () =>
  apiFetch('/strategies/sim-data', { method: 'DELETE' });
export const getBalance = (isDryRun = true) =>
  apiFetch<{ balance: number; isSimulated: boolean }>(`/strategies/balance?isDryRun=${isDryRun}`);
export const getRealBalance = () =>
  apiFetch<{ balance: number }>('/polymarket/balance');
export const updateSimBalance = (value: string) =>
  apiFetch('/settings', { method: 'PATCH', body: JSON.stringify([
    { key: 'COPY_TRADE_SIM_BALANCE', value },
    { key: 'MM_SIM_BALANCE', value },
  ]) });

// Notifications
export const testTelegram = () =>
  apiFetch('/notifications/telegram/test', { method: 'POST' });
