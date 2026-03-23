import { Module } from '@nestjs/common';
import { CopyTradeService } from './copy-trade.service';
import { WatcherService } from './watcher.service';
import { ExecutorService } from './executor.service';
import { AutoSellService } from './auto-sell.service';
import { RedeemerService } from './redeemer.service';
import { SimStatsService } from '../sim-stats.service';
import { SettingsModule } from '../../settings/settings.module';
import { PositionsModule } from '../../positions/positions.module';
import { TradesModule } from '../../trades/trades.module';
import { LogsModule } from '../../logs/logs.module';
import { PolymarketModule } from '../../polymarket/polymarket.module';

@Module({
  imports: [SettingsModule, PositionsModule, TradesModule, LogsModule, PolymarketModule],
  providers: [CopyTradeService, WatcherService, ExecutorService, AutoSellService, RedeemerService, SimStatsService],
  exports: [CopyTradeService],
})
export class CopyTradeModule {}
