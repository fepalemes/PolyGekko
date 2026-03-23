import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { TradesService } from './trades.service';

@ApiTags('trades')
@Controller('trades')
export class TradesController {
  constructor(private readonly tradesService: TradesService) {}

  @Get()
  @ApiOperation({ summary: 'Get trades' })
  findAll(
    @Query('conditionId') conditionId?: string,
    @Query('strategyType') strategyType?: string,
    @Query('side') side?: string,
    @Query('limit') limit?: string,
  ) {
    return this.tradesService.findAll({ conditionId, strategyType, side, limit: limit ? +limit : 100 });
  }
}
