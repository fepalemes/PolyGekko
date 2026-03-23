'use client';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { bulkUpdateSettings } from '@/lib/api';
import { toast } from '@/components/ui/use-toast';
import { useLang } from '@/lib/i18n';
import { Loader2, Save } from 'lucide-react';
import type { Setting } from '@/lib/types';

function getVal(settings: Setting[], key: string, def = '') {
  return settings.find(s => s.key === key)?.value ?? def;
}

export function CopyTradeForm({ settings, onSaved }: { settings: Setting[]; onSaved: () => void }) {
  const { t } = useLang();
  const f = t.strategies.copyTrade.fields;
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    COPY_TRADE_DRY_RUN: getVal(settings, 'COPY_TRADE_DRY_RUN', 'true'),
    COPY_TRADE_TRADER_ADDRESS: getVal(settings, 'COPY_TRADE_TRADER_ADDRESS'),
    COPY_TRADE_SIZE_MODE: getVal(settings, 'COPY_TRADE_SIZE_MODE', 'percentage'),
    COPY_TRADE_FIXED_AMOUNT: getVal(settings, 'COPY_TRADE_FIXED_AMOUNT', '10'),
    COPY_TRADE_SIZE_PERCENT: getVal(settings, 'COPY_TRADE_SIZE_PERCENT', '10'),
    COPY_TRADE_MAX_POSITION_SIZE: getVal(settings, 'COPY_TRADE_MAX_POSITION_SIZE', '50'),
    COPY_TRADE_DYNAMIC_SIZING_ENABLED: getVal(settings, 'COPY_TRADE_DYNAMIC_SIZING_ENABLED', 'false'),
    COPY_TRADE_MIN_ALLOCATION: getVal(settings, 'COPY_TRADE_MIN_ALLOCATION', '5'),
    COPY_TRADE_MAX_ALLOCATION: getVal(settings, 'COPY_TRADE_MAX_ALLOCATION', '25'),
    COPY_TRADE_MIN_ENTRY_AMOUNT: getVal(settings, 'COPY_TRADE_MIN_ENTRY_AMOUNT', '1'),
    COPY_TRADE_MAX_BALANCE_USAGE_PERCENT: getVal(settings, 'COPY_TRADE_MAX_BALANCE_USAGE_PERCENT', '30'),
    COPY_TRADE_AUTO_SELL_ENABLED: getVal(settings, 'COPY_TRADE_AUTO_SELL_ENABLED', 'true'),
    COPY_TRADE_AUTO_SELL_PROFIT_PERCENT: getVal(settings, 'COPY_TRADE_AUTO_SELL_PROFIT_PERCENT', '50'),
    COPY_TRADE_SELL_MODE: getVal(settings, 'COPY_TRADE_SELL_MODE', 'market'),
    COPY_TRADE_MIN_MARKET_TIME_LEFT: getVal(settings, 'COPY_TRADE_MIN_MARKET_TIME_LEFT', '300'),
    COPY_TRADE_GTC_FALLBACK_TIMEOUT: getVal(settings, 'COPY_TRADE_GTC_FALLBACK_TIMEOUT', '60'),
    COPY_TRADE_REDEEM_INTERVAL: getVal(settings, 'COPY_TRADE_REDEEM_INTERVAL', '60'),
    COPY_TRADE_SIM_BALANCE: getVal(settings, 'COPY_TRADE_SIM_BALANCE', '1000'),
    COPY_TRADE_STOP_LOSS_PERCENT: getVal(settings, 'COPY_TRADE_STOP_LOSS_PERCENT', '0'),
  });

  const set = (key: string, value: string) => setForm(f => ({ ...f, [key]: value }));

  const save = async () => {
    setSaving(true);
    try {
      await bulkUpdateSettings(Object.entries(form).map(([key, value]) => ({ key, value })));
      toast({ title: t.common.save + ' ✓', variant: 'success' as any });
      onSaved();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">{t.strategies.copyTrade.label}</CardTitle>
        <p className="text-xs text-muted-foreground leading-relaxed">{t.strategies.copyTrade.description}</p>
      </CardHeader>
      <CardContent className="space-y-5">

        {/* Trader Address */}
        <div className="space-y-1.5">
          <Label htmlFor="trader" className="flex items-center gap-1.5">
            {f.traderAddress.label} <HelpTooltip text={f.traderAddress.help} />
          </Label>
          <Input
            id="trader"
            placeholder={f.traderAddress.placeholder}
            value={form.COPY_TRADE_TRADER_ADDRESS}
            onChange={e => set('COPY_TRADE_TRADER_ADDRESS', e.target.value)}
          />
        </div>

        {/* Dynamic Sizing Toggle */}
        <div className="space-y-3 rounded-lg border border-border p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="flex items-center gap-1.5 text-sm font-medium">
                {t.strategies.marketMaker.fields.dynamicSizingEnabled.label} <HelpTooltip text={t.strategies.marketMaker.fields.dynamicSizingEnabled.help} />
              </p>
            </div>
            <Switch
              checked={form.COPY_TRADE_DYNAMIC_SIZING_ENABLED === 'true'}
              onCheckedChange={v => set('COPY_TRADE_DYNAMIC_SIZING_ENABLED', v.toString())}
            />
          </div>
          {form.COPY_TRADE_DYNAMIC_SIZING_ENABLED === 'true' && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="min-alloc">{t.strategies.marketMaker.fields.minAllocation.label}</Label>
                <Input
                  id="min-alloc"
                  type="number"
                  min="1"
                  value={form.COPY_TRADE_MIN_ALLOCATION}
                  onChange={e => set('COPY_TRADE_MIN_ALLOCATION', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="max-alloc">{t.strategies.marketMaker.fields.maxAllocation.label}</Label>
                <Input
                  id="max-alloc"
                  type="number"
                  min="1"
                  value={form.COPY_TRADE_MAX_ALLOCATION}
                  onChange={e => set('COPY_TRADE_MAX_ALLOCATION', e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        {form.COPY_TRADE_DYNAMIC_SIZING_ENABLED !== 'true' && (
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Size Mode */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                {f.sizeMode.label} <HelpTooltip text={f.sizeMode.help} />
              </Label>
              <Select value={form.COPY_TRADE_SIZE_MODE} onValueChange={v => set('COPY_TRADE_SIZE_MODE', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">{f.sizeMode.optFixed}</SelectItem>
                  <SelectItem value="percentage">{f.sizeMode.optPercentage}</SelectItem>
                  <SelectItem value="balance">{f.sizeMode.optBalance}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Fixed Amount — shown only when mode=fixed */}
            {form.COPY_TRADE_SIZE_MODE === 'fixed' ? (
              <div className="space-y-1.5">
                <Label htmlFor="fixed-amt" className="flex items-center gap-1.5">
                  {f.fixedAmount.label} <HelpTooltip text={f.fixedAmount.help} />
                </Label>
                <Input id="fixed-amt" type="number" min="0.01" step="0.01"
                  value={form.COPY_TRADE_FIXED_AMOUNT}
                  onChange={e => set('COPY_TRADE_FIXED_AMOUNT', e.target.value)} />
              </div>
            ) : (
              /* Size % — shown when mode=percentage or balance */
              <div className="space-y-1.5">
                <Label htmlFor="size-pct" className="flex items-center gap-1.5">
                  {f.sizePercent.label} <HelpTooltip text={f.sizePercent.help} />
                </Label>
                <Input id="size-pct" type="number" min="1" max="100"
                  value={form.COPY_TRADE_SIZE_PERCENT}
                  onChange={e => set('COPY_TRADE_SIZE_PERCENT', e.target.value)} />
              </div>
            )}

            {/* Max Position (hidden in fixed mode) */}
            {form.COPY_TRADE_SIZE_MODE !== 'fixed' && (
              <div className="space-y-1.5">
                <Label htmlFor="max-pos" className="flex items-center gap-1.5">
                  {f.maxPositionSize.label} <HelpTooltip text={f.maxPositionSize.help} />
                </Label>
                <Input id="max-pos" type="number" min="1"
                  value={form.COPY_TRADE_MAX_POSITION_SIZE}
                  onChange={e => set('COPY_TRADE_MAX_POSITION_SIZE', e.target.value)} />
              </div>
            )}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="min-entry" className="flex items-center gap-1.5">
              {f.minEntryAmount.label} <HelpTooltip text={f.minEntryAmount.help} />
            </Label>
            <Input id="min-entry" type="number" min="0" step="0.01"
              value={form.COPY_TRADE_MIN_ENTRY_AMOUNT}
              onChange={e => set('COPY_TRADE_MIN_ENTRY_AMOUNT', e.target.value)} />
          </div>

          {/* Max Balance Usage */}
          <div className="space-y-1.5">
            <Label htmlFor="max-bal" className="flex items-center gap-1.5">
              {f.maxBalanceUsage.label} <HelpTooltip text={f.maxBalanceUsage.help} />
            </Label>
            <Input id="max-bal" type="number" min="1" max="100"
              value={form.COPY_TRADE_MAX_BALANCE_USAGE_PERCENT}
              onChange={e => set('COPY_TRADE_MAX_BALANCE_USAGE_PERCENT', e.target.value)} />
          </div>

          {/* Sell Mode */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5">
              {f.sellMode.label} <HelpTooltip text={f.sellMode.help} />
            </Label>
            <Select value={form.COPY_TRADE_SELL_MODE} onValueChange={v => set('COPY_TRADE_SELL_MODE', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="market">{f.sellMode.optMarket}</SelectItem>
                <SelectItem value="limit">{f.sellMode.optLimit}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Sim Balance */}
          <div className="space-y-1.5">
            <Label htmlFor="sim-bal" className="flex items-center gap-1.5">
              {f.simBalance.label} <HelpTooltip text={f.simBalance.help} />
            </Label>
            <Input id="sim-bal" type="number" min="0"
              value={form.COPY_TRADE_SIM_BALANCE}
              onChange={e => set('COPY_TRADE_SIM_BALANCE', e.target.value)} />
          </div>
        </div>

        {/* Take Profit + Stop Loss */}
        <div className="space-y-3 rounded-lg border border-border p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="flex items-center gap-1.5 text-sm font-medium">
                {f.autoSell.label} <HelpTooltip text={f.autoSell.help} />
              </p>
            </div>
            <Switch
              checked={form.COPY_TRADE_AUTO_SELL_ENABLED === 'true'}
              onCheckedChange={v => set('COPY_TRADE_AUTO_SELL_ENABLED', v.toString())}
            />
          </div>
          {form.COPY_TRADE_AUTO_SELL_ENABLED === 'true' && (
            <div className="space-y-1.5">
              <Label htmlFor="profit-pct" className="flex items-center gap-1.5">
                {f.autoSellProfit.label} <HelpTooltip text={f.autoSellProfit.help} />
              </Label>
              <Input id="profit-pct" type="number" min="1"
                value={form.COPY_TRADE_AUTO_SELL_PROFIT_PERCENT}
                onChange={e => set('COPY_TRADE_AUTO_SELL_PROFIT_PERCENT', e.target.value)} />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="stop-loss" className="flex items-center gap-1.5">
              {f.stopLoss.label} <HelpTooltip text={f.stopLoss.help} />
            </Label>
            <Input id="stop-loss" type="number" min="0" max="99"
              value={form.COPY_TRADE_STOP_LOSS_PERCENT}
              onChange={e => set('COPY_TRADE_STOP_LOSS_PERCENT', e.target.value)} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="min-time" className="flex items-center gap-1.5">
              {f.minMarketTime.label} <HelpTooltip text={f.minMarketTime.help} />
            </Label>
            <Input id="min-time" type="number"
              value={form.COPY_TRADE_MIN_MARKET_TIME_LEFT}
              onChange={e => set('COPY_TRADE_MIN_MARKET_TIME_LEFT', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gtc-timeout" className="flex items-center gap-1.5">
              {f.gtcTimeout.label} <HelpTooltip text={f.gtcTimeout.help} />
            </Label>
            <Input id="gtc-timeout" type="number"
              value={form.COPY_TRADE_GTC_FALLBACK_TIMEOUT}
              onChange={e => set('COPY_TRADE_GTC_FALLBACK_TIMEOUT', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="redeem" className="flex items-center gap-1.5">
              {f.redeemInterval.label} <HelpTooltip text={f.redeemInterval.help} />
            </Label>
            <Input id="redeem" type="number"
              value={form.COPY_TRADE_REDEEM_INTERVAL}
              onChange={e => set('COPY_TRADE_REDEEM_INTERVAL', e.target.value)} />
          </div>
        </div>

        <Button onClick={save} disabled={saving} className="w-full">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          {t.common.save}
        </Button>
      </CardContent>
    </Card>
  );
}
