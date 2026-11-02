
import { ReactNode } from "react";

interface GlassPanelProps {
  children: ReactNode;
  className?: string;
}

export default function GlassPanel({ children, className = "" }: GlassPanelProps) {
  return (
    <div
      className={`backdrop-blur-md bg-white/5 border border-white/10 rounded-xl p-4 shadow-lg ${className}`}
    >
      {children}
    </div>
  );
}
