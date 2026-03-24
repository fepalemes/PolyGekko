'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard, Briefcase, ArrowLeftRight, Terminal,
  Settings, Copy, BarChart2, Crosshair, Zap, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLang } from '@/lib/i18n';
import { getStrategiesStatus } from '@/lib/api';

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { t } = useLang();

  // Close sidebar on navigation (mobile)
  useEffect(() => { onClose?.(); }, [pathname]);

  const { data: statuses = [] } = useQuery({
    queryKey: ['strategies'],
    queryFn: getStrategiesStatus,
    refetchInterval: 5000,
  });

  const runningMap = Object.fromEntries(statuses.map(s => [s.type, s.running]));

  const navItems = [
    { href: '/dashboard', label: t.nav.dashboard, icon: LayoutDashboard },
    { href: '/positions', label: t.nav.positions, icon: Briefcase },
    { href: '/trades', label: t.nav.trades, icon: ArrowLeftRight },
    { href: '/logs', label: t.nav.logs, icon: Terminal },
  ];

  const strategyItems = [
    { href: '/strategies/copy-trade', label: t.strategies.copyTrade.label, icon: Copy, color: 'text-blue-400', key: 'COPY_TRADE' },
    { href: '/strategies/market-maker', label: t.strategies.marketMaker.label, icon: BarChart2, color: 'text-purple-400', key: 'MARKET_MAKER' },
    { href: '/strategies/sniper', label: t.strategies.sniper.label, icon: Crosshair, color: 'text-orange-400', key: 'SNIPER' },
  ];

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar panel */}
      <div className={cn(
        'fixed inset-y-0 left-0 z-50 flex h-screen w-56 flex-col border-r border-border bg-card transition-transform duration-200 ease-in-out',
        'md:static md:translate-x-0 md:z-auto md:transition-none',
        open ? 'translate-x-0' : '-translate-x-full',
      )}>
        {/* Logo */}
        <div className="flex h-14 items-center justify-between border-b border-border px-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/15 ring-1 ring-primary/30">
              <Zap className="h-4 w-4 text-primary" />
            </div>
            <span className="font-bold tracking-wider text-foreground">PolyGekko</span>
          </div>
          <button
            className="md:hidden text-muted-foreground hover:text-foreground transition-colors"
            onClick={onClose}
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-2">
          <div className="mb-2">
            {navItems.map(({ href, label, icon: Icon }) => {
              const active = isActive(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-all duration-150',
                    active
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                  )}
                >
                  <Icon className={cn('h-4 w-4 shrink-0', active && 'text-primary')} />
                  {label}
                </Link>
              );
            })}
          </div>

          <div className="section-label mb-1 px-3">{t.nav.strategies}</div>

          {strategyItems.map(({ href, label, icon: Icon, color, key }) => {
            const active = pathname === href;
            const running = runningMap[key];
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-all duration-150',
                  active
                    ? 'bg-secondary text-foreground font-medium'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                )}
              >
                <Icon className={cn('h-4 w-4 shrink-0', active ? color : '')} />
                <span className="flex-1">{label}</span>
                {running && (
                  <span className="h-1.5 w-1.5 rounded-full bg-green-400 pulse-ring" />
                )}
              </Link>
            );
          })}

          <div className="mt-auto">
            <Link
              href="/settings"
              className={cn(
                'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-all duration-150',
                pathname === '/settings'
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
              )}
            >
              <Settings className={cn('h-4 w-4', pathname === '/settings' && 'text-primary')} />
              {t.nav.settings}
            </Link>
          </div>
        </nav>
      </div>
    </>
  );
}
