import { Injectable } from '@nestjs/common';
import { StrategyType } from '@prisma/client';
import { SettingsService } from '../../settings/settings.service';
import { LogsService } from '../../logs/logs.service';
import { EventsGateway } from '../../events/events.gateway';
import { DetectorService } from './detector.service';
import { MmExecutorService } from './mm-executor.service';

@Injectable()
export class MarketMakerService {
  private running = false;
  private paused = false;
  private isDryRun = true;
  private startedAt: Date | null = null;

  constructor(
    private settings: SettingsService,
    private logs: LogsService,
    private events: EventsGateway,
    private detector: DetectorService,
    private executor: MmExecutorService,
  ) {}

  getStatus() {
    return {
      type: 'MARKET_MAKER',
      running: this.running,
      paused: this.paused,
      isDryRun: this.isDryRun,
      startedAt: this.startedAt?.toISOString() || null,
    };
  }

  async start() {
    if (this.running) return { message: 'Already running' };
    const config = await this.settings.getMarketMakerConfig();
    this.isDryRun = await this.settings.isGlobalSimulationMode();
    this.running = true;
    this.paused = false;
    this.startedAt = new Date();

    await this.settings.set('MM_RUNNING', 'true');

    await this.logs.info(StrategyType.MARKET_MAKER, `Strategy started (${this.isDryRun ? 'DRY RUN' : 'LIVE'})`, { config });
    this.events.emitStrategyStatus(this.getStatus());
    this.executor.setConfig(config, this.isDryRun);
    this.detector.start(config, (market, asset) => {
      if (this.paused) return;
      this.executor.onMarketDetected(market, asset);
    });
    return { message: 'Started', status: this.getStatus() };
  }

  async stop() {
    if (!this.running) return { message: 'Not running' };
    this.running = false;
    this.paused = false;
    this.startedAt = null;

    await this.settings.set('MM_RUNNING', 'false');

    this.detector.stop();
    await this.executor.stopAll();
    this.executor.reset();
    await this.logs.info(StrategyType.MARKET_MAKER, 'Strategy stopped');
    this.events.emitStrategyStatus(this.getStatus());
    return { message: 'Stopped', status: this.getStatus() };
  }

  async pause() {
    if (!this.running) return { message: 'Not running' };
    if (this.paused) return { message: 'Already paused' };
    this.paused = true;
    await this.logs.info(StrategyType.MARKET_MAKER, 'Strategy paused — no new entries will be made');
    this.events.emitStrategyStatus(this.getStatus());
    return { message: 'Paused', status: this.getStatus() };
  }

  async resume() {
    if (!this.running) return { message: 'Not running' };
    if (!this.paused) return { message: 'Not paused' };
    this.paused = false;
    await this.logs.info(StrategyType.MARKET_MAKER, 'Strategy resumed');
    this.events.emitStrategyStatus(this.getStatus());
    return { message: 'Resumed', status: this.getStatus() };
  }
}
