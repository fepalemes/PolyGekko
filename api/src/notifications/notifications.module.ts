import { Global, Module } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { NotificationsController } from './notifications.controller';
import { SettingsModule } from '../settings/settings.module';

@Global()
@Module({
  imports: [SettingsModule],
  controllers: [NotificationsController],
  providers: [TelegramService],
  exports: [TelegramService],
})
export class NotificationsModule {}
