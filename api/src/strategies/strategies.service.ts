import { Injectable, OnApplicationBootstrap, Logger } from '@nestjs/common';
import { StrategyType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CopyTradeService } from './copy-trade/copy-trade.service';
import { MarketMakerService } from './market-maker/market-maker.service';
import { SniperService } from './sniper/sniper.service';
import { SimStatsService } from './sim-stats.service';
import { ClobService } from '../polymarket/clob.service';
import { SettingsService } from '../settings/settings.service';

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
