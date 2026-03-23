import { Module } from '@nestjs/common';
import { StrategiesController } from './strategies.controller';
import { StrategiesService } from './strategies.service';
import { SimStatsService } from './sim-stats.service';
import { CopyTradeModule } from './copy-trade/copy-trade.module';
import { MarketMakerModule } from './market-maker/market-maker.module';
import { SniperModule } from './sniper/sniper.module';
import { SettingsModule } from '../settings/settings.module';
import { LogsModule } from '../logs/logs.module';
import { PolymarketModule } from '../polymarket/polymarket.module';

@Module({
  imports: [SettingsModule, LogsModule, PolymarketModule, CopyTradeModule, MarketMakerModule, SniperModule],
  controllers: [StrategiesController],
  providers: [StrategiesService, SimStatsService],
  exports: [SimStatsService],
})
export class StrategiesModule {}
