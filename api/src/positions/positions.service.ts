import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PositionStatus, StrategyType } from '@prisma/client';

@Injectable()
export class PositionsService {
  constructor(private prisma: PrismaService) {}

  async findAll(filters?: { status?: string; strategyType?: string; isDryRun?: string }) {
    const where: any = {};
    if (filters?.status) where.status = filters.status as PositionStatus;
    if (filters?.strategyType) where.strategyType = filters.strategyType as StrategyType;
    if (filters?.isDryRun !== undefined) where.isDryRun = filters.isDryRun === 'true';

    return this.prisma.position.findMany({
      where,
      include: { trades: { orderBy: { createdAt: 'desc' }, take: 10 } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findOne(id: number) {
    return this.prisma.position.findUnique({
      where: { id },
      include: { trades: { orderBy: { createdAt: 'desc' } } },
    });
  }

  async findByConditionId(conditionId: string) {
    return this.prisma.position.findUnique({ where: { conditionId } });
  }

  async findByTokenId(tokenId: string) {
    return this.prisma.position.findFirst({
      where: { tokenId, status: 'OPEN' },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(data: {
    conditionId: string;
    tokenId: string;
    market: string;
    shares: number;
    avgBuyPrice: number;
    totalCost: number;
    outcome: string;
    strategyType: StrategyType;
    isDryRun: boolean;
  }) {
    return this.prisma.position.create({ data });
  }

  async update(id: number, data: Partial<{
    shares: number;
    avgBuyPrice: number;
    totalCost: number;
    sellOrderId: string;
    status: PositionStatus;
    resolvedPnl: number;
    simOutcome: any;
  }>) {
    return this.prisma.position.update({ where: { id }, data });
  }

  async updateByConditionId(conditionId: string, data: any) {
    return this.prisma.position.update({ where: { conditionId }, data });
  }
}
