import { Injectable, Logger } from '@nestjs/common';
import { StrategyType, TradeSide, TradeStatus, PositionStatus, SimOutcome } from '@prisma/client';
import { ClobService } from '../../polymarket/clob.service';
import { CtfService } from '../../polymarket/ctf.service';
import { LogsService } from '../../logs/logs.service';
import { TradesService } from '../../trades/trades.service';
import { PositionsService } from '../../positions/positions.service';
import { SettingsService } from '../../settings/settings.service';
import { SimStatsService } from '../sim-stats.service';
import { EventsGateway } from '../../events/events.gateway';
import { DetectorService } from './detector.service';
import { TelegramService } from '../../notifications/telegram.service';

interface MMPosition {
  conditionId: string;
  asset: string;
  question: string;
  yesTokenId: string;
  noTokenId: string;
  yesSellOrderId?: string;
  noSellOrderId?: string;
  yesFilled: boolean;
  noFilled: boolean;
  startTime: Date;
  endTime: Date;
  isDryRun: boolean;
  dbPositionId?: number; // DB record for sim mode tracking
}

@Injectable()
export class MmExecutorService {
  private readonly logger = new Logger(MmExecutorService.name);
  private config: any = {};
  private isDryRun = true;
  private positions = new Map<string, MMPosition>();
  // Markets that have already been processed this session — never re-enter
  private doneConditionIds = new Set<string>();

  constructor(
    private clob: ClobService,
    private ctf: CtfService,
    private logs: LogsService,
    private trades: TradesService,
    private positionsService: PositionsService,
    private settings: SettingsService,
    private simStats: SimStatsService,
    private events: EventsGateway,
    private detector: DetectorService,
    private telegram: TelegramService,
  ) {}

  setConfig(config: any, isDryRun: boolean) {
    this.config = config;
    this.isDryRun = isDryRun;
  }

  reset() {
    this.positions.clear();
    this.doneConditionIds.clear();
  }

  async onMarketDetected(market: any, asset: string) {
    const conditionId = market.conditionId || market.condition_id;
    if (this.positions.has(conditionId)) return;
    if (this.doneConditionIds.has(conditionId)) return; // already processed this session

    // clobTokenIds is normalized to array by GammaService
    const tokens: string[] = Array.isArray(market.clobTokenIds) ? market.clobTokenIds : [];
    if (tokens.length < 2) {
      this.logger.warn(`Missing token IDs for market ${conditionId}`);
      await this.logs.warn(StrategyType.MARKET_MAKER, `Market missing token IDs: ${conditionId}`);
      return;
    }

    // eventStartTime = actual trading window start (creation date ≠ trading start)
    const startTime = new Date(market.eventStartTime || market.startDate || market.start_date_iso || Date.now());
    const endTime = new Date(market.endDate || market.end_date_iso);
    const now = Date.now();
    const timeUntilStart = startTime.getTime() - now;
    const timeUntilEnd = endTime.getTime() - now;

    // Hard guard: market window must still have enough time to trade
    if (timeUntilEnd <= 0) {
      this.logger.warn(`Ignoring finished market: "${market.question}"`);
      await this.logs.warn(StrategyType.MARKET_MAKER, `Ignoring finished market: "${market.question}"`);
      this.detector.releaseConditionId(conditionId);
      return;
    }
    if (timeUntilEnd < (this.config.cutLossTime + 30) * 1000) {
      this.logger.warn(`Ignoring market with insufficient time: "${market.question}" — only ${Math.round(timeUntilEnd / 1000)}s left`);
      await this.logs.warn(
        StrategyType.MARKET_MAKER,
        `Ignoring market with insufficient time: "${market.question}" — only ${Math.round(timeUntilEnd / 1000)}s left`,
      );
      this.detector.releaseConditionId(conditionId);
      return;
    }

    const position: MMPosition = {
      conditionId,
      asset,
      question: market.question,
      yesTokenId: tokens[0],
      noTokenId: tokens[1],
      yesFilled: false,
      noFilled: false,
      startTime,
      endTime,
      isDryRun: this.isDryRun,
    };
    this.positions.set(conditionId, position);

    this.logger.log(`[${this.isDryRun ? 'SIM' : 'LIVE'}] Market queued: "${market.question}" | window in ${Math.round(timeUntilStart / 1000)}s | ends in ${Math.round(timeUntilEnd / 1000)}s`);
    await this.logs.info(
      StrategyType.MARKET_MAKER,
      `[${this.isDryRun ? 'SIM' : 'LIVE'}] Market queued: "${market.question}" | ` +
      `window starts in ${Math.round(timeUntilStart / 1000)}s | ends in ${Math.round(timeUntilEnd / 1000)}s`,
      { conditionId, asset },
    );

    // Enter immediately — order book is open before the resolution window starts
    setTimeout(() => this.enter(conditionId), 0);

    // Schedule cut-loss check before market close
    const cutLossAt = endTime.getTime() - this.config.cutLossTime * 1000;
    const cutLossDelay = Math.max(0, cutLossAt - now);
    setTimeout(() => this.cutLoss(conditionId), cutLossDelay);
  }

