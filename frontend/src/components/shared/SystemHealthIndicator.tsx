"use client";

interface SystemHealthIndicatorProps {
  status: 'online' | 'offline' | 'degraded';
  label?: string;
}

export default function SystemHealthIndicator({ status, label }: SystemHealthIndicatorProps) {
  const config = {
    online: { dot: 'bg-[var(--tier-nominal)]', ring: 'ring-[var(--tier-nominal)]/20', text: 'text-emerald-400' },
    degraded: { dot: 'bg-[var(--tier-watch)]', ring: 'ring-[var(--tier-watch)]/20', text: 'text-amber-400' },
    offline: { dot: 'bg-[var(--tier-critical)]', ring: 'ring-[var(--tier-critical)]/20', text: 'text-red-400' },
  }[status];

  return (
    <div className="flex items-center gap-2" title={`Status: ${status}`}>
      <span className={`relative flex h-2 w-2`}>
        {status === 'online' && (
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${config.dot} opacity-40`}></span>
        )}
        <span className={`relative inline-flex rounded-full h-2 w-2 ${config.dot}`}></span>
      </span>
      {label && <span className={`text-[10px] font-mono font-semibold uppercase tracking-wider ${config.text}`}>{label}</span>}
    </div>
  );
}
