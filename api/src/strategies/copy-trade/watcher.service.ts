import { Injectable, Logger } from '@nestjs/common';

const DATA_API = 'https://data-api.polymarket.com';
const POLL_INTERVAL_MS = 1000;
const BACKOFF_BASE_MS = 2000;
const BACKOFF_MAX_MS = 60000;

@Injectable()
export class WatcherService {
  private readonly logger = new Logger(WatcherService.name);
  private pollTimer: NodeJS.Timeout | null = null;
  private processedTrades = new Set<string>();
  private traderAddress = '';
  private onTrade: ((trade: any) => void) | null = null;
  private shouldRun = false;

  private consecutiveErrors = 0;
  private nextAllowedPollAt = 0;

  start(traderAddress: string, onTrade: (trade: any) => void) {
    this.traderAddress = traderAddress.toLowerCase();
    this.onTrade = onTrade;
    this.shouldRun = true;
    this.consecutiveErrors = 0;
    this.nextAllowedPollAt = 0;
    this.logger.log(`Polling trader ${this.traderAddress} every ${POLL_INTERVAL_MS}ms`);
    this.poll();
    this.pollTimer = setInterval(() => this.poll(), POLL_INTERVAL_MS);
  }

  stop() {
    this.shouldRun = false;
    if (this.pollTimer) { clearInterval(this.pollTimer); this.pollTimer = null; }
    this.processedTrades.clear();
    this.consecutiveErrors = 0;
  }

  private async poll() {
    if (!this.shouldRun) return;

    // Respect backoff: skip ticks until the backoff window expires
    if (Date.now() < this.nextAllowedPollAt) return;

    try {
      const url = `${DATA_API}/activity?user=${this.traderAddress}&limit=20`;
      const resp = await fetch(url);

      if (!resp.ok) {
        this.handleError(`HTTP ${resp.status}`);
        return;
      }

      const items: any[] = await resp.json();
      if (!Array.isArray(items)) return;

      // Success — reset backoff
      if (this.consecutiveErrors > 0) {
        this.logger.log(`Watcher recovered after ${this.consecutiveErrors} error(s)`);
        this.consecutiveErrors = 0;
      }

      for (const payload of items) {
        this.handleEvent(payload);
      }
    } catch (err) {
      this.handleError(err?.message || 'network error');
    }
  }

  private handleError(reason: string) {
    this.consecutiveErrors++;
    const delay = Math.min(BACKOFF_BASE_MS * Math.pow(2, this.consecutiveErrors - 1), BACKOFF_MAX_MS);
    this.nextAllowedPollAt = Date.now() + delay;
    this.logger.warn(`Watcher error #${this.consecutiveErrors}: ${reason} — backing off ${delay}ms`);
  }

  private handleEvent(payload: any) {
    // Deduplicate
    const tradeId = payload.transactionHash || payload.transaction_hash
      || `${payload.timestamp}_${payload.asset}`;
    if (!tradeId || this.processedTrades.has(tradeId)) return;
    this.processedTrades.add(tradeId);
    if (this.processedTrades.size > 1000) {
      const first = this.processedTrades.values().next().value;
      this.processedTrades.delete(first);
    }

    const side = (payload.side || '').toUpperCase();
    if (side !== 'BUY' && side !== 'SELL') return;
    if (!payload.asset) return;

    const trade = {
      id: tradeId,
      type: side,
      side,
      asset_id: payload.asset,
      tokenId: payload.asset,
      condition_id: payload.conditionId || payload.condition_id || null,
      conditionId: payload.conditionId || payload.condition_id || null,
      market: payload.title || payload.name || null,
      price: parseFloat(payload.price || '0'),
      size: parseFloat(payload.size || '0'),
      outcome: payload.outcome || null,
      timestamp: payload.timestamp,
    };

    this.logger.log(`Trade detected: ${side} ${trade.market || trade.asset_id} @ $${trade.price}`);
    if (this.onTrade) this.onTrade(trade);
  }
}