  private async enter(conditionId: string) {
    const pos = this.positions.get(conditionId);
    if (!pos) return;

    const now = Date.now();
    const timeLeft = pos.endTime.getTime() - now;

    // Safety check: don't enter if less than cutLossTime + 10s remaining
    if (timeLeft < (this.config.cutLossTime + 10) * 1000) {
      this.logger.warn(`Skipping entry — only ${Math.round(timeLeft / 1000)}s left in "${pos.question}"`);
      await this.logs.warn(
        StrategyType.MARKET_MAKER,
        `Skipping entry — only ${Math.round(timeLeft / 1000)}s left in "${pos.question}"`,
      );
      this.cleanup(conditionId);
      return;
    }

    this.logger.log(`[${this.isDryRun ? 'SIM' : 'LIVE'}] Entering: "${pos.question}" | size: $${this.config.tradeSize} | target: $${this.config.sellPrice} | ${Math.round(timeLeft / 1000)}s remaining`);
    await this.logs.info(
      StrategyType.MARKET_MAKER,
      `[${this.isDryRun ? 'SIM' : 'LIVE'}] Entering: "${pos.question}" | ` +
      `size: $${this.config.tradeSize} | target sell: $${this.config.sellPrice} | ` +
      `${Math.round(timeLeft / 1000)}s remaining`,
    );

    if (this.isDryRun) {
      await this.enterSim(pos);
      return;
    }

    // Live mode: split via CTF then place GTC sell orders on both sides
    const splitTxHash = await this.ctf.splitPosition(conditionId, this.config.tradeSize);
    if (!splitTxHash) {
      await this.logs.error(StrategyType.MARKET_MAKER, `CTF split failed for ${pos.question}`);
      this.cleanup(conditionId);
      return;
    }
    await this.logs.info(StrategyType.MARKET_MAKER, `[LIVE] Split tx: ${splitTxHash}`);

    try {
      const [yesResult, noResult] = await Promise.all([
        this.clob.placeGTCOrder(pos.yesTokenId, 'SELL', this.config.sellPrice, this.config.tradeSize),
        this.clob.placeGTCOrder(pos.noTokenId, 'SELL', this.config.sellPrice, this.config.tradeSize),
      ]);

      if (yesResult?.id) pos.yesSellOrderId = yesResult.id;
      if (noResult?.id) pos.noSellOrderId = noResult.id;

      await this.logs.info(
        StrategyType.MARKET_MAKER,
        `[LIVE] GTC orders placed: YES order=${pos.yesSellOrderId}, NO order=${pos.noSellOrderId}`,
      );

      this.monitorFillsLive(conditionId);
    } catch (err) {
      await this.logs.error(StrategyType.MARKET_MAKER, `Order placement failed: ${err.message}`);
      this.cleanup(conditionId);
    }
  }

  // ─── Simulation entry ─────────────────────────────────────────────────────

