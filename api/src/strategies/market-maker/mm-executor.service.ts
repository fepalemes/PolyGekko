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
import { BinanceService } from '../../polymarket/binance.service';

interface MMPosition {
  conditionId: string;
  asset: string;
  question: string;
  yesTokenId: string;
  noTokenId: string;
  yesBuyOrderId?: string;
  noBuyOrderId?: string;
  yesSellOrderId?: string;
  noSellOrderId?: string;
  yesBuyFilled: boolean;
  noBuyFilled: boolean;
  yesSellFilled: boolean;
  noSellFilled: boolean;
  yesSharesOwned: number;
  noSharesOwned: number;
  targetSellYes: number;
  targetSellNo: number;
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
    private binance: BinanceService,
  ) {}

  setConfig(config: any, isDryRun: boolean) {
    this.config = config;
    this.isDryRun = isDryRun;
  }

  reset() {
    this.positions.clear();
    this.doneConditionIds.clear();
  }

  async stopAll() {
    this.logger.warn(`[MM] Stop clicked. Panic-selling ${this.positions.size} open positions...`);
    const posEntries = Array.from(this.positions.entries());
    for (const [conditionId, pos] of posEntries) {
      this.logger.warn(`[MM] Liquidating "${pos.question}"`);
      await this.logs.warn(StrategyType.MARKET_MAKER, `[PANIC SELL] Strategy stopped. Liquidating "${pos.question}"...`);
      await this.cutLoss(conditionId);
    }
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
      yesBuyFilled: false,
      noBuyFilled: false,
      yesSellFilled: false,
      noSellFilled: false,
      yesSharesOwned: 0,
      noSharesOwned: 0,
      targetSellYes: 0,
      targetSellNo: 0,
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

    const maxPerMin = await this.settings.getGlobalMaxEntriesPerMinute();
    if (maxPerMin > 0) {
      const allowed = await this.positionsService.acquireGlobalEntry(maxPerMin, 60);
      if (!allowed) {
        this.logger.warn(`[RATE LIMIT] Max entries per minute (${maxPerMin}) reached. Skipping "${pos.question}"`);
        await this.logs.warn(StrategyType.MARKET_MAKER, `[RATE LIMIT] Max entries per minute (${maxPerMin}) reached — skipping`);
        this.cleanup(conditionId);
        return;
      }
    }

    const tradeSize = this.config.dynamicSizingEnabled
      ? Number((Math.random() * (this.config.maxAllocation - this.config.minAllocation) + this.config.minAllocation).toFixed(2))
      : this.config.tradeSize;
    
    (pos as any)._tradeSize = tradeSize;

    // --- Binance Trend Sizing ---
    let yesWeight = 0.5;
    let noWeight = 0.5;
    if (this.config.binanceTrendEnabled && pos.asset) {
      const trend = await this.binance.getTrendPercent(pos.asset);
      const weights = this.binance.calculateWeight(trend, this.config.maxBiasPercent || 80);
      yesWeight = weights.yesWeight;
      noWeight = weights.noWeight;
      await this.logs.info(StrategyType.MARKET_MAKER, `[BINANCE] Trend for ${pos.asset} is ${trend.toFixed(2)}%. Ratio -> YES: ${Math.round(yesWeight*100)}% / NO: ${Math.round(noWeight*100)}%`);
    }

    const yesCapital = tradeSize * yesWeight;
    const noCapital = tradeSize * noWeight;

    const [yesMid, noMid] = await Promise.all([
      this.clob.getMidpoint(pos.yesTokenId).catch(() => 0.5),
      this.clob.getMidpoint(pos.noTokenId).catch(() => 0.5),
    ]);

    const yesBuyPrice = Math.min(0.99, Math.max(0.01, yesMid));
    const noBuyPrice = Math.min(0.99, Math.max(0.01, noMid));

    pos.targetSellYes = this.config.dynamicSizingEnabled ? yesBuyPrice + this.config.spreadProfitTarget : this.config.sellPrice;
    pos.targetSellNo = this.config.dynamicSizingEnabled ? noBuyPrice + this.config.spreadProfitTarget : this.config.sellPrice;

    pos.yesSharesOwned = (yesCapital / yesBuyPrice) || 0;
    pos.noSharesOwned = (noCapital / noBuyPrice) || 0;

    this.logger.log(`[${this.isDryRun ? 'SIM' : 'LIVE'}] Entering: "${pos.question}" | size: $${tradeSize} (${(yesWeight*100).toFixed(0)}/${(noWeight*100).toFixed(0)}) | YES tgt: $${pos.targetSellYes.toFixed(3)}, NO tgt: $${pos.targetSellNo.toFixed(3)}`);
    await this.logs.info(
      StrategyType.MARKET_MAKER,
      `[${this.isDryRun ? 'SIM' : 'LIVE'}] Entering: "${pos.question}" | ` +
      `capital: $${tradeSize.toFixed(2)} | YES: $${yesCapital.toFixed(2)} @ $${yesBuyPrice.toFixed(3)} | NO: $${noCapital.toFixed(2)} @ $${noBuyPrice.toFixed(3)}`,
    );

    if (this.isDryRun) {
      await this.enterSim(pos, tradeSize, yesCapital, noCapital, yesBuyPrice, noBuyPrice);
      return;
    }

    // ── Live balance guard ────────────────────────────────────────────────
    const liveBalance = await this.clob.getBalance();
    const minLiveBal = await this.settings.getGlobalWalletMargin();
    if (liveBalance < tradeSize) {
      this.logger.warn(`[LIVE] Insufficient balance: $${liveBalance.toFixed(2)} < $${tradeSize}`);
      await this.logs.warn(StrategyType.MARKET_MAKER, `[LIVE] Insufficient balance: $${liveBalance.toFixed(2)} — need $${tradeSize}`);
      this.cleanup(conditionId);
      return;
    }
    if (liveBalance - tradeSize < minLiveBal) {
      this.logger.warn(`[LIVE] Order trades below min margin $${minLiveBal} (balance: $${liveBalance.toFixed(2)})`);
      await this.logs.warn(StrategyType.MARKET_MAKER, `[LIVE] Order would leave balance below min margin $${minLiveBal} (balance: $${liveBalance.toFixed(2)}) — skipping`);
      this.cleanup(conditionId);
      return;
    }

    // Live mode: place GTC BUY orders on both sides
    try {
      const [yesResult, noResult] = await Promise.all([
        this.clob.placeGTCOrder(pos.yesTokenId, 'BUY', yesBuyPrice, pos.yesSharesOwned),
        this.clob.placeGTCOrder(pos.noTokenId, 'BUY', noBuyPrice, pos.noSharesOwned),
      ]);

      if (yesResult?.id) pos.yesBuyOrderId = yesResult.id;
      if (noResult?.id) pos.noBuyOrderId = noResult.id;

      await this.logs.info(
        StrategyType.MARKET_MAKER,
        `[LIVE] GTC BUY orders placed: YES order=${pos.yesBuyOrderId}, NO order=${pos.noBuyOrderId}`,
      );

      this.monitorFillsLive(conditionId);
    } catch (err) {
      await this.logs.error(StrategyType.MARKET_MAKER, `BUY Order placement failed: ${err.message}`);
      this.cleanup(conditionId);
    }
  }

  // ─── Simulation entry ─────────────────────────────────────────────────────

  private async enterSim(
    pos: MMPosition,
    tradeSize: number,
    yesCapital: number,
    noCapital: number,
    yesBuyPrice: number,
    noBuyPrice: number
  ) {
    const { conditionId } = pos;
    // In SIM, we assume BUY fills immediately at the Midpoint we fetched.
    pos.yesBuyFilled = true;
    pos.noBuyFilled = true;

    // Final hard guard
    const nowMs = Date.now();
    const timeLeftMs = pos.endTime.getTime() - nowMs;
    const minRequired = (this.config.cutLossTime + 30) * 1000;
    if (timeLeftMs <= 0) {
      this.logger.warn(`[SIM] Entry aborted — market already expired: "${pos.question}"`);
      await this.logs.warn(StrategyType.MARKET_MAKER, `[SIM] Entry aborted — market already expired: "${pos.question}"`);
      this.cleanup(conditionId);
      return;
    }
    if (timeLeftMs < minRequired) {
      this.logger.warn(`[SIM] Entry aborted — insufficient time`);
      await this.logs.warn(StrategyType.MARKET_MAKER, `[SIM] Entry aborted — insufficient time (${Math.round(timeLeftMs / 1000)}s): "${pos.question}"`);
      this.cleanup(conditionId);
      return;
    }

    // Check sim balance
    const balance = await this.settings.getNumber('MM_SIM_BALANCE', 1000);
    const minBal = await this.settings.getGlobalWalletMargin();
    
    if (balance < tradeSize) {
      this.logger.warn(`[SIM] Insufficient balance: $${balance.toFixed(2)} < $${tradeSize}`);
      await this.logs.warn(StrategyType.MARKET_MAKER, `[SIM] Insufficient balance: $${balance.toFixed(2)} — need $${tradeSize}`);
      this.cleanup(conditionId);
      return;
    }
    
    if (balance - tradeSize < minBal) {
      this.logger.warn(`[SIM] Order leaves balance below min margin $${minBal}`);
      this.cleanup(conditionId);
      return;
    }

    // Deduct from sim balance
    await this.settings.set('MM_SIM_BALANCE', (balance - tradeSize).toFixed(2));

    // Create DB position
    try {
      const dbPos = await this.positionsService.create({
        conditionId,
        tokenId: pos.yesTokenId,
        market: pos.question,
        shares: pos.yesSharesOwned + pos.noSharesOwned, // total shares combined
        avgBuyPrice: (yesBuyPrice + noBuyPrice) / 2, // arbitrary for display
        totalCost: tradeSize,
        outcome: 'UP+DOWN',
        strategyType: StrategyType.MARKET_MAKER,
        isDryRun: true,
      });
      pos.dbPositionId = dbPos.id;

      // Make 2 trade records for clarity
      await this.trades.create({
        positionId: dbPos.id, conditionId, tokenId: pos.yesTokenId, market: pos.question, side: TradeSide.BUY,
        shares: pos.yesSharesOwned, price: yesBuyPrice, cost: yesCapital, status: TradeStatus.FILLED, isDryRun: true, strategyType: StrategyType.MARKET_MAKER,
      });
      await this.trades.create({
        positionId: dbPos.id, conditionId, tokenId: pos.noTokenId, market: pos.question, side: TradeSide.BUY,
        shares: pos.noSharesOwned, price: noBuyPrice, cost: noCapital, status: TradeStatus.FILLED, isDryRun: true, strategyType: StrategyType.MARKET_MAKER,
      });

      await this.simStats.recordBuy(StrategyType.MARKET_MAKER);
      this.events.emitPositionUpdate(dbPos);
    } catch (err) {
      this.logger.error(`[SIM] Failed to create DB position: ${err.message}`);
    }

    const remainingBal = balance - tradeSize;
    this.logger.log(`[SIM] Buy filled: $${tradeSize} → ${pos.yesSharesOwned.toFixed(2)} YES & ${pos.noSharesOwned.toFixed(2)} NO | bal: $${remainingBal.toFixed(2)}`);
    await this.logs.info(StrategyType.MARKET_MAKER, `[SIM] Buy filled: $${tradeSize} | remaining balance: $${remainingBal.toFixed(2)}`);
    
    this.telegram.notifyMMEntry({
      isDryRun: true,
      market: pos.question,
      asset: pos.asset,
      duration: this.config.duration || '5m',
      tradeSize,
      sellPrice: (pos.targetSellYes + pos.targetSellNo) / 2, // approximation
      endTime: pos.endTime,
      balance: remainingBal,
    });
    
    await this.logs.info(StrategyType.MARKET_MAKER, `[SIM] Listed SELL orders. Waiting for YES ≥ $${pos.targetSellYes.toFixed(3)} and NO ≥ $${pos.targetSellNo.toFixed(3)}`);
    this.monitorFillsSim(conditionId, tradeSize);
  }

  // ─── Simulation fill monitoring ───────────────────────────────────────────

  private monitorFillsSim(conditionId: string, tradeSize: number) {
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

        if (!pos.yesSellFilled && yesMid >= pos.targetSellYes) {
          pos.yesSellFilled = true;
          const pnl = (pos.targetSellYes * pos.yesSharesOwned) - (tradeSize / 2); // approximate PnL math
          this.logger.log(`[SIM] YES SELL filled at $${yesMid.toFixed(3)}`);
          await this.logs.info(StrategyType.MARKET_MAKER, `[SIM] YES SELL filled at $${yesMid.toFixed(3)} (target $${pos.targetSellYes.toFixed(3)})`);
        }

        if (!pos.noSellFilled && noMid >= pos.targetSellNo) {
          pos.noSellFilled = true;
          this.logger.log(`[SIM] NO SELL filled at $${noMid.toFixed(3)}`);
          await this.logs.info(StrategyType.MARKET_MAKER, `[SIM] NO SELL filled at $${noMid.toFixed(3)} (target $${pos.targetSellNo.toFixed(3)})`);
        }

        if (pos.yesSellFilled && pos.noSellFilled) {
          clearInterval(interval);
          const revenue = (pos.targetSellYes * pos.yesSharesOwned) + (pos.targetSellNo * pos.noSharesOwned);
          const totalPnl = revenue - tradeSize;
          this.logger.log(`[SIM] Both SELLs filled — profit! est. P&L: +$${totalPnl.toFixed(2)}`);
          await this.logs.info(StrategyType.MARKET_MAKER, `[SIM] Both SELLs filled! est. P&L: +$${totalPnl.toFixed(2)}`);
          await this.closeSimPosition(pos, totalPnl, true, tradeSize);
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

      // Track Bids
      if (pos.yesBuyOrderId && !pos.yesBuyFilled) {
        const order = await this.clob.getOrderStatus(pos.yesBuyOrderId);
        if (order?.status === 'MATCHED') {
          pos.yesBuyFilled = true;
          await this.logs.info(StrategyType.MARKET_MAKER, `[LIVE] YES BUY order filled. Listing SELL...`);
          const sell = await this.clob.placeGTCOrder(pos.yesTokenId, 'SELL', pos.targetSellYes, pos.yesSharesOwned);
          if (sell?.id) pos.yesSellOrderId = sell.id;
        }
      }
      if (pos.noBuyOrderId && !pos.noBuyFilled) {
        const order = await this.clob.getOrderStatus(pos.noBuyOrderId);
        if (order?.status === 'MATCHED') {
          pos.noBuyFilled = true;
          await this.logs.info(StrategyType.MARKET_MAKER, `[LIVE] NO BUY order filled. Listing SELL...`);
          const sell = await this.clob.placeGTCOrder(pos.noTokenId, 'SELL', pos.targetSellNo, pos.noSharesOwned);
          if (sell?.id) pos.yesSellOrderId = sell.id; // Bug fix: noSellOrderId
        }
      }

      // Track Asks
      if (pos.yesSellOrderId && !pos.yesSellFilled) {
        const order = await this.clob.getOrderStatus(pos.yesSellOrderId);
        if (order?.status === 'MATCHED') {
          pos.yesSellFilled = true;
          await this.logs.info(StrategyType.MARKET_MAKER, `[LIVE] YES SELL order filled`);
        }
      }
      if (pos.noSellOrderId && !pos.noSellFilled) {
        const order = await this.clob.getOrderStatus(pos.noSellOrderId);
        if (order?.status === 'MATCHED') {
          pos.noSellFilled = true;
          await this.logs.info(StrategyType.MARKET_MAKER, `[LIVE] NO SELL order filled`);
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
    const tradeSize = this.config.dynamicSizingEnabled
      ? (pos as any)._tradeSize || this.config.tradeSize
      : this.config.tradeSize;

    const [yesMid, noMid] = await Promise.all([
      this.clob.getMidpoint(pos.yesTokenId).catch(() => 0),
      this.clob.getMidpoint(pos.noTokenId).catch(() => 0),
    ]);

    this.logger.log(`[SIM] Cut-loss: "${pos.question}" | ${timeLeft}s left | YES=$${yesMid.toFixed(3)} NO=$${noMid.toFixed(3)} | yesSell=${pos.yesSellFilled} noSell=${pos.noSellFilled}`);
    
    let pnl: number = 0;
    
    // Simplistic P&L derivation
    const yesRevenue = pos.yesSellFilled ? (pos.yesSharesOwned * pos.targetSellYes) : (pos.yesSharesOwned * yesMid * 0.95);
    const noRevenue = pos.noSellFilled ? (pos.noSharesOwned * pos.targetSellNo) : (pos.noSharesOwned * noMid * 0.95);
    
    pnl = (yesRevenue + noRevenue) - tradeSize;

    if (!pos.yesSellFilled && !pos.noSellFilled) {
      await this.logs.info(StrategyType.MARKET_MAKER, `[SIM] Cut-loss: neither side sold, market dumping. Est. P&L: $${pnl.toFixed(2)}`);
    } else if (pos.yesSellFilled && !pos.noSellFilled) {
      await this.logs.info(StrategyType.MARKET_MAKER, `[SIM] YES sold at top, NO cut-loss. Est. net P&L: $${pnl.toFixed(2)}`);
    } else if (!pos.yesSellFilled && pos.noSellFilled) {
      await this.logs.info(StrategyType.MARKET_MAKER, `[SIM] NO sold at top, YES cut-loss. Est. net P&L: $${pnl.toFixed(2)}`);
    } else {
      pnl = (pos.targetSellYes * pos.yesSharesOwned) + (pos.targetSellNo * pos.noSharesOwned) - tradeSize;
      await this.logs.info(StrategyType.MARKET_MAKER, `[SIM] Both sides filled — profit! P&L: +$${pnl.toFixed(2)}`);
    }

    (pos as any)._isCutLoss = true;
    await this.closeSimPosition(pos, pnl, pnl >= 0, tradeSize);
  }

  private async closeSimPosition(pos: MMPosition, pnl: number, isWin: boolean, tradeSize: number = this.config.tradeSize) {
    if (!pos.dbPositionId) return;

    try {
      const simOutcome = isWin ? SimOutcome.WIN : SimOutcome.LOSS;
      await this.positionsService.update(pos.dbPositionId, {
        status: PositionStatus.REDEEMED,
        resolvedPnl: pnl,
        simOutcome,
      });

      // Credit back: original cost + P&L
      const refund = tradeSize + pnl;
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
        tradeSize: tradeSize,
        pnl,
        balance: newBal,
        isCutLoss: (pos as any)._isCutLoss ?? false,
        yesFilled: pos.yesSellFilled,
        noFilled: pos.noSellFilled,
      });
    } catch (err) {
      this.logger.error(`[SIM] Failed to close DB position: ${err.message}`);
    }
  }

  private async cutLossLive(pos: MMPosition) {
    await this.logs.info(StrategyType.MARKET_MAKER, `[LIVE] Cut-loss triggered for "${pos.question}"`);

    // Cancel pending RESTING BIDS
    if (pos.yesBuyOrderId && !pos.yesBuyFilled) await this.clob.cancelOrder(pos.yesBuyOrderId);
    if (pos.noBuyOrderId && !pos.noBuyFilled) await this.clob.cancelOrder(pos.noBuyOrderId);

    // Cancel pending RESTING ASKS
    if (pos.yesSellOrderId && !pos.yesSellFilled) await this.clob.cancelOrder(pos.yesSellOrderId);
    if (pos.noSellOrderId && !pos.noSellFilled) await this.clob.cancelOrder(pos.noSellOrderId);

    // Pure Orderbook cut-loss: FOK Sell whatever we bought
    if (pos.yesBuyFilled && !pos.yesSellFilled) {
      const mid = await this.clob.getMidpoint(pos.yesTokenId).catch(() => 0.05);
      await this.clob.placeFOKOrder(pos.yesTokenId, 'SELL', mid * 0.95, pos.yesSharesOwned);
      await this.logs.info(StrategyType.MARKET_MAKER, `[LIVE] Cut-loss: market sold YES at ~${(mid * 0.95).toFixed(3)}`);
    }
    
    if (pos.noBuyFilled && !pos.noSellFilled) {
      const mid = await this.clob.getMidpoint(pos.noTokenId).catch(() => 0.05);
      await this.clob.placeFOKOrder(pos.noTokenId, 'SELL', mid * 0.95, pos.noSharesOwned);
      await this.logs.info(StrategyType.MARKET_MAKER, `[LIVE] Cut-loss: market sold NO at ~${(mid * 0.95).toFixed(3)}`);
    }

    this.events.emitStatsUpdate({ type: 'MARKET_MAKER' });
  }

  private cleanup(conditionId: string) {
    this.doneConditionIds.add(conditionId); // prevent re-entry this session
    this.detector.releaseConditionId(conditionId);
    this.positions.delete(conditionId);
  }
}
