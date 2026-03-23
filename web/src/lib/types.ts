export type StrategyType = 'COPY_TRADE' | 'MARKET_MAKER' | 'SNIPER';
export type SimOutcome = 'WIN' | 'LOSS';
export type PositionStatus = 'OPEN' | 'SELLING' | 'SOLD' | 'REDEEMED';
export type TradeSide = 'BUY' | 'SELL';
export type TradeStatus = 'PENDING' | 'FILLED' | 'CANCELLED' | 'FAILED';
export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

export interface Position {
  id: number;
  conditionId: string;
  tokenId: string;
  market: string;
  shares: string;
  avgBuyPrice: string;
  totalCost: string;
  outcome: string;
  sellOrderId?: string;
  status: PositionStatus;
  strategyType: StrategyType;
  isDryRun: boolean;
  resolvedPnl?: string | null;
  simOutcome?: SimOutcome | null;
  trades?: Trade[];
  createdAt: string;
  updatedAt: string;
}

export interface PerformanceSample {
  id: number;
  strategyType: StrategyType;
  cumulativePnl: string;
  pnlDelta: string;
  outcome: SimOutcome;
  market: string;
  createdAt: string;
}

export interface Trade {
  id: number;
  positionId?: number;
  conditionId: string;
  tokenId: string;
  market: string;
  side: TradeSide;
  shares: string;
  price: string;
  cost: string;
  orderId?: string;
  status: TradeStatus;
  isDryRun: boolean;
  strategyType: StrategyType;
  createdAt: string;
}

export interface StrategyLog {
  id: number;
  strategyType: StrategyType;
  level: LogLevel;
  message: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface SimStats {
  id: number;
  strategyType: StrategyType;
  totalBuys: number;
  wins: number;
  losses: number;
  pnl: string;
}

export interface Setting {
  id: number;
  key: string;
  value: string;
  category: string;
  description?: string;
}

export interface StrategyStatus {
  type: StrategyType;
  running: boolean;
  isDryRun: boolean;
  startedAt?: string | null;
}
