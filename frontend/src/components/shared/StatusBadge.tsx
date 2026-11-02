"use client";

interface StatusBadgeProps {
  status: string;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const s = status.toLowerCase();

  let dotColor = 'bg-[var(--text-dim)]';
  let textColor = 'text-[var(--text-muted)]';
  let bgColor = 'bg-[var(--space-card)]';
  let borderColor = 'border-[var(--space-border-bright)]';

  if (['active', 'approved', 'resolved', 'executed'].includes(s)) {
    dotColor = 'bg-[var(--tier-nominal)]';
    textColor = 'text-emerald-400';
    bgColor = 'bg-emerald-950/30';
    borderColor = 'border-emerald-800';
  } else if (['pending', 'proposed', 'under_review'].includes(s)) {
    dotColor = 'bg-[var(--accent-amber)]';
    textColor = 'text-amber-400';
    bgColor = 'bg-amber-950/30';
    borderColor = 'border-amber-800';
  } else if (['rejected', 'expired', 'failed'].includes(s)) {
    dotColor = 'bg-[var(--tier-critical)]';
    textColor = 'text-red-400';
    bgColor = 'bg-red-950/30';
    borderColor = 'border-red-800';
  } else if (['verified'].includes(s)) {
    dotColor = 'bg-amber-400';
    textColor = 'text-amber-400';
    bgColor = 'bg-amber-950/30';
    borderColor = 'border-amber-800';
  }

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-sm border font-mono text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 ${bgColor} ${borderColor} ${textColor}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`}></span>
      {status}
    </span>
  );
}
