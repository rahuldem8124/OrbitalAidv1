"use client";

import { ReactNode } from "react";
import { ArrowDownIcon, ArrowUpIcon, MinusIcon } from "lucide-react";

interface MetricCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  icon?: ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  variant?: 'default' | 'critical' | 'warning' | 'success';
}

export default function MetricCard({ label, value, subValue, icon, trend, variant = 'default' }: MetricCardProps) {
  const borderClass = {
    default: 'border-[var(--space-border)]',
    critical: 'border-[var(--tier-critical)]/40',
    warning: 'border-[var(--tier-watch)]/40',
    success: 'border-[var(--tier-nominal)]/40',
  }[variant];

  const iconColor = {
    default: 'text-[var(--text-muted)]',
    critical: 'text-[var(--tier-critical)]',
    warning: 'text-[var(--tier-watch)]',
    success: 'text-[var(--tier-nominal)]',
  }[variant];

  return (
    <div className={`bg-[var(--space-card)] border ${borderClass} rounded-md px-4 py-3 flex flex-col gap-1.5`}>
      <div className="flex justify-between items-center">
        <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-widest">{label}</span>
        {icon && <div className={`${iconColor} opacity-70`}>{icon}</div>}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-xl font-bold text-[var(--text-primary)] font-mono-data tracking-tight">{value}</span>
        {trend && (
          <span className={`flex items-center text-[10px] font-medium ${
            trend === 'up' ? 'text-[var(--tier-critical)]' : trend === 'down' ? 'text-[var(--tier-nominal)]' : 'text-[var(--text-muted)]'
          }`}>
            {trend === 'up' ? <ArrowUpIcon className="w-3 h-3" /> : trend === 'down' ? <ArrowDownIcon className="w-3 h-3" /> : <MinusIcon className="w-3 h-3" />}
          </span>
        )}
      </div>
      {subValue && <span className="text-[10px] text-[var(--text-dim)]">{subValue}</span>}
    </div>
  );
}
