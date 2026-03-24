'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { TelegramForm } from '@/components/settings/telegram-form';
import { TradingModeForm } from '@/components/settings/trading-mode-form';
import { getSettingsByCategory, bulkUpdateSettings } from '@/lib/api';
import { toast } from '@/components/ui/use-toast';
import { useLang } from '@/lib/i18n';
import { Loader2, Save } from 'lucide-react';
import type { Setting } from '@/lib/types';

function SettingsTab({ category, settings }: { category: string; settings: Setting[] }) {
  const [form, setForm] = useState<Record<string, string>>(
    Object.fromEntries(settings.map(s => [s.key, s.value])),
  );
  const [saving, setSaving] = useState(false);
  const { t } = useLang();

  const save = async () => {
    setSaving(true);
    try {
      await bulkUpdateSettings(Object.entries(form).map(([key, value]) => ({ key, value })));
      toast({ title: t.common.save + ' ✓', variant: 'success' as any });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {settings.map(s => (
        <div key={s.key} className="space-y-1.5">
          <Label htmlFor={s.key} className="font-mono text-xs">{s.key}</Label>
          <Input
            id={s.key}
            value={form[s.key] ?? ''}
            onChange={e => setForm(f => ({ ...f, [s.key]: e.target.value }))}
            className="font-mono text-sm"
          />
          {s.description && <p className="text-xs text-muted-foreground">{s.description}</p>}
        </div>
      ))}
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
  return <SettingsTab category={category} settings={settings} />;
}

export default function SettingsPage() {
  const { t } = useLang();
  const s = t.settings;

  return (
    <MainLayout title={s.title}>
      <div className="mx-auto max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              {s.title}
              <HelpTooltip text={s.help} />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="trading_mode">
              <TabsList className="mb-6">
                <TabsTrigger value="trading_mode">{s.tradingMode}</TabsTrigger>
                <TabsTrigger value="copy_trade">{s.copyTrade}</TabsTrigger>
                <TabsTrigger value="market_maker">{s.marketMaker}</TabsTrigger>
                <TabsTrigger value="sniper">{s.sniper}</TabsTrigger>
                <TabsTrigger value="telegram">{s.telegram}</TabsTrigger>
                <TabsTrigger value="system">{s.system}</TabsTrigger>
              </TabsList>
              <TabsContent value="trading_mode"><TradingModeForm /></TabsContent>
              <TabsContent value="copy_trade"><CategoryTab category="copy_trade" /></TabsContent>
              <TabsContent value="market_maker"><CategoryTab category="market_maker" /></TabsContent>
              <TabsContent value="sniper"><CategoryTab category="sniper" /></TabsContent>
              <TabsContent value="telegram"><TelegramForm /></TabsContent>
              <TabsContent value="system"><CategoryTab category="system" /></TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
