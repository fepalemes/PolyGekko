import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { SettingsService } from '../settings/settings.service';

type QueuedEvent =
  | { type: 'buy';   params: BuyParams }
  | { type: 'sell';  params: SellParams }
  | { type: 'mmEntry';  params: MMEntryParams }
  | { type: 'mmClose';  params: MMCloseParams };

interface BuyParams {
  strategy: string; isDryRun: boolean; market: string;
  size: number; price: number; shares: number; balance?: number; endTime?: Date;
}

interface SellParams {
  strategy: string; isDryRun: boolean; market: string;
  shares: number; price: number; proceeds: number; pnl: number; totalCost: number; balance?: number;
}

interface MMEntryParams {
  isDryRun: boolean; market: string; asset: string; duration: string;
  tradeSize: number; sellPrice: number; endTime: Date; balance: number;
}

interface MMCloseParams {
  isDryRun: boolean; market: string; asset: string; duration: string;
  tradeSize: number; pnl: number; balance: number;
  isCutLoss: boolean; yesFilled: boolean; noFilled: boolean;
}

const FLUSH_INTERVAL_MS = 5 * 60 * 1000;

@Injectable()
export class TelegramService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramService.name);
  private readonly apiBase = 'https://api.telegram.org';

  private queue: QueuedEvent[] = [];
  private windowStart = new Date();
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private settings: SettingsService) {}

  onModuleInit() {
    this.windowStart = new Date();
    this.timer = setInterval(() => this.flush(), FLUSH_INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  // ── Public enqueuers ─────────────────────────────────────────────────────

  notifyBuy(params: BuyParams) {
    this.queue.push({ type: 'buy', params });
  }

  notifySell(params: SellParams) {
    this.queue.push({ type: 'sell', params });
  }

  notifyMMEntry(params: MMEntryParams) {
    this.queue.push({ type: 'mmEntry', params });
  }

  notifyMMClose(params: MMCloseParams) {
    this.queue.push({ type: 'mmClose', params });
  }

  /**
   * Sends an immediate high-priority alert (bypasses the 5-min batch queue).
   * Used for circuit breaker, session stop-loss, unexpected strategy stops.
   */
  async notifyAlert(title: string, body: string): Promise<void> {
    await this.send(`🚨 <b>${this.escapeHtml(title)}</b>\n\n${this.escapeHtml(body)}`);
  }

  // ── Core send (used by flush + test endpoint) ─────────────────────────────

  async send(html: string): Promise<void> {
    const [enabled, token, chatId] = await Promise.all([
      this.settings.getBool('TELEGRAM_ENABLED', false),
      this.settings.get('TELEGRAM_BOT_TOKEN'),
      this.settings.get('TELEGRAM_CHAT_ID'),
    ]);

    if (!enabled || !token || !chatId) return;

    try {
      const resp = await fetch(`${this.apiBase}/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: html,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }),
      });
      if (!resp.ok) {
        const body = await resp.text();
        this.logger.warn(`Telegram send failed (${resp.status}): ${body}`);
      }
    } catch (err) {
      this.logger.warn(`Telegram send error: ${err.message}`);
    }
  }

  // ── Flush ────────────────────────────────────────────────────────────────

  private async flush() {
    const events = this.queue.splice(0);
    const windowEnd = new Date();
    const windowStartSnap = this.windowStart;
    this.windowStart = windowEnd;

    if (events.length === 0) return;

    const msg = this.buildSummary(events, windowStartSnap, windowEnd);
    await this.send(msg);
  }

  private buildSummary(events: QueuedEvent[], from: Date, to: Date): string {
    const fromStr = this.formatTimeShort(from);
    const toStr   = this.formatTimeShort(to);

    const lines: string[] = [
      `📊 <b>PolyGekko — Resumo</b>`,
      `🕐 ${fromStr} → ${toStr} UTC`,
      `━━━━━━━━━━━━━━━━━━━`,
    ];

    // ── Copy Trade ───────────────────────────────────────────────────────
    const buys  = events.filter(e => e.type === 'buy')  as { type: 'buy';  params: BuyParams  }[];
    const sells = events.filter(e => e.type === 'sell') as { type: 'sell'; params: SellParams }[];

    if (buys.length > 0 || sells.length > 0) {
      const mode = buys[0]?.params.isDryRun ?? sells[0]?.params.isDryRun ? '🔸 Sim' : '🔴 Live';
      lines.push(``, `👥 <b>Copy Trade</b> · ${mode}`);

      if (buys.length > 0) {
        const totalInvested = buys.reduce((s, e) => s + e.params.size, 0);
        lines.push(`  🟢 ${buys.length} compra${buys.length > 1 ? 's' : ''} · <code>$${totalInvested.toFixed(2)}</code> investido`);
        for (const e of buys) {
          lines.push(`     • ${this.escapeHtml(this.truncate(e.params.market, 40))} @ <code>$${e.params.price.toFixed(4)}</code>`);
        }
      }

      if (sells.length > 0) {
        const totalPnl = sells.reduce((s, e) => s + e.params.pnl, 0);
        const wins = sells.filter(e => e.params.pnl >= 0).length;
        const pnlSign = totalPnl >= 0 ? '+' : '';
        lines.push(`  🔴 ${sells.length} venda${sells.length > 1 ? 's' : ''} · ${wins}✅ ${sells.length - wins}❌ · P&amp;L: <b>${pnlSign}$${totalPnl.toFixed(2)}</b>`);
        for (const e of sells) {
          const sign = e.params.pnl >= 0 ? '+' : '';
          lines.push(`     • ${this.escapeHtml(this.truncate(e.params.market, 40))} · <code>${sign}$${e.params.pnl.toFixed(2)}</code>`);
        }
        const lastBal = sells[sells.length - 1].params.balance;
        if (lastBal !== undefined) lines.push(`  💰 Saldo CT: <code>$${lastBal.toFixed(2)}</code>`);
      }
    }

    // ── Market Maker ─────────────────────────────────────────────────────
    const mmEntries = events.filter(e => e.type === 'mmEntry') as { type: 'mmEntry'; params: MMEntryParams }[];
    const mmCloses  = events.filter(e => e.type === 'mmClose') as { type: 'mmClose'; params: MMCloseParams }[];

    if (mmEntries.length > 0 || mmCloses.length > 0) {
      const mode = mmEntries[0]?.params.isDryRun ?? mmCloses[0]?.params.isDryRun ? '🔸 Sim' : '🔴 Live';
      lines.push(``, `🤖 <b>Market Maker</b> · ${mode}`);

      if (mmEntries.length > 0) {
        const totalIn = mmEntries.reduce((s, e) => s + e.params.tradeSize, 0);
        lines.push(`  📥 ${mmEntries.length} entrada${mmEntries.length > 1 ? 's' : ''} · <code>$${totalIn.toFixed(2)}</code>`);
        for (const e of mmEntries) {
          lines.push(`     • ${e.params.asset.toUpperCase()} ${e.params.duration} — ${this.escapeHtml(this.truncate(e.params.market, 35))}`);
        }
      }

      if (mmCloses.length > 0) {
        const totalPnl = mmCloses.reduce((s, e) => s + e.params.pnl, 0);
        const wins = mmCloses.filter(e => e.params.pnl >= 0).length;
        const cutLosses = mmCloses.filter(e => e.params.isCutLoss).length;
        const pnlSign = totalPnl >= 0 ? '+' : '';
        lines.push(`  📤 ${mmCloses.length} fechamento${mmCloses.length > 1 ? 's' : ''} · ${wins}✅ ${mmCloses.length - wins}❌${cutLosses > 0 ? ` · ✂️ ${cutLosses} cut-loss` : ''} · P&amp;L: <b>${pnlSign}$${totalPnl.toFixed(2)}</b>`);
        for (const e of mmCloses) {
          const sign = e.params.pnl >= 0 ? '+' : '';
          const tag = e.params.isCutLoss ? ' ✂️' : '';
          lines.push(`     • ${e.params.asset.toUpperCase()} ${e.params.duration}${tag} · <code>${sign}$${e.params.pnl.toFixed(2)}</code>`);
        }
        const lastBal = mmCloses[mmCloses.length - 1].params.balance;
        lines.push(`  💰 Saldo MM: <code>$${lastBal.toFixed(2)}</code>`);
      }
    }

    lines.push(`━━━━━━━━━━━━━━━━━━━`);
    lines.push(`📦 ${events.length} evento${events.length > 1 ? 's' : ''} neste período`);

    return lines.join('\n');
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private formatTimeShort(date: Date): string {
    return date.toISOString().slice(11, 16);
  }

  private truncate(text: string, max: number): string {
    return text.length <= max ? text : text.slice(0, max - 1) + '…';
  }

  private escapeHtml(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}
