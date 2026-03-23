'use client';
import { HelpCircle } from 'lucide-react';

export function HelpTooltip({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex shrink-0 cursor-help align-middle">
      <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/50 transition-colors group-hover:text-muted-foreground" />
      <span
        className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-72 -translate-x-1/2 rounded-lg border border-border bg-popover px-3 py-2.5 text-xs leading-relaxed text-popover-foreground shadow-xl opacity-0 transition-opacity duration-150 group-hover:opacity-100"
        style={{ minWidth: '220px', maxWidth: '320px' }}
      >
        {text}
        <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-border" />
      </span>
    </span>
  );
}

export function FieldLabel({ label, help }: { label: string; help?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {label}
      {help && <HelpTooltip text={help} />}
    </span>
  );
}