  private async enterSim(pos: MMPosition) {
    const { conditionId } = pos;
    const tradeSize = this.config.tradeSize;
    const tokensPerSide = tradeSize / 0.5; // $10 split → 20 YES + 20 NO tokens (each worth $0.5)

    // Final hard guard — check actual time right before committing
    const nowMs = Date.now();
    const timeLeftMs = pos.endTime.getTime() - nowMs;
    const minRequired = (this.config.cutLossTime + 30) * 1000;
    if (timeLeftMs <= 0) {
      this.logger.warn(`[SIM] Entry aborted — market already expired: "${pos.question}" (ended ${Math.round(-timeLeftMs / 1000)}s ago)`);
      await this.logs.warn(StrategyType.MARKET_MAKER, `[SIM] Entry aborted — market already expired: "${pos.question}"`);
      this.cleanup(conditionId);
      return;
    }
    if (timeLeftMs < minRequired) {
      this.logger.warn(`[SIM] Entry aborted — only ${Math.round(timeLeftMs / 1000)}s left, need ${Math.round(minRequired / 1000)}s: "${pos.question}"`);
      await this.logs.warn(StrategyType.MARKET_MAKER, `[SIM] Entry aborted — insufficient time (${Math.round(timeLeftMs / 1000)}s): "${pos.question}"`);
      this.cleanup(conditionId);
      return;
    }

    // Check sim balance
    const balance = await this.settings.getNumber('MM_SIM_BALANCE', 1000);
    if (balance < tradeSize) {
      this.logger.warn(`[SIM] Insufficient balance: $${balance.toFixed(2)} < $${tradeSize}`);
      await this.logs.warn(
        StrategyType.MARKET_MAKER,
        `[SIM] Insufficient balance: $${balance.toFixed(2)} — need $${tradeSize}`,
      );
      this.cleanup(conditionId);
      return;
    }

    // Deduct from sim balance
    await this.settings.set('MM_SIM_BALANCE', (balance - tradeSize).toFixed(2));

    // Create DB position so it shows in the Positions page
    try {
      const dbPos = await this.positionsService.create({
        conditionId,
        tokenId: pos.yesTokenId,
        market: pos.question,
        shares: tokensPerSide,
        avgBuyPrice: 0.5,
        totalCost: tradeSize,
        outcome: 'UP+DOWN',
        strategyType: StrategyType.MARKET_MAKER,
        isDryRun: true,
      });
      pos.dbPositionId = dbPos.id;

      // Record the BUY trade
      await this.trades.create({
        positionId: dbPos.id,
        conditionId,
        tokenId: pos.yesTokenId,
        market: pos.question,
        side: TradeSide.BUY,
        shares: tokensPerSide,
        price: 0.5,
        cost: tradeSize,
        status: TradeStatus.FILLED,
        isDryRun: true,
        strategyType: StrategyType.MARKET_MAKER,
      });

      await this.simStats.recordBuy(StrategyType.MARKET_MAKER);
      this.events.emitPositionUpdate(dbPos);
    } catch (err) {
      this.logger.error(`[SIM] Failed to create DB position: ${err.message}`);
    }

    const remainingBal = balance - tradeSize;
    this.logger.log(`[SIM] Simulated split: $${tradeSize} → ${tokensPerSide} YES + ${tokensPerSide} NO tokens | balance: $${remainingBal.toFixed(2)}`);
    await this.logs.info(
      StrategyType.MARKET_MAKER,
      `[SIM] Simulated split: $${tradeSize} → ${tokensPerSide} YES + ${tokensPerSide} NO tokens | remaining balance: $${remainingBal.toFixed(2)}`,
    );
    this.telegram.notifyMMEntry({
      isDryRun: true,
      market: pos.question,
      asset: pos.asset,
      duration: this.config.duration || '5m',
      tradeSize,
      sellPrice: this.config.sellPrice,
      endTime: pos.endTime,
      balance: remainingBal,
    });
    await this.logs.info(
      StrategyType.MARKET_MAKER,
      `[SIM] Watching for price ≥ $${this.config.sellPrice} on YES (${pos.yesTokenId.slice(-6)}) and NO (${pos.noTokenId.slice(-6)})`,
    );

    this.monitorFillsSim(conditionId);
  }

  // ─── Simulation fill monitoring ───────────────────────────────────────────

  private monitorFillsSim(conditionId: string) {
    const interval = setInterval(async () => {
      const pos = this.positions.get(conditionId);
      if (!pos || Date.now() > pos.endTime.getTime()) {
        clearInterval(interval);
        return;
      }

      try {
        const [yesMid, noMid] = await Promise.all([
          this.clob.getMidpoint(pos.yesTokenId),
          this.clob.getMidpoint(pos.noTokenId),
        ]);

        if (!pos.yesFilled && yesMid >= this.config.sellPrice) {
          pos.yesFilled = true;
          const pnl = this.config.tradeSize * (this.config.sellPrice - 0.5);
          this.logger.log(`[SIM] YES filled at $${yesMid.toFixed(4)} | est. P&L: +$${pnl.toFixed(2)}`);
          await this.logs.info(
            StrategyType.MARKET_MAKER,
            `[SIM] YES filled at $${yesMid.toFixed(4)} (target $${this.config.sellPrice}) | est. P&L: +$${pnl.toFixed(2)}`,
          );
        }

        if (!pos.noFilled && noMid >= this.config.sellPrice) {
          pos.noFilled = true;
          const pnl = this.config.tradeSize * (this.config.sellPrice - 0.5);
          this.logger.log(`[SIM] NO filled at $${noMid.toFixed(4)} | est. P&L: +$${pnl.toFixed(2)}`);
          await this.logs.info(
            StrategyType.MARKET_MAKER,
            `[SIM] NO filled at $${noMid.toFixed(4)} (target $${this.config.sellPrice}) | est. P&L: +$${pnl.toFixed(2)}`,
          );
        }

        if (pos.yesFilled && pos.noFilled) {
          clearInterval(interval);
          const totalPnl = 2 * this.config.tradeSize * (this.config.sellPrice - 0.5);
          this.logger.log(`[SIM] Both sides filled — profit! est. P&L: +$${totalPnl.toFixed(2)}`);
          await this.logs.info(StrategyType.MARKET_MAKER, `[SIM] Both sides filled — full profit! est. P&L: +$${totalPnl.toFixed(2)}`);
          // Update DB position
          await this.closeSimPosition(pos, totalPnl, true);
        }
      } catch {}
    }, 5000);
  }

