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

export function MarketMakerForm({ settings, onSaved }: { settings: Setting[]; onSaved: () => void }) {
  const { t } = useLang();
  const f = t.strategies.marketMaker.fields;
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    MM_DRY_RUN: getVal(settings, 'MM_DRY_RUN', 'true'),
    MM_ASSETS: getVal(settings, 'MM_ASSETS', 'btc,eth'),
    MM_DURATION: getVal(settings, 'MM_DURATION', '5m'),
    MM_TRADE_SIZE: getVal(settings, 'MM_TRADE_SIZE', '10'),
    MM_SELL_PRICE: getVal(settings, 'MM_SELL_PRICE', '0.60'),
    MM_CUT_LOSS_TIME: getVal(settings, 'MM_CUT_LOSS_TIME', '60'),
    MM_ADAPTIVE_CL: getVal(settings, 'MM_ADAPTIVE_CL', 'false'),
    MM_ADAPTIVE_MIN_COMBINED: getVal(settings, 'MM_ADAPTIVE_MIN_COMBINED', '1.0'),
    MM_RECOVERY_BUY: getVal(settings, 'MM_RECOVERY_BUY', 'false'),
    MM_RECOVERY_THRESHOLD: getVal(settings, 'MM_RECOVERY_THRESHOLD', '0.70'),
    MM_POLL_INTERVAL: getVal(settings, 'MM_POLL_INTERVAL', '30'),
    MM_SIM_BALANCE: getVal(settings, 'MM_SIM_BALANCE', '1000'),
    MM_DYNAMIC_SIZING_ENABLED: getVal(settings, 'MM_DYNAMIC_SIZING_ENABLED', 'false'),
    MM_MIN_ALLOCATION: getVal(settings, 'MM_MIN_ALLOCATION', '5'),
    MM_MAX_ALLOCATION: getVal(settings, 'MM_MAX_ALLOCATION', '50'),
    MM_SPREAD_PROFIT_TARGET: getVal(settings, 'MM_SPREAD_PROFIT_TARGET', '0.01'),
    MM_BINANCE_TREND_ENABLED: getVal(settings, 'MM_BINANCE_TREND_ENABLED', 'false'),
    MM_MAX_BIAS_PERCENT: getVal(settings, 'MM_MAX_BIAS_PERCENT', '80'),
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
        <CardTitle className="text-base font-semibold">{t.strategies.marketMaker.label}</CardTitle>
        <p className="text-xs text-muted-foreground leading-relaxed">{t.strategies.marketMaker.description}</p>
      </CardHeader>
      <CardContent className="space-y-5">

        {/* Assets Toggle Grid */}
        {(() => {
          const CRYPTO_ASSETS = ['btc', 'eth', 'sol', 'xrp', 'bnb', 'doge', 'hype'];
          const selectedAssets = form.MM_ASSETS.split(',').map(a => a.trim().toLowerCase()).filter(Boolean);
          const toggleAsset = (asset: string) => {
            const current = form.MM_ASSETS.split(',').map(a => a.trim().toLowerCase()).filter(Boolean);
            const next = current.includes(asset)
              ? current.filter(a => a !== asset)
              : [...current, asset];
            set('MM_ASSETS', next.join(','));
          };
          return (
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                {f.assets.label} <HelpTooltip text={f.assets.help} />
              </Label>
              <div className="flex flex-wrap gap-2">
                {CRYPTO_ASSETS.map(asset => {
                  const isSelected = selectedAssets.includes(asset);
                  return (
                    <button
                      key={asset}
                      type="button"
                      onClick={() => toggleAsset(asset)}
                      className={`rounded-md border px-3 py-1 text-xs font-medium transition-colors ${
                        isSelected
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-muted/40 text-muted-foreground border-border hover:bg-muted'
                      }`}
                    >
                      {asset.toUpperCase()}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })()}

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Duration */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5">
              {f.duration.label} <HelpTooltip text={f.duration.help} />
            </Label>
            <Select value={form.MM_DURATION} onValueChange={v => set('MM_DURATION', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="5m">{f.duration.opt5m}</SelectItem>
                <SelectItem value="15m">{f.duration.opt15m}</SelectItem>
                <SelectItem value="1h">{f.duration.opt1h}</SelectItem>
                <SelectItem value="4h">{f.duration.opt4h}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Trade Size */}
          <div className="space-y-1.5">
            <Label htmlFor="trade-size" className="flex items-center gap-1.5">
              {f.tradeSize.label} <HelpTooltip text={f.tradeSize.help} />
            </Label>
            <Input
              id="trade-size"
              type="number"
              min="1"
              value={form.MM_TRADE_SIZE}
              onChange={e => set('MM_TRADE_SIZE', e.target.value)}
            />
          </div>

          {/* Sell Price */}
          <div className="space-y-1.5">
            <Label htmlFor="sell-price" className="flex items-center gap-1.5">
              {f.sellPrice.label} <HelpTooltip text={f.sellPrice.help} />
            </Label>
            <Input
              id="sell-price"
              type="number"
              min="0.01" max="0.99" step="0.01"
              value={form.MM_SELL_PRICE}
              onChange={e => set('MM_SELL_PRICE', e.target.value)}
            />
          </div>

          {/* Cut Loss Time */}
          <div className="space-y-1.5">
            <Label htmlFor="cut-loss-time" className="flex items-center gap-1.5">
              {f.cutLossTime.label} <HelpTooltip text={f.cutLossTime.help} />
            </Label>
            <Input
              id="cut-loss-time"
              type="number"
              min="10"
              value={form.MM_CUT_LOSS_TIME}
              onChange={e => set('MM_CUT_LOSS_TIME', e.target.value)}
            />
          </div>

          {/* Poll Interval */}
          <div className="space-y-1.5">
            <Label htmlFor="poll-interval" className="flex items-center gap-1.5">
              {f.pollInterval.label} <HelpTooltip text={f.pollInterval.help} />
            </Label>
            <Input
              id="poll-interval"
              type="number"
              min="10"
              value={form.MM_POLL_INTERVAL}
              onChange={e => set('MM_POLL_INTERVAL', e.target.value)}
            />
          </div>
        </div>

        {/* Dynamic Sizing */}
        <div className="space-y-3 rounded-lg border border-border p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="flex items-center gap-1.5 text-sm font-medium">
                {f.dynamicSizingEnabled.label} <HelpTooltip text={f.dynamicSizingEnabled.help} />
              </p>
            </div>
            <Switch
              checked={form.MM_DYNAMIC_SIZING_ENABLED === 'true'}
              onCheckedChange={v => set('MM_DYNAMIC_SIZING_ENABLED', v.toString())}
            />
          </div>
          {form.MM_DYNAMIC_SIZING_ENABLED === 'true' && (
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="min-alloc">{f.minAllocation.label}</Label>
                <Input
                  id="min-alloc"
                  type="number"
                  min="1"
                  value={form.MM_MIN_ALLOCATION}
                  onChange={e => set('MM_MIN_ALLOCATION', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="max-alloc">{f.maxAllocation.label}</Label>
                <Input
                  id="max-alloc"
                  type="number"
                  min="1"
                  value={form.MM_MAX_ALLOCATION}
                  onChange={e => set('MM_MAX_ALLOCATION', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="profit-tgt">Spread Target</Label>
                <Input
                  id="profit-tgt"
                  type="number"
                  min="0.01" step="0.01"
                  value={form.MM_SPREAD_PROFIT_TARGET}
                  onChange={e => set('MM_SPREAD_PROFIT_TARGET', e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        {/* Binance Trend Sizing */}
        <div className="space-y-3 rounded-lg border border-border p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="flex items-center gap-1.5 text-sm font-medium">
                Binance Trend Bias <HelpTooltip text="Use Binance 24h momentum API to allocate more money to the trending side" />
              </p>
            </div>
            <Switch
              checked={form.MM_BINANCE_TREND_ENABLED === 'true'}
              onCheckedChange={v => set('MM_BINANCE_TREND_ENABLED', v.toString())}
            />
          </div>
          {form.MM_BINANCE_TREND_ENABLED === 'true' && (
            <div className="grid gap-4 sm:grid-cols-1">
              <div className="space-y-1.5">
                <Label htmlFor="max-bias">Max Bias Allocation %</Label>
                <Input
                  id="max-bias"
                  type="number"
                  min="50" max="100"
                  value={form.MM_MAX_BIAS_PERCENT}
                  onChange={e => set('MM_MAX_BIAS_PERCENT', e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">If 80%, places up to 80% capital on YES and 20% on NO based on strong momentum.</p>
              </div>
            </div>
          )}
        </div>

        {/* Adaptive Cut-Loss */}
        <div className="space-y-3 rounded-lg border border-border p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="flex items-center gap-1.5 text-sm font-medium">
                {f.adaptiveCL.label} <HelpTooltip text={f.adaptiveCL.help} />
              </p>
            </div>
            <Switch
              checked={form.MM_ADAPTIVE_CL === 'true'}
              onCheckedChange={v => set('MM_ADAPTIVE_CL', v.toString())}
            />
          </div>
          {form.MM_ADAPTIVE_CL === 'true' && (
            <div className="space-y-1.5">
              <Label htmlFor="min-combined">Min Combined Price</Label>
              <Input
                id="min-combined"
                type="number"
                min="0" max="2" step="0.01"
                value={form.MM_ADAPTIVE_MIN_COMBINED}
                onChange={e => set('MM_ADAPTIVE_MIN_COMBINED', e.target.value)}
              />
            </div>
          )}
        </div>

        {/* Recovery Buy */}
        <div className="space-y-3 rounded-lg border border-border p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="flex items-center gap-1.5 text-sm font-medium">
                {f.recoveryBuy.label} <HelpTooltip text={f.recoveryBuy.help} />
              </p>
            </div>
            <Switch
              checked={form.MM_RECOVERY_BUY === 'true'}
              onCheckedChange={v => set('MM_RECOVERY_BUY', v.toString())}
            />
          </div>
          {form.MM_RECOVERY_BUY === 'true' && (
            <div className="space-y-1.5">
              <Label htmlFor="recovery-threshold">Recovery Threshold</Label>
              <Input
                id="recovery-threshold"
                type="number"
                min="0" max="1" step="0.01"
                value={form.MM_RECOVERY_THRESHOLD}
                onChange={e => set('MM_RECOVERY_THRESHOLD', e.target.value)}
              />
            </div>
          )}
        </div>

        {/* Sim Balance */}
        <div className="space-y-1.5">
          <Label htmlFor="sim-balance" className="flex items-center gap-1.5">
            {f.simBalance.label} <HelpTooltip text={f.simBalance.help} />
          </Label>
          <Input
            id="sim-balance"
            type="number"
            min="0"
            step="0.01"
            value={form.MM_SIM_BALANCE}
            onChange={e => set('MM_SIM_BALANCE', e.target.value)}
          />
        </div>

        <Button onClick={save} disabled={saving} className="w-full">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          {t.common.save}
        </Button>
      </CardContent>
    </Card>
  );
}
