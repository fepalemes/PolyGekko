import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type TradingMode = 'high' | 'intermediate' | 'low' | 'custom';

// Settings applied when a preset mode is selected.
// DRY_RUN flags are intentionally excluded — those stay as the user set them.
export const TRADING_MODE_PRESETS: Record<Exclude<TradingMode, 'custom'>, Record<string, string>> = {
  high: {
    // Copy Trade
    COPY_TRADE_SIZE_MODE: 'fixed',
    COPY_TRADE_FIXED_AMOUNT: '50',
    COPY_TRADE_MAX_BALANCE_USAGE_PERCENT: '80',
    COPY_TRADE_MIN_LIVE_BALANCE: '10',
    COPY_TRADE_MIN_ENTRY_AMOUNT: '5',
    COPY_TRADE_MIN_MARKET_TIME_LEFT: '60',
    COPY_TRADE_STOP_LOSS_PERCENT: '0',
    COPY_TRADE_AUTO_SELL_ENABLED: 'true',
    COPY_TRADE_AUTO_SELL_PROFIT_PERCENT: '30',
    COPY_TRADE_GTC_FALLBACK_TIMEOUT: '45',
    // Market Maker
    MM_TRADE_SIZE: '50',
    MM_SELL_PRICE: '0.65',
    MM_CUT_LOSS_TIME: '30',
    MM_ENTRY_MAX_COMBINED: '1.05',
    MM_ENTRY_MIN_TOKEN_PRICE: '0.10',
    MM_ENTRY_MAX_TOKEN_PRICE: '0.90',
    MM_EARLY_EXIT_ENABLED: 'true',
    MM_EARLY_EXIT_LOSS_PCT: '60',
    // Sniper
    SNIPER_MAX_SHARES: '50',
    SNIPER_TIER1_PRICE: '0.04',
    SNIPER_TIER2_PRICE: '0.03',
    SNIPER_TIER3_PRICE: '0.02',
    // Global
    GLOBAL_WALLET_MARGIN: '10',
    GLOBAL_MAX_ENTRIES_PER_MINUTE: '10',
  },
  intermediate: {
    COPY_TRADE_SIZE_MODE: 'fixed',
    COPY_TRADE_FIXED_AMOUNT: '20',
    COPY_TRADE_MAX_BALANCE_USAGE_PERCENT: '50',
    COPY_TRADE_MIN_LIVE_BALANCE: '20',
    COPY_TRADE_MIN_ENTRY_AMOUNT: '2',
    COPY_TRADE_MIN_MARKET_TIME_LEFT: '120',
    COPY_TRADE_STOP_LOSS_PERCENT: '30',
    COPY_TRADE_AUTO_SELL_ENABLED: 'true',
    COPY_TRADE_AUTO_SELL_PROFIT_PERCENT: '50',
    COPY_TRADE_GTC_FALLBACK_TIMEOUT: '60',
    MM_TRADE_SIZE: '20',
    MM_SELL_PRICE: '0.60',
    MM_CUT_LOSS_TIME: '60',
    MM_ENTRY_MAX_COMBINED: '1.02',
    MM_ENTRY_MIN_TOKEN_PRICE: '0.20',
    MM_ENTRY_MAX_TOKEN_PRICE: '0.80',
    MM_EARLY_EXIT_ENABLED: 'true',
    MM_EARLY_EXIT_LOSS_PCT: '40',
    SNIPER_MAX_SHARES: '25',
    SNIPER_TIER1_PRICE: '0.03',
    SNIPER_TIER2_PRICE: '0.02',
    SNIPER_TIER3_PRICE: '0.01',
    GLOBAL_WALLET_MARGIN: '20',
    GLOBAL_MAX_ENTRIES_PER_MINUTE: '5',
  },
  low: {
    COPY_TRADE_SIZE_MODE: 'fixed',
    COPY_TRADE_FIXED_AMOUNT: '5',
    COPY_TRADE_MAX_BALANCE_USAGE_PERCENT: '20',
    COPY_TRADE_MIN_LIVE_BALANCE: '50',
    COPY_TRADE_MIN_ENTRY_AMOUNT: '1',
    COPY_TRADE_MIN_MARKET_TIME_LEFT: '300',
    COPY_TRADE_STOP_LOSS_PERCENT: '50',
    COPY_TRADE_AUTO_SELL_ENABLED: 'true',
    COPY_TRADE_AUTO_SELL_PROFIT_PERCENT: '80',
    COPY_TRADE_GTC_FALLBACK_TIMEOUT: '90',
    MM_TRADE_SIZE: '5',
    MM_SELL_PRICE: '0.55',
    MM_CUT_LOSS_TIME: '90',
    MM_ENTRY_MAX_COMBINED: '1.00',
    MM_ENTRY_MIN_TOKEN_PRICE: '0.30',
    MM_ENTRY_MAX_TOKEN_PRICE: '0.70',
    MM_EARLY_EXIT_ENABLED: 'true',
    MM_EARLY_EXIT_LOSS_PCT: '25',
    SNIPER_MAX_SHARES: '10',
    SNIPER_TIER1_PRICE: '0.03',
    SNIPER_TIER2_PRICE: '0.02',
    SNIPER_TIER3_PRICE: '0.01',
    GLOBAL_WALLET_MARGIN: '50',
    GLOBAL_MAX_ENTRIES_PER_MINUTE: '2',
  },
};

