import { Injectable, Logger } from '@nestjs/common';

const BINANCE_API = 'https://api.binance.com/api/v3';

@Injectable()
export class BinanceService {
  private readonly logger = new Logger(BinanceService.name);

  /**
   * Short-term momentum using recent klines (1m candles by default).
   * Returns percentage change over the last N periods — much more relevant
   * for 5-minute trading windows than the 24h ticker.
   * e.g., last 3 × 1m candles: positive = price rising, negative = price falling.
   */
  async getShortTermMomentum(asset: string, interval = '1m', periods = 3): Promise<number> {
    try {
      const symbol = `${asset.toUpperCase()}USDT`;
      const limit = periods + 1; // +1 so we can compute change from first to last
      const resp = await fetch(`${BINANCE_API}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`);
      if (!resp.ok) {
        this.logger.warn(`Binance klines error for ${symbol}: ${resp.statusText}`);
        return 0;
      }
      const candles: any[][] = await resp.json();
      if (!candles || candles.length < 2) return 0;

      // candle[1] = open, candle[4] = close
      const openPrice = parseFloat(candles[0][1]);
      const closePrice = parseFloat(candles[candles.length - 1][4]);
      if (openPrice <= 0) return 0;

      return ((closePrice - openPrice) / openPrice) * 100;
    } catch (err) {
      this.logger.warn(`Failed to fetch Binance klines for ${asset}: ${err.message}`);
      return 0;
    }
  }

  /**
   * Calculates the YES and NO allocation weights (0.0 to 1.0) summing to 1.0.
   * Trend is clamped to ±maxTrendPct (default ±2%) to avoid over-biasing
   * on short-term candles where swings are smaller than 24h moves.
   */
  calculateWeight(
    trendPercent: number,
    maxBiasPercent = 70,
    maxTrendPct = 2,
  ): { yesWeight: number; noWeight: number } {
    const maxBias = Math.max(50, Math.min(100, maxBiasPercent)) / 100;
    const neutral = 0.5;
    // Clamp trend strength to [-1, 1] using maxTrendPct as the reference swing
    const trendStrength = Math.max(-maxTrendPct, Math.min(maxTrendPct, trendPercent)) / maxTrendPct;
    const deviation = (maxBias - neutral) * trendStrength;
    const yesWeight = neutral + deviation;
    return {
      yesWeight: Number(yesWeight.toFixed(2)),
      noWeight: Number((1.0 - yesWeight).toFixed(2)),
    };
  }
}
