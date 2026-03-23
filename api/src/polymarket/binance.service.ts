import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class BinanceService {
  private readonly logger = new Logger(BinanceService.name);

  /**
   * Fetches the 24h ticker price change percent from Binance for a given asset.
   * Positive returns = Bullish (suggests YES bias).
   * Negative returns = Bearish (suggests NO bias).
   * Returns a value like +2.5 or -1.8.
   */
  async getTrendPercent(asset: string): Promise<number> {
    try {
      const symbol = `${asset.toUpperCase()}USDT`;
      const resp = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`);
      if (!resp.ok) {
        this.logger.warn(`Binance API error for ${symbol}: ${resp.statusText}`);
        return 0;
      }
      const data = await resp.json();
      return parseFloat(data.priceChangePercent || '0');
    } catch (err) {
      this.logger.warn(`Failed to fetch Binance trend for ${asset}: ${err.message}`);
      return 0;
    }
  }

  /**
   * Calculates the YES and NO allocation weights (0.0 to 1.0) summing to 1.0.
   * If trend is +3%, and maxBias is 70% (0.7), YES gets 70%, NO gets 30%.
   * Trend is clamped between -maxTrend and +maxTrend (e.g. 5%)
   */
  calculateWeight(trendPercent: number, maxBiasPercent: number = 70): { yesWeight: number; noWeight: number } {
    // maxBiasPercent is usually between 50 and 100. (50 = no bias, 100 = all in on one side).
    const maxBias = Math.max(50, Math.min(100, maxBiasPercent)) / 100;
    const neutral = 0.5;
    
    // We assume a 5% swing is "max strength" trend.
    const trendStrength = Math.max(-5, Math.min(5, trendPercent)) / 5; // -1.0 to 1.0
    
    // Calculate YES weight
    // If trendStrength = +1.0 (very bullish), yesWeight goes from 0.5 up to maxBias
    // If trendStrength = -1.0 (very bearish), yesWeight goes from 0.5 down to (1 - maxBias)
    const deviation = (maxBias - neutral) * trendStrength;
    const yesWeight = neutral + deviation;
    const noWeight = 1.0 - yesWeight;
    
    return {
      yesWeight: Number(yesWeight.toFixed(2)),
      noWeight: Number(noWeight.toFixed(2))
    };
  }
}
