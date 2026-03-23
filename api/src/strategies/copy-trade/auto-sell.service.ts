import { Injectable } from '@nestjs/common';
import { ClobService } from '../../polymarket/clob.service';
import { PositionsService } from '../../positions/positions.service';
import { LogsService } from '../../logs/logs.service';
import { StrategyType } from '@prisma/client';

@Injectable()
export class AutoSellService {
  constructor(
    private clob: ClobService,
    private positions: PositionsService,
    private logs: LogsService,
  ) {}

  private roundToTickSize(price: number, tickSize = 0.01): number {
    const rounded = Math.round(price / tickSize) * tickSize;
    return Math.min(Math.max(rounded, 0.01), 0.99);
  }

  async placeAutoSell(
    positionId: number, conditionId: string, tokenId: string,
    avgBuyPrice: number, shares: number, config: any, market: any,
  ) {
    try {
      const tickSize = market.minimumTickSize || 0.01;
      const targetPrice = this.roundToTickSize(
        avgBuyPrice * (1 + config.autoSellProfitPercent / 100),
        tickSize,
      );

      const result = await this.clob.placeGTCOrder(tokenId, 'SELL', targetPrice, shares);
      if (result?.id) {
        await this.positions.update(positionId, { sellOrderId: result.id });
        await this.logs.info(
          StrategyType.COPY_TRADE,
          `Auto-sell placed @ $${targetPrice} (${config.autoSellProfitPercent}% target)`,
        );
      }
    } catch (err) {
      await this.logs.error(StrategyType.COPY_TRADE, `Auto-sell error: ${err.message}`);
    }
  }
}
