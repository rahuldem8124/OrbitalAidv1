"use client";

import { ReactNode } from "react";

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
    default: 'border-[var(--space-border-bright)]/30',
    critical: 'border-[var(--tier-critical)] bg-[var(--tier-critical)]/5',
    warning: 'border-[var(--tier-watch)] bg-[var(--tier-watch)]/5',
    success: 'border-[var(--tier-nominal)] bg-[var(--tier-nominal)]/5',
  }[variant];

  const iconColor = {
    default: 'text-[var(--accent-cyan)]',
    critical: 'text-[var(--tier-critical)]',
    warning: 'text-[var(--tier-watch)]',
    success: 'text-[var(--tier-nominal)]',
  }[variant];

  return (
    <div className={`relative bg-[var(--space-card)] border ${borderClass} px-3 py-2 flex flex-col justify-between overflow-hidden group`}>
      {/* Corner Brackets */}
      <div className={`absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-[var(--text-muted)] opacity-50`}></div>
      <div className={`absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-[var(--text-muted)] opacity-50`}></div>
      <div className={`absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-[var(--text-muted)] opacity-50`}></div>
      <div className={`absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-[var(--text-muted)] opacity-50`}></div>
      
      {/* Scanline Background */}
      <div className="absolute inset-0 scanline opacity-20 group-hover:opacity-40 transition-opacity pointer-events-none"></div>
      
      <div className="flex justify-between items-start relative z-10 mb-2">
        <span className={`text-[9px] font-mono font-bold uppercase tracking-widest ${variant !== 'default' ? iconColor : 'text-[var(--text-muted)]'}`}>
          {label}
        </span>
        {icon && <div className={`${iconColor} opacity-70 group-hover:animate-pulse`}>{icon}</div>}
      </div>
      <div className="flex items-baseline gap-2 relative z-10">
        <span className={`text-xl font-bold font-mono tracking-tighter ${variant === 'critical' ? 'text-[var(--tier-critical)]' : 'text-[var(--text-primary)]'}`}>
          {value}
        </span>
        {trend && (
          <span className={`flex items-center text-[10px] font-mono ${
            trend === 'up' ? 'text-[var(--tier-critical)]' : trend === 'down' ? 'text-[var(--tier-nominal)]' : 'text-[var(--text-muted)]'
          }`}>
            {trend === 'up' ? '▲' : trend === 'down' ? '▼' : '—'}
          </span>
        )}
      </div>
      {subValue && <span className="text-[9px] font-mono text-[var(--text-dim)] relative z-10">{subValue}</span>}
    </div>
  );
}
