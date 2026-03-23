'use client';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { bulkUpdateSettings } from '@/lib/api';
import { toast } from '@/components/ui/use-toast';
import { useLang } from '@/lib/i18n';
import { Loader2, Save } from 'lucide-react';
import type { Setting } from '@/lib/types';

function getVal(settings: Setting[], key: string, def = '') {
  return settings.find(s => s.key === key)?.value ?? def;
}

export function SniperForm({ settings, onSaved }: { settings: Setting[]; onSaved: () => void }) {
  const { t } = useLang();
  const f = t.strategies.sniper.fields;
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    SNIPER_DRY_RUN: getVal(settings, 'SNIPER_DRY_RUN', 'true'),
    SNIPER_ASSETS: getVal(settings, 'SNIPER_ASSETS', 'eth,btc,sol'),
    SNIPER_TIER1_PRICE: getVal(settings, 'SNIPER_TIER1_PRICE', '0.03'),
    SNIPER_TIER2_PRICE: getVal(settings, 'SNIPER_TIER2_PRICE', '0.02'),
    SNIPER_TIER3_PRICE: getVal(settings, 'SNIPER_TIER3_PRICE', '0.01'),
    SNIPER_MAX_SHARES: getVal(settings, 'SNIPER_MAX_SHARES', '15'),
    SNIPER_PAUSE_ROUNDS_AFTER_WIN: getVal(settings, 'SNIPER_PAUSE_ROUNDS_AFTER_WIN', '2'),
    SNIPER_MULTIPLIERS: getVal(settings, 'SNIPER_MULTIPLIERS', ''),
    SNIPER_SCHEDULE: getVal(settings, 'SNIPER_SCHEDULE', ''),
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
        <CardTitle className="text-base font-semibold">{t.strategies.sniper.label}</CardTitle>
        <p className="text-xs text-muted-foreground leading-relaxed">{t.strategies.sniper.description}</p>
      </CardHeader>
      <CardContent className="space-y-5">

        {/* Dry Run */}
        <div className="flex items-center justify-between rounded-lg border border-border p-3">
          <div>
            <p className="flex items-center gap-1.5 text-sm font-medium">
              {t.strategies.copyTrade.fields.dryRun.label}
              <HelpTooltip text={t.strategies.copyTrade.fields.dryRun.help} />
            </p>
          </div>
          <Switch
            checked={form.SNIPER_DRY_RUN === 'true'}
            onCheckedChange={v => set('SNIPER_DRY_RUN', v.toString())}
          />
        </div>

        {/* Assets */}
        <div className="space-y-1.5">
          <Label htmlFor="sniper-assets" className="flex items-center gap-1.5">
            {f.assets.label} <HelpTooltip text={f.assets.help} />
          </Label>
          <Input
            id="sniper-assets"
            placeholder={f.assets.placeholder}
            value={form.SNIPER_ASSETS}
            onChange={e => set('SNIPER_ASSETS', e.target.value)}
          />
        </div>

        {/* Price Tiers */}
        <div className="space-y-3 rounded-lg border border-border p-3">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            Price Tiers
            <HelpTooltip text="3-tier allocation strategy: Tier 1 gets the most shares (50%), Tier 2 gets 30%, Tier 3 gets 20%. Lower-priced tiers are less likely to fill but yield higher returns." />
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="tier1" className="flex items-center gap-1.5">
                {f.tier1Price.label} <HelpTooltip text={f.tier1Price.help} />
              </Label>
              <Input
                id="tier1"
                type="number"
                min="0.01" max="0.99" step="0.01"
                value={form.SNIPER_TIER1_PRICE}
                onChange={e => set('SNIPER_TIER1_PRICE', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tier2" className="flex items-center gap-1.5">
                {f.tier2Price.label} <HelpTooltip text={f.tier2Price.help} />
              </Label>
              <Input
                id="tier2"
                type="number"
                min="0.01" max="0.99" step="0.01"
                value={form.SNIPER_TIER2_PRICE}
                onChange={e => set('SNIPER_TIER2_PRICE', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tier3" className="flex items-center gap-1.5">
                {f.tier3Price.label} <HelpTooltip text={f.tier3Price.help} />
              </Label>
              <Input
                id="tier3"
                type="number"
                min="0.01" max="0.99" step="0.01"
                value={form.SNIPER_TIER3_PRICE}
                onChange={e => set('SNIPER_TIER3_PRICE', e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Max Shares */}
          <div className="space-y-1.5">
            <Label htmlFor="max-shares" className="flex items-center gap-1.5">
              {f.maxShares.label} <HelpTooltip text={f.maxShares.help} />
            </Label>
            <Input
              id="max-shares"
              type="number"
              min="1"
              value={form.SNIPER_MAX_SHARES}
              onChange={e => set('SNIPER_MAX_SHARES', e.target.value)}
            />
          </div>

          {/* Pause Rounds */}
          <div className="space-y-1.5">
            <Label htmlFor="pause-rounds" className="flex items-center gap-1.5">
              {f.pauseRounds.label} <HelpTooltip text={f.pauseRounds.help} />
            </Label>
            <Input
              id="pause-rounds"
              type="number"
              min="0"
              value={form.SNIPER_PAUSE_ROUNDS_AFTER_WIN}
              onChange={e => set('SNIPER_PAUSE_ROUNDS_AFTER_WIN', e.target.value)}
            />
          </div>
        </div>

        {/* Multipliers */}
        <div className="space-y-1.5">
          <Label htmlFor="multipliers" className="flex items-center gap-1.5">
            {f.multipliers.label} <HelpTooltip text={f.multipliers.help} />
          </Label>
          <Input
            id="multipliers"
            placeholder={f.multipliers.placeholder}
            value={form.SNIPER_MULTIPLIERS}
            onChange={e => set('SNIPER_MULTIPLIERS', e.target.value)}
          />
        </div>

        {/* Schedule */}
        <div className="space-y-1.5">
          <Label htmlFor="schedule" className="flex items-center gap-1.5">
            {f.schedule.label} <HelpTooltip text={f.schedule.help} />
          </Label>
          <Input
            id="schedule"
            placeholder={f.schedule.placeholder}
            value={form.SNIPER_SCHEDULE}
            onChange={e => set('SNIPER_SCHEDULE', e.target.value)}
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
