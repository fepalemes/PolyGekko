import { Controller, Get, Post, Delete, Param, Query, ParseBoolPipe, DefaultValuePipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { StrategiesService } from './strategies.service';

@ApiTags('strategies')
@Controller('strategies')
export class StrategiesController {
  constructor(private readonly strategiesService: StrategiesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all strategies status' })
  getAll() {
    return this.strategiesService.getAllStatus();
  }

  @Get('sim-stats')
  @ApiOperation({ summary: 'Get simulation statistics' })
  getSimStats() {
    return this.strategiesService.getSimStats();
  }

  @Get('performance')
  @ApiOperation({ summary: 'Get P&L time-series samples' })
  @ApiQuery({ name: 'strategy', required: false })
  @ApiQuery({ name: 'limit', required: false })
  getPerformance(
    @Query('strategy') strategy?: string,
    @Query('limit') limit?: string,
  ) {
    return this.strategiesService.getPerformanceSamples(strategy, limit ? +limit : 200);
  }

  @Delete('sim-stats/:type')
  @ApiOperation({ summary: 'Reset simulation statistics for a strategy' })
  resetSimStats(@Param('type') type: string) {
    return this.strategiesService.resetSimStats(type);
  }

  @Delete('sim-data')
  @ApiOperation({ summary: 'Clear ALL simulation data (positions, trades, logs, stats)' })
  clearSimData() {
    return this.strategiesService.clearSimData();
  }

  @Get('balance')
  @ApiOperation({ summary: 'Get current balance (simulated or real)' })
  @ApiQuery({ name: 'isDryRun', required: false, type: Boolean })
  getBalance(@Query('isDryRun', new DefaultValuePipe(true), ParseBoolPipe) isDryRun: boolean) {
    return this.strategiesService.getBalance(isDryRun);
  }

  @Post('copy-trade/start')
  @ApiOperation({ summary: 'Start copy trade strategy' })
  startCopyTrade() { return this.strategiesService.start('COPY_TRADE'); }

  @Post('copy-trade/stop')
  @ApiOperation({ summary: 'Stop copy trade strategy' })
  stopCopyTrade() { return this.strategiesService.stop('COPY_TRADE'); }

  @Get('copy-trade/status')
  @ApiOperation({ summary: 'Get copy trade status' })
  getCopyTradeStatus() { return this.strategiesService.getStatus('COPY_TRADE'); }

  @Post('market-maker/start')
  @ApiOperation({ summary: 'Start market maker strategy' })
  startMarketMaker() { return this.strategiesService.start('MARKET_MAKER'); }

  @Post('market-maker/stop')
  @ApiOperation({ summary: 'Stop market maker strategy' })
  stopMarketMaker() { return this.strategiesService.stop('MARKET_MAKER'); }

  @Get('market-maker/status')
  @ApiOperation({ summary: 'Get market maker status' })
  getMarketMakerStatus() { return this.strategiesService.getStatus('MARKET_MAKER'); }

  @Post('sniper/start')
  @ApiOperation({ summary: 'Start sniper strategy' })
  startSniper() { return this.strategiesService.start('SNIPER'); }

  @Post('sniper/stop')
  @ApiOperation({ summary: 'Stop sniper strategy' })
  stopSniper() { return this.strategiesService.stop('SNIPER'); }

  @Get('sniper/status')
  @ApiOperation({ summary: 'Get sniper status' })
  getSniperStatus() { return this.strategiesService.getStatus('SNIPER'); }
}
