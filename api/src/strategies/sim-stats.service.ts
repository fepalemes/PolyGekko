import { Injectable } from '@nestjs/common';
import { StrategyType, SimOutcome } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';

@Injectable()
export class SimStatsService {
  constructor(
    private prisma: PrismaService,
    private events: EventsGateway,
  ) {}

  /**
   * Record a buy (increments totalBuys counter).
   */
  async recordBuy(strategyType: StrategyType) {
    return this.prisma.simStats.upsert({
      where: { strategyType },
      create: { strategyType, totalBuys: 1 },
      update: { totalBuys: { increment: 1 } },
    });
  }

  /**
   * Record a WIN after market resolution.
   * pnl = shares * 1.0 - totalCost  (winning shares pay $1 each)
   */
  async recordWin(strategyType: StrategyType, pnl: number, market: string) {
    const stats = await this.prisma.simStats.upsert({
      where: { strategyType },
      create: { strategyType, totalBuys: 0, wins: 1, losses: 0, pnl },
      update: {
        wins: { increment: 1 },
        pnl: { increment: pnl },
      },
    });

    await this.prisma.performanceSample.create({
      data: {
        strategyType,
        cumulativePnl: stats.pnl,
        pnlDelta: pnl,
        outcome: SimOutcome.WIN,
        market,
      },
    });

    this.events.emitStatsUpdate(stats);
    return stats;
  }

  /**
   * Record a LOSS after market resolution.
   * pnl = -totalCost  (losing shares pay $0)
   */
  async recordLoss(strategyType: StrategyType, pnl: number, market: string) {
    const stats = await this.prisma.simStats.upsert({
      where: { strategyType },
      create: { strategyType, totalBuys: 0, wins: 0, losses: 1, pnl },
      update: {
        losses: { increment: 1 },
        pnl: { increment: pnl },
      },
    });

    await this.prisma.performanceSample.create({
      data: {
        strategyType,
        cumulativePnl: stats.pnl,
        pnlDelta: pnl,
        outcome: SimOutcome.LOSS,
        market,
      },
    });

    this.events.emitStatsUpdate(stats);
    return stats;
  }

  async getAll() {
    return this.prisma.simStats.findMany();
  }

  async getPerformanceSamples(strategyType?: StrategyType, limit = 200) {
    return this.prisma.performanceSample.findMany({
      where: strategyType ? { strategyType } : undefined,
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
  }

  async reset(strategyType: StrategyType) {
    await this.prisma.$transaction([
      this.prisma.simStats.upsert({
        where: { strategyType },
        create: { strategyType },
        update: { totalBuys: 0, wins: 0, losses: 0, pnl: 0 },
      }),
      this.prisma.performanceSample.deleteMany({ where: { strategyType } }),
    ]);
    this.events.emitStatsUpdate({ strategyType, reset: true });
  }
}