  // ─── Live fill monitoring ─────────────────────────────────────────────────

  private monitorFillsLive(conditionId: string) {
    const interval = setInterval(async () => {
      const pos = this.positions.get(conditionId);
      if (!pos || Date.now() > pos.endTime.getTime()) {
        clearInterval(interval);
        return;
      }

      if (pos.yesSellOrderId && !pos.yesFilled) {
        const order = await this.clob.getOrderStatus(pos.yesSellOrderId);
        if (order?.status === 'MATCHED') {
          pos.yesFilled = true;
          await this.logs.info(StrategyType.MARKET_MAKER, `[LIVE] YES sell order filled`);
        }
      }
      if (pos.noSellOrderId && !pos.noFilled) {
        const order = await this.clob.getOrderStatus(pos.noSellOrderId);
        if (order?.status === 'MATCHED') {
          pos.noFilled = true;
          await this.logs.info(StrategyType.MARKET_MAKER, `[LIVE] NO sell order filled`);
        }
      }
    }, 5000);
  }

  // ─── Cut-loss ──────────────────────────────────────────────────────────────

  private async cutLoss(conditionId: string) {
    const pos = this.positions.get(conditionId);
    if (!pos) return;

    const timeLeft = Math.round((pos.endTime.getTime() - Date.now()) / 1000);

    if (pos.isDryRun) {
      await this.cutLossSim(pos, timeLeft);
    } else {
      await this.cutLossLive(pos);
    }

    this.cleanup(conditionId);
  }

  private async cutLossSim(pos: MMPosition, timeLeft: number) {
    const [yesMid, noMid] = await Promise.all([
      this.clob.getMidpoint(pos.yesTokenId).catch(() => 0),
      this.clob.getMidpoint(pos.noTokenId).catch(() => 0),
    ]);

    this.logger.log(`[SIM] Cut-loss: "${pos.question}" | ${timeLeft}s left | YES=$${yesMid.toFixed(3)} NO=$${noMid.toFixed(3)} | yesFilled=${pos.yesFilled} noFilled=${pos.noFilled}`);
    await this.logs.info(
      StrategyType.MARKET_MAKER,
      `[SIM] Cut-loss check for "${pos.question}" | ${timeLeft}s left | ` +
      `YES mid=$${yesMid.toFixed(4)} NO mid=$${noMid.toFixed(4)} | ` +
      `YES filled=${pos.yesFilled} NO filled=${pos.noFilled}`,
    );

    let pnl: number;
    if (!pos.yesFilled && !pos.noFilled) {
      pnl = -(this.config.tradeSize * 0.02); // ~2% spread cost
      await this.logs.info(
        StrategyType.MARKET_MAKER,
        `[SIM] Cut-loss: neither side filled, merging back. Est. loss: $${pnl.toFixed(2)}`,
      );
    } else if (pos.yesFilled && !pos.noFilled) {
      const sellAtMarket = noMid * 0.95;
      pnl = this.config.tradeSize * (this.config.sellPrice - 0.5)
          - this.config.tradeSize * (0.5 - sellAtMarket);
      await this.logs.info(
        StrategyType.MARKET_MAKER,
        `[SIM] YES filled, NO cut-loss at $${sellAtMarket.toFixed(4)}. Est. net P&L: $${pnl.toFixed(2)}`,
      );
    } else if (!pos.yesFilled && pos.noFilled) {
      const sellAtMarket = yesMid * 0.95;
      pnl = this.config.tradeSize * (this.config.sellPrice - 0.5)
          - this.config.tradeSize * (0.5 - sellAtMarket);
      await this.logs.info(
        StrategyType.MARKET_MAKER,
        `[SIM] NO filled, YES cut-loss at $${sellAtMarket.toFixed(4)}. Est. net P&L: $${pnl.toFixed(2)}`,
      );
    } else {
      pnl = 2 * this.config.tradeSize * (this.config.sellPrice - 0.5);
      await this.logs.info(StrategyType.MARKET_MAKER, `[SIM] Both sides filled — profit! P&L: +$${pnl.toFixed(2)}`);
    }

    (pos as any)._isCutLoss = true;
    await this.closeSimPosition(pos, pnl, pnl >= 0);
  }

