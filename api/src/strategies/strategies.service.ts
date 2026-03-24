import { Injectable, OnApplicationBootstrap, Logger } from '@nestjs/common';
import { StrategyType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CopyTradeService } from './copy-trade/copy-trade.service';
import { MarketMakerService } from './market-maker/market-maker.service';
import { SniperService } from './sniper/sniper.service';
import { SimStatsService } from './sim-stats.service';
import { ClobService } from '../polymarket/clob.service';
import { GammaService } from '../polymarket/gamma.service';
import { SettingsService, TradingMode, TRADING_MODE_PRESETS } from '../settings/settings.service';

@Injectable()
export class StrategiesService implements OnApplicationBootstrap {
  private readonly logger = new Logger(StrategiesService.name);

  constructor(
    private prisma: PrismaService,
    private copyTrade: CopyTradeService,
    private marketMaker: MarketMakerService,
    private sniper: SniperService,
    private simStats: SimStatsService,
    private clob: ClobService,
    private gamma: GammaService,
    private settings: SettingsService,
  ) {}

  async onApplicationBootstrap() {
    // Auto-restart any strategy that was running before the last shutdown
    try {
      if (await this.settings.getBool('COPY_TRADE_RUNNING', false)) {
        this.logger.log('Auto-restarting Copy Trade (was running before shutdown)');
        await this.copyTrade.start();
      }
      if (await this.settings.getBool('MM_RUNNING', false)) {
        this.logger.log('Auto-restarting Market Maker (was running before shutdown)');
        await this.marketMaker.start();
      }
      if (await this.settings.getBool('SNIPER_RUNNING', false)) {
        this.logger.log('Auto-restarting Sniper (was running before shutdown)');
        await this.sniper.start();
      }
    } catch (err) {
      this.logger.error(`Auto-restart error: ${err.message}`);
    }
  }

  getAllStatus() {
    return [
      this.copyTrade.getStatus(),
      this.marketMaker.getStatus(),
      this.sniper.getStatus(),
    ];
  }

  getStatus(type: string) {
    switch (type) {
      case 'COPY_TRADE': return this.copyTrade.getStatus();
      case 'MARKET_MAKER': return this.marketMaker.getStatus();
      case 'SNIPER': return this.sniper.getStatus();
      default: throw new Error(`Unknown strategy: ${type}`);
    }
  }

  async start(type: string) {
    switch (type) {
      case 'COPY_TRADE': return this.copyTrade.start();
      case 'MARKET_MAKER': return this.marketMaker.start();
      case 'SNIPER': return this.sniper.start();
      default: throw new Error(`Unknown strategy: ${type}`);
    }
  }

  async stop(type: string) {
    switch (type) {
      case 'COPY_TRADE': return this.copyTrade.stop();
      case 'MARKET_MAKER': return this.marketMaker.stop();
      case 'SNIPER': return this.sniper.stop();
      default: throw new Error(`Unknown strategy: ${type}`);
    }
  }

  async pause(type: string) {
    switch (type) {
      case 'COPY_TRADE': return this.copyTrade.pause();
      case 'MARKET_MAKER': return this.marketMaker.pause();
      case 'SNIPER': return this.sniper.pause();
      default: throw new Error(`Unknown strategy: ${type}`);
    }
  }

  async resume(type: string) {
    switch (type) {
      case 'COPY_TRADE': return this.copyTrade.resume();
      case 'MARKET_MAKER': return this.marketMaker.resume();
      case 'SNIPER': return this.sniper.resume();
      default: throw new Error(`Unknown strategy: ${type}`);
    }
  }

  async getSimStats() {
    return this.simStats.getAll();
  }

  async getPerformanceSamples(strategyType?: string, limit?: number) {
    return this.simStats.getPerformanceSamples(
      strategyType as StrategyType | undefined,
      limit,
    );
  }

  async resetSimStats(type: string) {
    await this.simStats.reset(type as StrategyType);
    return { message: `Stats reset for ${type}` };
  }

  async clearSimData() {
    const [positions, trades, logs, stats, samples] = await this.prisma.$transaction([
      this.prisma.position.deleteMany({ where: { isDryRun: true } }),
      this.prisma.trade.deleteMany({ where: { isDryRun: true } }),
      this.prisma.strategyLog.deleteMany({}),
      this.prisma.simStats.deleteMany({}),
      this.prisma.performanceSample.deleteMany({}),
    ]);
    // Reset sim balances to default
    await this.settings.set('COPY_TRADE_SIM_BALANCE', '1000');
    await this.settings.set('MM_SIM_BALANCE', '1000');
    return {
      message: 'All simulation data cleared',
      deleted: { positions: positions.count, trades: trades.count, logs: logs.count, stats: stats.count, samples: samples.count },
    };
  }

