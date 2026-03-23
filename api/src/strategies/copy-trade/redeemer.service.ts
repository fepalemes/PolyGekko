import { Injectable, Logger } from '@nestjs/common';
import { StrategyType, PositionStatus, SimOutcome } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CtfService } from '../../polymarket/ctf.service';
import { GammaService } from '../../polymarket/gamma.service';
import { ClobService } from '../../polymarket/clob.service';
import { LogsService } from '../../logs/logs.service';
import { SimStatsService } from '../sim-stats.service';
import { SettingsService } from '../../settings/settings.service';
import { EventsGateway } from '../../events/events.gateway';

@Injectable()
export class RedeemerService {
  private readonly logger = new Logger(RedeemerService.name);
  private timer: NodeJS.Timeout | null = null;
  private isDryRun = true;
  private config: any = {};

  constructor(
    private prisma: PrismaService,
    private ctf: CtfService,
    private gamma: GammaService,
    private clob: ClobService,
    private logs: LogsService,
    private simStats: SimStatsService,
    private settingsService: SettingsService,
    private events: EventsGateway,
  ) {}

  start(intervalSeconds: number, isDryRun: boolean, config: any) {
    this.isDryRun = isDryRun;
    this.config = config;
    this.timer = setInterval(() => this.checkAndRedeem(), intervalSeconds * 1000);
    this.checkAndRedeem();
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async checkAndRedeem() {
    try {
      await this.checkPriceTargets();
      await this.checkMarketResolutions();
    } catch (err) {
      await this.logs.error(StrategyType.COPY_TRADE, `Redeemer error: ${err.message}`);
    }
  }

  // ─── Price monitoring: take-profit and stop-loss ──────────────────────────

  private async checkPriceTargets() {
    const openPositions = await this.prisma.position.findMany({
      where: {
        status: PositionStatus.OPEN,
        strategyType: StrategyType.COPY_TRADE,
        isDryRun: this.isDryRun,
      },
    });

    for (const pos of openPositions) {
      try {
        const midpoint = await this.clob.getMidpoint(pos.tokenId);
        if (!midpoint || midpoint <= 0) continue;

        const avgBuyPrice = parseFloat(pos.avgBuyPrice.toString());
        const shares = parseFloat(pos.shares.toString());
        const totalCost = parseFloat(pos.totalCost.toString());

        const takeProfitEnabled = this.config.autoSellEnabled;
        const takeProfitThreshold = avgBuyPrice * (1 + this.config.autoSellProfitPercent / 100);
        const stopLossEnabled = this.config.stopLossPercent > 0;
        const stopLossThreshold = avgBuyPrice * (1 - this.config.stopLossPercent / 100);

        let reason: 'TAKE_PROFIT' | 'STOP_LOSS' | null = null;
        if (takeProfitEnabled && midpoint >= takeProfitThreshold) {
          reason = 'TAKE_PROFIT';
        } else if (stopLossEnabled && midpoint <= stopLossThreshold) {
          reason = 'STOP_LOSS';
        }

        if (!reason) continue;

        const pnl = shares * midpoint - totalCost;
        const pnlStr = `${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}`;
        const label = reason === 'TAKE_PROFIT' ? 'TAKE PROFIT' : 'STOP LOSS';

        await this.logs.info(
          StrategyType.COPY_TRADE,
          `[${this.isDryRun ? 'SIM' : 'LIVE'}] ${label}: ${pos.market} | ${pos.outcome} | bought @ $${avgBuyPrice.toFixed(4)} | now @ $${midpoint.toFixed(4)} | P&L: ${pnlStr}`,
          { positionId: pos.id, midpoint, avgBuyPrice, pnl },
        );

        if (this.isDryRun) {
          await this.simulateSell(pos, midpoint, pnl);
        } else {
          await this.placeLiveSell(pos, midpoint, shares);
        }
      } catch (err) {
        await this.logs.error(
          StrategyType.COPY_TRADE,
          `Price check error for position ${pos.id}: ${err.message}`,
        );
      }
    }
  }

  private async simulateSell(pos: any, sellPrice: number, pnl: number) {
    const simOutcome: SimOutcome = pnl >= 0 ? SimOutcome.WIN : SimOutcome.LOSS;

    await this.prisma.position.update({
      where: { id: pos.id },
      data: { status: PositionStatus.REDEEMED, resolvedPnl: pnl, simOutcome },
    });

    await this.simStats[pnl >= 0 ? 'recordWin' : 'recordLoss'](StrategyType.COPY_TRADE, pnl, pos.market);

    // Credit back: original cost + P&L (if stop-loss, pnl is negative so less is returned)
    const totalCost = parseFloat(pos.totalCost.toString());
    const refund = totalCost + pnl;
    if (refund > 0) {
      const currentBal = await this.settingsService.getNumber('COPY_TRADE_SIM_BALANCE', 0);
      await this.settingsService.set('COPY_TRADE_SIM_BALANCE', (currentBal + refund).toFixed(2));
    }

    this.events.emitPositionUpdate({ id: pos.id, status: 'REDEEMED', resolvedPnl: pnl, simOutcome });
    this.events.emitStatsUpdate({});
  }

  private async placeLiveSell(pos: any, sellPrice: number, shares: number) {
    try {
      // Try FOK first, fall back to GTC
      const result = await this.clob.placeFOKOrder(pos.tokenId, 'SELL', sellPrice * 0.98, shares);
      if (!result?.ordersFilled?.length) {
        await this.clob.placeGTCOrder(pos.tokenId, 'SELL', sellPrice, shares);
      }
      await this.prisma.position.update({
        where: { id: pos.id },
        data: { status: PositionStatus.SELLING },
      });
      this.events.emitPositionUpdate({ id: pos.id, status: 'SELLING' });
    } catch (err) {
      await this.logs.error(StrategyType.COPY_TRADE, `Live sell error: ${err.message}`);
    }
  }

  // ─── Market resolution: settle closed markets ─────────────────────────────

  private async checkMarketResolutions() {
    const positions = await this.prisma.position.findMany({
      where: {
        status: { in: [PositionStatus.OPEN, PositionStatus.SOLD] },
        strategyType: StrategyType.COPY_TRADE,
      },
    });

    for (const pos of positions) {
      let market = await this.gamma.getMarketByTokenId(pos.tokenId);
      if (!market) market = await this.gamma.getMarket(pos.conditionId);
      if (!market) continue;

      const isClosed = market.closed === true || market.active === false
        || market.isResolved === true || market.resolvedOutcome != null;
      if (!isClosed) continue;

      const rawOutcomes = market.outcomes;
      const outcomes: string[] = Array.isArray(rawOutcomes)
        ? rawOutcomes
        : typeof rawOutcomes === 'string'
          ? (() => { try { return JSON.parse(rawOutcomes); } catch { return ['YES', 'NO']; } })()
          : ['YES', 'NO'];

      const winnerOutcomeIndex = await this.determineWinner(pos.conditionId, market);
      const winnerOutcome = winnerOutcomeIndex >= 0 ? outcomes[winnerOutcomeIndex] : null;

      const shares = parseFloat(pos.shares.toString());
      const totalCost = parseFloat(pos.totalCost.toString());
      const isWin = winnerOutcome !== null && pos.outcome === winnerOutcome;
      // WIN: each share pays $1 at resolution
      const pnl = isWin ? shares - totalCost : -totalCost;
      const simOutcome = isWin ? SimOutcome.WIN : SimOutcome.LOSS;
      const pnlStr = `${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}`;

      if (this.isDryRun) {
        await this.prisma.position.update({
          where: { id: pos.id },
          data: { status: PositionStatus.REDEEMED, resolvedPnl: pnl, simOutcome },
        });
        await this.simStats[isWin ? 'recordWin' : 'recordLoss'](StrategyType.COPY_TRADE, pnl, pos.market);
        const refund = totalCost + pnl;
        if (refund > 0) {
          const currentBal = await this.settingsService.getNumber('COPY_TRADE_SIM_BALANCE', 0);
          await this.settingsService.set('COPY_TRADE_SIM_BALANCE', (currentBal + refund).toFixed(2));
        }
        await this.logs.info(
          StrategyType.COPY_TRADE,
          `[SIM] RESOLVED ${isWin ? 'WIN' : 'LOSS'}: ${pos.market} | ${pos.outcome} @ $${parseFloat(pos.avgBuyPrice.toString()).toFixed(4)} | P&L: ${pnlStr}`,
          { conditionId: pos.conditionId, outcome: pos.outcome, winner: winnerOutcome, pnl },
        );
        this.events.emitPositionUpdate({ id: pos.id, status: 'REDEEMED', resolvedPnl: pnl, simOutcome });
        this.events.emitStatsUpdate({});
        continue;
      }

      const txHash = await this.ctf.redeemPositions(pos.conditionId);
      if (txHash) {
        await this.prisma.position.update({
          where: { id: pos.id },
          data: { status: PositionStatus.REDEEMED, resolvedPnl: pnl, simOutcome },
        });
        await this.simStats[isWin ? 'recordWin' : 'recordLoss'](StrategyType.COPY_TRADE, pnl, pos.market);
        await this.logs.info(
          StrategyType.COPY_TRADE,
          `[LIVE] RESOLVED ${isWin ? 'WIN' : 'LOSS'}: ${pos.market} | P&L: ${pnlStr} | tx: ${txHash}`,
        );
        this.events.emitPositionUpdate({ id: pos.id, status: 'REDEEMED', resolvedPnl: pnl });
        this.events.emitStatsUpdate({});
      }
    }
  }

  private async determineWinner(conditionId: string, market: any): Promise<number> {
    try {
      for (let i = 0; i < 2; i++) {
        const payout = await this.ctf.getPayoutNumerator(conditionId, i);
        if (payout > 0) return i;
      }
    } catch {}

    const outcomes: string[] = market.outcomes || ['YES', 'NO'];
    if (market.resolvedOutcome) {
      const idx = outcomes.findIndex(
        (o: string) => o.toLowerCase() === market.resolvedOutcome.toLowerCase(),
      );
      if (idx >= 0) return idx;
    }
    return -1;
  }
}
