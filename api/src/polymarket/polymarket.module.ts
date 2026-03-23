import { Module } from '@nestjs/common';
import { ClobService } from './clob.service';
import { GammaService } from './gamma.service';
import { CtfService } from './ctf.service';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [SettingsModule],
  providers: [ClobService, GammaService, CtfService],
  exports: [ClobService, GammaService, CtfService],
})
export class PolymarketModule {}
