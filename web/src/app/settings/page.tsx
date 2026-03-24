'use client';
import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { TelegramForm } from '@/components/settings/telegram-form';
import { TradingModeForm } from '@/components/settings/trading-mode-form';
import { getSettingsByCategory, bulkUpdateSettings, exportSettings, importSettings, getSettingsHistory, type ExportedSettings } from '@/lib/api';
import { toast } from '@/components/ui/use-toast';
import { useLang } from '@/lib/i18n';
import { Loader2, Save, Download, Upload } from 'lucide-react';
import type { Setting } from '@/lib/types';

// ─── Field schema ─────────────────────────────────────────────────────────────

type FieldType = 'boolean' | 'number' | 'text' | 'select' | 'tags' | 'address' | 'password';

interface FieldDef {
  type: FieldType;
  label: { en: string; pt: string };
  help: string;
  group: string;       // maps to settings.groupXxx i18n key
  options?: { value: string; label: string }[];
  min?: number; max?: number; step?: number;
  unit?: string;
  readOnly?: boolean;
}

const FIELD_SCHEMA: Record<string, FieldDef> = {
  // ── Copy Trade — General ─────────────────────────────────────────────────
  COPY_TRADE_DRY_RUN: {
    type: 'boolean', group: 'groupGeneral',
    label: { en: 'Simulation Mode', pt: 'Modo Simulação' },
    help: 'When ON, all orders are virtual — no real funds are used. Turn OFF only when you are ready to trade with real money. Highly recommended to run in simulation first to validate your configuration.',
  },
  COPY_TRADE_TRADER_ADDRESS: {
    type: 'address', group: 'groupGeneral',
    label: { en: 'Trader Address', pt: 'Endereço do Trader' },
    help: 'The Polymarket proxy wallet address of the trader you want to copy. You can find this in the URL on a trader\'s profile page (e.g. polymarket.com/profile/0xabc...). Must be the lowercase hex address.',
  },
  COPY_TRADE_SELL_MODE: {
    type: 'select', group: 'groupGeneral',
    label: { en: 'Sell Mode', pt: 'Modo de Venda' },
    help: 'Market: sells immediately at ~2% below midpoint (fast, may slip). Limit: places a resting limit order at midpoint (may not fill if price moves away).',
    options: [
      { value: 'market', label: 'Market (instant FOK)' },
      { value: 'limit', label: 'Limit (resting GTC)' },
    ],
  },
  COPY_TRADE_SIM_BALANCE: {
    type: 'number', group: 'groupSimulation', unit: 'USDC', min: 0,
    label: { en: 'Simulation Balance', pt: 'Saldo Simulado' },
    help: 'Starting virtual balance used in simulation mode. Deducted on each buy and credited on each sell/redemption. Reset by clearing sim data.',
  },
  // ── Copy Trade — Position Sizing ─────────────────────────────────────────
  COPY_TRADE_SIZE_MODE: {
    type: 'select', group: 'groupSizing',
    label: { en: 'Size Mode', pt: 'Modo de Tamanho' },
    help: 'How trade size is calculated: Percentage = % of max position size. Balance = % of available balance. Fixed = always this USDC amount. Proportional = scale the copied trader\'s own size by a factor.',
    options: [
      { value: 'percentage', label: 'Percentage of max position' },
      { value: 'balance', label: 'Percentage of balance' },
      { value: 'fixed', label: 'Fixed USDC amount' },
      { value: 'proportional', label: 'Proportional to trader' },
    ],
  },
  COPY_TRADE_FIXED_AMOUNT: {
    type: 'number', group: 'groupSizing', unit: 'USDC', min: 0, step: 1,
    label: { en: 'Fixed Amount', pt: 'Valor Fixo' },
    help: 'USDC spent per trade when Size Mode is "Fixed". Ignored in other modes.',
  },
  COPY_TRADE_SIZE_PERCENT: {
    type: 'number', group: 'groupSizing', unit: '%', min: 0, max: 100,
    label: { en: 'Size Percent', pt: 'Percentual de Tamanho' },
    help: 'Percentage applied to the max position size (or balance). E.g. 10 with max $50 → $5 per trade.',
  },
  COPY_TRADE_MAX_POSITION_SIZE: {
    type: 'number', group: 'groupSizing', unit: 'USDC', min: 0,
    label: { en: 'Max Position Size', pt: 'Tamanho Máx. de Posição' },
    help: 'Hard cap in USDC per individual position. Regardless of size mode, a single entry will never exceed this amount.',
  },
  COPY_TRADE_MAX_BALANCE_USAGE_PERCENT: {
    type: 'number', group: 'groupSizing', unit: '%', min: 0, max: 100,
    label: { en: 'Max Balance Usage', pt: 'Uso Máx. do Saldo' },
    help: 'Maximum percentage of your total balance that can be deployed in open positions at once. E.g. 30 means no new entries once 30% of balance is tied up.',
  },
  COPY_TRADE_MIN_ENTRY_AMOUNT: {
    type: 'number', group: 'groupSizing', unit: 'USDC', min: 0,
    label: { en: 'Minimum Entry Amount', pt: 'Valor Mínimo de Entrada' },
    help: 'Skip an entry if the calculated size is below this threshold. Prevents tiny dust trades that cost more in fees than they earn.',
  },
  COPY_TRADE_PROPORTIONAL_FACTOR: {
    type: 'number', group: 'groupSizing', min: 0, step: 0.1,
    label: { en: 'Proportional Factor', pt: 'Fator Proporcional' },
    help: 'When Size Mode is Proportional, multiply the copied trader\'s trade size by this factor. 1.0 = same size, 0.5 = half, 2.0 = double.',
  },
  COPY_TRADE_DYNAMIC_SIZING_ENABLED: {
    type: 'boolean', group: 'groupSizing',
    label: { en: 'Dynamic Random Sizing', pt: 'Tamanho Aleatório Dinâmico' },
    help: 'When ON, each trade size is randomly chosen between Min Allocation and Max Allocation. Useful to avoid predictable patterns. Overrides Size Mode when enabled.',
  },
  COPY_TRADE_MIN_ALLOCATION: {
    type: 'number', group: 'groupSizing', unit: 'USDC', min: 0,
    label: { en: 'Dynamic Min Allocation', pt: 'Alocação Mínima Dinâmica' },
    help: 'Minimum USDC per trade when dynamic sizing is enabled.',
  },
  COPY_TRADE_MAX_ALLOCATION: {
    type: 'number', group: 'groupSizing', unit: 'USDC', min: 0,
    label: { en: 'Dynamic Max Allocation', pt: 'Alocação Máxima Dinâmica' },
    help: 'Maximum USDC per trade when dynamic sizing is enabled.',
  },
  // ── Copy Trade — Risk & Exits ─────────────────────────────────────────────
  COPY_TRADE_AUTO_SELL_ENABLED: {
    type: 'boolean', group: 'groupRisk',
    label: { en: 'Auto Take-Profit', pt: 'Take-Profit Automático' },
    help: 'Automatically places a limit sell order after each buy at a target price above your entry. If the trader sells before your target is hit, the position is sold at market instead.',
  },
  COPY_TRADE_AUTO_SELL_PROFIT_PERCENT: {
    type: 'number', group: 'groupRisk', unit: '%', min: 0,
    label: { en: 'Take-Profit Target', pt: 'Alvo de Take-Profit' },
    help: 'Auto-sell target expressed as % above your average buy price. E.g. 50 means sell when price reaches 1.5× your entry. Only active when Auto Take-Profit is ON.',
  },
  COPY_TRADE_STOP_LOSS_PERCENT: {
    type: 'number', group: 'groupRisk', unit: '%', min: 0,
    label: { en: 'Stop-Loss', pt: 'Stop-Loss' },
    help: 'Automatically sell if the position value drops to this % below your entry price. 0 = disabled. E.g. 50 means exit if the token price drops 50% from your buy price.',
  },
  COPY_TRADE_SESSION_STOP_LOSS: {
    type: 'number', group: 'groupRisk', unit: '%', min: 0,
    label: { en: 'Session Stop-Loss', pt: 'Stop-Loss de Sessão' },
    help: 'Auto-pause the strategy if total session P&L falls below this % of the starting balance. E.g. 20 = pause when you\'ve lost 20% since the strategy started. 0 = disabled.',
  },
  COPY_TRADE_MIN_LIVE_BALANCE: {
    type: 'number', group: 'groupRisk', unit: 'USDC', min: 0,
    label: { en: 'Min Live Balance Reserve', pt: 'Reserva Mínima (Live)' },
    help: 'Minimum USDC to keep in your wallet at all times in live mode. New entries are skipped if the wallet would fall below this threshold after the buy.',
  },
  // ── Copy Trade — Filters ─────────────────────────────────────────────────
  COPY_TRADE_MIN_MARKET_TIME_LEFT: {
    type: 'number', group: 'groupFilters', unit: 'seconds', min: 0,
    label: { en: 'Min Time Until Close', pt: 'Tempo Mínimo até Fechar' },
    help: 'Skip buying if the market resolves within this many seconds. Prevents entering markets that are about to close. 300 = skip markets closing within 5 minutes.',
  },
  COPY_TRADE_MIN_VOLUME: {
    type: 'number', group: 'groupFilters', unit: 'USDC', min: 0,
    label: { en: 'Minimum Volume', pt: 'Volume Mínimo' },
    help: 'Skip markets whose total trading volume is below this USDC amount. Higher volume markets tend to have better liquidity and more reliable price discovery. 0 = disabled.',
  },
  COPY_TRADE_ALLOWED_TAGS: {
    type: 'tags', group: 'groupFilters',
    label: { en: 'Allowed Tags', pt: 'Tags Permitidas' },
    help: 'Only enter markets that have at least one of these category tags. Comma-separated slugs, e.g. "crypto,politics,sports". Leave empty to allow all markets.',
  },
  COPY_TRADE_MARKET_WHITELIST: {
    type: 'tags', group: 'groupLists',
    label: { en: 'Market Whitelist', pt: 'Whitelist de Mercados' },
    help: 'If non-empty, ONLY enter markets whose conditionId is in this list. Comma-separated conditionIds. Use this to restrict the strategy to specific known markets.',
  },
  COPY_TRADE_MARKET_BLACKLIST: {
    type: 'tags', group: 'groupLists',
    label: { en: 'Market Blacklist', pt: 'Blacklist de Mercados' },
    help: 'Never enter markets whose conditionId appears in this list. Comma-separated conditionIds. Use to permanently exclude specific markets.',
  },
  // ── Copy Trade — Timings ─────────────────────────────────────────────────
  COPY_TRADE_GTC_FALLBACK_TIMEOUT: {
    type: 'number', group: 'groupTimings', unit: 'seconds', min: 0,
    label: { en: 'GTC Fallback Timeout', pt: 'Timeout GTC Fallback' },
    help: 'When a FOK order fails to fill, a GTC (Good-Till-Cancelled) limit order is placed as fallback. If the GTC order has not filled within this many seconds, it is cancelled.',
  },
  COPY_TRADE_REDEEM_INTERVAL: {
    type: 'number', group: 'groupTimings', unit: 'seconds', min: 10,
    label: { en: 'Redeem Check Interval', pt: 'Intervalo de Redenção' },
    help: 'How often (in seconds) the strategy checks open positions for price updates and redemption eligibility. Lower values = more responsive but more API calls.',
  },
  COPY_TRADE_MAX_RETRIES: {
    type: 'number', group: 'groupTimings', min: 0, max: 10,
    label: { en: 'Max Order Retries', pt: 'Máx. Tentativas de Ordem' },
    help: 'Number of times to retry a failed order before skipping the trade entirely.',
  },
  // ── Copy Trade — Kelly ───────────────────────────────────────────────────
  COPY_TRADE_KELLY_ENABLED: {
    type: 'boolean', group: 'groupKelly',
    label: { en: 'Kelly Criterion Sizing', pt: 'Dimensionamento Kelly' },
    help: 'Use the Kelly criterion formula to dynamically size positions based on historical win rate and average win/loss ratio. Requires a minimum number of resolved trades to activate. Falls back to standard sizing when insufficient data.',
  },
  COPY_TRADE_KELLY_MAX_FRACTION: {
    type: 'number', group: 'groupKelly', min: 0.01, max: 1, step: 0.01,
    label: { en: 'Kelly Max Fraction', pt: 'Fração Máxima Kelly' },
    help: 'Cap on the Kelly fraction — the maximum percentage of your balance that Kelly can allocate per trade. E.g. 0.25 = Kelly can allocate up to 25% of balance per trade. Recommended: 0.10–0.25 to avoid over-betting.',
  },
  COPY_TRADE_KELLY_MIN_TRADES: {
    type: 'number', group: 'groupKelly', min: 1,
    label: { en: 'Kelly Min Trades', pt: 'Trades Mínimos Kelly' },
    help: 'Minimum number of resolved trades required before Kelly criterion activates. Below this threshold, standard sizing is used. Recommended: at least 10 for a statistically meaningful sample.',
  },

  // ── Market Maker — General ───────────────────────────────────────────────
  MM_DRY_RUN: {
    type: 'boolean', group: 'groupGeneral',
    label: { en: 'Simulation Mode', pt: 'Modo Simulação' },
    help: 'When ON, the Market Maker places no real orders. All fills, P&L and balance changes are tracked virtually. Turn OFF only after validating the strategy in simulation.',
  },
  MM_ASSETS: {
    type: 'tags', group: 'groupGeneral',
    label: { en: 'Assets', pt: 'Ativos' },
    help: 'Comma-separated list of crypto assets to monitor for binary prediction markets. Available: btc, eth, sol, xrp, bnb, doge, hype. The strategy will detect and enter qualifying 5m/15m/1h/4h markets for these assets.',
  },
  MM_DURATION: {
    type: 'select', group: 'groupGeneral',
    label: { en: 'Market Duration', pt: 'Duração do Mercado' },
    help: 'Only enter markets of this duration. Shorter durations cycle faster but have less time to exit profitably. 5m is the most liquid on Polymarket.',
    options: [
      { value: '5m', label: '5 minutes' },
      { value: '15m', label: '15 minutes' },
      { value: '1h', label: '1 hour' },
      { value: '4h', label: '4 hours' },
    ],
  },
  MM_SIM_BALANCE: {
    type: 'number', group: 'groupSimulation', unit: 'USDC', min: 0,
    label: { en: 'Simulation Balance', pt: 'Saldo Simulado' },
    help: 'Virtual balance for Market Maker simulation. The strategy deducts the trade size on entry and credits cost + P&L on close.',
  },
  MM_POLL_INTERVAL: {
    type: 'number', group: 'groupTimings', unit: 'seconds', min: 5,
    label: { en: 'Detection Poll Interval', pt: 'Intervalo de Detecção' },
    help: 'How often the Market Maker polls Gamma for new qualifying markets. Lower values detect markets sooner but increase API load. 30 seconds is recommended for 5m markets.',
  },
  // ── Market Maker — Position Sizing ──────────────────────────────────────
  MM_TRADE_SIZE: {
    type: 'number', group: 'groupSizing', unit: 'USDC', min: 0, step: 1,
    label: { en: 'Trade Size per Side', pt: 'Tamanho por Lado' },
    help: 'USDC deployed on each side (YES + NO) per market. Total capital at risk = 2 × Trade Size. E.g. $10 per side = $20 total at risk per position.',
  },
  MM_DYNAMIC_SIZING_ENABLED: {
    type: 'boolean', group: 'groupSizing',
    label: { en: 'Dynamic Sizing', pt: 'Tamanho Dinâmico' },
    help: 'When ON, randomizes the per-side trade size between Min and Max Allocation. This varies capital deployment per market instead of using a fixed amount.',
  },
  MM_MIN_ALLOCATION: {
    type: 'number', group: 'groupSizing', unit: 'USDC', min: 0,
    label: { en: 'Dynamic Min Allocation', pt: 'Alocação Mínima Dinâmica' },
    help: 'Minimum USDC per side when dynamic sizing is enabled.',
  },
  MM_MAX_ALLOCATION: {
    type: 'number', group: 'groupSizing', unit: 'USDC', min: 0,
    label: { en: 'Dynamic Max Allocation', pt: 'Alocação Máxima Dinâmica' },
    help: 'Maximum USDC per side when dynamic sizing is enabled.',
  },
  MM_MAX_ACTIVE_MARKETS: {
    type: 'number', group: 'groupSizing', min: 0,
    label: { en: 'Max Active Positions', pt: 'Posições Ativas Máximas' },
    help: 'Limit how many markets the MM can be in simultaneously. 0 = unlimited. Useful to control total capital exposure when trading multiple assets.',
  },
  // ── Market Maker — Risk & Exits ──────────────────────────────────────────
  MM_SELL_PRICE: {
    type: 'number', group: 'groupRisk', min: 0.01, max: 0.99, step: 0.01,
    label: { en: 'Take-Profit Target Price', pt: 'Preço Alvo de Take-Profit' },
    help: 'Target sell price for each side (0.01–0.99). The MM places limit sell orders at this price after buying. E.g. 0.60 means you profit if YES or NO reaches $0.60 from a $0.50 entry.',
  },
  MM_SPREAD_PROFIT_TARGET: {
    type: 'number', group: 'groupRisk', min: 0, step: 0.001,
    label: { en: 'Spread Profit Target', pt: 'Margem de Lucro' },
    help: 'Additional margin above entry price to set the take-profit limit order. E.g. 0.01 = sell 1 cent above where you bought. Stacks with Sell Price in some configurations.',
  },
  MM_CUT_LOSS_TIME: {
    type: 'number', group: 'groupRisk', unit: 'seconds', min: 0,
    label: { en: 'Cut-Loss Before Close', pt: 'Saída antes do Fechamento' },
    help: 'Seconds before market resolution to force-exit any unsold positions. Prevents holding until resolution which is always a total loss on one side. E.g. 60 = exit 1 minute before market closes.',
  },
  MM_EARLY_EXIT_ENABLED: {
    type: 'boolean', group: 'groupEarlyExit',
    label: { en: 'Early Exit on Large Loss', pt: 'Saída Antecipada por Perda' },
    help: 'Monitor combined position value during the trade. If the value drops below the loss threshold, exit immediately rather than waiting for cut-loss time. Reduces catastrophic losses.',
  },
  MM_EARLY_EXIT_LOSS_PCT: {
    type: 'number', group: 'groupEarlyExit', unit: '%', min: 0, max: 100,
    label: { en: 'Early Exit Loss Threshold', pt: 'Limite de Perda para Saída' },
    help: 'Exit early if combined position value falls below cost × (1 − threshold%). E.g. 40 = exit if position is worth less than 60% of what you paid.',
  },
  MM_MAX_POSITION_AGE_HOURS: {
    type: 'number', group: 'groupRisk', unit: 'hours', min: 0,
    label: { en: 'Max Position Age', pt: 'Idade Máxima da Posição' },
    help: 'Auto-exit a position that has been open longer than this many hours, regardless of P&L. Useful for longer-duration markets (1h/4h). 0 = disabled.',
  },
  // ── Market Maker — Entry Filters ─────────────────────────────────────────
  MM_ENTRY_MAX_COMBINED: {
    type: 'number', group: 'groupEntryFilters', min: 0, max: 2, step: 0.01,
    label: { en: 'Max Combined Midpoint', pt: 'Midpoint Combinado Máximo' },
    help: 'Only enter if YES midpoint + NO midpoint ≤ this value. On Polymarket, the fair combined price for a new binary market is ~1.00. Values above 1.0 mean you\'re buying above theoretical fair value. Recommended: 1.00–1.05.',
  },
  MM_ENTRY_MIN_TOKEN_PRICE: {
    type: 'number', group: 'groupEntryFilters', min: 0, max: 1, step: 0.01,
    label: { en: 'Min Token Midpoint', pt: 'Midpoint Mínimo do Token' },
    help: 'Skip if either side (YES or NO) has a midpoint below this value. Avoids very one-sided markets where one outcome is near certain. E.g. 0.20 = skip if YES is at $0.95 (NO at $0.05).',
  },
  MM_ENTRY_MAX_TOKEN_PRICE: {
    type: 'number', group: 'groupEntryFilters', min: 0, max: 1, step: 0.01,
    label: { en: 'Max Token Midpoint', pt: 'Midpoint Máximo do Token' },
    help: 'Skip if either side (YES or NO) has a midpoint above this value. Symmetric with Min Token Midpoint to filter out one-sided markets.',
  },
  MM_MIN_SPREAD: {
    type: 'number', group: 'groupEntryFilters', min: 0, max: 1, step: 0.01,
    label: { en: 'Min Spread Profit Margin', pt: 'Margem Mínima de Spread' },
    help: 'Require a minimum implied profit margin before entering. Spread = 1 − combined midpoints. E.g. 0.05 = only enter when YES + NO ≤ 0.95, guaranteeing ≥5¢ of spread. 0 = disabled.',
  },
  // ── Market Maker — Adaptive ──────────────────────────────────────────────
  MM_ADAPTIVE_CL: {
    type: 'boolean', group: 'groupAdaptive',
    label: { en: 'Adaptive Cut-Loss', pt: 'Cut-Loss Adaptativo' },
    help: 'Instead of a fixed time-based cut-loss, use combined position value to decide when to exit. The MM waits if combined value is above the threshold, exits aggressively if below.',
  },
  MM_ADAPTIVE_MIN_COMBINED: {
    type: 'number', group: 'groupAdaptive', min: 0, max: 2, step: 0.01,
    label: { en: 'Adaptive Min Combined Price', pt: 'Preço Combinado Mínimo Adaptativo' },
    help: 'When Adaptive Cut-Loss is ON, only force-exit if combined midpoint (YES + NO) drops below this value. Above it, the position is considered recoverable.',
  },
  MM_RECOVERY_BUY: {
    type: 'boolean', group: 'groupAdaptive',
    label: { en: 'Recovery Buy', pt: 'Compra de Recuperação' },
    help: 'After a cut-loss, buy the winning side at a discount to partially recover the loss. Only fires if the remaining side\'s price is above the Recovery Threshold.',
  },
  MM_RECOVERY_THRESHOLD: {
    type: 'number', group: 'groupAdaptive', min: 0, max: 1, step: 0.01,
    label: { en: 'Recovery Buy Threshold', pt: 'Limite de Compra de Recuperação' },
    help: 'Minimum price of the winning side required to trigger a recovery buy. E.g. 0.70 = only buy if the winning side is at $0.70 or above (high confidence).',
  },
  // ── Market Maker — Binance ───────────────────────────────────────────────
  MM_BINANCE_TREND_ENABLED: {
    type: 'boolean', group: 'groupBinance',
    label: { en: 'Binance Trend Bias', pt: 'Viés de Tendência Binance' },
    help: 'Use Binance candlestick momentum to skew capital allocation. If BTC is trending up when a BTC market opens, more capital is deployed on the YES (price up) side. Requires Binance API access.',
  },
  MM_MAX_BIAS_PERCENT: {
    type: 'number', group: 'groupBinance', unit: '%', min: 50, max: 100,
    label: { en: 'Max Trend Bias', pt: 'Viés Máximo de Tendência' },
    help: 'Maximum % of total capital that can be allocated to the trending side. E.g. 70 means up to 70% on YES and 30% on NO (or vice versa). 50 = no bias (equal split).',
  },
  MM_BINANCE_KLINE_INTERVAL: {
    type: 'select', group: 'groupBinance',
    label: { en: 'Kline Interval', pt: 'Intervalo de Candles' },
    help: 'Timeframe for Binance candlestick momentum calculation. 1m is ideal for 5-minute markets (captures very short-term direction). Use 3m or 5m for longer market durations.',
    options: [
      { value: '1m', label: '1 minute' },
      { value: '3m', label: '3 minutes' },
      { value: '5m', label: '5 minutes' },
    ],
  },
  MM_BINANCE_KLINE_PERIODS: {
    type: 'number', group: 'groupBinance', min: 1, max: 20,
    label: { en: 'Kline Periods', pt: 'Períodos de Candles' },
    help: 'Number of recent candles to use for momentum calculation. More periods = smoother signal, less responsive. Recommended: 3–5.',
  },

  // ── Sniper — General ─────────────────────────────────────────────────────
  SNIPER_DRY_RUN: {
    type: 'boolean', group: 'groupGeneral',
    label: { en: 'Simulation Mode', pt: 'Modo Simulação' },
    help: 'When ON, all Sniper orders are virtual. No real funds are used. Recommended for initial testing.',
  },
  SNIPER_ASSETS: {
    type: 'tags', group: 'groupGeneral',
    label: { en: 'Assets to Snipe', pt: 'Ativos para Sniper' },
    help: 'Comma-separated list of crypto assets to snipe. The Sniper watches for very cheap YES/NO tokens (< $0.05) near market open and places low-cost high-upside bets. Available: btc, eth, sol, xrp, etc.',
  },
  SNIPER_SIM_BALANCE: {
    type: 'number', group: 'groupSimulation', unit: 'USDC', min: 0,
    label: { en: 'Simulation Balance', pt: 'Saldo Simulado' },
    help: 'Virtual balance for Sniper simulation mode.',
  },
  SNIPER_PAUSE_ROUNDS_AFTER_WIN: {
    type: 'number', group: 'groupGeneral', min: 0,
    label: { en: 'Pause Rounds After Win', pt: 'Pausar Rodadas Após Ganho' },
    help: 'After winning on an asset, skip this many market cycles before sniping that asset again. Prevents over-concentrating in a single asset that just won.',
  },
  SNIPER_MAX_SHARES: {
    type: 'number', group: 'groupGeneral', min: 1,
    label: { en: 'Max Shares per Side', pt: 'Máx. Shares por Lado' },
    help: 'Maximum number of shares to buy per outcome (YES or NO) per market. Since prices are very low ($0.01–$0.03), more shares = more capital at risk per position.',
  },
  SNIPER_VOLUME_SPIKE_PCT: {
    type: 'number', group: 'groupFilters', unit: '%', min: 0,
    label: { en: 'Volume Spike Filter', pt: 'Filtro de Spike de Volume' },
    help: 'Only place orders when volume has increased by at least this % since the last check. 0 = disabled (always snipe). Higher values focus on markets with sudden interest spikes.',
  },
  // ── Sniper — Tiers ───────────────────────────────────────────────────────
  SNIPER_TIER1_PRICE: {
    type: 'number', group: 'groupTiers', min: 0.001, max: 0.99, step: 0.001,
    label: { en: 'Tier 1 Price', pt: 'Preço Tier 1' },
    help: 'Price target for Tier 1 (most expensive tier) orders. The Sniper places buy orders at this price and below. E.g. 0.03 = buy YES tokens priced at $0.03 or less.',
  },
  SNIPER_TIER2_PRICE: {
    type: 'number', group: 'groupTiers', min: 0.001, max: 0.99, step: 0.001,
    label: { en: 'Tier 2 Price', pt: 'Preço Tier 2' },
    help: 'Price target for Tier 2 orders. Must be less than Tier 1. More shares are allocated at this cheaper price.',
  },
  SNIPER_TIER3_PRICE: {
    type: 'number', group: 'groupTiers', min: 0.001, max: 0.99, step: 0.001,
    label: { en: 'Tier 3 Price', pt: 'Preço Tier 3' },
    help: 'Price target for the cheapest tier. Maximum shares are allocated here since the potential upside is highest (e.g. $0.01 → $1.00 is a 100× return).',
  },
  // ── Sniper — Schedule ────────────────────────────────────────────────────
  SNIPER_MULTIPLIERS: {
    type: 'text', group: 'groupSchedule',
    label: { en: 'Time-based Multipliers', pt: 'Multiplicadores por Horário' },
    help: 'Scale share count based on time of day. Format: "HH:MM-HH:MM:factor,…". E.g. "09:00-17:00:1.5,17:00-23:00:0.5" means 1.5× shares during market hours, 0.5× after. Leave empty to disable.',
  },
  SNIPER_SCHEDULE: {
    type: 'text', group: 'groupSchedule',
    label: { en: 'Asset Schedule', pt: 'Agenda por Ativo' },
    help: 'Restrict sniping to specific time windows per asset. Format: "ASSET=HH:MM-HH:MM,…". E.g. "ETH=09:00-17:00,BTC=00:00-23:59". Leave empty to snipe all assets at all times.',
  },

  // ── System ────────────────────────────────────────────────────────────────
  GLOBAL_SIMULATION_MODE: {
    type: 'boolean', group: 'groupGlobal',
    label: { en: 'Global Simulation Mode', pt: 'Modo Simulação Global' },
    help: 'Master switch that forces all strategies into simulation mode regardless of their individual settings. Turn OFF to allow live trading. Turning this OFF does not automatically start live trading — each strategy still uses its own Simulation Mode setting.',
  },
  GLOBAL_WALLET_MARGIN: {
    type: 'number', group: 'groupGlobal', unit: 'USDC', min: 0,
    label: { en: 'Wallet Reserve Margin', pt: 'Margem de Reserva da Carteira' },
    help: 'Minimum USDC that must remain in your wallet at all times across all strategies in live mode. New entries are blocked if the wallet would fall below this amount. Acts as a global safety net.',
  },
  GLOBAL_MAX_ENTRIES_PER_MINUTE: {
    type: 'number', group: 'groupGlobal', min: 0,
    label: { en: 'Max Entries / Minute', pt: 'Máx. Entradas por Minuto' },
    help: 'Rate limit on total new position entries across all strategies per minute. Helps avoid excessive API usage and overly aggressive trading. 0 = unlimited.',
  },
  GLOBAL_MAX_EXPOSURE_USDC: {
    type: 'number', group: 'groupGlobal', unit: 'USDC', min: 0,
    label: { en: 'Max Total Exposure', pt: 'Exposição Máxima Total' },
    help: 'Hard cap on the total USDC deployed in open positions across ALL strategies simultaneously. New entries are blocked when this limit is reached. 0 = disabled.',
  },
  GLOBAL_CIRCUIT_BREAKER_PCT: {
    type: 'number', group: 'groupGlobal', unit: '%', min: 0,
    label: { en: 'Circuit Breaker Threshold', pt: 'Limite do Circuit Breaker' },
    help: 'Auto-pause ALL strategies if total losses within the time window exceed this % of current balance. E.g. 20 = pause all strategies when you\'ve lost 20% in the window period. 0 = disabled. Sends a Telegram alert when triggered.',
  },
  GLOBAL_CIRCUIT_BREAKER_WINDOW_HOURS: {
    type: 'number', group: 'groupGlobal', unit: 'hours', min: 1,
    label: { en: 'Circuit Breaker Window', pt: 'Janela do Circuit Breaker' },
    help: 'Time window used for circuit breaker P&L calculation. E.g. 24 = check if losses in the last 24 hours exceed the threshold. Shorter windows react faster but may trigger on normal volatility.',
  },
  POLYGON_RPC_URL: {
    type: 'address', group: 'groupGeneral',
    label: { en: 'Polygon RPC URL', pt: 'URL RPC Polygon' },
    help: 'Custom Polygon network RPC endpoint. Leave empty to use the default from environment variables. For best reliability, use a dedicated endpoint from Alchemy, QuickNode or Infura.',
  },
};

