import { Injectable, Logger } from '@nestjs/common';
import { StrategyType, TradeSide, TradeStatus } from '@prisma/client';
import { PositionsService } from '../../positions/positions.service';
import { TradesService } from '../../trades/trades.service';
import { LogsService } from '../../logs/logs.service';
import { EventsGateway } from '../../events/events.gateway';
import { ClobService } from '../../polymarket/clob.service';
import { GammaService } from '../../polymarket/gamma.service';
import { SettingsService } from '../../settings/settings.service';
import { AutoSellService } from './auto-sell.service';
import { SimStatsService } from '../sim-stats.service';
import { TelegramService } from '../../notifications/telegram.service';

@Injectable()
export class ExecutorService {
  private readonly logger = new Logger(ExecutorService.name);
  private config: any = {};
  private isDryRun = true;
  private buyQueues = new Map<string, Promise<void>>();

  constructor(
    private positions: PositionsService,
    private trades: TradesService,
    private logs: LogsService,
    private events: EventsGateway,
    private clob: ClobService,
    private gamma: GammaService,
    private settings: SettingsService,
    private autoSell: AutoSellService,
    private simStats: SimStatsService,
    private telegram: TelegramService,
  ) {}

  setConfig(config: any, isDryRun: boolean) {
    this.config = config;
    this.isDryRun = isDryRun;
  }

  async onTradeDetected(event: any) {
    const tokenId = event.asset_id || event.tokenId;
    const side: string = (event.side || event.type || 'BUY').toUpperCase();
    const conditionId = event.condition_id || event.conditionId;

    if (!tokenId || !conditionId) {
      await this.logs.warn(StrategyType.COPY_TRADE, `Trade missing tokenId or conditionId — skipping`, { event });
      return;
    }

    if (side === 'SELL' || side.toUpperCase() === 'SELL') {
      await this.handleSell(conditionId, tokenId, event);
    } else {
      const tail = (this.buyQueues.get(conditionId) || Promise.resolve()).then(async () => {
        await this.handleBuy(conditionId, tokenId, event);
      });
      this.buyQueues.set(conditionId, tail);
    }
  }

