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
export const getUnrealizedPnl = (isDryRun?: string) =>
  apiFetch<Array<{ positionId: number; currentPrice: number | null; currentValue: number | null; unrealizedPnl: number | null; unrealizedPnlPct: number | null }>>(`/positions/unrealized-pnl?isDryRun=${isDryRun ?? 'true'}`);

// Trades
export const getTrades = (filters?: { conditionId?: string; strategyType?: string; side?: string; isDryRun?: string; limit?: string }) => {
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
export const getSettingsHistory = (limit?: number) =>
  apiFetch<Array<{ id: number; key: string; oldValue: string | null; newValue: string; changedAt: string }>>(`/settings/history${limit ? `?limit=${limit}` : ''}`);
export type ExportedSettings = {
  exportedAt: string;
  categories: Array<{
    category: string;
    label: string;
    fields: Array<{ key: string; value: string; description: string }>;
  }>;
};
export const exportSettings = () => apiFetch<ExportedSettings>('/settings/export');
export const importSettings = (body: ExportedSettings | Record<string, string>) =>
  apiFetch<{ imported: number; skipped: number; message: string }>('/settings/import', {
    method: 'POST', body: JSON.stringify(body),
  });

// Strategies
export const getStrategiesStatus = () => apiFetch<StrategyStatus[]>('/strategies');
export const getStrategyStatus = (type: string) => apiFetch<StrategyStatus>(`/strategies/${type.toLowerCase().replace('_', '-')}/status`);
export const startStrategy = (type: string) =>
  apiFetch(`/strategies/${type.toLowerCase().replace('_', '-')}/start`, { method: 'POST' });
export const stopStrategy = (type: string) =>
  apiFetch(`/strategies/${type.toLowerCase().replace('_', '-')}/stop`, { method: 'POST' });
export const pauseStrategy = (type: string) =>
  apiFetch(`/strategies/${type.toLowerCase().replace('_', '-')}/pause`, { method: 'POST' });
export const resumeStrategy = (type: string) =>
  apiFetch(`/strategies/${type.toLowerCase().replace('_', '-')}/resume`, { method: 'POST' });
export const getHealth = () =>
  apiFetch<{ checkedAt: string; clob: { api: boolean; clientInitialized: boolean }; gamma: { api: boolean }; strategies: any[] }>('/strategies/health');
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
export const runBacktest = (params: {
  strategyType?: string;
  stopLossPercent?: number;
  takeProfitPercent?: number;
  positionSizeUsdc?: number;
  isDryRun?: boolean;
}) => apiFetch<{
  totalPositions: number; wins: number; losses: number;
  winRate: number; totalPnl: number; avgPnlPerTrade: number;
  maxDrawdown: number; sharpeRatio: number;
  params: typeof params; message?: string;
}>('/strategies/backtest', { method: 'POST', body: JSON.stringify(params) });

export const getRealBalance = () =>
  apiFetch<{ balance: number }>('/polymarket/balance');
export const updateSimBalance = (value: string) =>
  apiFetch('/settings', { method: 'PATCH', body: JSON.stringify([
    { key: 'COPY_TRADE_SIM_BALANCE', value },
    { key: 'MM_SIM_BALANCE', value },
  ]) });

// Trading Mode
export type TradingMode = 'high' | 'intermediate' | 'low' | 'custom';
export const getTradingMode = () =>
  apiFetch<{ mode: TradingMode; presets: Record<string, Record<string, string>> }>('/strategies/trading-mode');
export const setTradingMode = (mode: TradingMode) =>
  apiFetch('/strategies/trading-mode', { method: 'POST', body: JSON.stringify({ mode }) });

// Notifications
export const testTelegram = () =>
  apiFetch('/notifications/telegram/test', { method: 'POST' });
