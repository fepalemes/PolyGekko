import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StrategyType, TradeSide, TradeStatus } from '@prisma/client';

@Injectable()
export class TradesService {
  constructor(private prisma: PrismaService) {}

  async findAll(filters?: { conditionId?: string; strategyType?: string; side?: string; limit?: number }) {
    const where: any = {};
    if (filters?.conditionId) where.conditionId = filters.conditionId;
    if (filters?.strategyType) where.strategyType = filters.strategyType as StrategyType;
    if (filters?.side) where.side = filters.side as TradeSide;

    return this.prisma.trade.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: filters?.limit ?? 100,
    });
  }

  async create(data: {
    positionId?: number;
    conditionId: string;
    tokenId: string;
    market: string;
    side: TradeSide;
    shares: number;
    price: number;
    cost: number;
    orderId?: string;
    status?: TradeStatus;
    isDryRun: boolean;
    strategyType: StrategyType;
  }) {
    return this.prisma.trade.create({ data });
  }

  async updateStatus(id: number, status: TradeStatus, orderId?: string) {
    return this.prisma.trade.update({ where: { id }, data: { status, ...(orderId && { orderId }) } });
  }
}