  async getTradingMode() {
    const mode = await this.settings.getTradingMode();
    return { mode, presets: TRADING_MODE_PRESETS };
  }

  async applyTradingMode(mode: TradingMode) {
    await this.settings.applyTradingMode(mode);
    return { mode, applied: mode !== 'custom' };
  }

  async runBacktest(params: {
    strategyType?: string;
    stopLossPercent?: number;
    takeProfitPercent?: number;
    positionSizeUsdc?: number;
    isDryRun?: boolean;
  }) {
    const { stopLossPercent = 0, takeProfitPercent = 0, positionSizeUsdc = 0, isDryRun = true } = params;
    const where: any = { status: { in: ['SOLD', 'REDEEMED'] } };
    if (params.strategyType) where.strategyType = params.strategyType;
    if (isDryRun !== undefined) where.isDryRun = isDryRun;

    const positions = await this.prisma.position.findMany({ where });
    if (positions.length === 0) return { message: 'No historical positions found', totalPositions: 0 };

    let totalPnl = 0;
    let wins = 0;
    let losses = 0;
    let cumulativePnl = 0;
    let peak = 0;
    let maxDrawdown = 0;
    const pnlSeries: number[] = [];

    for (const pos of positions) {
      const avgBuy = parseFloat(pos.avgBuyPrice.toString());
      const shares = parseFloat(pos.shares.toString());
      const resolvedPnl = parseFloat((pos.resolvedPnl ?? '0').toString());
      const isWin = resolvedPnl > 0;

      // Normalize position size if requested
      const origCost = parseFloat(pos.totalCost.toString());
      const sizeFactor = positionSizeUsdc > 0 && origCost > 0 ? positionSizeUsdc / origCost : 1;
      const adjShares = shares * sizeFactor;
      const adjCost = origCost * sizeFactor;

      let simPnl: number;
      if (isWin) {
        // Market resolved to $1. If take-profit configured, simulate early exit.
        if (takeProfitPercent > 0) {
          const tpPrice = Math.min(avgBuy * (1 + takeProfitPercent / 100), 0.99);
          simPnl = adjShares * tpPrice - adjCost;
        } else {
          simPnl = adjShares * 1.0 - adjCost; // full win
        }
      } else {
        // Market resolved to $0. If stop-loss configured, simulate early exit.
        if (stopLossPercent > 0) {
          const slPrice = avgBuy * (1 - stopLossPercent / 100);
          simPnl = adjShares * Math.max(slPrice, 0) - adjCost;
        } else {
          simPnl = -adjCost; // full loss
        }
      }

      totalPnl += simPnl;
      cumulativePnl += simPnl;
      pnlSeries.push(cumulativePnl);
      if (cumulativePnl > peak) peak = cumulativePnl;
      const drawdown = peak - cumulativePnl;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
      if (simPnl >= 0) wins++; else losses++;
    }

    const n = positions.length;
    const winRate = (wins / n) * 100;
    const avgPnl = totalPnl / n;

    // Simple Sharpe: mean(pnlDeltas) / std(pnlDeltas)
    const deltas = pnlSeries.map((v, i) => i === 0 ? v : v - pnlSeries[i - 1]);
    const mean = deltas.reduce((s, v) => s + v, 0) / deltas.length;
    const variance = deltas.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / deltas.length;
    const sharpe = variance > 0 ? mean / Math.sqrt(variance) : 0;

    return {
      totalPositions: n,
      wins,
      losses,
      winRate: parseFloat(winRate.toFixed(1)),
      totalPnl: parseFloat(totalPnl.toFixed(2)),
      avgPnlPerTrade: parseFloat(avgPnl.toFixed(2)),
      maxDrawdown: parseFloat(maxDrawdown.toFixed(2)),
      sharpeRatio: parseFloat(sharpe.toFixed(3)),
      params: { stopLossPercent, takeProfitPercent, positionSizeUsdc, isDryRun },
    };
  }

  async getHealth() {
    const [clobApi, gammaApi] = await Promise.all([
      this.clob.ping().catch(() => false),
      this.gamma.ping().catch(() => false),
    ]);
    return {
      checkedAt: new Date().toISOString(),
      clob: { api: clobApi, clientInitialized: this.clob.isClientInitialized() },
      gamma: { api: gammaApi },
      strategies: this.getAllStatus(),
    };
  }

  async getBalance(isDryRun: boolean) {
    if (isDryRun) {
      const ctBalance = await this.settings.getNumber('COPY_TRADE_SIM_BALANCE', 1000);
      const mmBalance = await this.settings.getNumber('MM_SIM_BALANCE', 1000);
      return { balance: ctBalance + mmBalance, isSimulated: true, ctBalance, mmBalance };
    }
    const balance = await this.clob.getBalance();
    return { balance, isSimulated: false };
  }
}
