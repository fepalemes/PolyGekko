import { Controller, Get, Param, Patch, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PositionsService } from './positions.service';
import { ClobService } from '../polymarket/clob.service';

@ApiTags('positions')
@Controller('positions')
export class PositionsController {
  constructor(
    private readonly positionsService: PositionsService,
    private readonly clob: ClobService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get all positions' })
  findAll(
    @Query('status') status?: string,
    @Query('strategyType') strategyType?: string,
    @Query('isDryRun') isDryRun?: string,
  ) {
    return this.positionsService.findAll({ status, strategyType, isDryRun });
  }

  @Get('unrealized-pnl')
  @ApiOperation({ summary: 'Get unrealized P&L for all open positions (fetches live midpoints)' })
  async getUnrealizedPnl(@Query('isDryRun') isDryRunStr?: string) {
    const isDryRun = isDryRunStr !== 'false';
    const openPositions = await this.positionsService.findAll({ status: 'OPEN', isDryRun: isDryRunStr });

    const results = await Promise.all(openPositions.map(async (pos) => {
      try {
        const currentPrice = await this.clob.getMidpoint(pos.tokenId);
        const shares = parseFloat(pos.shares.toString());
        const totalCost = parseFloat(pos.totalCost.toString());
        const currentValue = currentPrice > 0 ? currentPrice * shares : 0;
        const unrealizedPnl = currentPrice > 0 ? currentValue - totalCost : null;
        const unrealizedPnlPct = unrealizedPnl != null && totalCost > 0
          ? (unrealizedPnl / totalCost) * 100 : null;
        return { positionId: pos.id, currentPrice, currentValue, unrealizedPnl, unrealizedPnlPct };
      } catch {
        return { positionId: pos.id, currentPrice: null, currentValue: null, unrealizedPnl: null, unrealizedPnlPct: null };
      }
    }));

    return results;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get position by id' })
  findOne(@Param('id') id: string) {
    return this.positionsService.findOne(+id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update position' })
  update(@Param('id') id: string, @Body() body: any) {
    return this.positionsService.update(+id, body);
  }
}