// ─── Group ordering per category ─────────────────────────────────────────────

const CATEGORY_GROUP_ORDER: Record<string, string[]> = {
  copy_trade: ['groupGeneral', 'groupSizing', 'groupRisk', 'groupFilters', 'groupLists', 'groupTimings', 'groupKelly', 'groupSimulation'],
  market_maker: ['groupGeneral', 'groupSizing', 'groupRisk', 'groupEntryFilters', 'groupEarlyExit', 'groupAdaptive', 'groupBinance', 'groupTimings', 'groupSimulation'],
  sniper: ['groupGeneral', 'groupTiers', 'groupFilters', 'groupSchedule', 'groupSimulation'],
  system: ['groupGlobal', 'groupGeneral'],
};

// Keys to hide from the settings form (managed elsewhere)
const HIDDEN_KEYS = new Set([
  'COPY_TRADE_RUNNING', 'MM_RUNNING', 'SNIPER_RUNNING', 'TRADING_MODE',
]);

// ─── Field renderers ─────────────────────────────────────────────────────────

function FieldControl({
  fieldKey, def, value, onChange,
}: {
  fieldKey: string;
  def: FieldDef;
  value: string;
  onChange: (v: string) => void;
}) {
  if (def.type === 'boolean') {
    return (
      <Switch
        checked={value === 'true'}
        onCheckedChange={v => onChange(v ? 'true' : 'false')}
      />
    );
  }

  if (def.type === 'select' && def.options) {
    return (
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full sm:w-64">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {def.options.map(o => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (def.type === 'number') {
    return (
      <div className="flex items-center gap-2">
        <Input
          id={fieldKey}
          type="number"
          value={value}
          min={def.min}
          max={def.max}
          step={def.step ?? 1}
          onChange={e => onChange(e.target.value)}
          className="w-36 font-mono text-sm"
        />
        {def.unit && <span className="text-xs text-muted-foreground">{def.unit}</span>}
      </div>
    );
  }

  if (def.type === 'password') {
    return (
      <Input
        id={fieldKey}
        type="password"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="font-mono text-sm max-w-md"
        autoComplete="off"
      />
    );
  }

  // text / address / tags
  return (
    <Input
      id={fieldKey}
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={def.type === 'tags' ? 'tag1, tag2, ...' : undefined}
      className="font-mono text-sm max-w-md"
    />
  );
}

// ─── Settings form ────────────────────────────────────────────────────────────

function SettingsForm({ category, settings }: { category: string; settings: Setting[] }) {
  const { t, lang } = useLang();
  const s = t.settings;
  const [form, setForm] = useState<Record<string, string>>(
    Object.fromEntries(settings.map(st => [st.key, st.value])),
  );
  const [saving, setSaving] = useState(false);

  // Sync form when settings refetch (e.g. after import)
  useEffect(() => {
    setForm(Object.fromEntries(settings.map(st => [st.key, st.value])));
  }, [settings]);

  const save = async () => {
    setSaving(true);
    try {
      await bulkUpdateSettings(Object.entries(form).map(([key, value]) => ({ key, value })));
      toast({ title: `${t.common.save} ✓`, variant: 'success' as any });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const visible = settings.filter(st => !HIDDEN_KEYS.has(st.key));
  const groupOrder = CATEGORY_GROUP_ORDER[category] ?? [];

  // Group fields by their schema group
  const groups = new Map<string, Setting[]>();
  for (const groupKey of groupOrder) {
    groups.set(groupKey, []);
  }
  for (const st of visible) {
    const def = FIELD_SCHEMA[st.key];
    const g = def?.group ?? 'groupGeneral';
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(st);
  }

  return (
    <div className="space-y-6">
      {Array.from(groups.entries()).map(([groupKey, fields]) => {
        if (!fields.length) return null;
        const groupLabel = (s as any)[groupKey] ?? groupKey;
        return (
          <div key={groupKey}>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border pb-1">
              {groupLabel}
            </p>
            <div className="space-y-4">
              {fields.map(st => {
                const def = FIELD_SCHEMA[st.key];
                if (!def) {
                  // Fallback: render as plain text input with raw key label
                  return (
                    <div key={st.key} className="space-y-1.5">
                      <Label htmlFor={st.key} className="font-mono text-xs text-muted-foreground">{st.key}</Label>
                      <Input
                        id={st.key}
                        value={form[st.key] ?? ''}
                        onChange={e => setForm(f => ({ ...f, [st.key]: e.target.value }))}
                        className="font-mono text-sm max-w-md"
                      />
                      {st.description && <p className="text-xs text-muted-foreground">{st.description}</p>}
                    </div>
                  );
                }

                const label = def.label[lang as 'en' | 'pt'] ?? def.label.en;
                const isBoolean = def.type === 'boolean';

                return (
                  <div key={st.key}>
                    {isBoolean ? (
                      <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3 gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-medium">{label}</span>
                            <HelpTooltip text={def.help} />
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                            {def.help.split('.')[0]}.
                          </p>
                        </div>
                        <FieldControl
                          fieldKey={st.key}
                          def={def}
                          value={form[st.key] ?? 'false'}
                          onChange={v => setForm(f => ({ ...f, [st.key]: v }))}
                        />
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <Label htmlFor={st.key} className="flex items-center gap-1.5 text-sm font-medium">
                          {label}
                          <HelpTooltip text={def.help} />
                        </Label>
                        <FieldControl
                          fieldKey={st.key}
                          def={def}
                          value={form[st.key] ?? ''}
                          onChange={v => setForm(f => ({ ...f, [st.key]: v }))}
                        />
                        <p className="text-xs text-muted-foreground leading-relaxed max-w-lg">
                          {def.help.length > 120 ? def.help.slice(0, 120) + '…' : def.help}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <Button onClick={save} disabled={saving} className="mt-2">
        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
        {t.common.save}
      </Button>
    </div>
  );
}

function CategoryTab({ category }: { category: string }) {
  const { t } = useLang();
  const { data: settings = [], isLoading } = useQuery({
    queryKey: ['settings', category],
    queryFn: () => getSettingsByCategory(category),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">{t.common.loading}</p>;
  return <SettingsForm category={category} settings={settings} />;
}

// ─── History tab ─────────────────────────────────────────────────────────────

function HistoryTab() {
  const { t, lang } = useLang();
  const { data: history = [], isLoading } = useQuery({
    queryKey: ['settings-history'],
    queryFn: () => getSettingsHistory(200),
    refetchInterval: 30000,
  });

  const getLabel = (key: string) => {
    const def = FIELD_SCHEMA[key];
    if (!def) return key;
    return def.label[lang as 'en' | 'pt'] ?? def.label.en;
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">{t.settings.historyHelp}</p>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t.common.loading}</p>
      ) : history.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t.common.noData}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-xs">
            <thead className="bg-secondary/30">
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-3 py-2 font-medium">{t.settings.historyKey}</th>
                <th className="px-3 py-2 font-medium">{t.settings.historyOld}</th>
                <th className="px-3 py-2 font-medium">{t.settings.historyNew}</th>
                <th className="px-3 py-2 font-medium">{t.settings.historyWhen}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {history.map(h => (
                <tr key={h.id} className="hover:bg-secondary/10">
                  <td className="px-3 py-2">
                    <span className="font-medium text-foreground">{getLabel(h.key)}</span>
                    <span className="ml-1.5 font-mono text-muted-foreground opacity-60">{h.key}</span>
                  </td>
                  <td className="px-3 py-2 font-mono text-muted-foreground max-w-[160px] truncate">{h.oldValue ?? <em className="opacity-50">—</em>}</td>
                  <td className="px-3 py-2 font-mono text-foreground max-w-[160px] truncate">{h.newValue}</td>
                  <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                    {new Date(h.changedAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Backup / Import panel ────────────────────────────────────────────────────

function BackupImportPanel() {
  const { t } = useLang();
  const queryClient = useQueryClient();
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    try {
      const data = await exportSettings();
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `polygekko-settings-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: `${t.settings.exportSettings} ✓`, variant: 'success' as any });
    } catch (err: any) {
      toast({ title: 'Export failed', description: err.message, variant: 'destructive' });
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const parsed: ExportedSettings | Record<string, any> = JSON.parse(text);
      // Pass the full parsed object — the backend normalizes both new and legacy formats
      if (typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Invalid format');
      }
      const result = await importSettings(parsed as ExportedSettings);
      // Refresh all settings queries so the forms reflect the imported values
      await queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast({
        title: `${t.settings.importSuccess} ✓`,
        description: `${result.imported} ${t.settings.importApplied}${result.skipped > 0 ? `, ${result.skipped} ${t.settings.importSkipped}` : ''}`,
        variant: 'success' as any,
      });
    } catch (err: any) {
      toast({ title: 'Import failed', description: err.message, variant: 'destructive' });
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Button variant="outline" size="sm" onClick={handleExport}>
        <Download className="mr-2 h-4 w-4" />
        {t.settings.exportSettings}
      </Button>
      <Button variant="outline" size="sm" disabled={importing} onClick={() => fileInputRef.current?.click()}>
        {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
        {t.settings.importSettings}
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleImport}
      />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { t } = useLang();
  const s = t.settings;

  return (
    <MainLayout title={s.title}>
      <div className="mx-auto max-w-3xl">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                {s.title}
                <HelpTooltip text={s.help} />
              </CardTitle>
              <BackupImportPanel />
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="trading_mode">
              <TabsList className="mb-6 flex-wrap h-auto gap-1">
                <TabsTrigger value="trading_mode">{s.tradingMode}</TabsTrigger>
                <TabsTrigger value="copy_trade">{s.copyTrade}</TabsTrigger>
                <TabsTrigger value="market_maker">{s.marketMaker}</TabsTrigger>
                <TabsTrigger value="sniper">{s.sniper}</TabsTrigger>
                <TabsTrigger value="telegram">{s.telegram}</TabsTrigger>
                <TabsTrigger value="system">{s.system}</TabsTrigger>
                <TabsTrigger value="history">{s.history}</TabsTrigger>
              </TabsList>
              <TabsContent value="trading_mode"><TradingModeForm /></TabsContent>
              <TabsContent value="copy_trade"><CategoryTab category="copy_trade" /></TabsContent>
              <TabsContent value="market_maker"><CategoryTab category="market_maker" /></TabsContent>
              <TabsContent value="sniper"><CategoryTab category="sniper" /></TabsContent>
              <TabsContent value="telegram"><TelegramForm /></TabsContent>
              <TabsContent value="system"><CategoryTab category="system" /></TabsContent>
              <TabsContent value="history"><HistoryTab /></TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
