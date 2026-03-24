import { Injectable, Logger } from '@nestjs/common';

const DATA_API = 'https://data-api.polymarket.com';

export interface PolyActivity {
  proxyWallet: string;
  timestamp: number;
  conditionId: string;
  type: 'TRADE' | 'REDEEM';
  size: number;        // shares
  usdcSize: number;    // USDC value
  price: number;
  asset: string;       // tokenId
  side: 'BUY' | 'SELL' | '';
  outcomeIndex: number;
  title: string;
  slug: string;
  icon: string;
  outcome: string;
}

export interface PolyPosition {
  proxyWallet: string;
  asset: string;
  conditionId: string;
  size: number;
  avgPrice: number;
  initialValue: number;
  currentValue: number;
  cashPnl: number;
  percentPnl: number;
  title: string;
  outcome: string;
  icon: string;
}

export interface PolyPortfolio {
  totalValue: number;
  realizedPnl: number;
  unrealizedPnl: number;
  totalPnl: number;
  openPositions: number;
  totalTrades: number;
  winRate: number;
}

@Injectable()
export class PolymarketDataService {
  private readonly logger = new Logger(PolymarketDataService.name);

  async getActivity(address: string, limit = 200): Promise<PolyActivity[]> {
    try {
      const resp = await fetch(`${DATA_API}/activity?user=${address.toLowerCase()}&limit=${limit}`, {
        signal: AbortSignal.timeout(8000),
      });
      if (!resp.ok) return [];
      return resp.json();
    } catch (e) {
      this.logger.warn(`Failed to fetch activity: ${e.message}`);
      return [];
    }
  }

  async getPositions(address: string): Promise<PolyPosition[]> {
    try {
      const resp = await fetch(`${DATA_API}/positions?user=${address.toLowerCase()}`, {
        signal: AbortSignal.timeout(8000),
      });
      if (!resp.ok) return [];
      return resp.json();
    } catch (e) {
      this.logger.warn(`Failed to fetch positions: ${e.message}`);
      return [];
    }
  }

  async getValue(address: string): Promise<number> {
    try {
      const resp = await fetch(`${DATA_API}/value?user=${address.toLowerCase()}`, {
        signal: AbortSignal.timeout(8000),
      });
      if (!resp.ok) return 0;
      const data: Array<{ value: number }> = await resp.json();
      return data[0]?.value ?? 0;
    } catch (e) {
      this.logger.warn(`Failed to fetch portfolio value: ${e.message}`);
      return 0;
    }
  }

  /** Calculate real realized P&L from on-chain activity */
  async getPortfolio(address: string): Promise<PolyPortfolio> {
    const [activity, positions, totalValue] = await Promise.all([
      this.getActivity(address, 500),
      this.getPositions(address),
      this.getValue(address),
    ]);

    const trades = activity.filter(a => a.type === 'TRADE');
    const totalBuyUSDC  = trades.filter(a => a.side === 'BUY').reduce((s, a) => s + (a.usdcSize || 0), 0);
    const totalSellUSDC = trades.filter(a => a.side === 'SELL').reduce((s, a) => s + (a.usdcSize || 0), 0);

    // Realized P&L: what we got from sells minus what we spent on buys (closed positions)
    // Unrealized: current value of open positions minus cost
    const unrealizedPnl = positions.reduce((s, p) => s + (p.cashPnl || 0), 0);
    const realizedPnl = totalSellUSDC - totalBuyUSDC - unrealizedPnl;

    // Win rate: count conditionIds where total sell > total buy (profitable round-trips)
    const byCondition = new Map<string, { buy: number; sell: number }>();
    for (const t of trades) {
      if (!t.conditionId) continue;
      const entry = byCondition.get(t.conditionId) ?? { buy: 0, sell: 0 };
      if (t.side === 'BUY')  entry.buy  += t.usdcSize || 0;
      if (t.side === 'SELL') entry.sell += t.usdcSize || 0;
      byCondition.set(t.conditionId, entry);
    }
    const resolved = [...byCondition.values()].filter(e => e.sell > 0);
    const wins = resolved.filter(e => e.sell > e.buy).length;
    const winRate = resolved.length > 0 ? wins / resolved.length : 0;

    return {
      totalValue,
      realizedPnl: parseFloat(realizedPnl.toFixed(4)),
      unrealizedPnl: parseFloat(unrealizedPnl.toFixed(4)),
      totalPnl: parseFloat((realizedPnl + unrealizedPnl).toFixed(4)),
      openPositions: positions.length,
      totalTrades: resolved.length,
      winRate: parseFloat((winRate * 100).toFixed(1)),
    };
  }

  /** Real P&L for a single conditionId — used to reconcile a closed live position */
  async getPnlForCondition(address: string, conditionId: string): Promise<number | null> {
    try {
      const activity = await this.getActivity(address, 500);
      const relevant = activity.filter(a => a.conditionId === conditionId && a.type === 'TRADE');
      if (relevant.length === 0) return null;
      const buyUSDC  = relevant.filter(a => a.side === 'BUY').reduce((s, a)  => s + (a.usdcSize || 0), 0);
      const sellUSDC = relevant.filter(a => a.side === 'SELL').reduce((s, a) => s + (a.usdcSize || 0), 0);
      return parseFloat((sellUSDC - buyUSDC).toFixed(4));
    } catch {
      return null;
    }
  }
}
