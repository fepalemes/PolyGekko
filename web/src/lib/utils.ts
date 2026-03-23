import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatUSD(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(num);
}

export function formatNumber(value: string | number, decimals = 2): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return num.toFixed(decimals);
}

export function formatPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

export function truncate(str: string, maxLen = 40): string {
  return str.length > maxLen ? str.slice(0, maxLen) + '...' : str;
}

export function strategyLabel(type: string): string {
  switch (type) {
    case 'COPY_TRADE': return 'Copy Trade';
    case 'MARKET_MAKER': return 'Market Maker';
    case 'SNIPER': return 'Sniper';
    default: return type;
  }
}

export function strategyColor(type: string): string {
  switch (type) {
    case 'COPY_TRADE': return 'text-blue-400';
    case 'MARKET_MAKER': return 'text-purple-400';
    case 'SNIPER': return 'text-orange-400';
    default: return 'text-gray-400';
  }
}
