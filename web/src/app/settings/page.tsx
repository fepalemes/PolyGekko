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
import { getSettingsByCategory, bulkUpdateSettings, exportSettings, importSettings, getSettingsHistory } from '@/lib/api';
import { toast } from '@/components/ui/use-toast';
import { useLang } from '@/lib/i18n';
import { Loader2, Save, Download, Upload } from 'lucide-react';
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

function HistoryTab() {
  const { t } = useLang();
  const { data: history = [], isLoading } = useQuery({
    queryKey: ['settings-history'],
    queryFn: () => getSettingsHistory(200),
    refetchInterval: 30000,
  });

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
                  <td className="px-3 py-2 font-mono text-foreground">{h.key}</td>
                  <td className="px-3 py-2 font-mono text-muted-foreground max-w-[180px] truncate">{h.oldValue ?? <em className="opacity-50">–</em>}</td>
                  <td className="px-3 py-2 font-mono text-foreground max-w-[180px] truncate">{h.newValue}</td>
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

function BackupImportPanel() {
  const { t } = useLang();
  const [importing, setImporting] = useState(false);

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
      toast({ title: 'Settings exported ✓', variant: 'success' as any });
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
      const parsed = JSON.parse(text);
      const settingsObj = parsed.settings ?? parsed;
      if (typeof settingsObj !== 'object' || Array.isArray(settingsObj)) {
        throw new Error('Invalid format — expected { settings: { KEY: VALUE } }');
      }
      const result = await importSettings(settingsObj);
      toast({ title: `Settings imported ✓ (${result.imported} applied${result.skipped > 0 ? `, ${result.skipped} skipped` : ''})`, variant: 'success' as any });
    } catch (err: any) {
      toast({ title: 'Import failed', description: err.message, variant: 'destructive' });
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Button variant="outline" size="sm" onClick={handleExport}>
        <Download className="mr-2 h-4 w-4" />
        {t.settings.exportSettings}
      </Button>
      <Button variant="outline" size="sm" disabled={importing} asChild>
        <label className="cursor-pointer">
          {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
          {t.settings.importSettings}
          <input type="file" accept=".json" className="hidden" onChange={handleImport} />
        </label>
      </Button>
    </div>
  );
}

export default function SettingsPage() {
  const { t } = useLang();
  const s = t.settings;

  return (
    <MainLayout title={s.title}>
      <div className="mx-auto max-w-3xl">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                {s.title}
                <HelpTooltip text={s.help} />
              </CardTitle>
              <BackupImportPanel />
            </div>
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