  private async handleBuy(conditionId: string, tokenId: string, event: any) {
    try {
      const maxPerMin = await this.settings.getGlobalMaxEntriesPerMinute();
      if (maxPerMin > 0) {
        const allowed = await this.positions.acquireGlobalEntry(maxPerMin, 60);
        if (!allowed) {
          await this.logs.warn(StrategyType.COPY_TRADE, `[RATE LIMIT] Max entries per minute (${maxPerMin}) reached — skipping`);
          return;
        }
      }

      const existing = await this.positions.findByConditionId(conditionId);
      if (existing) return;

      const market = await this.gamma.getMarketByTokenId(tokenId);
      if (!market) {
        await this.logs.warn(StrategyType.COPY_TRADE, `Market not found for tokenId: ${tokenId}`);
        return;
      }

      const endTime = new Date(market.endDate || market.end_date_iso).getTime();
      const timeLeft = (endTime - Date.now()) / 1000;
      if (timeLeft < this.config.minMarketTimeLeft) {
        await this.logs.info(StrategyType.COPY_TRADE, `Skipping ${market.question}: closes in ${Math.round(timeLeft)}s`);
        return;
      }

      const size = await this.calculateSize();
      if (size <= 0) {
        const balance = await this.getAvailableBalance();
        const exposure = await this.getCurrentExposure();
        await this.logs.warn(StrategyType.COPY_TRADE,
          `Max exposure reached — balance: $${balance.toFixed(2)}, exposure: $${exposure.toFixed(2)} (${this.config.maxBalanceUsagePercent}% limit)`);
        return;
      }
      const minEntry = this.config.minEntryAmount ?? 1;
      if (size < minEntry) {
        await this.logs.warn(StrategyType.COPY_TRADE, `Order size $${size.toFixed(2)} below minimum $${minEntry} — skipping`);
        return;
      }

      const midpoint = await this.clob.getMidpoint(tokenId);
      // Fallback to event price if midpoint not available
      const basePrice = midpoint > 0 ? midpoint : (event.price || 0);
      if (basePrice <= 0) {
        await this.logs.warn(StrategyType.COPY_TRADE, `Cannot determine price for ${market.question} — skipping`);
        return;
      }
      const price = Math.min(basePrice * 1.02, 0.99);
      const shares = size / price;

      // outcomes may come as a JSON string from Gamma API
      const rawOutcomes = market.outcomes;
      const outcomesArr: string[] = Array.isArray(rawOutcomes)
        ? rawOutcomes
        : typeof rawOutcomes === 'string'
          ? (() => { try { return JSON.parse(rawOutcomes); } catch { return ['YES', 'NO']; } })()
          : ['YES', 'NO'];
      const outcome = outcomesArr[0] || 'YES';

      await this.logs.info(StrategyType.COPY_TRADE, `BUY ${market.question} | ${shares.toFixed(2)} shares @ $${price.toFixed(4)} | $${size.toFixed(2)}`);

      if (this.isDryRun) {
        const currentBalance = await this.settings.getNumber('COPY_TRADE_SIM_BALANCE', 1000);
        const minBal = await this.settings.getGlobalWalletMargin();
        
        if (currentBalance < size || currentBalance - size < minBal) {
          await this.logs.warn(StrategyType.COPY_TRADE, `[SIM] Order would leave simulation balance below minimum $${minBal} — skipping (balance: $${currentBalance.toFixed(2)})`);
          return;
        }

        const pos = await this.positions.create({
          conditionId,
          tokenId,
          market: market.question,
          shares,
          avgBuyPrice: price,
          totalCost: size,
          outcome,
          strategyType: StrategyType.COPY_TRADE,
          isDryRun: true,
        });
        await this.trades.create({
          positionId: pos.id,
          conditionId,
          tokenId,
          market: market.question,
          side: TradeSide.BUY,
          shares,
          price,
          cost: size,
          status: TradeStatus.FILLED,
          isDryRun: true,
          strategyType: StrategyType.COPY_TRADE,
        });
        await this.simStats.recordBuy(StrategyType.COPY_TRADE);
        // Deduct from sim balance
        const updatedBal = await this.settings.getNumber('COPY_TRADE_SIM_BALANCE', 1000);
        await this.settings.set('COPY_TRADE_SIM_BALANCE', (updatedBal - size).toFixed(2));
        this.events.emitPositionUpdate(pos);
        this.events.emitTradeExecuted({ side: 'BUY', market: market.question, shares, price, isDryRun: true });
        const newBal = await this.settings.getNumber('COPY_TRADE_SIM_BALANCE', 0);
        this.telegram.notifyBuy({
          strategy: 'COPY_TRADE', isDryRun: true,
          market: market.question, size, price, shares,
          balance: newBal,
          endTime: new Date(endTime),
        });
        return;
      }

      // ── Live balance guard ────────────────────────────────────────────────
      const liveBalance = await this.clob.getBalance();
      const minLiveBal = await this.settings.getGlobalWalletMargin();
      if (liveBalance < size) {
        await this.logs.warn(StrategyType.COPY_TRADE,
          `Insufficient balance: $${liveBalance.toFixed(2)} available, need $${size.toFixed(2)} — skipping`);
        return;
      }
      if (liveBalance - size < minLiveBal) {
        await this.logs.warn(StrategyType.COPY_TRADE,
          `Order would leave balance below minimum $${minLiveBal} — skipping (balance: $${liveBalance.toFixed(2)})`);
        return;
      }

      let result = await this.clob.placeFOKOrder(tokenId, 'BUY', price, size);

      if (!result?.ordersFilled?.length) {
        await this.logs.info(StrategyType.COPY_TRADE, 'FOK failed, trying GTC fallback...');
        result = await this.clob.placeGTCOrder(tokenId, 'BUY', price, size);
        if (result?.id) {
          await this.waitForGTCFill(result.id, tokenId, conditionId, market, size, price, outcome, shares);
        }
        return;
      }

      const filledShares = result.ordersFilled.reduce((sum: number, f: any) => sum + parseFloat(f.size || 0), 0);
      const filledCost = result.ordersFilled.reduce((sum: number, f: any) => sum + parseFloat(f.size || 0) * parseFloat(f.price || 0), 0);
      const avgPrice = filledCost / filledShares;
      const orderId: string | undefined = result.id || result.ordersFilled?.[0]?.id;

      const pos = await this.positions.create({
        conditionId,
        tokenId,
        market: market.question,
        shares: filledShares,
        avgBuyPrice: avgPrice,
        totalCost: filledCost,
        outcome,
        strategyType: StrategyType.COPY_TRADE,
        isDryRun: false,
      });

      await this.trades.create({
        positionId: pos.id,
        conditionId,
        tokenId,
        market: market.question,
        side: TradeSide.BUY,
        shares: filledShares,
        price: avgPrice,
        cost: filledCost,
        orderId,
        status: TradeStatus.FILLED,
        isDryRun: false,
        strategyType: StrategyType.COPY_TRADE,
      });

      await this.simStats.recordBuy(StrategyType.COPY_TRADE);
      this.events.emitPositionUpdate(pos);
      this.events.emitTradeExecuted({ side: 'BUY', market: market.question, shares: filledShares, price: avgPrice, isDryRun: false });
      this.telegram.notifyBuy({
        strategy: 'COPY_TRADE', isDryRun: false,
        market: market.question, size: filledCost, price: avgPrice, shares: filledShares,
        endTime: new Date(endTime),
      });

      if (this.config.autoSellEnabled) {
        await this.autoSell.placeAutoSell(pos.id, conditionId, tokenId, avgPrice, filledShares, this.config, market);
      }
    } catch (err) {
      await this.logs.error(StrategyType.COPY_TRADE, `handleBuy error: ${err.message}`, { conditionId });
    }
  }

