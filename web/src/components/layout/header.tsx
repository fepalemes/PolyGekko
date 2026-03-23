'use client';
import { useEffect, useState } from 'react';
import { getSocket } from '@/lib/socket';
import { useLang, type Lang } from '@/lib/i18n';
import { HelpTooltip } from '@/components/ui/help-tooltip';

export function Header({ title }: { title: string }) {
  const [connected, setConnected] = useState(false);
  const [time, setTime] = useState('');
  const { lang, setLang, t } = useLang();

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

  const toggleLang = () => setLang(lang === 'en' ? 'pt' : 'en');

  return (
    <div className="flex h-14 items-center justify-between border-b border-border px-6">
      <h1 className="text-base font-semibold text-foreground">{title}</h1>
      <div className="flex items-center gap-4">
        {/* Language switcher */}
        <button
          onClick={toggleLang}
          className="flex items-center gap-1.5 rounded border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
          title={lang === 'en' ? 'Mudar para Português' : 'Switch to English'}
        >
          <span className="text-base leading-none">{lang === 'en' ? '🇧🇷' : '🇺🇸'}</span>
          <span className="font-medium">{lang === 'en' ? 'PT' : 'EN'}</span>
        </button>

        {/* Connection status */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <div className={`h-2 w-2 rounded-full ${connected ? 'bg-green-500 shadow-[0_0_6px_#22c55e]' : 'bg-red-500'}`} />
          {connected ? t.common.connected : t.common.disconnected}
          <HelpTooltip text={t.header.connectedHelp} />
        </div>

        <span className="font-mono text-xs text-muted-foreground">{time}</span>
      </div>
    </div>
  );
}
