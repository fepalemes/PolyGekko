'use client';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { getSettingsByCategory, bulkUpdateSettings, testTelegram } from '@/lib/api';
import { toast } from '@/components/ui/use-toast';
import { useLang } from '@/lib/i18n';
import { Loader2, Save, Send } from 'lucide-react';

export function TelegramForm() {
  const { t } = useLang();
  const tg = t.telegram;
  const qc = useQueryClient();

  const { data: settings = [], isLoading } = useQuery({
    queryKey: ['settings', 'telegram'],
    queryFn: () => getSettingsByCategory('telegram'),
  });

  const [form, setForm] = useState<Record<string, string>>({});
  const [initialized, setInitialized] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  if (!initialized && settings.length > 0) {
    setForm(Object.fromEntries(settings.map(s => [s.key, s.value])));
    setInitialized(true);
  }

  const enabled = form['TELEGRAM_ENABLED'] === 'true';

  const save = async () => {
    setSaving(true);
    try {
      await bulkUpdateSettings(Object.entries(form).map(([key, value]) => ({ key, value })));
      qc.invalidateQueries({ queryKey: ['settings', 'telegram'] });
      toast({ title: t.common.save + ' ✓', variant: 'success' as any });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    setTesting(true);
    try {
      await testTelegram();
      toast({ title: tg.testSuccess, variant: 'success' as any });
    } catch {
      toast({ title: tg.testFail, variant: 'destructive' });
    } finally {
      setTesting(false);
    }
  };

  if (isLoading) return <p className="text-sm text-muted-foreground">{t.common.loading}</p>;

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">{tg.description}</p>

      {/* Enable toggle */}
      <div className="flex items-center justify-between rounded-lg border p-4">
        <div className="space-y-0.5">
          <Label className="text-sm font-medium">{tg.enabled}</Label>
          <p className="text-xs text-muted-foreground">{tg.enabledHelp}</p>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={v => setForm(f => ({ ...f, TELEGRAM_ENABLED: v ? 'true' : 'false' }))}
        />
      </div>

      {/* Bot Token */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5">
          <Label htmlFor="TELEGRAM_BOT_TOKEN" className="text-sm font-medium">{tg.botToken}</Label>
          <HelpTooltip text={tg.botTokenHelp} />
        </div>
        <Input
          id="TELEGRAM_BOT_TOKEN"
          type="password"
          placeholder="123456789:AAFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
          value={form['TELEGRAM_BOT_TOKEN'] ?? ''}
          onChange={e => setForm(f => ({ ...f, TELEGRAM_BOT_TOKEN: e.target.value }))}
          className="font-mono text-sm"
        />
      </div>

      {/* Chat ID */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5">
          <Label htmlFor="TELEGRAM_CHAT_ID" className="text-sm font-medium">{tg.chatId}</Label>
          <HelpTooltip text={tg.chatIdHelp} />
        </div>
        <Input
          id="TELEGRAM_CHAT_ID"
          placeholder="-100123456789"
          value={form['TELEGRAM_CHAT_ID'] ?? ''}
          onChange={e => setForm(f => ({ ...f, TELEGRAM_CHAT_ID: e.target.value }))}
          className="font-mono text-sm"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          {t.common.save}
        </Button>
        <Button variant="outline" onClick={test} disabled={testing}>
          {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
          {tg.testBtn}
        </Button>
      </div>
    </div>
  );
}
