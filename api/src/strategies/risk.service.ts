import { Injectable, OnApplicationBootstrap, OnApplicationShutdown, Logger } from '@nestjs/common';
import { StrategyType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { LogsService } from '../logs/logs.service';
import { TelegramService } from '../notifications/telegram.service';
import { CopyTradeService } from './copy-trade/copy-trade.service';
import { MarketMakerService } from './market-maker/market-maker.service';
import { SniperService } from './sniper/sniper.service';

@Injectable()
export class RiskService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(RiskService.name);
  private timer: NodeJS.Timeout | null = null;
  private breachedAt: number | null = null;

  constructor(
    private prisma: PrismaService,
    private settings: SettingsService,
    private logs: LogsService,
    private telegram: TelegramService,
    private copyTrade: CopyTradeService,
    private marketMaker: MarketMakerService,
    private sniper: SniperService,
  ) {}

  onApplicationBootstrap() {
    // Check circuit breaker every 5 minutes
    this.timer = setInterval(() => this.checkCircuitBreaker().catch(err =>
      this.logger.error(`Circuit breaker check failed: ${err.message}`),
    ), 5 * 60 * 1000);
  }

  onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
  }

  async checkCircuitBreaker() {
    const { pct, windowHours } = await this.settings.getCircuitBreakerConfig();
    if (pct <= 0) return;

    const since = new Date(Date.now() - windowHours * 3600 * 1000);
    const samples = await this.prisma.performanceSample.findMany({
      where: { createdAt: { gte: since } },
      select: { pnlDelta: true },
    });

    if (samples.length === 0) return;

    const totalPnl = samples.reduce((sum, s) => sum + parseFloat(s.pnlDelta.toString()), 0);
    if (totalPnl >= 0) {
      // P&L recovered — reset breached state so it can trigger again later
      this.breachedAt = null;
      return;
    }

    // Use current sim balances as reference for % calculation
    const [ctBal, mmBal] = await Promise.all([
      this.settings.getNumber('COPY_TRADE_SIM_BALANCE', 0),
      this.settings.getNumber('MM_SIM_BALANCE', 0),
    ]);
    const refBalance = ctBal + mmBal;
    if (refBalance <= 0) return;

    const lossAbs = Math.abs(totalPnl);
    const drawdownPct = (lossAbs / (refBalance + lossAbs)) * 100; // as % of starting balance

    if (drawdownPct < pct) return;

    // Avoid repeated triggers within the same window
    if (this.breachedAt && Date.now() - this.breachedAt < windowHours * 3600 * 1000) return;
    this.breachedAt = Date.now();

    const msg = `[CIRCUIT BREAKER] ${drawdownPct.toFixed(1)}% drawdown in last ${windowHours}h (loss: $${lossAbs.toFixed(2)}) — pausing all strategies`;
    this.logger.warn(msg);
    await this.logs.warn(StrategyType.COPY_TRADE, msg);
    await this.telegram.notifyAlert(
      'Circuit Breaker Triggered',
      `Drawdown of ${drawdownPct.toFixed(1)}% in the last ${windowHours}h (loss: $${lossAbs.toFixed(2)}).\nAll running strategies have been paused.`,
    );

    const ctStatus = this.copyTrade.getStatus();
    if (ctStatus.running && !ctStatus.paused) await this.copyTrade.pause();

    const mmStatus = this.marketMaker.getStatus();
    if (mmStatus.running && !mmStatus.paused) await this.marketMaker.pause();

    const sniperStatus = this.sniper.getStatus();
    if (sniperStatus.running && !sniperStatus.paused) await this.sniper.pause();
  }
}
