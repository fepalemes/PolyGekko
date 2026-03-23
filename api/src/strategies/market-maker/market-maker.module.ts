import { Module } from '@nestjs/common';
import { MarketMakerService } from './market-maker.service';
import { DetectorService } from './detector.service';
import { MmExecutorService } from './mm-executor.service';
import { SettingsModule } from '../../settings/settings.module';
import { PositionsModule } from '../../positions/positions.module';
import { TradesModule } from '../../trades/trades.module';
import { LogsModule } from '../../logs/logs.module';
import { PolymarketModule } from '../../polymarket/polymarket.module';
import { SimStatsService } from '../sim-stats.service';

@Module({
  imports: [SettingsModule, PositionsModule, TradesModule, LogsModule, PolymarketModule],
  providers: [MarketMakerService, DetectorService, MmExecutorService, SimStatsService],
  exports: [MarketMakerService],
})
export class MarketMakerModule {}