  private async handleSell(conditionId: string, tokenId: string, event: any) {
    try {
      // Primary lookup by conditionId; fallback by tokenId if conditionId is missing
      let position = conditionId ? await this.positions.findByConditionId(conditionId) : null;
      if (!position && tokenId) {
        position = await this.positions.findByTokenId(tokenId);
      }

      if (!position) {
        await this.logs.warn(StrategyType.COPY_TRADE, `SELL signal received but no open position found — conditionId: ${conditionId}, tokenId: ${tokenId}`);
        return;
      }
      if (position.status !== 'OPEN') {
        await this.logs.warn(StrategyType.COPY_TRADE, `SELL signal received but position status is ${position.status} — skipping`, { conditionId: position.conditionId });
        return;
      }

      const posConditionId = position.conditionId;
      await this.positions.updateByConditionId(posConditionId, { status: 'SELLING' });

      const shares = parseFloat(position.shares.toString());
      const avgBuyPrice = parseFloat(position.avgBuyPrice.toString());
      const totalCost = parseFloat(position.totalCost.toString());
      const midpoint = await this.clob.getMidpoint(position.tokenId).catch(() => 0);
      const sellPrice = midpoint > 0
        ? (this.config.sellMode === 'limit' ? midpoint : midpoint * 0.98)
        : (event.price || avgBuyPrice);

      const proceeds = shares * sellPrice;
      const pnl = proceeds - totalCost;

      await this.logs.info(
        StrategyType.COPY_TRADE,
        `SELL ${position.market} | ${shares.toFixed(2)} shares @ $${sellPrice.toFixed(4)} | proceeds: $${proceeds.toFixed(2)} | P&L: ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}`,
      );

      if (this.isDryRun) {
        await this.trades.create({
          positionId: position.id,
          conditionId: posConditionId,
          tokenId: position.tokenId,
          market: position.market,
          side: TradeSide.SELL,
          shares,
          price: sellPrice,
          cost: proceeds,
          status: TradeStatus.FILLED,
          isDryRun: true,
          strategyType: StrategyType.COPY_TRADE,
        });
        await this.positions.updateByConditionId(posConditionId, {
          status: 'SOLD',
          resolvedPnl: pnl,
        });
        // Credit balance back
        const currentBal = await this.settings.getNumber('COPY_TRADE_SIM_BALANCE', 0);
        await this.settings.set('COPY_TRADE_SIM_BALANCE', (currentBal + proceeds).toFixed(2));
        await this.simStats[pnl >= 0 ? 'recordWin' : 'recordLoss'](StrategyType.COPY_TRADE, pnl, position.market);
        this.events.emitPositionUpdate({ ...position, status: 'SOLD', resolvedPnl: pnl });
        this.events.emitTradeExecuted({ side: 'SELL', market: position.market, shares, price: sellPrice, isDryRun: true });
        const newBal = await this.settings.getNumber('COPY_TRADE_SIM_BALANCE', 0);
        this.telegram.notifySell({
          strategy: 'COPY_TRADE', isDryRun: true,
          market: position.market, shares, price: sellPrice, proceeds, pnl,
          totalCost: parseFloat(position.totalCost.toString()),
          balance: newBal,
        });
        return;
      }

      if (position.sellOrderId) await this.clob.cancelOrder(position.sellOrderId).catch(() => {});
      await this.clob.cancelAllOrders(position.tokenId).catch(() => {});

      let sellResult: any;
      if (this.config.sellMode === 'limit') {
        sellResult = await this.clob.placeGTCOrder(position.tokenId, 'SELL', sellPrice, shares);
      } else {
        sellResult = await this.clob.placeFOKOrder(position.tokenId, 'SELL', sellPrice, shares);
      }

      // Compute actual proceeds from fills if available, otherwise use estimated
      let actualShares = shares;
      let actualPrice = sellPrice;
      if (sellResult?.ordersFilled?.length) {
        actualShares = sellResult.ordersFilled.reduce((s: number, f: any) => s + parseFloat(f.size || 0), 0);
        const totalProceeds = sellResult.ordersFilled.reduce((s: number, f: any) => s + parseFloat(f.size || 0) * parseFloat(f.price || 0), 0);
        actualPrice = totalProceeds / actualShares;
      }
      const actualProceeds = actualShares * actualPrice;
      const actualPnl = actualProceeds - totalCost;
      const sellOrderId: string | undefined = sellResult?.id || sellResult?.ordersFilled?.[0]?.id;

      await this.trades.create({
        positionId: position.id,
        conditionId: posConditionId,
        tokenId: position.tokenId,
        market: position.market,
        side: TradeSide.SELL,
        shares: actualShares,
        price: actualPrice,
        cost: actualProceeds,
        orderId: sellOrderId,
        status: TradeStatus.FILLED,
        isDryRun: false,
        strategyType: StrategyType.COPY_TRADE,
      });
      await this.positions.updateByConditionId(posConditionId, {
        status: 'SOLD',
        resolvedPnl: actualPnl,
      });
      await this.simStats[actualPnl >= 0 ? 'recordWin' : 'recordLoss'](StrategyType.COPY_TRADE, actualPnl, position.market);
      this.events.emitPositionUpdate({ conditionId: posConditionId, status: 'SOLD', resolvedPnl: actualPnl });
      this.events.emitTradeExecuted({ side: 'SELL', market: position.market, shares: actualShares, price: actualPrice, isDryRun: false });
      this.telegram.notifySell({
        strategy: 'COPY_TRADE', isDryRun: false,
        market: position.market, shares: actualShares, price: actualPrice,
        proceeds: actualProceeds, pnl: actualPnl,
        totalCost,
      });
    } catch (err) {
      await this.logs.error(StrategyType.COPY_TRADE, `handleSell error: ${err.message}`, { conditionId });
    }
  }