  private async closeSimPosition(pos: MMPosition, pnl: number, isWin: boolean) {
    if (!pos.dbPositionId) return;

    try {
      const simOutcome = isWin ? SimOutcome.WIN : SimOutcome.LOSS;
      await this.positionsService.update(pos.dbPositionId, {
        status: PositionStatus.REDEEMED,
        resolvedPnl: pnl,
        simOutcome,
      });

      // Credit back: original cost + P&L
      const refund = this.config.tradeSize + pnl;
      if (refund > 0) {
        const currentBal = await this.settings.getNumber('MM_SIM_BALANCE', 0);
        await this.settings.set('MM_SIM_BALANCE', (currentBal + refund).toFixed(2));
      }

      await this.simStats[isWin ? 'recordWin' : 'recordLoss'](StrategyType.MARKET_MAKER, pnl, pos.question);
      this.events.emitPositionUpdate({ id: pos.dbPositionId, status: 'REDEEMED', resolvedPnl: pnl, simOutcome });
      this.events.emitStatsUpdate({});

      const newBal = await this.settings.getNumber('MM_SIM_BALANCE', 0);
      this.telegram.notifyMMClose({
        isDryRun: true,
        market: pos.question,
        asset: pos.asset,
        duration: this.config.duration || '5m',
        tradeSize: this.config.tradeSize,
        pnl,
        balance: newBal,
        isCutLoss: (pos as any)._isCutLoss ?? false,
        yesFilled: pos.yesFilled,
        noFilled: pos.noFilled,
      });
    } catch (err) {
      this.logger.error(`[SIM] Failed to close DB position: ${err.message}`);
    }
  }

  private async cutLossLive(pos: MMPosition) {
    await this.logs.info(StrategyType.MARKET_MAKER, `[LIVE] Cut-loss triggered for "${pos.question}"`);

    if (!pos.yesFilled && !pos.noFilled) {
      if (pos.yesSellOrderId) await this.clob.cancelOrder(pos.yesSellOrderId);
      if (pos.noSellOrderId) await this.clob.cancelOrder(pos.noSellOrderId);
      const mergeTxHash = await this.ctf.mergePositions(pos.conditionId, this.config.tradeSize);
      if (mergeTxHash) {
        await this.logs.info(StrategyType.MARKET_MAKER, `[LIVE] Merged positions back — tx: ${mergeTxHash}`);
      } else {
        await this.logs.error(StrategyType.MARKET_MAKER, `Merge failed for ${pos.conditionId}`);
      }
    } else if (pos.yesFilled && !pos.noFilled) {
      if (pos.noSellOrderId) await this.clob.cancelOrder(pos.noSellOrderId);
      const mid = await this.clob.getMidpoint(pos.noTokenId);
      await this.clob.placeFOKOrder(pos.noTokenId, 'SELL', mid * 0.95, this.config.tradeSize);
      await this.logs.info(StrategyType.MARKET_MAKER, `[LIVE] Cut-loss: sold NO at $${(mid * 0.95).toFixed(4)}`);
    } else if (!pos.yesFilled && pos.noFilled) {
      if (pos.yesSellOrderId) await this.clob.cancelOrder(pos.yesSellOrderId);
      const mid = await this.clob.getMidpoint(pos.yesTokenId);
      await this.clob.placeFOKOrder(pos.yesTokenId, 'SELL', mid * 0.95, this.config.tradeSize);
      await this.logs.info(StrategyType.MARKET_MAKER, `[LIVE] Cut-loss: sold YES at $${(mid * 0.95).toFixed(4)}`);
    } else {
      await this.logs.info(StrategyType.MARKET_MAKER, `[LIVE] Both sides already filled — profit!`);
    }

    this.events.emitStatsUpdate({ type: 'MARKET_MAKER' });
  }

  private cleanup(conditionId: string) {
    this.doneConditionIds.add(conditionId); // prevent re-entry this session
    this.detector.releaseConditionId(conditionId);
    this.positions.delete(conditionId);
  }
}
