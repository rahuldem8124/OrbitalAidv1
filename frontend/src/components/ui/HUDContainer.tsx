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
    <div className={`relative bg-[#05070A]/60 backdrop-blur-md border border-white/10 shadow-2xl ${cornerCut ? 'hud-panel' : 'rounded-md'} ${className}`}>
      {/* Subtle 1px Corner Brackets */}
      <div className="absolute top-0 left-0 w-2.5 h-2.5 border-t border-l border-white/20 pointer-events-none"></div>
      <div className="absolute top-0 right-0 w-2.5 h-2.5 border-t border-r border-white/20 pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-2.5 h-2.5 border-b border-l border-white/20 pointer-events-none"></div>
      <div className="absolute bottom-0 right-0 w-2.5 h-2.5 border-b border-r border-white/20 pointer-events-none"></div>
      
      {/* Subtle Scanline Overlay */}
      <div className="absolute inset-0 pointer-events-none scanline opacity-15"></div>

      {title && (
        <div className="absolute -top-2.5 left-4 bg-[#050505]/95 px-2 py-0.5 text-[9px] font-mono font-medium text-amber-400 tracking-widest uppercase z-10 border border-white/10 rounded-sm shadow-sm flex items-center gap-1.5">
          <span className="w-1 h-1 rounded-full bg-amber-400"></span>
          {title}
        </div>
      )}

      <div className="relative z-10 h-full">
        {children}
      </div>
    </div>
  );
}
