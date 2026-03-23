'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Briefcase, ArrowLeftRight, Terminal,
  Settings, Copy, BarChart2, Crosshair, TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLang } from '@/lib/i18n';

export function Sidebar() {
  const pathname = usePathname();
  const { t } = useLang();

  const navItems = [
    { href: '/dashboard', label: t.nav.dashboard, icon: LayoutDashboard },
    { href: '/positions', label: t.nav.positions, icon: Briefcase },
    { href: '/trades', label: t.nav.trades, icon: ArrowLeftRight },
    { href: '/logs', label: t.nav.logs, icon: Terminal },
  ];

  const strategyItems = [
    { href: '/strategies/copy-trade', label: t.strategies.copyTrade.label, icon: Copy, color: 'text-blue-400' },
    { href: '/strategies/market-maker', label: t.strategies.marketMaker.label, icon: BarChart2, color: 'text-purple-400' },
    { href: '/strategies/sniper', label: t.strategies.sniper.label, icon: Crosshair, color: 'text-orange-400' },
  ];

  return (
    <div className="flex h-screen w-56 flex-col border-r border-border bg-card">
      <div className="flex h-14 items-center gap-2 border-b border-border px-4">
        <TrendingUp className="h-5 w-5 text-primary" />
        <span className="font-bold tracking-wider text-foreground">PolyGekko</span>
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-2">
        <div className="mb-2">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
                pathname === href || pathname.startsWith(href + '/')
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          ))}
        </div>

        <div className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
          {t.nav.strategies}
        </div>
        {strategyItems.map(({ href, label, icon: Icon, color }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
              pathname === href
                ? 'bg-secondary text-foreground'
                : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
            )}
          >
            <Icon className={cn('h-4 w-4 shrink-0', pathname === href && color)} />
            {label}
          </Link>
        ))}

        <div className="mt-auto">
          <Link
            href="/settings"
            className={cn(
              'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
              pathname === '/settings'
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
            )}
          >
            <Settings className="h-4 w-4" />
            {t.nav.settings}
          </Link>
        </div>
      </nav>
    </div>
  );
}
