import { Module } from '@nestjs/common';
import { ClobService } from './clob.service';
import { GammaService } from './gamma.service';
import { CtfService } from './ctf.service';
import { BinanceService } from './binance.service';
import { SettingsModule } from '../settings/settings.module';
import { PolymarketController } from './polymarket.controller';

@Module({
  imports: [SettingsModule],
  controllers: [PolymarketController],
  providers: [ClobService, GammaService, CtfService, BinanceService],
  exports: [ClobService, GammaService, CtfService, BinanceService],
})
export class PolymarketModule {}
