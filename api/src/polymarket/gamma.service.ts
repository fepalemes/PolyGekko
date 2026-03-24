import { Injectable, Logger } from '@nestjs/common';

const GAMMA_BASE = 'https://gamma-api.polymarket.com';

@Injectable()
export class GammaService {
  private readonly logger = new Logger(GammaService.name);

  async ping(): Promise<boolean> {
    try {
      const resp = await fetch(`${GAMMA_BASE}/markets?limit=1`, { signal: AbortSignal.timeout(5000) });
      return resp.ok;
    } catch {
      return false;
    }
  }

  async getMarket(conditionId: string): Promise<any> {
    try {
      const resp = await fetch(`${GAMMA_BASE}/markets/${conditionId}`);
      return resp.json();
    } catch (err) {
      this.logger.error(`getMarket ${conditionId}: ${err.message}`);
      return null;
    }
  }

  async getMarketByTokenId(tokenId: string): Promise<any> {
    try {
      const resp = await fetch(`${GAMMA_BASE}/markets?clob_token_ids=${tokenId}`);
      const data = await resp.json();
      return Array.isArray(data) ? data[0] : null;
    } catch (err) {
      this.logger.error(`getMarketByTokenId ${tokenId}: ${err.message}`);
      return null;
    }
  }

  async searchMarkets(query: string, limit = 20): Promise<any[]> {
    try {
      const resp = await fetch(`${GAMMA_BASE}/markets?q=${encodeURIComponent(query)}&limit=${limit}&active=true`);
      const data = await resp.json();
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  async getMarketsBySlug(slugPattern: string): Promise<any[]> {
    try {
      const resp = await fetch(`${GAMMA_BASE}/markets?slug=${encodeURIComponent(slugPattern)}&limit=10`);
      const data = await resp.json();
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  async getResolvedMarkets(limit = 50): Promise<any[]> {
    try {
      const resp = await fetch(`${GAMMA_BASE}/markets?closed=true&limit=${limit}&order=updatedAt&ascending=false`);
      const data = await resp.json();
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  /**
   * Find crypto up/down markets for a given asset and duration ('5m', '15m', '1h', or '4h').
   *
   * These are recurring events: slug = "{asset}-updown-{suffix}-{unixTs}"
   * seriesSlug = "{asset}-up-or-down-{suffix}"
   *
   * Key facts discovered from the API:
   * - Events are created ~24h in advance, so startDate/creationDate = creation time (NOT trading start)
   * - The actual trading window is: eventStartTime → endDate
   * - clobTokenIds comes as a JSON string, not an array
   * - Markets are active=true and acceptingOrders=true immediately after creation
   */
  async getCryptoMarketsByDuration(asset: string, duration: string): Promise<any[]> {
    const DURATION_MAP: Record<string, { suffix: string; ms: number; toleranceMs: number }> = {
      '5m':  { suffix: '5m',     ms: 5  * 60 * 1000,       toleranceMs: 90 * 1000 },
      '15m': { suffix: '15m',    ms: 15 * 60 * 1000,       toleranceMs: 90 * 1000 },
      '1h':  { suffix: 'hourly', ms: 60 * 60 * 1000,       toleranceMs: 5 * 60 * 1000 },
      '4h':  { suffix: '4h',     ms: 4  * 60 * 60 * 1000,  toleranceMs: 10 * 60 * 1000 },
    };

    if (!DURATION_MAP[duration]) return [];

    const seriesSlug = `${asset.toLowerCase()}-up-or-down-${DURATION_MAP[duration].suffix}`;
    const slugPrefix = `${asset.toLowerCase()}-updown-${DURATION_MAP[duration].suffix}-`;
    const durationMs = DURATION_MAP[duration].ms;
    const toleranceMs = DURATION_MAP[duration].toleranceMs;
    const now = Date.now();

    const seen = new Set<string>();
    const result: any[] = [];

    const parseTokenIds = (raw: any): string[] => {
      if (!raw) return [];
      if (Array.isArray(raw)) return raw;
      try { return JSON.parse(raw); } catch { return []; }
    };

    const isTimingOk = (m: any, eventStartTime?: string): boolean => {
      // Use eventStartTime (trading window start), NOT startDate (creation date)
      const start = new Date(m.eventStartTime || eventStartTime || 0).getTime();
      const end = new Date(m.endDate || m.end_date_iso || 0).getTime();
      if (!start || !end || end <= now) return false;
      // Resolution window must match target duration
      if (Math.abs((end - start) - durationMs) > toleranceMs) return false;
      // Reject markets whose trading window starts more than 5 minutes from now
      // (markets are created ~24h in advance — we only want current/imminent windows)
      if (start > now + 5 * 60 * 1000) return false;
      return true;
    };

    const addMarket = (m: any, event?: any) => {
      const id = m.conditionId || m.condition_id;
      if (!id || seen.has(id)) return;
      // Reject closed or non-accepting markets (finished/expired)
      if (m.closed === true) return;
      if (m.acceptingOrders === false) return;
      // Ensure clobTokenIds is always an array
      m.clobTokenIds = parseTokenIds(m.clobTokenIds || m.clob_token_ids);
      // Propagate eventStartTime from the event if market is missing it
      if (!m.eventStartTime && event?.startTime) m.eventStartTime = event.startTime;
      if (!isTimingOk(m, event?.startTime)) return;
      seen.add(id);
      result.push(m);
    };

    // ── Primary strategy: direct slug lookup by computed timestamp ────────────
    //
    // Polymarket event slugs follow: "{asset}-updown-{suffix}-{unixTimestamp}"
    // where unixTimestamp = the trading window START in UTC seconds, aligned to
    // the duration boundary (5m → multiple of 300, 15m → 900, 1h → 3600, 4h → 14400).
    //
    // This lets us compute expected slugs directly instead of paginating through
    // thousands of events ordered by creation date.
    //
    // We probe: previous window (might still be open), current, next 2 ahead.
    // isTimingOk rejects expired windows and those starting >5min from now.

    const processEvents = (data: any[]) => {
      if (!Array.isArray(data)) return;
      const arr = Array.isArray(data) ? data : [data];
      for (const event of arr) {
        const es: string = event.seriesSlug || '';
        const sl: string = event.slug || '';
        if (es !== seriesSlug && !sl.startsWith(slugPrefix)) continue;
        for (const m of (event.markets || [])) addMarket(m, event);
      }
    };

    const windowSecs = durationMs / 1000;
    const nowSecs = Math.floor(Date.now() / 1000);
    const currentWindowStart = Math.floor(nowSecs / windowSecs) * windowSecs;

    // Probe current window, one before and two ahead (for pre-entry)
    const timestamps = [
      currentWindowStart - windowSecs,
      currentWindowStart,
      currentWindowStart + windowSecs,
      currentWindowStart + windowSecs * 2,
    ];

    try {
      const slugFetches = timestamps.map(ts =>
        fetch(`${GAMMA_BASE}/events?slug=${slugPrefix}${ts}`).then(r => r.ok ? r.json() : []).catch(() => []),
      );
      const slugResults = await Promise.all(slugFetches);
      for (const data of slugResults) processEvents(Array.isArray(data) ? data : []);
    } catch {}

    // ── Fallback: ascending pagination ─────────────────────────────────────────
    // Used when slug lookup finds nothing (e.g. Polymarket changes slug format).
    // Ascending creation order → oldest active events first → current windows.
    if (result.length === 0) {
      try {
        const resp = await fetch(`${GAMMA_BASE}/events?active=true&limit=200&order=startDate&ascending=true`);
        if (resp.ok) processEvents(await resp.json());
      } catch {}
    }

    result.sort((a, b) => {
      const getStart = (m: any) => new Date(m.eventStartTime || 0).getTime();
      return getStart(a) - getStart(b);
    });

    return result;
  }
}
