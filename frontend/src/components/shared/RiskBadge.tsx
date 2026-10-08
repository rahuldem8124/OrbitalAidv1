"use client";

import { RiskTier } from "@/lib/types";

interface RiskBadgeProps {
  tier: RiskTier | null;
  size?: 'sm' | 'md' | 'lg';
}

export default function RiskBadge({ tier, size = 'md' }: RiskBadgeProps) {
  if (!tier) {
    return (
      <span className="inline-flex items-center gap-1 rounded-sm border border-[var(--space-border-bright)] bg-[var(--space-card)] px-2 py-0.5 text-[10px] font-mono font-medium text-[var(--text-muted)] uppercase tracking-wider">
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-dim)]"></span>
        UNASSESSED
      </span>
    );
  }

  const config = {
    critical: {
      dot: 'bg-[var(--tier-critical)]',
      text: 'text-red-400',
      bg: 'bg-red-950/40',
      border: 'border-red-800',
      label: 'CRITICAL',
    },
    high: {
      dot: 'bg-[var(--tier-high)]',
      text: 'text-orange-400',
      bg: 'bg-orange-950/40',
      border: 'border-orange-800',
      label: 'HIGH',
    },
    watch: {
      dot: 'bg-[var(--tier-watch)]',
      text: 'text-yellow-400',
      bg: 'bg-yellow-950/40',
      border: 'border-yellow-800',
      label: 'WATCH',
    },
    low: {
      dot: 'bg-[var(--tier-nominal)]',
      text: 'text-emerald-400',
      bg: 'bg-emerald-950/40',
      border: 'border-emerald-800',
      label: 'LOW',
    },
  }[tier];

  const sizeClasses = {
    sm: 'text-[9px] py-0 px-1.5 gap-1',
    md: 'text-[10px] py-0.5 px-2 gap-1.5',
    lg: 'text-xs py-1 px-2.5 gap-1.5',
  }[size];

  const dotSize = size === 'sm' ? 'w-1 h-1' : 'w-1.5 h-1.5';

  return (
    <span className={`inline-flex items-center rounded-sm border font-mono font-medium uppercase tracking-wider ${config.bg} ${config.border} ${config.text} ${sizeClasses}`}>
      <span className={`${dotSize} rounded-full ${config.dot}`}></span>
      {config.label}
    </span>
  );
}
