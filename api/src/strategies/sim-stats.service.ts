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

  /**
   * Returns Kelly criterion parameters for a given strategy.
   * p = win rate, b = avg_win / avg_loss, n = total resolved trades.
   */
  async getKellyParams(strategyType: StrategyType): Promise<{ p: number; b: number; n: number }> {
    const stats = await this.prisma.simStats.findUnique({ where: { strategyType } });
    if (!stats) return { p: 0, b: 1, n: 0 };

    const wins = stats.wins;
    const losses = stats.losses;
    const n = wins + losses;
    if (n === 0) return { p: 0, b: 1, n: 0 };

    const p = wins / n;

    const [winSamples, lossSamples] = await Promise.all([
      this.prisma.performanceSample.findMany({
        where: { strategyType, outcome: SimOutcome.WIN },
        select: { pnlDelta: true },
      }),
      this.prisma.performanceSample.findMany({
        where: { strategyType, outcome: SimOutcome.LOSS },
        select: { pnlDelta: true },
      }),
    ]);

    const avgWin = winSamples.length > 0
      ? winSamples.reduce((s, r) => s + parseFloat(r.pnlDelta.toString()), 0) / winSamples.length
      : 1;
    const avgLoss = lossSamples.length > 0
      ? Math.abs(lossSamples.reduce((s, r) => s + parseFloat(r.pnlDelta.toString()), 0) / lossSamples.length)
      : 1;

    const b = avgLoss > 0 ? avgWin / avgLoss : 1;
    return { p, b, n };
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
