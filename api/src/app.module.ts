import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { SettingsModule } from './settings/settings.module';
import { PositionsModule } from './positions/positions.module';
import { TradesModule } from './trades/trades.module';
import { LogsModule } from './logs/logs.module';
import { PolymarketModule } from './polymarket/polymarket.module';
import { StrategiesModule } from './strategies/strategies.module';
import { EventsModule } from './events/events.module';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    SettingsModule,
    PositionsModule,
    TradesModule,
    LogsModule,
    PolymarketModule,
    EventsModule,
    NotificationsModule,
    StrategiesModule,
  ],
})
export class AppModule {}
