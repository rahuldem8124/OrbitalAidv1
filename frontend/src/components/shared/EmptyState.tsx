"use client";

import { ReactNode } from "react";
import { CheckCircle2 } from "lucide-react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center border border-dashed border-[var(--space-border-bright)] rounded-sm bg-[var(--space-canvas)] w-full h-full">
      <div className="mb-3 text-[var(--tier-nominal)] opacity-80">
        {icon || <CheckCircle2 className="w-8 h-8" />}
      </div>
      <h3 className="text-sm font-mono font-semibold tracking-wider uppercase text-[var(--text-primary)] mb-1">{title}</h3>
      {description && <p className="text-[11px] font-mono text-[var(--text-muted)] max-w-sm mb-4">{description}</p>}
      {action && <div>{action}</div>}
    </div>
  );
}
