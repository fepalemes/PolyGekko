import { Module } from '@nestjs/common';
import { PositionsService } from './positions.service';
import { PositionsController } from './positions.controller';
import { PolymarketModule } from '../polymarket/polymarket.module';

@Module({
  imports: [PolymarketModule],
  providers: [PositionsService],
  controllers: [PositionsController],
  exports: [PositionsService],
})
export class PositionsModule {}
