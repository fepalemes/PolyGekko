import { Module } from '@nestjs/common';
import { SniperService } from './sniper.service';
import { SniperExecutorService } from './sniper-executor.service';
import { SniperSizingService } from './sniper-sizing.service';
import { SimStatsService } from '../sim-stats.service';
import { SettingsModule } from '../../settings/settings.module';
import { TradesModule } from '../../trades/trades.module';
import { LogsModule } from '../../logs/logs.module';
import { PolymarketModule } from '../../polymarket/polymarket.module';
import { PositionsModule } from '../../positions/positions.module';

@Module({
  imports: [SettingsModule, TradesModule, LogsModule, PolymarketModule, PositionsModule],
  providers: [SniperService, SniperExecutorService, SniperSizingService, SimStatsService],
  exports: [SniperService],
})
export class SniperModule {}
