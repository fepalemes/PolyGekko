import { Injectable, Logger } from '@nestjs/common';
import { GammaService } from '../../polymarket/gamma.service';

@Injectable()
export class DetectorService {
  private readonly logger = new Logger(DetectorService.name);
  private timer: NodeJS.Timeout | null = null;
  private onMarket: ((market: any, asset: string) => void) | null = null;
  private config: any = {};
  // Track by conditionId so multiple markets per asset can run simultaneously
  private activeConditionIds = new Set<string>();

  constructor(private gamma: GammaService) {}

  start(config: any, onMarket: (market: any, asset: string) => void) {
    this.config = config;
    this.onMarket = onMarket;
    this.activeConditionIds.clear();
    this.poll();
    this.timer = setInterval(() => this.poll(), config.pollInterval * 1000);
  }

  stop() {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    this.activeConditionIds.clear();
  }

  private async poll() {
    const duration = this.config.duration || '5m';
    const durationLabel = duration; // e.g. "5m", "1h"
    const now = Date.now();

    for (const asset of this.config.assets) {
      try {
        const markets = await this.gamma.getCryptoMarketsByDuration(asset, duration);

        if (markets.length === 0) {
          this.logger.warn(`No ${durationLabel} markets found for ${asset} (slug: ${asset}-updown-${durationLabel}-*)`);
          continue;
        }

        this.logger.log(`[MM] ${markets.length} ${durationLabel} market(s) found for ${asset.toUpperCase()}`);

        for (const market of markets) {
          const conditionId = market.conditionId || market.condition_id;
          if (!conditionId || this.activeConditionIds.has(conditionId)) continue;

          // clobTokenIds is already normalized to an array by GammaService
          const tokens: string[] = Array.isArray(market.clobTokenIds) ? market.clobTokenIds : [];
          if (tokens.length < 2) {
            this.logger.warn(`[MM] Skipping "${market.question}" — missing clobTokenIds (got ${JSON.stringify(market.clobTokenIds)})`);
            continue;
          }

          // Use eventStartTime (actual trading window), not startDate (creation date)
          const startTs = new Date(market.eventStartTime || market.startDate || 0).getTime();
          const endTs = new Date(market.endDate || market.end_date_iso || 0).getTime();
          const timeUntilStart = startTs - now;
          const timeUntilEnd = endTs - now;

          // Skip if less than cutLossTime remaining (not enough time to trade)
          if (timeUntilEnd < this.config.cutLossTime * 1000 + 10000) {
            this.logger.warn(`[MM] Skipping "${market.question}" — only ${Math.round(timeUntilEnd / 1000)}s left (cutLossTime=${this.config.cutLossTime}s)`);
            continue;
          }

          this.activeConditionIds.add(conditionId);

          this.logger.log(
            `[MM] Found ${durationLabel} ${asset.toUpperCase()} market: "${market.question}" ` +
            `starts in ${Math.round(timeUntilStart / 1000)}s, ends in ${Math.round(timeUntilEnd / 1000)}s`,
          );

          if (this.onMarket) {
            this.onMarket(market, asset);
          }

          // Only process the first eligible market per asset per cycle
          break;
        }
      } catch (err) {
        this.logger.warn(`Detector poll error for ${asset}: ${err.message}`);
      }
    }
  }

  releaseConditionId(conditionId: string) {
    this.activeConditionIds.delete(conditionId);
  }
}
