import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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
  { key: 'MM_BINANCE_TREND_ENABLED', value: 'false', category: 'market_maker', description: 'Use Binance momentum to skew YES/NO capital allocation' },
  { key: 'MM_MAX_BIAS_PERCENT', value: '80', category: 'market_maker', description: 'Maximum bias percent (e.g. 80 means up to 80% capital on trending side)' },

  // ── Telegram ─────────────────────────────────────────────────────────────
  { key: 'TELEGRAM_ENABLED', value: 'false', category: 'telegram', description: 'Enable Telegram notifications' },
  { key: 'TELEGRAM_BOT_TOKEN', value: '', category: 'telegram', description: 'Bot token from @BotFather (e.g. 123456789:AAF...)' },
  { key: 'TELEGRAM_CHAT_ID', value: '', category: 'telegram', description: 'Your chat/group ID (use @userinfobot to find it)' },

  // ── System ──────────────────────────────────────────────────────────────────
  { key: 'POLYGON_RPC_URL', value: '', category: 'system', description: 'Polygon RPC endpoint (leave empty to use env var). Recommended: Alchemy or QuickNode for reliability' },
  { key: 'GLOBAL_SIMULATION_MODE', value: 'true', category: 'system', description: 'Applies Simulation mode globally and overrides individual strategy dry-run settings' },
  { key: 'GLOBAL_WALLET_MARGIN', value: '50', category: 'system', description: 'Minimum USDC that must remain in the wallet at all times across all strategies (Live mode)' },
  { key: 'GLOBAL_MAX_ENTRIES_PER_MINUTE', value: '5', category: 'system', description: 'Maximum total entries across all strategies per minute (0 = unlimited)' },

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

  async getBool(key: string, defaultValue = false): Promise<boolean> {
    const val = await this.get(key);
    if (val === null) return defaultValue;
    return val === 'true' || val === '1';
  }

  async set(key: string, value: string) {
    return this.prisma.setting.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });
  }

  async bulkSet(settings: Array<{ key: string; value: string }>) {
    const results = await Promise.all(settings.map(s => this.set(s.key, s.value)));
    return results;
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
      maxBiasPercent: parseFloat(map.MM_MAX_BIAS_PERCENT || '80'),
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
    };
  }
}
