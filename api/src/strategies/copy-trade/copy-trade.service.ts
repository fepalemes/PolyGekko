import { Injectable } from '@nestjs/common';
import { StrategyType } from '@prisma/client';
import { SettingsService } from '../../settings/settings.service';
import { LogsService } from '../../logs/logs.service';
import { EventsGateway } from '../../events/events.gateway';
import { WatcherService } from './watcher.service';
import { ExecutorService } from './executor.service';
import { RedeemerService } from './redeemer.service';

@Injectable()
export class CopyTradeService {
  private running = false;
  private isDryRun = true;
  private startedAt: Date | null = null;

  constructor(
    private settings: SettingsService,
    private logs: LogsService,
    private events: EventsGateway,
    private watcher: WatcherService,
    private executor: ExecutorService,
    private redeemer: RedeemerService,
  ) {}

  getStatus() {
    return {
      type: 'COPY_TRADE',
      running: this.running,
      isDryRun: this.isDryRun,
      startedAt: this.startedAt?.toISOString() || null,
    };
  }

  async start() {
    if (this.running) return { message: 'Already running' };

    const config = await this.settings.getCopyTradeConfig();
    this.isDryRun = await this.settings.getBool('COPY_TRADE_DRY_RUN', true);

    if (!config.traderAddress) {
      await this.logs.warn(StrategyType.COPY_TRADE, 'COPY_TRADE_TRADER_ADDRESS not configured');
      return { message: 'Trader address not configured' };
    }

    this.running = true;
    this.startedAt = new Date();

    // Persist running state so it survives restarts
    await this.settings.set('COPY_TRADE_RUNNING', 'true');

    await this.logs.info(StrategyType.COPY_TRADE, `Strategy started (${this.isDryRun ? 'DRY RUN' : 'LIVE'})`, { config });
    this.events.emitStrategyStatus(this.getStatus());

    this.executor.setConfig(config, this.isDryRun);
    this.watcher.start(config.traderAddress, (trade) => this.executor.onTradeDetected(trade));
    this.redeemer.start(config.redeemInterval, this.isDryRun, config);

    return { message: 'Started', status: this.getStatus() };
  }

  async stop() {
    if (!this.running) return { message: 'Not running' };
    this.running = false;
    this.startedAt = null;

    await this.settings.set('COPY_TRADE_RUNNING', 'false');

    this.watcher.stop();
    this.redeemer.stop();
    await this.logs.info(StrategyType.COPY_TRADE, 'Strategy stopped');
    this.events.emitStrategyStatus(this.getStatus());
    return { message: 'Stopped', status: this.getStatus() };
  }
}
