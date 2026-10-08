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
  const valueColor = {
    default: 'text-white',
    critical: 'text-red-400',
    warning: 'text-amber-400',
    success: 'text-emerald-400',
  }[variant];

  const borderClass = {
    default: 'border-white/10 hover:border-white/20',
    critical: 'border-red-500/40 bg-red-950/20',
    warning: 'border-amber-500/40 bg-amber-950/20',
    success: 'border-emerald-500/30 bg-emerald-950/10',
  }[variant];

  return (
    <div className={`relative bg-[#05070A]/60 backdrop-blur-md border ${borderClass} px-3 py-2 flex flex-col justify-between rounded shadow-lg transition-all group overflow-hidden`}>
      {/* Subtle 1px Corner Accents */}
      <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-white/20 pointer-events-none"></div>
      <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-white/20 pointer-events-none"></div>
      
      {/* Subtle Scanline Overlay */}
      <div className="absolute inset-0 scanline opacity-10 pointer-events-none"></div>
      
      <div className="flex justify-between items-center relative z-10 mb-1">
        <span className="text-[9px] font-sans font-medium uppercase tracking-wider text-zinc-400">
          {label}
        </span>
        {icon && <div className="text-zinc-500 group-hover:text-cyan-400 transition-colors">{icon}</div>}
      </div>
      
      <div className="flex items-baseline justify-between gap-2 relative z-10">
        <span className={`text-lg md:text-xl font-bold font-mono tracking-tight ${valueColor}`}>
          {value}
        </span>
        {trend && (
          <span className={`flex items-center text-[9px] font-mono ${
            trend === 'up' ? 'text-red-400' : trend === 'down' ? 'text-emerald-400' : 'text-zinc-500'
          }`}>
            {trend === 'up' ? '▲' : trend === 'down' ? '▼' : '—'}
          </span>
        )}
      </div>
      
      {subValue && <span className="text-[9px] font-mono text-zinc-500 relative z-10 mt-0.5">{subValue}</span>}
    </div>
  );
}
