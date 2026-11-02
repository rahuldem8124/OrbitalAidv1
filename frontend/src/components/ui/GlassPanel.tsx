import { ReactNode } from "react";

interface GlassPanelProps {
  children: ReactNode;
  className?: string;
}

export default function GlassPanel({ children, className = "" }: GlassPanelProps) {
  return (
    <div className={`bg-[var(--space-panel)] border border-[var(--space-border)] rounded-md p-4 ${className}`}>
      {children}
    </div>
  );
}
