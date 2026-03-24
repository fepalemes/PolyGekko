import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ClobService } from './clob.service';
import { PolymarketDataService } from './polymarket-data.service';

const PROXY_ADDRESS = () => process.env.PROXY_WALLET_ADDRESS_MAIN ?? '';

@ApiTags('polymarket')
@Controller('polymarket')
export class PolymarketController {
  constructor(
    private readonly clobService: ClobService,
    private readonly dataService: PolymarketDataService,
  ) {}

  @Get('balance')
  @ApiOperation({ summary: 'Get real Polymarket USDC balance (on-chain)' })
  async getBalance() {
    const balance = await this.clobService.getBalance();
    return { balance };
  }

  @Get('portfolio')
  @ApiOperation({ summary: 'Get real portfolio stats from Polymarket data API (live mode)' })
  async getPortfolio() {
    return this.dataService.getPortfolio(PROXY_ADDRESS());
  }

  @Get('activity')
  @ApiOperation({ summary: 'Get recent trading activity from Polymarket (live mode)' })
  async getActivity(@Query('limit') limit?: string) {
    return this.dataService.getActivity(PROXY_ADDRESS(), limit ? +limit : 100);
  }

  @Get('positions')
  @ApiOperation({ summary: 'Get open positions from Polymarket (live mode)' })
  async getPositions() {
    return this.dataService.getPositions(PROXY_ADDRESS());
  }
}