const DEFAULT_SETTINGS = [
  // ── Copy Trade ──────────────────────────────────────────────────────────────
  { key: 'COPY_TRADE_RUNNING', value: 'false', category: 'copy_trade', description: 'Whether the strategy is running (auto-restored on restart)' },
  { key: 'COPY_TRADE_DRY_RUN', value: 'true', category: 'copy_trade', description: 'Simulation mode — no real orders placed' },
  { key: 'COPY_TRADE_TRADER_ADDRESS', value: '', category: 'copy_trade', description: 'Proxy wallet address of the trader to copy' },
  { key: 'COPY_TRADE_SIZE_MODE', value: 'percentage', category: 'copy_trade', description: '"percentage", "balance", or "fixed"' },
  { key: 'COPY_TRADE_FIXED_AMOUNT', value: '10', category: 'copy_trade', description: 'Fixed USDC amount per trade when SIZE_MODE=fixed' },
  { key: 'COPY_TRADE_SIZE_PERCENT', value: '10', category: 'copy_trade', description: 'Percentage of MAX_POSITION_SIZE (or balance) per trade' },
  { key: 'COPY_TRADE_MAX_POSITION_SIZE', value: '50', category: 'copy_trade', description: 'Max USDC per position' },
  { key: 'COPY_TRADE_DYNAMIC_SIZING_ENABLED', value: 'false', category: 'copy_trade', description: 'Enable dynamic random sizing' },
  { key: 'COPY_TRADE_MIN_ALLOCATION', value: '5', category: 'copy_trade', description: 'Minimum USDC to allocate dynamically' },
  { key: 'COPY_TRADE_MAX_ALLOCATION', value: '25', category: 'copy_trade', description: 'Maximum USDC to allocate dynamically' },
  { key: 'COPY_TRADE_MIN_ENTRY_AMOUNT', value: '1', category: 'copy_trade', description: 'Minimum USDC to spend on an entry — never skips if size >= this' },
  { key: 'COPY_TRADE_AUTO_SELL_ENABLED', value: 'true', category: 'copy_trade', description: 'Place auto limit-sell after entry' },
  { key: 'COPY_TRADE_AUTO_SELL_PROFIT_PERCENT', value: '50', category: 'copy_trade', description: 'Take-profit target % above buy price' },
  { key: 'COPY_TRADE_STOP_LOSS_PERCENT', value: '0', category: 'copy_trade', description: 'Stop-loss % below buy price (0 = disabled)' },
  { key: 'COPY_TRADE_SELL_MODE', value: 'market', category: 'copy_trade', description: '"market" or "limit"' },
  { key: 'COPY_TRADE_MIN_MARKET_TIME_LEFT', value: '300', category: 'copy_trade', description: 'Skip buy if market closes within N seconds' },
  { key: 'COPY_TRADE_GTC_FALLBACK_TIMEOUT', value: '60', category: 'copy_trade', description: 'Seconds to wait for GTC fill before cancelling' },
  { key: 'COPY_TRADE_REDEEM_INTERVAL', value: '60', category: 'copy_trade', description: 'Seconds between price-check / redemption cycles' },
  { key: 'COPY_TRADE_MAX_RETRIES', value: '3', category: 'copy_trade', description: 'Max retries on order failure' },
  { key: 'COPY_TRADE_SIM_BALANCE', value: '1000', category: 'copy_trade', description: 'Fictitious balance for simulation mode (USDC)' },
  { key: 'COPY_TRADE_MAX_BALANCE_USAGE_PERCENT', value: '30', category: 'copy_trade', description: 'Max % of total balance to keep in open positions' },
  { key: 'COPY_TRADE_MIN_LIVE_BALANCE', value: '5', category: 'copy_trade', description: 'Minimum USDC to keep in wallet at all times — never deploy below this (live mode only)' },
  { key: 'COPY_TRADE_PROPORTIONAL_FACTOR', value: '1.0', category: 'copy_trade', description: 'When SIZE_MODE=proportional, multiply the trader\'s trade size by this factor (1.0 = same size, 0.5 = half, 2.0 = double)' },
  { key: 'COPY_TRADE_MIN_VOLUME', value: '0', category: 'copy_trade', description: 'Minimum total trading volume (USDC) a market must have to be entered. 0 = disabled.' },
  { key: 'COPY_TRADE_ALLOWED_TAGS', value: '', category: 'copy_trade', description: 'Comma-separated tag slugs to allow (e.g. "crypto,politics"). Empty = all markets allowed.' },
  { key: 'COPY_TRADE_MARKET_WHITELIST', value: '', category: 'copy_trade', description: 'Comma-separated conditionIds to exclusively enter. Empty = all markets allowed.' },
  { key: 'COPY_TRADE_MARKET_BLACKLIST', value: '', category: 'copy_trade', description: 'Comma-separated conditionIds to never enter.' },
  { key: 'COPY_TRADE_SESSION_STOP_LOSS', value: '0', category: 'copy_trade', description: 'Auto-pause if session P&L drops below this % of starting balance (0 = disabled). E.g. 20 = pause when -20% is reached.' },
  { key: 'COPY_TRADE_KELLY_ENABLED', value: 'false', category: 'copy_trade', description: 'Use Kelly criterion for dynamic position sizing based on historical win rate. Requires KELLY_MIN_TRADES resolved positions, then falls back if insufficient data.' },
  { key: 'COPY_TRADE_KELLY_MAX_FRACTION', value: '0.25', category: 'copy_trade', description: 'Maximum fraction of balance Kelly criterion can allocate per trade (0.25 = max 25%). Acts as a cap to avoid over-betting.' },
  { key: 'COPY_TRADE_KELLY_MIN_TRADES', value: '10', category: 'copy_trade', description: 'Minimum resolved trades before Kelly kicks in. Uses fixed/percentage sizing until this threshold is met.' },

  // ── Market Maker ────────────────────────────────────────────────────────────
  { key: 'MM_RUNNING', value: 'false', category: 'market_maker', description: 'Whether the strategy is running (auto-restored on restart)' },
  { key: 'MM_DRY_RUN', value: 'true', category: 'market_maker', description: 'Simulation mode' },
  { key: 'MM_ASSETS', value: 'btc,eth,sol,xrp', category: 'market_maker', description: 'Comma-separated assets to trade. Available: btc,eth,sol,xrp,bnb,doge,hype' },
  { key: 'MM_DURATION', value: '5m', category: 'market_maker', description: '"5m", "15m", "1h", or "4h"' },
  { key: 'MM_TRADE_SIZE', value: '10', category: 'market_maker', description: 'USDC per side' },
  { key: 'MM_SELL_PRICE', value: '0.60', category: 'market_maker', description: 'Target sell price (0.01-0.99)' },
  { key: 'MM_CUT_LOSS_TIME', value: '60', category: 'market_maker', description: 'Seconds before close to cut loss' },
  { key: 'MM_ADAPTIVE_CL', value: 'false', category: 'market_maker', description: 'Enable adaptive cut-loss strategy' },
  { key: 'MM_ADAPTIVE_MIN_COMBINED', value: '1.0', category: 'market_maker', description: 'Min combined price for adaptive CL' },
  { key: 'MM_RECOVERY_BUY', value: 'false', category: 'market_maker', description: 'Enable recovery buy after cut-loss' },
  { key: 'MM_RECOVERY_THRESHOLD', value: '0.70', category: 'market_maker', description: 'Min price for recovery buy' },
  { key: 'MM_POLL_INTERVAL', value: '30', category: 'market_maker', description: 'Seconds between market detection polls' },
  { key: 'MM_SIM_BALANCE', value: '1000', category: 'market_maker', description: 'Fictitious balance for Market Maker simulation mode (USDC)' },
  { key: 'MM_DYNAMIC_SIZING_ENABLED', value: 'false', category: 'market_maker', description: 'Enable dynamic sizing and fractional profit targets' },
  { key: 'MM_MIN_ALLOCATION', value: '5', category: 'market_maker', description: 'Minimum USDC to allocate dynamically' },
  { key: 'MM_MAX_ALLOCATION', value: '50', category: 'market_maker', description: 'Maximum USDC to allocate dynamically' },
  { key: 'MM_SPREAD_PROFIT_TARGET', value: '0.01', category: 'market_maker', description: 'Take-profit margin above entry price (e.g. 0.01 = 1 cent)' },
  { key: 'MM_BINANCE_TREND_ENABLED', value: 'false', category: 'market_maker', description: 'Use Binance short-term momentum (1m klines) to skew YES/NO capital allocation' },
  { key: 'MM_MAX_BIAS_PERCENT', value: '70', category: 'market_maker', description: 'Maximum bias percent (e.g. 70 means up to 70% capital on trending side)' },
  { key: 'MM_BINANCE_KLINE_INTERVAL', value: '1m', category: 'market_maker', description: 'Kline interval for Binance momentum. "1m" is ideal for 5m markets. Options: 1m, 3m, 5m' },
  { key: 'MM_BINANCE_KLINE_PERIODS', value: '3', category: 'market_maker', description: 'Number of klines to compute short-term momentum (3-5 recommended)' },
  { key: 'MM_MAX_ACTIVE_MARKETS', value: '0', category: 'market_maker', description: 'Maximum number of simultaneously active positions. 0 = unlimited.' },
  { key: 'MM_MIN_SPREAD', value: '0', category: 'market_maker', description: 'Minimum spread (1 - combined midpoint) required to enter a market. E.g. 0.05 = only enter when YES+NO combined is ≤ 0.95, guaranteeing a 5¢ profit margin. 0 = disabled.' },
  { key: 'MM_MAX_POSITION_AGE_HOURS', value: '0', category: 'market_maker', description: 'Auto-exit a position if it has been open for more than this many hours. 0 = disabled (position runs until market close or cut-loss).' },
  // ── Entry filters ─────────────────────────────────────────────────────────
  { key: 'MM_ENTRY_MAX_COMBINED', value: '1.02', category: 'market_maker', description: 'Max combined midpoint (YES+NO) to enter. Above 1.0 means you are buying above fair value on both sides. Recommended 1.00–1.05 (Polymarket 5m markets open near 1.00)' },
  { key: 'MM_ENTRY_MIN_TOKEN_PRICE', value: '0.20', category: 'market_maker', description: 'Min midpoint for each token. Avoids very one-sided markets (e.g. YES already at 0.95)' },
  { key: 'MM_ENTRY_MAX_TOKEN_PRICE', value: '0.80', category: 'market_maker', description: 'Max midpoint for each token. Avoids very one-sided markets (e.g. YES already at 0.95)' },
  // ── Early exit ────────────────────────────────────────────────────────────
  { key: 'MM_EARLY_EXIT_ENABLED', value: 'true', category: 'market_maker', description: 'Exit early if the current combined position value drops below the stop-loss floor during monitoring' },
  { key: 'MM_EARLY_EXIT_LOSS_PCT', value: '40', category: 'market_maker', description: 'Early exit if current position value < cost × (1 - this%). E.g. 40 = exit if value drops to 60% of cost' },

  // ── Telegram ─────────────────────────────────────────────────────────────
  { key: 'TELEGRAM_ENABLED', value: 'false', category: 'telegram', description: 'Enable Telegram notifications' },
  { key: 'TELEGRAM_BOT_TOKEN', value: '', category: 'telegram', description: 'Bot token from @BotFather (e.g. 123456789:AAF...)' },
  { key: 'TELEGRAM_CHAT_ID', value: '', category: 'telegram', description: 'Your chat/group ID (use @userinfobot to find it)' },
  { key: 'TELEGRAM_ALERT_LOSS_THRESHOLD', value: '0', category: 'telegram', description: 'Send an immediate Telegram alert when a single position closes with a loss larger than this USDC amount. 0 = disabled.' },

  // ── System ──────────────────────────────────────────────────────────────────
  { key: 'TRADING_MODE', value: 'custom', category: 'system', description: 'Active trading mode: high | intermediate | low | custom' },
  { key: 'POLYGON_RPC_URL', value: '', category: 'system', description: 'Polygon RPC endpoint (leave empty to use env var). Recommended: Alchemy or QuickNode for reliability' },
  { key: 'GLOBAL_SIMULATION_MODE', value: 'true', category: 'system', description: 'Applies Simulation mode globally and overrides individual strategy dry-run settings' },
  { key: 'GLOBAL_WALLET_MARGIN', value: '50', category: 'system', description: 'Minimum USDC that must remain in the wallet at all times across all strategies (Live mode)' },
  { key: 'GLOBAL_MAX_ENTRIES_PER_MINUTE', value: '5', category: 'system', description: 'Maximum total entries across all strategies per minute (0 = unlimited)' },
  { key: 'GLOBAL_MAX_EXPOSURE_USDC', value: '0', category: 'system', description: 'Maximum total USDC deployed in open positions across ALL strategies simultaneously. 0 = disabled.' },
  { key: 'GLOBAL_CIRCUIT_BREAKER_PCT', value: '0', category: 'system', description: 'Auto-pause ALL strategies if total P&L loss in the window exceeds this % of current balance. 0 = disabled. E.g. 20 = pause when losses exceed 20% of balance.' },
  { key: 'GLOBAL_CIRCUIT_BREAKER_WINDOW_HOURS', value: '24', category: 'system', description: 'Time window (hours) used for circuit breaker P&L calculation.' },

  // ── Sniper ──────────────────────────────────────────────────────────────────
  { key: 'SNIPER_RUNNING', value: 'false', category: 'sniper', description: 'Whether the strategy is running (auto-restored on restart)' },
  { key: 'SNIPER_DRY_RUN', value: 'true', category: 'sniper', description: 'Simulation mode' },
  { key: 'SNIPER_ASSETS', value: 'eth,btc,sol', category: 'sniper', description: 'Comma-separated assets to snipe' },
  { key: 'SNIPER_TIER1_PRICE', value: '0.03', category: 'sniper', description: 'Tier 1 price (3¢)' },
  { key: 'SNIPER_TIER2_PRICE', value: '0.02', category: 'sniper', description: 'Tier 2 price (2¢)' },
  { key: 'SNIPER_TIER3_PRICE', value: '0.01', category: 'sniper', description: 'Tier 3 price (1¢)' },
  { key: 'SNIPER_MAX_SHARES', value: '15', category: 'sniper', description: 'Max shares per side per market' },
  { key: 'SNIPER_PAUSE_ROUNDS_AFTER_WIN', value: '2', category: 'sniper', description: 'Rounds to pause asset after a win' },
  { key: 'SNIPER_MULTIPLIERS', value: '', category: 'sniper', description: 'Time-based sizing: "HH:MM-HH:MM:factor,..."' },
  { key: 'SNIPER_SCHEDULE', value: '', category: 'sniper', description: 'Per-asset schedule: "ETH=11:40-15:40,BTC=09:00-17:00"' },
  { key: 'SNIPER_SIM_BALANCE', value: '1000', category: 'sniper', description: 'Fictitious balance for Sniper simulation mode (USDC)' },
  { key: 'SNIPER_VOLUME_SPIKE_PCT', value: '0', category: 'sniper', description: 'Min volume increase % since last round to trigger order placement. 0 = disabled (always place orders).' },
];

