"use client";

import { ReactNode } from "react";

interface HUDContainerProps {
  children: ReactNode;
  className?: string;
  title?: string;
  cornerCut?: boolean;
}

export default function HUDContainer({ children, className = "", title, cornerCut = true }: HUDContainerProps) {
  return (
    <div className={`relative bg-[#030407]/80 backdrop-blur-md border border-[var(--space-border-bright)]/30 ${cornerCut ? 'hud-panel' : ''} ${className}`}>
      {/* Corner Brackets */}
      <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-[var(--text-muted)] opacity-70"></div>
      <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-[var(--text-muted)] opacity-70"></div>
      <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-[var(--text-muted)] opacity-70"></div>
      <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-[var(--text-muted)] opacity-70"></div>
      
      {/* Crosshairs */}
      <div className="absolute top-1/2 -left-1 w-2 h-[1px] bg-[var(--text-muted)] opacity-30"></div>
      <div className="absolute top-1/2 -right-1 w-2 h-[1px] bg-[var(--text-muted)] opacity-30"></div>
      
      {/* Scanline Overlay */}
      <div className="absolute inset-0 pointer-events-none scanline opacity-30"></div>

      {title && (
        <div className="absolute -top-2.5 left-4 bg-[#030407] px-2 text-[9px] font-mono font-bold text-[var(--accent-cyan)] tracking-widest uppercase z-10 border-x border-[var(--space-border-bright)]/30">
          {title}
        </div>
      )}

      <div className="relative z-10 h-full">
        {children}
      </div>
    </div>
  );
}