  private async getAvailableBalance(): Promise<number> {
    if (this.isDryRun) {
      return await this.settings.getNumber('COPY_TRADE_SIM_BALANCE', 1000);
    }
    return await this.clob.getBalance();
  }

  private async getCurrentExposure(): Promise<number> {
    const openPositions = await this.positions.findAll({
      status: 'OPEN',
      isDryRun: this.isDryRun ? 'true' : 'false',
    });
    return openPositions.reduce((sum, p) => sum + parseFloat(p.totalCost.toString()), 0);
  }

  private async calculateSize(): Promise<number> {
    const balance = await this.getAvailableBalance();
    const maxExposure = balance * (this.config.maxBalanceUsagePercent / 100);
    const currentExposure = await this.getCurrentExposure();
    const remaining = maxExposure - currentExposure;

    if (remaining <= 0) return 0;

    let tradeSize: number;
    if (this.config.dynamicSizingEnabled) {
      tradeSize = Number((Math.random() * (this.config.maxAllocation - this.config.minAllocation) + this.config.minAllocation).toFixed(2));
    } else if (this.config.sizeMode === 'fixed') {
      // Fixed dollar amount — always enter with exactly this amount regardless of trader's size
      tradeSize = this.config.fixedAmount;
    } else if (this.config.sizeMode === 'balance') {
      tradeSize = balance * (this.config.sizePercent / 100);
    } else {
      // 'percentage' (default): percent of max position size
      tradeSize = this.config.maxPositionSize * (this.config.sizePercent / 100);
    }

    return Math.min(tradeSize, remaining);
  }

  private async waitForGTCFill(
    orderId: string, tokenId: string, conditionId: string, market: any,
    size: number, price: number, outcome: string, shares: number,
  ) {
    const timeout = this.config.gtcFallbackTimeout * 1000;
    const start = Date.now();
    while (Date.now() - start < timeout) {
      await new Promise(r => setTimeout(r, 3000));
      const order = await this.clob.getOrderStatus(orderId);
      if (order?.status === 'MATCHED') {
        const pos = await this.positions.create({
          conditionId, tokenId, market: market.question,
          shares, avgBuyPrice: price, totalCost: size, outcome,
          strategyType: StrategyType.COPY_TRADE, isDryRun: false,
        });
        this.events.emitPositionUpdate(pos);
        return;
      }
    }
    await this.clob.cancelOrder(orderId);
    await this.logs.info(StrategyType.COPY_TRADE, `GTC fallback timeout – order cancelled`);
  }
}
