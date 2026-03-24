'use client';
import { useEffect, useState } from 'react';
import { getSocket } from '@/lib/socket';
import { useLang, type Lang } from '@/lib/i18n';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { Trash2, Loader2, Sun, Moon, Menu } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSettingsByCategory, updateSetting, getRealBalance, clearSimData, getStrategiesStatus } from '@/lib/api';
import { useTheme } from '@/hooks/use-theme';

export function Header({ title, onMenuClick }: { title: string; onMenuClick?: () => void }) {
  const [connected, setConnected] = useState(false);
  const [time, setTime] = useState('');
  const [clearing, setClearing] = useState(false);
  const { lang, setLang, t } = useLang();
  const { isDark, toggleTheme } = useTheme();
  const qc = useQueryClient();

  useEffect(() => {
    const socket = getSocket();
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    setConnected(socket.connected);

    const timer = setInterval(() => {
      setTime(new Date().toLocaleTimeString('pt-BR', { hour12: false }));
    }, 1000);

    return () => {
      clearInterval(timer);
      socket.off('connect');
      socket.off('disconnect');
    };
  }, []);

  const handleClearSimData = async () => {
    if (!confirm(t.common.clearSimDataConfirm)) return;
    setClearing(true);
    try {
      await clearSimData();
      qc.invalidateQueries();
    } finally {
      setClearing(false);
    }
  };

  const { data: settings = [] } = useQuery({
    queryKey: ['settings', 'system'],
    queryFn: () => getSettingsByCategory('system'),
  });

  const simModeSetting = settings.find(s => s.key === 'GLOBAL_SIMULATION_MODE');
  const isSimMode = simModeSetting ? simModeSetting.value === 'true' : true;

  const { mutate: toggleSimMode } = useMutation({
    mutationFn: (val: boolean) => updateSetting('GLOBAL_SIMULATION_MODE', val.toString()),
    onSuccess: () => {
      qc.invalidateQueries(); // refresh all data for the new mode
    }
  });

  const { data: realBalance } = useQuery({
    queryKey: ['balance', 'real'],
    queryFn: async () => {
      try {
        const { balance } = await getRealBalance();
        return balance;
      } catch {
        return 0;
      }
    },
    refetchInterval: 10000,
  });

  const { data: statuses = [] } = useQuery({
    queryKey: ['strategies'],
    queryFn: getStrategiesStatus,
    refetchInterval: 5000,
  });
  const anyRunning = statuses.some((s: any) => s.running);

  const toggleLang = () => setLang(lang === 'en' ? 'pt' : 'en');

  return (
    <div className="flex h-14 items-center justify-between border-b border-border px-4 md:px-6">
      <div className="flex items-center gap-3">
        {/* Hamburger — mobile only */}
        <button
          className="md:hidden text-muted-foreground hover:text-foreground transition-colors"
          onClick={onMenuClick}
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <h1 className="text-base font-semibold text-foreground">{title}</h1>
      </div>
      <div className="flex items-center gap-2 md:gap-4">
        {/* Simulation / Live Toggle & Clear button */}
        <div className="flex items-center gap-2 border-r border-border pr-4">
          {isSimMode && (
            <Button
              variant="ghost"
              size="sm"
              className="text-red-500 hover:text-red-600 hover:bg-red-500/10 h-7 text-xs px-2 cursor-pointer shadow-none"
              onClick={handleClearSimData}
              disabled={clearing}
              title={t.common.clearSimData}
            >
              {clearing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            </Button>
          )}
          <Label className="hidden sm:flex text-xs text-muted-foreground items-center gap-1.5 cursor-pointer">
            {t.header.simMode}
            <HelpTooltip text={anyRunning ? (lang === 'pt' ? 'Pare todas as estratégias para mudar de modo' : 'Stop all strategies to change mode') : t.header.simModeHelp} />
          </Label>
          <Switch checked={isSimMode} onCheckedChange={toggleSimMode} disabled={anyRunning || clearing} />
          {isSimMode ? (
            <span className="text-xs font-semibold text-yellow-500 bg-yellow-500/10 px-1.5 py-0.5 rounded uppercase">{t.common.dryRun}</span>
          ) : (
            <span className="text-xs font-semibold text-green-500 bg-green-500/10 px-1.5 py-0.5 rounded uppercase">{t.common.live}</span>
          )}
        </div>

        {/* Real Balance display */}
        {!isSimMode && realBalance !== undefined && (
          <div className="flex items-center gap-1.5 text-xs font-medium text-foreground border-r border-border pr-4 leading-none">
             Polymarket: <span className="text-green-500">${realBalance.toFixed(2)}</span>
          </div>
        )}

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="flex items-center justify-center rounded border border-border p-1.5 text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
        </button>

        {/* Language switcher */}
        <button
          onClick={toggleLang}
          className="flex items-center gap-1.5 rounded border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
          title={lang === 'en' ? 'Mudar para Português' : 'Switch to English'}
        >
          <span className="text-base leading-none">{lang === 'en' ? '🇧🇷' : '🇺🇸'}</span>
          <span className="font-medium">{lang === 'en' ? 'PT' : 'EN'}</span>
        </button>

        {/* Connection status — hidden on mobile */}
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
          <div className={`h-2 w-2 rounded-full ${connected ? 'bg-green-500 shadow-[0_0_6px_#22c55e]' : 'bg-red-500'}`} />
          <span className="hidden md:inline">{connected ? t.common.connected : t.common.disconnected}</span>
          <HelpTooltip text={t.header.connectedHelp} />
        </div>

        <span className="hidden sm:inline font-mono text-xs text-muted-foreground">{time}</span>
      </div>
    </div>
  );
}