@Injectable()
export class SettingsService implements OnModuleInit {
  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    await this.initDefaults();
  }

  async initDefaults() {
    for (const setting of DEFAULT_SETTINGS) {
      await this.prisma.setting.upsert({
        where: { key: setting.key },
        create: setting,
        update: { description: setting.description },
      });
    }
    // One-time fix: MM_ENTRY_MAX_COMBINED was incorrectly defaulted to 0.97 (blocks all normal markets).
    // Polymarket 5m markets open near combined=1.00, so 0.97 rejects every entry. Migrate to 1.02.
    await this.prisma.setting.updateMany({
      where: { key: 'MM_ENTRY_MAX_COMBINED', value: { in: ['0.97', '0.99', '0.95'] } },
      data: { value: '1.02' },
    });
  }

  async getAll() {
    return this.prisma.setting.findMany({ orderBy: { category: 'asc' } });
  }

  async getByCategory(category: string) {
    return this.prisma.setting.findMany({ where: { category }, orderBy: { key: 'asc' } });
  }

  async get(key: string): Promise<string | null> {
    const setting = await this.prisma.setting.findUnique({ where: { key } });
    return setting?.value ?? null;
  }

  async getNumber(key: string, defaultValue = 0): Promise<number> {
    const val = await this.get(key);
    return val ? parseFloat(val) : defaultValue;
  }

  async isGlobalSimulationMode(): Promise<boolean> {
    return this.getBool('GLOBAL_SIMULATION_MODE', true);
  }

  async getGlobalWalletMargin(): Promise<number> {
    return this.getNumber('GLOBAL_WALLET_MARGIN', 50);
  }

  async getGlobalMaxEntriesPerMinute(): Promise<number> {
    return this.getNumber('GLOBAL_MAX_ENTRIES_PER_MINUTE', 5);
  }

  async getGlobalMaxExposure(): Promise<number> {
    return this.getNumber('GLOBAL_MAX_EXPOSURE_USDC', 0);
  }

  async getCircuitBreakerConfig(): Promise<{ pct: number; windowHours: number }> {
    const [pct, windowHours] = await Promise.all([
      this.getNumber('GLOBAL_CIRCUIT_BREAKER_PCT', 0),
      this.getNumber('GLOBAL_CIRCUIT_BREAKER_WINDOW_HOURS', 24),
    ]);
    return { pct, windowHours };
  }

  async getBool(key: string, defaultValue = false): Promise<boolean> {
    const val = await this.get(key);
    if (val === null) return defaultValue;
    return val === 'true' || val === '1';
  }

  async set(key: string, value: string) {
    const existing = await this.prisma.setting.findUnique({ where: { key } });
    const result = await this.prisma.setting.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });
    // Record change in history (skip if value didn't change)
    if (!existing || existing.value !== value) {
      await this.prisma.settingHistory.create({
        data: { key, oldValue: existing?.value ?? null, newValue: value },
      });
    }
    return result;
  }

  async bulkSet(settings: Array<{ key: string; value: string }>) {
    const results = await Promise.all(settings.map(s => this.set(s.key, s.value)));
    return results;
  }

  async getHistory(limit = 100) {
    return this.prisma.settingHistory.findMany({
      orderBy: { changedAt: 'desc' },
      take: limit,
    });
  }

  async getCopyTradeConfig() {
    const settings = await this.getByCategory('copy_trade');
    const map = Object.fromEntries(settings.map(s => [s.key, s.value]));
    return {
      traderAddress: map.COPY_TRADE_TRADER_ADDRESS || '',
      sizeMode: map.COPY_TRADE_SIZE_MODE || 'percentage',
      fixedAmount: parseFloat(map.COPY_TRADE_FIXED_AMOUNT || '10'),
      sizePercent: parseFloat(map.COPY_TRADE_SIZE_PERCENT || '10'),
      maxPositionSize: parseFloat(map.COPY_TRADE_MAX_POSITION_SIZE || '50'),
      dynamicSizingEnabled: map.COPY_TRADE_DYNAMIC_SIZING_ENABLED === 'true',
      minAllocation: parseFloat(map.COPY_TRADE_MIN_ALLOCATION || '5'),
      maxAllocation: parseFloat(map.COPY_TRADE_MAX_ALLOCATION || '25'),
      minEntryAmount: parseFloat(map.COPY_TRADE_MIN_ENTRY_AMOUNT || '1'),
      autoSellEnabled: map.COPY_TRADE_AUTO_SELL_ENABLED === 'true',
      autoSellProfitPercent: parseFloat(map.COPY_TRADE_AUTO_SELL_PROFIT_PERCENT || '50'),
      stopLossPercent: parseFloat(map.COPY_TRADE_STOP_LOSS_PERCENT || '0'),
      sellMode: map.COPY_TRADE_SELL_MODE || 'market',
      minMarketTimeLeft: parseInt(map.COPY_TRADE_MIN_MARKET_TIME_LEFT || '300'),
      gtcFallbackTimeout: parseInt(map.COPY_TRADE_GTC_FALLBACK_TIMEOUT || '60'),
      redeemInterval: parseInt(map.COPY_TRADE_REDEEM_INTERVAL || '60'),
      maxRetries: parseInt(map.COPY_TRADE_MAX_RETRIES || '3'),
      simBalance: parseFloat(map.COPY_TRADE_SIM_BALANCE || '1000'),
      maxBalanceUsagePercent: parseFloat(map.COPY_TRADE_MAX_BALANCE_USAGE_PERCENT || '30'),
      minLiveBalance: parseFloat(map.COPY_TRADE_MIN_LIVE_BALANCE || '5'),
      proportionalFactor: parseFloat(map.COPY_TRADE_PROPORTIONAL_FACTOR || '1.0'),
      minVolume: parseFloat(map.COPY_TRADE_MIN_VOLUME || '0'),
      allowedTags: map.COPY_TRADE_ALLOWED_TAGS
        ? map.COPY_TRADE_ALLOWED_TAGS.split(',').map((s: string) => s.trim()).filter(Boolean)
        : [],
      marketWhitelist: map.COPY_TRADE_MARKET_WHITELIST
        ? map.COPY_TRADE_MARKET_WHITELIST.split(',').map((s: string) => s.trim()).filter(Boolean)
        : [],
      marketBlacklist: map.COPY_TRADE_MARKET_BLACKLIST
        ? map.COPY_TRADE_MARKET_BLACKLIST.split(',').map((s: string) => s.trim()).filter(Boolean)
        : [],
      sessionStopLossPercent: parseFloat(map.COPY_TRADE_SESSION_STOP_LOSS || '0'),
      kellyEnabled: map.COPY_TRADE_KELLY_ENABLED === 'true',
      kellyMaxFraction: parseFloat(map.COPY_TRADE_KELLY_MAX_FRACTION || '0.25'),
      kellyMinTrades: parseInt(map.COPY_TRADE_KELLY_MIN_TRADES || '10'),
    };
  }

  async getMarketMakerConfig() {
    const settings = await this.getByCategory('market_maker');
    const map = Object.fromEntries(settings.map(s => [s.key, s.value]));
    return {
      assets: (map.MM_ASSETS || 'btc,eth').split(',').map(a => a.trim()),
      duration: map.MM_DURATION || '5m',
      tradeSize: parseFloat(map.MM_TRADE_SIZE || '10'),
      sellPrice: parseFloat(map.MM_SELL_PRICE || '0.60'),
      cutLossTime: parseInt(map.MM_CUT_LOSS_TIME || '60'),
      adaptiveCL: map.MM_ADAPTIVE_CL === 'true',
      adaptiveMinCombined: parseFloat(map.MM_ADAPTIVE_MIN_COMBINED || '1.0'),
      recoveryBuy: map.MM_RECOVERY_BUY === 'true',
      recoveryThreshold: parseFloat(map.MM_RECOVERY_THRESHOLD || '0.70'),
      pollInterval: parseInt(map.MM_POLL_INTERVAL || '30'),
      simBalance: parseFloat(map.MM_SIM_BALANCE || '1000'),
      dynamicSizingEnabled: map.MM_DYNAMIC_SIZING_ENABLED === 'true',
      minAllocation: parseFloat(map.MM_MIN_ALLOCATION || '5'),
      maxAllocation: parseFloat(map.MM_MAX_ALLOCATION || '50'),
      spreadProfitTarget: parseFloat(map.MM_SPREAD_PROFIT_TARGET || '0.01'),
      binanceTrendEnabled: map.MM_BINANCE_TREND_ENABLED === 'true',
      maxBiasPercent: parseFloat(map.MM_MAX_BIAS_PERCENT || '70'),
      binanceKlineInterval: map.MM_BINANCE_KLINE_INTERVAL || '1m',
      binanceKlinePeriods: parseInt(map.MM_BINANCE_KLINE_PERIODS || '3'),
      entryMaxCombined: parseFloat(map.MM_ENTRY_MAX_COMBINED || '0.97'),
      entryMinTokenPrice: parseFloat(map.MM_ENTRY_MIN_TOKEN_PRICE || '0.20'),
      entryMaxTokenPrice: parseFloat(map.MM_ENTRY_MAX_TOKEN_PRICE || '0.80'),
      earlyExitEnabled: map.MM_EARLY_EXIT_ENABLED !== 'false',
      earlyExitLossPct: parseFloat(map.MM_EARLY_EXIT_LOSS_PCT || '40'),
      maxActiveMarkets: parseInt(map.MM_MAX_ACTIVE_MARKETS || '0'),
      minSpread: parseFloat(map.MM_MIN_SPREAD || '0'),
      maxPositionAgeHours: parseFloat(map.MM_MAX_POSITION_AGE_HOURS || '0'),
    };
  }

  async getSniperConfig() {
    const settings = await this.getByCategory('sniper');
    const map = Object.fromEntries(settings.map(s => [s.key, s.value]));
    return {
      assets: (map.SNIPER_ASSETS || 'eth,btc,sol').split(',').map(a => a.trim()),
      tier1Price: parseFloat(map.SNIPER_TIER1_PRICE || '0.03'),
      tier2Price: parseFloat(map.SNIPER_TIER2_PRICE || '0.02'),
      tier3Price: parseFloat(map.SNIPER_TIER3_PRICE || '0.01'),
      maxShares: parseInt(map.SNIPER_MAX_SHARES || '15'),
      pauseRoundsAfterWin: parseInt(map.SNIPER_PAUSE_ROUNDS_AFTER_WIN || '2'),
      multipliers: map.SNIPER_MULTIPLIERS || '',
      schedule: map.SNIPER_SCHEDULE || '',
      simBalance: parseFloat(map.SNIPER_SIM_BALANCE || '1000'),
      volumeSpikePct: parseFloat(map.SNIPER_VOLUME_SPIKE_PCT || '0'),
    };
  }

  async getTradingMode(): Promise<TradingMode> {
    const val = await this.get('TRADING_MODE');
    return (val as TradingMode) || 'custom';
  }

  async applyTradingMode(mode: TradingMode): Promise<void> {
    // Always persist the selected mode
    await this.set('TRADING_MODE', mode);
    // For 'custom', only save the flag — don't touch any other setting
    if (mode === 'custom') return;
    const preset = TRADING_MODE_PRESETS[mode];
    await this.bulkSet(Object.entries(preset).map(([key, value]) => ({ key, value })));
  }
}
