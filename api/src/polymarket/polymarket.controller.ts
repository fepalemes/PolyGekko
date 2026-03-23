import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ClobService } from './clob.service';

@ApiTags('polymarket')
@Controller('polymarket')
export class PolymarketController {
  constructor(private readonly clobService: ClobService) {}

  @Get('balance')
  @ApiOperation({ summary: 'Get real Polymarket balance' })
  async getBalance() {
    const balance = await this.clobService.getBalance();
    return { balance };
  }
}
