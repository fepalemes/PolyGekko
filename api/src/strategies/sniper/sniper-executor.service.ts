import { Injectable } from '@nestjs/common';
import { StrategyType, TradeSide, TradeStatus } from '@prisma/client';
import { ClobService } from '../../polymarket/clob.service';
import { CtfService } from '../../polymarket/ctf.service';
import { GammaService } from '../../polymarket/gamma.service';
import { LogsService } from '../../logs/logs.service';
import { TradesService } from '../../trades/trades.service';
import { PositionsService } from '../../positions/positions.service';
import { EventsGateway } from '../../events/events.gateway';
import { SimStatsService } from '../sim-stats.service';
import { SniperSizingService } from './sniper-sizing.service';

interface SniperAssetState {
  asset: string;
  pauseRoundsLeft: number;
  activeOrders: string[];
}

@Injectable()
export class SniperExecutorService {
  private config: any = {};
  private isDryRun = true;
  private timer: NodeJS.Timeout | null = null;
  private assetStates = new Map<string, SniperAssetState>();

  constructor(
    private clob: ClobService,
    private ctf: CtfService,
    private gamma: GammaService,
    private logs: LogsService,
    private trades: TradesService,
    private positions: PositionsService,
    private events: EventsGateway,
    private simStats: SimStatsService,
    private sizing: SniperSizingService,
  ) {}

  start(config: any, isDryRun: boolean) {
    this.config = config;
    this.isDryRun = isDryRun;
    this.sizing.parseMultipliers(config.multipliers);
    for (const asset of config.assets) {
      this.assetStates.set(asset, { asset, pauseRoundsLeft: 0, activeOrders: [] });
    }
    this.timer = setInterval(() => this.round(), 60000);
    this.round();
  }

  stop() {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  }

  private async round() {
    for (const asset of this.config.assets) {
      const state = this.assetStates.get(asset)!;

      if (state.pauseRoundsLeft > 0) {
        state.pauseRoundsLeft--;
        await this.logs.info(StrategyType.SNIPER, `${asset.toUpperCase()}: paused (${state.pauseRoundsLeft} rounds left)`);
        continue;
      }

      if (this.config.schedule && !this.sizing.isInSchedule(asset, this.config.schedule)) {
        continue;
      }

      try {
        await this.placeOrders(asset, state);
      } catch (err) {
        await this.logs.error(StrategyType.SNIPER, `Round error for ${asset}: ${err.message}`);
      }
    }
  }

  private async placeOrders(asset: string, state: SniperAssetState) {
    const multiplier = this.sizing.getCurrentMultiplier();
    const maxShares = Math.floor(this.config.maxShares * multiplier);

    // 3-tier allocation: 20% / 30% / 50%
    const tier1Shares = Math.floor(maxShares * 0.2);
    const tier2Shares = Math.floor(maxShares * 0.3);
    const tier3Shares = maxShares - tier1Shares - tier2Shares;

    const markets = await this.gamma.searchMarkets(`${asset}-updown`, 5);
    if (!markets.length) return;
    const market = markets[0];
    const rawTokens = market.clobTokenIds || market.clob_token_ids || [];
    const tokens: string[] = Array.isArray(rawTokens)
      ? rawTokens
      : typeof rawTokens === 'string'
        ? JSON.parse(rawTokens)
        : [];
    if (tokens.length < 2) return;

    const tiers: [number, number][] = [
      [this.config.tier1Price, tier1Shares],
      [this.config.tier2Price, tier2Shares],
      [this.config.tier3Price, tier3Shares],
    ];

    const totalShares = tiers.reduce((sum, [, s]) => sum + s, 0);
    const totalCost = tiers.reduce((sum, [p, s]) => sum + p * s, 0);
    const avgPrice = totalShares > 0 ? totalCost / totalShares : 0;

    if (this.isDryRun) {
      await this.logs.info(
        StrategyType.SNIPER,
        `[SIM] ${asset.toUpperCase()} x${multiplier} — orders: ` +
        tiers.map(([p, s]) => `${s}sh@$${p}`).join(', ') +
        ` × ${tokens.length} tokens`,
      );

      // Create one simulated position per outcome token (YES / NO)
      const outcomes = ['YES', 'NO'];
      for (let i = 0; i < tokens.length && i < 2; i++) {
        const tokenId = tokens[i];
        const outcome = outcomes[i];
        const conditionId = `sniper-${asset}-${tokenId.slice(-8)}-${Date.now()}`;

        const pos = await this.positions.create({
          conditionId,
          tokenId,
          market: market.question || `${asset.toUpperCase()} Market`,
          shares: totalShares,
          avgBuyPrice: avgPrice,
          totalCost,
          outcome,
          strategyType: StrategyType.SNIPER,
          isDryRun: true,
        });

        for (const [price, shares] of tiers) {
          if (shares < 1) continue;
          await this.trades.create({
            positionId: pos.id,
            conditionId,
            tokenId,
            market: pos.market,
            side: TradeSide.BUY,
            shares,
            price,
            cost: price * shares,
            status: TradeStatus.FILLED,
            isDryRun: true,
            strategyType: StrategyType.SNIPER,
          });
        }

        await this.simStats.recordBuy(StrategyType.SNIPER);
        this.events.emitPositionUpdate(pos);
        state.activeOrders.push(`sim-${conditionId}`);
      }
    } else {
      await this.logs.info(StrategyType.SNIPER, `Placing sniper orders for ${asset.toUpperCase()} | x${multiplier} | ${maxShares} shares`);
      for (const tokenId of tokens) {
        for (const [price, shares] of tiers) {
          if (shares < 1) continue;
          const result = await this.clob.placeGTCOrder(tokenId, 'BUY', price, shares * price);
          if (result?.id) state.activeOrders.push(result.id);
        }
      }
    }

    // Check wins from previous round
    await this.checkWins(asset, state, market);
  }

  private async checkWins(asset: string, state: SniperAssetState, market: any) {
    const conditionId = market.conditionId || market.condition_id;
    if (!conditionId) return;
    for (let i = 0; i < 2; i++) {
      const payout = await this.ctf.getPayoutNumerator(conditionId, i);
      if (payout > 0) {
        await this.logs.info(StrategyType.SNIPER, `WIN detected for ${asset.toUpperCase()} – pausing ${this.config.pauseRoundsAfterWin} rounds`);
        state.pauseRoundsLeft = this.config.pauseRoundsAfterWin;
        if (!this.isDryRun) await this.ctf.redeemPositions(conditionId);
        break;
      }
    }
  }
}
