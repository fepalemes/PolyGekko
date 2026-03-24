import { Injectable } from '@nestjs/common';
import { StrategyType } from '@prisma/client';
import { SettingsService } from '../../settings/settings.service';
import { LogsService } from '../../logs/logs.service';
import { EventsGateway } from '../../events/events.gateway';
import { SniperExecutorService } from './sniper-executor.service';

@Injectable()
export class SniperService {
  private running = false;
  private paused = false;
  private isDryRun = true;
  private startedAt: Date | null = null;

  constructor(
    private settings: SettingsService,
    private logs: LogsService,
    private events: EventsGateway,
    private executor: SniperExecutorService,
  ) {}

  getStatus() {
    return {
      type: 'SNIPER',
      running: this.running,
      paused: this.paused,
      isDryRun: this.isDryRun,
      startedAt: this.startedAt?.toISOString() || null,
    };
  }

  async start() {
    if (this.running) return { message: 'Already running' };
    const config = await this.settings.getSniperConfig();
    this.isDryRun = await this.settings.isGlobalSimulationMode();
    this.running = true;
    this.paused = false;
    this.startedAt = new Date();

    await this.settings.set('SNIPER_RUNNING', 'true');

    await this.logs.info(StrategyType.SNIPER, `Strategy started (${this.isDryRun ? 'DRY RUN' : 'LIVE'})`, { config });
    this.events.emitStrategyStatus(this.getStatus());
    this.executor.start(config, this.isDryRun);
    return { message: 'Started', status: this.getStatus() };
  }

  async stop() {
    if (!this.running) return { message: 'Not running' };
    this.running = false;
    this.paused = false;
    this.startedAt = null;

    await this.settings.set('SNIPER_RUNNING', 'false');

    this.executor.stop();
    await this.logs.info(StrategyType.SNIPER, 'Strategy stopped');
    this.events.emitStrategyStatus(this.getStatus());
    return { message: 'Stopped', status: this.getStatus() };
  }

  async pause() {
    if (!this.running) return { message: 'Not running' };
    if (this.paused) return { message: 'Already paused' };
    this.paused = true;
    this.executor.setPaused(true);
    await this.logs.info(StrategyType.SNIPER, 'Strategy paused — no new entries will be made');
    this.events.emitStrategyStatus(this.getStatus());
    return { message: 'Paused', status: this.getStatus() };
  }

  async resume() {
    if (!this.running) return { message: 'Not running' };
    if (!this.paused) return { message: 'Not paused' };
    this.paused = false;
    this.executor.setPaused(false);
    await this.logs.info(StrategyType.SNIPER, 'Strategy resumed');
    this.events.emitStrategyStatus(this.getStatus());
    return { message: 'Resumed', status: this.getStatus() };
  }
}
