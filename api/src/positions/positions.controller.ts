import { Controller, Get, Param, Patch, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PositionsService } from './positions.service';

@ApiTags('positions')
@Controller('positions')
export class PositionsController {
  constructor(private readonly positionsService: PositionsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all positions' })
  findAll(
    @Query('status') status?: string,
    @Query('strategyType') strategyType?: string,
    @Query('isDryRun') isDryRun?: string,
  ) {
    return this.positionsService.findAll({ status, strategyType, isDryRun });
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
